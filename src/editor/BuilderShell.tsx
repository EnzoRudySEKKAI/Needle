import { useEffect, useRef, useState } from 'react'
import { addFlowTraversal } from '../domain/commands'
import { makeId } from '../domain/id'
import { IsoCanvas } from '../map/components/IsoCanvas'
import type { StepDisplayMode } from '../map/core/step-display'
import { toggleFlow } from '../map/stores/flow-clock'
import { Inspector } from './Inspector'
import { LeftRail } from './LeftRail'
import { MapHeader } from './MapHeader'
import { useDocumentStore } from './document-store'
import type { ConnectionDraft } from './connection'
import type { RelationPreview } from './RelationCandidatePicker'
import type { RelationPickTarget } from './ScenarioInspector'

export function BuilderShell({ presentation = false, onExport }: { presentation?: boolean; onExport?: () => void }) {
  const { document, selection, setSelection, commit, persistenceError, syncReady } = useDocumentStore()
  const appRef = useRef<HTMLDivElement | null>(null)
  const [editable, setEditable] = useState(!presentation)
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null)
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft | null>(null)
  const [relationPreview, setRelationPreview] = useState<RelationPreview | null>(null)
  const [relationPickTarget, setRelationPickTarget] = useState<RelationPickTarget | null>(null)
  const [stepDisplayModes, setStepDisplayModes] = useState<{ build: StepDisplayMode; present: StepDisplayMode }>({ build: 'all', present: 'current' })
  const [fullscreen, setFullscreen] = useState(false)
  const [fullscreenError, setFullscreenError] = useState<string | null>(null)
  const stepDisplayContext = editable ? 'build' : 'present'
  const stepDisplayMode = stepDisplayModes[stepDisplayContext]
  const setStepDisplayMode = (mode: StepDisplayMode) => setStepDisplayModes((current) => ({ ...current, [stepDisplayContext]: mode }))

  useEffect(() => {
    const syncFullscreen = () => setFullscreen(window.document.fullscreenElement === appRef.current)
    window.document.addEventListener('fullscreenchange', syncFullscreen)
    return () => window.document.removeEventListener('fullscreenchange', syncFullscreen)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (window.document.fullscreenElement) return
        if (relationPickTarget) { setRelationPickTarget(null); setRelationPreview(null) }
        else if (relationPreview) setRelationPreview(null)
        else if (connectionDraft) setConnectionDraft(null)
        else { setSelection(null); setActiveFlowId(null) }
      }
      const target = event.target as HTMLElement | null
      const typing = target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')
      if (event.key === ' ' && activeFlowId && !typing) { event.preventDefault(); toggleFlow() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeFlowId, connectionDraft, relationPickTarget, relationPreview, setSelection])

  const toggleFullscreen = async () => {
    setFullscreenError(null)
    try {
      if (window.document.fullscreenElement) await window.document.exitFullscreen()
      else await appRef.current?.requestFullscreen()
    } catch (error) {
      setFullscreenError(error instanceof Error ? error.message : 'Fullscreen is unavailable.')
    }
  }

  const startConnection = (sourceId: string) => {
    const activeFlow = document.flows.find((flow) => flow.id === activeFlowId)
    const flowId = activeFlow?.id ?? null
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
  const setEditorMode = (nextEditable: boolean) => {
    setEditable(nextEditable)
    if (!nextEditable) { setRelationPickTarget(null); setRelationPreview(null) }
  }
  const changeActiveFlow = (id: string | null) => {
    setActiveFlowId(id)
    if (relationPickTarget && relationPickTarget.flowId !== id) { setRelationPickTarget(null); setRelationPreview(null) }
  }
  const relationPickFlow = relationPickTarget ? document.flows.find((flow) => flow.id === relationPickTarget.flowId) : null
  const relationPickStage = relationPickTarget?.stageId ? relationPickFlow?.stages.find((stage) => stage.id === relationPickTarget.stageId) : null
  const relationPickIds = relationPickTarget && relationPickFlow && (relationPickTarget.stageId === null || relationPickStage)
    ? new Set(document.relations.filter((relation) => !relationPickStage?.traversals.some((traversal) => traversal.relationId === relation.id)).map((relation) => relation.id))
    : null
  const pickRelation = (relationId: string) => {
    if (!relationPickTarget || !relationPickIds?.has(relationId)) return
    commit((current) => addFlowTraversal(current, relationPickTarget.flowId, relationPickTarget.stageId, relationId, 'forward'))
    setRelationPickTarget(null)
    setRelationPreview(null)
  }

  if (!syncReady) return <main className="map-load-state"><span>Connecting to the shared workspace…</span></main>

  return <div ref={appRef} className={`map-app ${editable ? 'is-editing' : 'is-presenting'} ${selection || connectionDraft ? 'has-inspector' : ''}`}>
    {persistenceError ? <div className="sync-error" role="alert">{persistenceError}</div> : null}
    <MapHeader activeFlowId={activeFlowId} editable={editable} stepDisplayMode={stepDisplayMode} fullscreen={fullscreen} fullscreenError={fullscreenError} onStepDisplayMode={setStepDisplayMode} onFullscreen={toggleFullscreen} onEditable={presentation ? undefined : setEditorMode} onExport={onExport} />
    <main className="map-workspace">
      <LeftRail activeFlowId={activeFlowId} onActiveFlow={changeActiveFlow} editable={editable} />
      <section className="stage-column">
        <IsoCanvas document={document} selection={selection} activeFlowId={activeFlowId} editable={editable} stepDisplayMode={stepDisplayMode} relationPreview={relationPreview} relationPickIds={relationPickIds} onPickRelation={pickRelation} connectionDraft={connectionDraft} onToggleConnectionTarget={toggleConnectionTarget} onSelect={setSelection} onMoveNode={(id, gx, gy) => commit((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === id ? { ...node, position: { gx, gy } } : node) }))} />
        <footer className="map-footer"><span className="legend-key flow-key" /> flow <span className="legend-key support-key" /> support <span className="legend-key retry-key" /> retry <span className="payload-key" /> payload <b>{editable ? 'drag buildings · scroll to zoom · drag ground to pan' : 'choose a scenario · space plays · scroll to zoom'}</b></footer>
      </section>
      <Inspector editable={editable} onActiveFlow={changeActiveFlow} relationPickTarget={relationPickTarget} onRelationPickTarget={setRelationPickTarget} onRelationPreview={setRelationPreview} connectionDraft={connectionDraft} onStartConnection={startConnection} onUpdateConnection={setConnectionDraft} onCancelConnection={() => setConnectionDraft(null)} onCommitConnection={commitConnection} />
    </main>
  </div>
}
