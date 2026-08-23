import { useState } from 'react'
import { codeFromName, makeId } from '../domain/id'
import { deleteRelationsCascade } from '../domain/commands'
import type { Selection } from '../domain/types'
import { nextFreePosition } from '../map/core/layout'
import { useDocumentStore } from './document-store'

export function LeftRail({ activeFlowId, onActiveFlow, activeFloorId, onActiveFloor, editable, onCollapse }: { activeFlowId: string | null; onActiveFlow: (id: string | null) => void; activeFloorId: string; onActiveFloor: (id: string) => void; editable: boolean; onCollapse?: () => void }) {
  void onActiveFloor
  const { document, selection, setSelection, commit } = useDocumentStore()
  const [tabChoice, setTabChoice] = useState<{ tab: 'scenarios' | 'relations' | 'concepts'; selection: Selection | null }>({ tab: 'concepts', selection })
  const selectionTab = selection?.kind === 'flow' ? 'scenarios' : selection?.kind === 'relation' ? 'relations' : selection?.kind === 'node' || selection?.kind === 'group' ? 'concepts' : null
  const activeTab = tabChoice.selection === selection ? tabChoice.tab : selectionTab ?? tabChoice.tab

  const addGroup = () => {
    const id = makeId('group')
    commit((current) => ({ ...current, groups: [...current.groups, { id, name: 'New neighborhood', description: 'Describe what belongs here.' }] }))
    setSelection({ kind: 'group', id })
  }

  const addNode = (groupId: string) => {
    const id = makeId('node')
    const name = 'New concept'
    const code = codeFromName(name, new Set(document.nodes.map((node) => node.code)))
    const position = nextFreePosition(document.nodes.filter((node) => node.floorId === activeFloorId), groupId)
    commit((current) => ({ ...current, nodes: [...current.nodes, { id, code, name, groupId, floorId: activeFloorId, whatItDoes: 'Explain what this concept changes or makes possible.', howItsBuilt: 'Explain the decision that shapes it.', size: 'm', properties: [], position, faceTexture: 'auto' }] }))
    setSelection({ kind: 'node', id })
  }

  const addFlow = () => {
    const id = makeId('flow')
    commit((current) => ({ ...current, flows: [...current.flows, { id, name: 'New scenario', payload: 'payload', summary: 'Explain what this journey accomplishes.', stages: [] }] }))
    setSelection({ kind: 'flow', id })
    onActiveFlow(id)
  }

  const select = (next: Selection) => {
    setSelection(next)
    if (next.kind !== 'flow') onActiveFlow(null)
  }

  const deleteRelation = (id: string) => {
    commit((current) => deleteRelationsCascade(current, new Set([id])))
    if (selection?.kind === 'relation' && selection.id === id) setSelection(null)
    onActiveFlow(null)
  }
  const visibleNodeIds = new Set(document.nodes.filter((node) => node.floorId === activeFloorId).map((node) => node.id))
  const visibleRelations = document.relations.filter((relation) => visibleNodeIds.has(relation.from) || visibleNodeIds.has(relation.to))

  return (
    <aside className="left-rail">
      <div className="rail-tabs-wrap">
        <div className="rail-tabs" role="tablist" aria-label="Map content">
          {(['concepts', 'relations', 'scenarios'] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'is-active' : ''} onClick={() => setTabChoice({ tab, selection })}>{tab}</button>)}
        </div>
        {onCollapse ? <button type="button" className="rail-collapse-button" aria-label="Hide left rail" title="Hide left rail [" onClick={onCollapse}><span aria-hidden="true">‹</span></button> : null}
      </div>
      {activeTab === 'scenarios' ? <section className="rail-section rail-flows" role="tabpanel">
        <div className="rail-heading"><span>Scenarios</span>{editable ? <button type="button" onClick={addFlow} aria-label="Add scenario">+</button> : null}</div>
        <div className="flow-list">
          {document.flows.map((flow, index) => (
            <button key={flow.id} type="button" className={`flow-row ${activeFlowId === flow.id ? 'is-active' : ''}`} onClick={() => { const next = activeFlowId === flow.id ? null : flow.id; onActiveFlow(next); setSelection(next ? { kind: 'flow', id: flow.id } : null) }}>
              <span className="flow-index">{String(index + 1).padStart(2, '0')}</span><span className="flow-name">{flow.name}</span><span className="flow-payload">{flow.payload}</span>
            </button>
          ))}
          {document.flows.length === 0 ? <p className="rail-empty">No scenario yet.</p> : null}
        </div>
      </section> : null}
      {activeTab === 'relations' ? <section className="rail-section rail-relations" role="tabpanel">
        <div className="rail-heading"><span>Relations</span><span>{visibleRelations.length}</span></div>
        <div className="relation-list">
          {visibleRelations.map((relation) => {
            const from = document.nodes.find((node) => node.id === relation.from)
            const to = document.nodes.find((node) => node.id === relation.to)
            return <div className={`relation-row ${selection?.kind === 'relation' && selection.id === relation.id ? 'is-active' : ''}`} key={relation.id}><button type="button" onClick={() => select({ kind: 'relation', id: relation.id })}><span>{from?.code ?? '?'}</span><strong>{relation.label}</strong><span>{to?.code ?? '?'}</span></button>{editable ? <button type="button" className="relation-row-delete" aria-label={`Delete ${relation.label}`} onClick={() => deleteRelation(relation.id)}>×</button> : null}</div>
          })}
          {visibleRelations.length === 0 ? <p className="rail-empty">No relation on this floor.</p> : null}
        </div>
      </section> : null}
      {activeTab === 'concepts' ? <div className="rail-neighborhoods" role="tabpanel">
        {(() => {
          const nodesOnFloor = document.nodes.filter((n) => n.floorId === activeFloorId)
          const groupsWithNodes = document.groups.filter((g) => nodesOnFloor.some((n) => n.groupId === g.id))
          const totalOnFloor = nodesOnFloor.length
          const displayGroups = totalOnFloor === 0 ? document.groups : groupsWithNodes
          if (document.groups.length === 0) return <section className="rail-section"><p className="rail-empty">No neighborhoods yet. Create one to add your first concept.</p></section>
          if (displayGroups.length === 0) return <section className="rail-section"><p className="rail-empty">No concepts on this floor.</p></section>
          return (
            <>
              {displayGroups.map((group) => {
                const nodesOnFloorForGroup = nodesOnFloor.filter((n) => n.groupId === group.id)
                return (
                  <section className="rail-section" key={group.id}>
                    <button type="button" className={`group-heading ${selection?.kind === 'group' && selection.id === group.id ? 'is-active' : ''}`} onClick={() => select({ kind: 'group', id: group.id })}><span>{group.name}</span><span>{nodesOnFloorForGroup.length}</span></button>
                    <div className="node-list">
                      {nodesOnFloorForGroup.map((node) => (
                        <button key={node.id} id={`rail-node-${node.id}`} type="button" className={`node-row ${selection?.kind === 'node' && selection.id === node.id ? 'is-active' : ''}`} onClick={() => select({ kind: 'node', id: node.id })}><span className="node-code">{node.code}</span><span>{node.name}</span><span className="node-size">{node.size.toUpperCase()}</span></button>
                      ))}
                      {editable ? <button type="button" className="add-row" onClick={() => addNode(group.id)}>+ Add concept</button> : null}
                    </div>
                  </section>
                )
              })}
              {editable && totalOnFloor > 0 && document.groups.length > displayGroups.length ? (
                <section className="rail-section" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <p className="rail-empty" style={{ fontSize: '10px', marginBottom: 6 }}>Add to another neighborhood</p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select
                      aria-label="Neighborhood for new concept"
                      defaultValue={document.groups.find((g) => !groupsWithNodes.some((h) => h.id === g.id))?.id ?? document.groups[0]?.id}
                      id="add-concept-group-select"
                      style={{ flex: 1, minWidth: 0, padding: '6px 8px', border: 0, borderRadius: 8, background: 'var(--surface-soft)', fontSize: 11 }}
                    >
                      {document.groups.filter((g) => !groupsWithNodes.some((h) => h.id === g.id)).map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="add-row"
                      style={{ flex: '0 0 auto', padding: '6px 10px', background: 'var(--surface-soft)', borderRadius: 8 }}
                      onClick={() => {
                        const sel = (typeof window !== 'undefined' ? window.document.getElementById('add-concept-group-select') : null) as HTMLSelectElement | null
                        const groupId = sel?.value ?? document.groups.find((g) => !groupsWithNodes.some((h) => h.id === g.id))?.id ?? document.groups[0]?.id
                        if (groupId) addNode(groupId)
                      }}
                    >
                      + Add
                    </button>
                  </div>
                </section>
              ) : null}
            </>
          )
        })()}
        {editable ? <button type="button" className="add-group" onClick={addGroup}>+ New neighborhood</button> : null}
      </div> : null}
    </aside>
  )
}
