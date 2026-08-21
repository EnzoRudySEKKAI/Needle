import { useEffect, useEffectEvent, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { addFlowTraversal, moveFlowStage } from '../domain/commands'
import { resolveTraversal } from '../domain/flows'
import type { OntologyDocument, OntologyFlow, OntologyRelation } from '../domain/types'
import { RelationCandidatePicker, type RelationCandidateOption, type RelationPreview } from './RelationCandidatePicker'

type Commit = (transform: (document: OntologyDocument) => OntologyDocument) => void
export type RelationPickTarget = { flowId: string; stageId: string | null }
type StageDragSession = { pointerId: number; stageId: string; beforeStageId: string | null; startY: number; clientY: number; moved: boolean; frame: number; handle: HTMLButtonElement }

export function ScenarioInspector({ flow, document, commit, editable, relationPickTarget, onRelationPickTarget, onRelationPreview }: { flow: OntologyFlow; document: OntologyDocument; commit: Commit; editable: boolean; relationPickTarget: RelationPickTarget | null; onRelationPickTarget: (target: RelationPickTarget | null) => void; onRelationPreview: (preview: RelationPreview | null) => void }) {
  const patch = (value: Partial<OntologyFlow>) => commit((current) => ({ ...current, flows: current.flows.map((item) => item.id === flow.id ? { ...item, ...value } : item) }))
  const nodeById = new Map(document.nodes.map((node) => [node.id, node]))
  const relationById = new Map(document.relations.map((relation) => [relation.id, relation]))
  const stageElements = useRef(new Map<string, HTMLElement>())
  const dragSession = useRef<StageDragSession | null>(null)
  const [draggingStageId, setDraggingStageId] = useState<string | null>(null)
  const [dropBeforeStageId, setDropBeforeStageId] = useState<string | null>(null)

  const addTraversal = (stageId: string | null, selection: RelationPreview) => {
    commit((current) => addFlowTraversal(current, flow.id, stageId, selection.relationId, selection.direction))
  }
  const pickerOpen = (stageId: string | null) => relationPickTarget?.flowId === flow.id && relationPickTarget.stageId === stageId
  const setPickerOpen = (stageId: string | null, open: boolean) => {
    onRelationPreview(null)
    onRelationPickTarget(open ? { flowId: flow.id, stageId } : null)
  }

  const optionFor = (relation: OntologyRelation): RelationCandidateOption => ({ relationId: relation.id, fromLabel: nodeById.get(relation.from)?.name ?? relation.from, toLabel: nodeById.get(relation.to)?.name ?? relation.to, label: relation.label })

  const updateDropTarget = (clientY: number) => {
    const session = dragSession.current
    if (!session) return
    const before = flow.stages
      .filter((stage) => stage.id !== session.stageId)
      .find((stage) => {
        const bounds = stageElements.current.get(stage.id)?.getBoundingClientRect()
        return bounds ? clientY < bounds.top + bounds.height / 2 : false
      })?.id ?? null
    session.beforeStageId = before
    setDropBeforeStageId(before)
  }
  const autoScroll = () => {
    const session = dragSession.current
    if (!session || session.frame) return
    const tick = () => {
      const current = dragSession.current
      if (!current || !current.moved) return
      const inspector = current.handle.closest<HTMLElement>('.inspector')
      if (!inspector) return
      const bounds = inspector.getBoundingClientRect()
      const margin = 52
      const speed = current.clientY < bounds.top + margin ? -12 : current.clientY > bounds.bottom - margin ? 12 : 0
      if (!speed) { current.frame = 0; return }
      inspector.scrollTop += speed
      updateDropTarget(current.clientY)
      current.frame = requestAnimationFrame(tick)
    }
    session.frame = requestAnimationFrame(tick)
  }
  const finishStageDrag = (shouldCommit: boolean) => {
    const session = dragSession.current
    if (!session) return
    dragSession.current = null
    if (session.frame) cancelAnimationFrame(session.frame)
    if (session.handle.hasPointerCapture(session.pointerId)) session.handle.releasePointerCapture(session.pointerId)
    setDraggingStageId(null)
    setDropBeforeStageId(null)
    if (shouldCommit && session.moved) commit((current) => moveFlowStage(current, flow.id, session.stageId, session.beforeStageId))
  }
  const cancelStageDrag = useEffectEvent(() => finishStageDrag(false))

  useEffect(() => {
    const cancel = () => cancelStageDrag()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !dragSession.current) return
      event.preventDefault()
      event.stopImmediatePropagation()
      cancel()
    }
    window.addEventListener('blur', cancel)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('blur', cancel)
      window.removeEventListener('keydown', onKeyDown, true)
      cancel()
    }
  }, [])

  const startStageDrag = (event: ReactPointerEvent<HTMLButtonElement>, stageId: string) => {
    if (event.button !== 0 || dragSession.current) return
    event.preventDefault()
    event.stopPropagation()
    dragSession.current = { pointerId: event.pointerId, stageId, beforeStageId: stageId, startY: event.clientY, clientY: event.clientY, moved: false, frame: 0, handle: event.currentTarget }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDraggingStageId(stageId)
    setDropBeforeStageId(stageId)
  }
  const moveStageDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const session = dragSession.current
    if (!session || session.pointerId !== event.pointerId) return
    session.clientY = event.clientY
    session.moved ||= Math.abs(event.clientY - session.startY) > 5
    if (!session.moved) return
    updateDropTarget(event.clientY)
    autoScroll()
  }

  if (!editable) return <><span className="eyebrow">Animated scenario</span><h2>{flow.name}</h2><p className="lede">{flow.stages.length} steps · {flow.payload}</p><p>{flow.summary}</p></>

  const nextStageCandidates = document.relations

  return <>
    <span className="eyebrow">Animated scenario</span>
    <h2>{flow.name}</h2>
    <p className="lede">{flow.stages.length} steps · {flow.payload}</p>
    <div className="form-stack">
      <label className="field"><span>Name</span><input value={flow.name} onChange={(event) => patch({ name: event.target.value })} /></label>
      <label className="field"><span>Payload</span><input value={flow.payload} onChange={(event) => patch({ payload: event.target.value })} /></label>
      <label className="field"><span>Outcome</span><textarea rows={3} value={flow.summary} onChange={(event) => patch({ summary: event.target.value })} /></label>
      <div className="scenario-stages">
        {flow.stages.map((stage, stageIndex) => {
          const usedRelationIds = new Set(stage.traversals.map((traversal) => traversal.relationId))
          const candidates = document.relations.filter((relation) => !usedRelationIds.has(relation.id))
          const withoutStage = flow.stages.filter((_, index) => index !== stageIndex)
          return <section ref={(element) => { if (element) stageElements.current.set(stage.id, element); else stageElements.current.delete(stage.id) }} className={`scenario-stage ${draggingStageId === stage.id ? 'is-dragging' : ''} ${draggingStageId && dropBeforeStageId === stage.id ? 'is-drop-before' : ''}`} key={stage.id}>
            <header><strong>Step {String(stageIndex + 1).padStart(2, '0')}</strong><div><button type="button" className="scenario-drag-handle" aria-label={`Drag step ${stageIndex + 1}`} title="Drag to reorder" onPointerDown={(event) => startStageDrag(event, stage.id)} onPointerMove={moveStageDrag} onPointerUp={(event) => { if (dragSession.current?.pointerId === event.pointerId) finishStageDrag(true) }} onPointerCancel={(event) => { if (dragSession.current?.pointerId === event.pointerId) finishStageDrag(false) }} onLostPointerCapture={(event) => { if (dragSession.current?.pointerId === event.pointerId) finishStageDrag(false) }}><span aria-hidden="true">::</span></button><button type="button" disabled={stageIndex === 0} onClick={() => commit((current) => moveFlowStage(current, flow.id, stage.id, flow.stages[stageIndex - 1]?.id ?? null))}>↑</button><button type="button" disabled={stageIndex === flow.stages.length - 1} onClick={() => commit((current) => moveFlowStage(current, flow.id, stage.id, flow.stages[stageIndex + 2]?.id ?? null))}>↓</button><button type="button" onClick={() => patch({ stages: withoutStage })}>×</button></div></header>
            {stage.traversals.map((traversal) => {
              const relation = relationById.get(traversal.relationId)
              if (!relation) return <div className="scenario-branch is-missing" key={traversal.id}>Missing relation</div>
              const resolved = resolveTraversal(traversal, relation)
              const removed = flow.stages.map((item, index) => index === stageIndex ? { ...item, traversals: item.traversals.filter((candidate) => candidate.id !== traversal.id) } : item).filter((item) => item.traversals.length > 0)
              return <div className="scenario-branch" key={traversal.id}><span className="branch-code">{nodeById.get(resolved.sourceId)?.code}</span><span className="branch-name">{nodeById.get(resolved.sourceId)?.name}</span><button type="button" className="branch-direction" title="Reverse in this scenario" onClick={() => patch({ stages: flow.stages.map((item, index) => index === stageIndex ? { ...item, traversals: item.traversals.map((candidate) => candidate.id === traversal.id ? { ...candidate, direction: candidate.direction === 'forward' ? 'reverse' : 'forward' } : candidate) } : item) })}>→</button><span className="branch-code">{nodeById.get(resolved.targetId)?.code}</span><span className="branch-name">{nodeById.get(resolved.targetId)?.name}</span><button type="button" className="branch-remove" onClick={() => patch({ stages: removed })}>×</button><small>{relation.label}</small></div>
            })}
            <RelationCandidatePicker label="+ Add parallel branch" options={candidates.map(optionFor)} open={pickerOpen(stage.id)} onOpenChange={(open) => setPickerOpen(stage.id, open)} onSelect={(selection) => addTraversal(stage.id, selection)} onPreview={onRelationPreview} />
          </section>
        })}
        {draggingStageId && dropBeforeStageId === null ? <div className="scenario-stage-drop-end" aria-hidden="true" /> : null}
      </div>
      <RelationCandidatePicker label="+ Add next step" options={nextStageCandidates.map(optionFor)} open={pickerOpen(null)} onOpenChange={(open) => setPickerOpen(null, open)} onSelect={(selection) => addTraversal(null, selection)} onPreview={onRelationPreview} />
    </div>
  </>
}
