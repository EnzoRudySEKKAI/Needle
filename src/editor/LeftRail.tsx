import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { codeFromName, makeId } from '../domain/id'
import { deleteRelationsCascade } from '../domain/commands'
import type { RelationKind, Selection } from '../domain/types'
import { nextFreePosition } from '../map/core/layout'
import { useDocumentStore } from './document-store'

type RailTab = 'concepts' | 'relations' | 'scenarios'
type RelationScope = 'floor' | 'all' | 'cross-floor'

type LeftRailProps = {
  activeFlowId: string | null
  onActiveFlow: (id: string | null) => void
  activeFloorId: string
  onActiveFloor: (id: string) => void
  editable: boolean
  onCollapse?: () => void
  onStartConnection?: (sourceId: string) => void
}

const tabs: RailTab[] = ['concepts', 'relations', 'scenarios']
const relationKinds: Array<'all' | RelationKind> = ['all', 'flow', 'data', 'support', 'retry']

export function LeftRail({ activeFlowId, onActiveFlow, activeFloorId, onActiveFloor, editable, onCollapse, onStartConnection }: LeftRailProps) {
  void onActiveFloor
  const { document, selection, setSelection, commit } = useDocumentStore()
  const [activeTab, setActiveTab] = useState<RailTab>('concepts')
  const [search, setSearch] = useState('')
  const [relationScope, setRelationScope] = useState<RelationScope>('floor')
  const [relationKind, setRelationKind] = useState<'all' | RelationKind>('all')
  const [hiddenGroupId, setHiddenGroupId] = useState('')
  const [isChoosingRelationSource, setIsChoosingRelationSource] = useState(false)
  const [relationSourceId, setRelationSourceId] = useState('')
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const nodeById = new Map(document.nodes.map((node) => [node.id, node]))

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

  const chooseTab = (tab: RailTab) => {
    setActiveTab(tab)
    setSearch('')
  }

  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = tabs.length - 1
    if (nextIndex === null) return
    event.preventDefault()
    chooseTab(tabs[nextIndex]!)
    tabRefs.current[nextIndex]?.focus()
  }

  const beginRelation = () => {
    const preferredSource = selection?.kind === 'node' ? selection.id : document.nodes.find((node) => node.floorId === activeFloorId)?.id ?? document.nodes[0]?.id ?? ''
    setRelationSourceId(preferredSource)
    setIsChoosingRelationSource(true)
    chooseTab('concepts')
  }

  const sourceNodes = document.nodes.filter((node) => node.floorId === activeFloorId)
  const selectedSourceId = sourceNodes.some((node) => node.id === relationSourceId) ? relationSourceId : sourceNodes[0]?.id ?? ''
  const filteredFlows = document.flows.filter((flow) => !normalizedSearch || [flow.name, flow.payload, flow.summary].some((value) => value.toLocaleLowerCase().includes(normalizedSearch)))
  const filteredRelations = document.relations.filter((relation) => {
    const from = nodeById.get(relation.from)
    const to = nodeById.get(relation.to)
    const isOnFloor = from?.floorId === activeFloorId || to?.floorId === activeFloorId
    const isCrossFloor = Boolean(from && to && from.floorId !== to.floorId)
    const isInScope = relationScope === 'all' || (relationScope === 'floor' ? isOnFloor : isCrossFloor)
    const matchesKind = relationKind === 'all' || relation.kind === relationKind
    const matchesSearch = !normalizedSearch || [relation.label, from?.name ?? '', to?.name ?? ''].some((value) => value.toLocaleLowerCase().includes(normalizedSearch))
    return isInScope && matchesKind && matchesSearch
  })

  return (
    <aside className="left-rail">
      <div className="rail-tabs-wrap">
        <div className="rail-tabs" role="tablist" aria-label="Map content">
          {tabs.map((tab, index) => (
            <button
              key={tab}
              ref={(element) => { tabRefs.current[index] = element }}
              id={`left-rail-tab-${tab}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`left-rail-panel-${tab}`}
              tabIndex={activeTab === tab ? 0 : -1}
              className={activeTab === tab ? 'is-active' : ''}
              onClick={() => chooseTab(tab)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              {tab}
            </button>
          ))}
        </div>
        {onCollapse ? <button type="button" className="rail-collapse-button" aria-label="Hide left rail" title="Hide left rail [" onClick={onCollapse}><span aria-hidden="true">‹</span></button> : null}
      </div>

      <div className="rail-section" style={{ paddingTop: 8 }}>
        <label className="field">
          <span>Search {activeTab}</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${activeTab}`} aria-label={`Search ${activeTab}`} />
        </label>
      </div>

      {activeTab === 'scenarios' ? <section id="left-rail-panel-scenarios" aria-labelledby="left-rail-tab-scenarios" className="rail-section rail-flows" role="tabpanel">
        <div className="rail-heading"><span>Scenarios</span>{editable ? <button type="button" onClick={addFlow} aria-label="Add scenario" title="Add scenario">+</button> : null}</div>
        <div className="flow-list">
          {filteredFlows.map((flow) => {
            const index = document.flows.findIndex((candidate) => candidate.id === flow.id)
            return (
              <button key={flow.id} type="button" className={`flow-row ${activeFlowId === flow.id ? 'is-active' : ''}`} title={`${flow.name} · ${flow.payload} · ${flow.summary}`} onClick={() => { const next = activeFlowId === flow.id ? null : flow.id; onActiveFlow(next); setSelection(next ? { kind: 'flow', id: flow.id } : null) }}>
                <span className="flow-index">{String(index + 1).padStart(2, '0')}</span><span className="flow-name" title={flow.name}>{flow.name}</span><span className="flow-payload" title={flow.payload}>{flow.payload}</span>
              </button>
            )
          })}
          {filteredFlows.length === 0 ? <div><p className="rail-empty">{normalizedSearch ? 'No scenarios match this search.' : 'No scenarios yet.'}</p>{normalizedSearch ? <button type="button" className="add-row" onClick={() => setSearch('')}>Clear search</button> : editable ? <button type="button" className="add-row" onClick={addFlow}>+ Create scenario</button> : null}</div> : null}
        </div>
      </section> : null}

      {activeTab === 'relations' ? <section id="left-rail-panel-relations" aria-labelledby="left-rail-tab-relations" className="rail-section rail-relations" role="tabpanel">
        <div className="rail-heading"><span>Relations</span><span>{filteredRelations.length}</span></div>
        <div className="segmented" aria-label="Relation scope" style={{ marginTop: 10 }}>
          {(['floor', 'all', 'cross-floor'] as const).map((scope) => <button key={scope} type="button" className={relationScope === scope ? 'is-active' : ''} aria-pressed={relationScope === scope} onClick={() => setRelationScope(scope)}>{scope === 'cross-floor' ? 'Cross-floor' : scope}</button>)}
        </div>
        <label className="field" style={{ marginTop: 10 }}>
          <span>Relation kind</span>
          <select value={relationKind} onChange={(event) => setRelationKind(event.target.value as 'all' | RelationKind)}>
            {relationKinds.map((kind) => <option key={kind} value={kind}>{kind === 'all' ? 'All kinds' : kind}</option>)}
          </select>
        </label>
        {editable && document.nodes.length > 0 ? <button type="button" className="secondary-button" style={{ marginTop: 10 }} onClick={beginRelation}>+ Create relation</button> : null}
        <div className="relation-list" style={{ marginTop: 8 }}>
          {filteredRelations.map((relation) => {
            const from = nodeById.get(relation.from)
            const to = nodeById.get(relation.to)
            const direction = `FROM ${from?.name ?? 'Unknown'} → TO ${to?.name ?? 'Unknown'}`
            return <div className={`relation-row ${selection?.kind === 'relation' && selection.id === relation.id ? 'is-active' : ''}`} key={relation.id}><button type="button" title={`${direction} · ${relation.kind} · ${relation.label}`} onClick={() => select({ kind: 'relation', id: relation.id })}><span title={from?.name ?? 'Unknown source'}>{from?.code ?? '?'}</span><strong title={`${direction} · ${relation.label}`}>{direction} · {relation.label}</strong><span title={`${relation.kind} relation`}>{relation.kind}</span></button>{editable ? <button type="button" className="relation-row-delete" aria-label={`Delete ${relation.label}`} title={`Delete ${relation.label}`} onClick={() => deleteRelation(relation.id)}>×</button> : null}</div>
          })}
          {filteredRelations.length === 0 ? <div><p className="rail-empty">{document.relations.length === 0 ? 'No relations yet.' : 'No relations match these filters.'}</p>{document.relations.length > 0 ? <button type="button" className="add-row" onClick={() => { setSearch(''); setRelationScope('floor'); setRelationKind('all') }}>Reset filters</button> : null}{editable && document.nodes.length > 0 ? <button type="button" className="add-row" onClick={beginRelation}>+ Create relation</button> : null}</div> : null}
          {editable && document.nodes.length === 0 ? <div><p className="rail-empty">Add a concept before creating a relation.</p><button type="button" className="add-row" onClick={() => chooseTab('concepts')}>Go to concepts</button></div> : null}
        </div>
      </section> : null}

      {activeTab === 'concepts' ? <div id="left-rail-panel-concepts" aria-labelledby="left-rail-tab-concepts" className="rail-neighborhoods" role="tabpanel">
        {isChoosingRelationSource ? <section className="rail-section" aria-live="polite">
          <div className="rail-heading"><span>Choose relation source</span><button type="button" aria-label="Cancel relation creation" title="Cancel" onClick={() => setIsChoosingRelationSource(false)}>×</button></div>
          {sourceNodes.length > 0 ? <div style={{ marginTop: 8 }}>
            <label className="field"><span>Source concept on this floor</span><select value={selectedSourceId} onChange={(event) => { setRelationSourceId(event.target.value); select({ kind: 'node', id: event.target.value }) }}>{sourceNodes.map((node) => <option key={node.id} value={node.id}>{node.code} · {node.name}</option>)}</select></label>
            {onStartConnection ? <button type="button" className="secondary-button" style={{ marginTop: 8 }} onClick={() => { onStartConnection(selectedSourceId); setIsChoosingRelationSource(false) }}>Start from selected concept</button> : <><p className="rail-empty">Select the source here, then use “Connect from” in its inspector.</p><button type="button" className="add-row" onClick={() => select({ kind: 'node', id: selectedSourceId })}>Select source concept</button></>}
          </div> : <p className="rail-empty">Add a concept on this floor before creating a relation.</p>}
        </section> : null}
        {(() => {
          const nodesOnFloor = document.nodes.filter((node) => node.floorId === activeFloorId)
          const matchingNodes = nodesOnFloor.filter((node) => !normalizedSearch || [node.code, node.name, node.whatItDoes, node.howItsBuilt, ...node.properties.map((property) => property.value)].some((value) => value.toLocaleLowerCase().includes(normalizedSearch)))
          const groupsWithNodes = document.groups.filter((group) => nodesOnFloor.some((node) => node.groupId === group.id))
          const selectedGroupId = selection?.kind === 'group' ? selection.id : null
          const selectedGroup = selectedGroupId ? document.groups.find((group) => group.id === selectedGroupId) : null
          const shouldShowSelected = selectedGroup && nodesOnFloor.length > 0 && !groupsWithNodes.some((group) => group.id === selectedGroup.id)
          const baseGroups = nodesOnFloor.length === 0 ? document.groups : shouldShowSelected ? [...groupsWithNodes, selectedGroup!] : groupsWithNodes
          const displayGroups = normalizedSearch ? baseGroups.filter((group) => matchingNodes.some((node) => node.groupId === group.id)) : baseGroups
          if (document.groups.length === 0) return <section className="rail-section"><p className="rail-empty">No neighborhoods yet. Create one to add your first concept.</p>{editable ? <button type="button" className="add-row" onClick={addGroup}>+ Create neighborhood</button> : null}</section>
          if (normalizedSearch && displayGroups.length === 0) return <section className="rail-section"><p className="rail-empty">No concepts match this search on this floor.</p><button type="button" className="add-row" onClick={() => setSearch('')}>Clear search</button></section>
          if (displayGroups.length === 0) return <section className="rail-section"><p className="rail-empty">No concepts on this floor.</p>{editable ? <button type="button" className="add-row" onClick={() => addNode(document.groups[0]!.id)}>+ Add first concept</button> : null}</section>
          const hiddenGroups = document.groups.filter((group) => !baseGroups.some((visibleGroup) => visibleGroup.id === group.id))
          const selectedHiddenGroupId = hiddenGroups.some((group) => group.id === hiddenGroupId) ? hiddenGroupId : hiddenGroups[0]?.id ?? ''
          return (
            <>
              {displayGroups.map((group) => {
                const nodesForGroup = matchingNodes.filter((node) => node.groupId === group.id)
                return (
                  <section className="rail-section" key={group.id}>
                    <button type="button" className={`group-heading ${selection?.kind === 'group' && selection.id === group.id ? 'is-active' : ''}`} title={group.name} onClick={() => select({ kind: 'group', id: group.id })}><span title={group.name}>{group.name}</span><span>{nodesForGroup.length}</span></button>
                    <div className="node-list">
                      {nodesForGroup.map((node) => (
                        <button key={node.id} id={`rail-node-${node.id}`} type="button" className={`node-row ${selection?.kind === 'node' && selection.id === node.id ? 'is-active' : ''}`} title={`${node.code} · ${node.name}`} onClick={() => select({ kind: 'node', id: node.id })}><span className="node-code" title={node.code}>{node.code}</span><span title={node.name}>{node.name}</span><span className="node-size" title={`Size ${node.size.toUpperCase()}`}>{node.size.toUpperCase()}</span></button>
                      ))}
                      {editable && !normalizedSearch ? <button type="button" className="add-row" onClick={() => addNode(group.id)}>+ Add concept</button> : null}
                    </div>
                  </section>
                )
              })}
              {editable && hiddenGroups.length > 0 && !normalizedSearch ? (
                <section className="rail-section" style={{ marginTop: 12, paddingTop: 12 }}>
                  <p className="rail-empty" style={{ fontSize: 10, marginBottom: 6 }}>Add concept to another neighborhood</p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select aria-label="Neighborhood for new concept" value={selectedHiddenGroupId} onChange={(event) => setHiddenGroupId(event.target.value)} style={{ flex: 1, minWidth: 0, padding: '6px 8px', background: 'var(--surface-soft)', fontSize: 11 }}>
                      {hiddenGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                    </select>
                    <button type="button" className="add-row" style={{ flex: '0 0 auto', padding: '6px 10px', background: 'var(--surface-soft)' }} onClick={() => addNode(selectedHiddenGroupId)}>+ Add</button>
                  </div>
                </section>
              ) : null}
            </>
          )
        })()}
        {editable && document.groups.length > 0 ? <button type="button" className="add-group" onClick={addGroup}>+ New neighborhood</button> : null}
      </div> : null}
    </aside>
  )
}
