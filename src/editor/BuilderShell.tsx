import { useEffect, useState } from 'react'
import { canAppendFlowFrom } from '../domain/flows'
import { makeId } from '../domain/id'
import { IsoCanvas } from '../map/components/IsoCanvas'
import { toggleFlow } from '../map/stores/flow-clock'
import { Inspector } from './Inspector'
import { LeftRail } from './LeftRail'
import { MapHeader } from './MapHeader'
import { useDocumentStore } from './document-store'
import type { ConnectionDraft } from './connection'

export function BuilderShell({ presentation = false, onExport }: { presentation?: boolean; onExport?: () => void }) {
  const { document, selection, setSelection, commit } = useDocumentStore()
  const [editable, setEditable] = useState(!presentation)
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null)
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (connectionDraft) setConnectionDraft(null)
        else { setSelection(null); setActiveFlowId(null) }
      }
      const target = event.target as HTMLElement | null
      const typing = target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')
      if (event.key === ' ' && activeFlowId && !typing) { event.preventDefault(); toggleFlow() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeFlowId, connectionDraft, setSelection])

  const startConnection = (sourceId: string) => {
    const activeFlow = document.flows.find((flow) => flow.id === activeFlowId)
    const flowId = activeFlow && canAppendFlowFrom(activeFlow, document.relations, sourceId) ? activeFlow.id : null
    setConnectionDraft({ sourceId, targets: [], label: 'new relation', kind: 'flow', flowId })
  }
  const toggleConnectionTarget = (nodeId: string) => setConnectionDraft((draft) => {
    if (!draft || nodeId === draft.sourceId) return draft
    const exists = draft.targets.some((target) => target.nodeId === nodeId)
    return { ...draft, targets: exists ? draft.targets.filter((target) => target.nodeId !== nodeId) : [...draft.targets, { nodeId, direction: 'outbound' }] }
  })
  const commitConnection = () => {
    if (!connectionDraft || connectionDraft.targets.length === 0) return
    const relations = connectionDraft.targets.map((target) => ({
      id: makeId('relation'),
      from: target.direction === 'outbound' ? connectionDraft.sourceId : target.nodeId,
      to: target.direction === 'outbound' ? target.nodeId : connectionDraft.sourceId,
      kind: connectionDraft.kind,
      label: connectionDraft.label,
    }))
    commit((current) => ({
      ...current,
      relations: [...current.relations, ...relations],
      flows: current.flows.map((flow) => flow.id === connectionDraft.flowId ? {
        ...flow,
        stages: [...flow.stages, { id: makeId('stage'), traversals: relations.map((relation, index) => ({ id: makeId('traversal'), relationId: relation.id, direction: connectionDraft.targets[index]!.direction === 'outbound' ? 'forward' as const : 'reverse' as const })) }],
      } : flow),
    }))
    setSelection(connectionDraft.flowId ? { kind: 'flow', id: connectionDraft.flowId } : { kind: 'relation', id: relations[0]!.id })
    setConnectionDraft(null)
  }

  return <div className={`map-app ${editable ? 'is-editing' : 'is-presenting'} ${selection || connectionDraft ? 'has-inspector' : ''}`}>
    <MapHeader activeFlowId={activeFlowId} editable={editable} onEditable={presentation ? undefined : setEditable} onExport={onExport} />
    <main className="map-workspace">
      <LeftRail activeFlowId={activeFlowId} onActiveFlow={setActiveFlowId} editable={editable} />
      <section className="stage-column">
        <IsoCanvas document={document} selection={selection} activeFlowId={activeFlowId} editable={editable} connectionDraft={connectionDraft} onToggleConnectionTarget={toggleConnectionTarget} onSelect={setSelection} onMoveNode={(id, gx, gy) => commit((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === id ? { ...node, position: { gx, gy } } : node) }))} />
        <footer className="map-footer"><span className="legend-key flow-key" /> flow <span className="legend-key support-key" /> support <span className="legend-key retry-key" /> retry <span className="payload-key" /> payload <b>{editable ? 'drag buildings · scroll to zoom · drag ground to pan' : 'choose a scenario · space plays · scroll to zoom'}</b></footer>
      </section>
      <Inspector editable={editable} onActiveFlow={setActiveFlowId} connectionDraft={connectionDraft} onStartConnection={startConnection} onUpdateConnection={setConnectionDraft} onCancelConnection={() => setConnectionDraft(null)} onCommitConnection={commitConnection} />
    </main>
  </div>
}
