import { useEffect, useEffectEvent, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { addFlowTraversal, addScenarioCallout, moveFlowStage } from '../domain/commands'
import { resolveTraversal } from '../domain/flows'
import type { OntologyDocument, OntologyFlow, OntologyRelation } from '../domain/types'
import { RelationCandidatePicker, type RelationCandidateOption, type RelationPreview } from './RelationCandidatePicker'
import { useI18n } from '../i18n/useI18n'

type Commit = (transform: (document: OntologyDocument) => OntologyDocument) => void
export type RelationPickTarget = { flowId: string; stageId: string | null }
export type StagePreviewTarget = { flowId: string; stageId: string }
type StageDragSession = { pointerId: number; stageId: string; beforeStageId: string | null; startY: number; clientX: number; clientY: number; moved: boolean; frame: number; owner: HTMLElement }

export function ScenarioInspector({ flow, document, commit, editable, relationPickTarget, onRelationPickTarget, onRelationPreview, onStagePreview, focusActive = false, onFocusChange }: { flow: OntologyFlow; document: OntologyDocument; commit: Commit; editable: boolean; relationPickTarget: RelationPickTarget | null; onRelationPickTarget: (target: RelationPickTarget | null) => void; onRelationPreview: (preview: RelationPreview | null) => void; onStagePreview: (target: StagePreviewTarget | null) => void; focusActive?: boolean; onFocusChange?: (value: boolean) => void }) {
  const { t } = useI18n()
  const focusToggle = onFocusChange ? <label className="scenario-focus-toggle"><input type="checkbox" checked={focusActive} onChange={(event) => onFocusChange(event.target.checked)} /><span>{t('content.scenarioFocus')}</span><small>{t('content.scenarioFocusHint')}</small></label> : null
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
      const inspector = current.owner.closest<HTMLElement>('.inspector')
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
    if (session.owner.hasPointerCapture(session.pointerId)) session.owner.releasePointerCapture(session.pointerId)
    setDraggingStageId(null)
    setDropBeforeStageId(null)
    if (shouldCommit && session.moved) commit((current) => moveFlowStage(current, flow.id, session.stageId, session.beforeStageId))
    const hoveredStage = window.document.elementFromPoint(session.clientX, session.clientY)?.closest<HTMLElement>('[data-stage-id]')?.dataset.stageId
    onStagePreview(hoveredStage ? { flowId: flow.id, stageId: hoveredStage } : null)
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

  useEffect(() => () => onStagePreview(null), [onStagePreview])

  const startStageDrag = (event: ReactPointerEvent<HTMLElement>, stageId: string) => {
    if (event.button !== 0 || dragSession.current) return
    if ((event.target as Element).closest('button')) return
    event.preventDefault()
    event.stopPropagation()
    dragSession.current = { pointerId: event.pointerId, stageId, beforeStageId: stageId, startY: event.clientY, clientX: event.clientX, clientY: event.clientY, moved: false, frame: 0, owner: event.currentTarget }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDraggingStageId(stageId)
    setDropBeforeStageId(stageId)
  }
  const moveStageDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const session = dragSession.current
    if (!session || session.pointerId !== event.pointerId) return
    session.clientX = event.clientX
    session.clientY = event.clientY
    session.moved ||= Math.abs(event.clientY - session.startY) > 5
    if (!session.moved) return
    updateDropTarget(event.clientY)
    autoScroll()
  }

  if (!editable) return <><span className="eyebrow">{t('content.animatedScenario')}</span><h2>{flow.name}</h2><p className="lede">{t(flow.stages.length === 1 ? 'content.stepCount' : 'content.stepsCount', { count: flow.stages.length })}</p>{focusToggle}<div className="scenario-stages is-readonly">{flow.stages.map((stage, index) => <section className="scenario-stage" key={stage.id}><header><strong>{stage.name || t('content.stepIndex', { index: String(index + 1).padStart(2, '0') })}</strong></header>{stage.traversals.map((traversal) => { const relation = relationById.get(traversal.relationId); if (!relation) return null; const resolved = resolveTraversal(traversal, relation); return <div className="scenario-branch" key={traversal.id}><span className="branch-code">{nodeById.get(resolved.sourceId)?.code}</span><span className="branch-name">{nodeById.get(resolved.sourceId)?.name}</span><span aria-hidden="true">→</span><span className="branch-code">{nodeById.get(resolved.targetId)?.code}</span><span className="branch-name">{nodeById.get(resolved.targetId)?.name}</span></div> })}</section>)}</div></>

  const nextStageCandidates = document.relations

  return <>
    <span className="eyebrow">{t('content.animatedScenario')}</span>
    <h2>{flow.name}</h2>
    <p className="lede">{t(flow.stages.length === 1 ? 'content.stepCount' : 'content.stepsCount', { count: flow.stages.length })}</p>
    {focusToggle}
    <div className="form-stack scenario-editor">
      <label className="field"><span>{t('content.name')}</span><input value={flow.name} onChange={(event) => patch({ name: event.target.value })} /></label>
      <label className="field"><span>Synopsis</span><textarea value={flow.summary} onChange={(event) => patch({ summary: event.target.value })} /></label>
      <label className="field"><span>End behavior</span><select value={flow.endBehavior ?? 'stop'} onChange={(event) => patch({ endBehavior: event.target.value as 'stop' | 'loop' })}><option value="stop">Stop on final plan</option><option value="loop">Loop scenario</option></select></label>
      <label className="field"><span>Grid and neighborhoods</span><select value={flow.showGrid === false ? 'hidden' : 'visible'} onChange={(event) => patch({ showGrid: event.target.value === 'visible' })}><option value="visible">Visible</option><option value="hidden">Hidden</option></select></label>
      <div className="scenario-steps-heading"><span>{t('content.steps')}</span><small>{t('content.dragStepInstruction')}</small></div>
      <div className="scenario-stages">
        {flow.stages.map((stage, stageIndex) => {
          const usedRelationIds = new Set(stage.traversals.map((traversal) => traversal.relationId))
          const candidates = document.relations.filter((relation) => !usedRelationIds.has(relation.id))
          const withoutStage = flow.stages.filter((_, index) => index !== stageIndex)
          return <section ref={(element) => { if (element) stageElements.current.set(stage.id, element); else stageElements.current.delete(stage.id) }} data-stage-id={stage.id} className={`scenario-stage is-editable ${draggingStageId === stage.id ? 'is-dragging' : ''} ${draggingStageId && dropBeforeStageId === stage.id ? 'is-drop-before' : ''}`} key={stage.id} onPointerEnter={() => onStagePreview({ flowId: flow.id, stageId: stage.id })} onPointerLeave={() => { if (!dragSession.current) onStagePreview(null) }}>
            <header className="scenario-stage-header" onPointerDown={(event) => startStageDrag(event, stage.id)} onPointerMove={moveStageDrag} onPointerUp={(event) => { if (dragSession.current?.pointerId === event.pointerId) finishStageDrag(true) }} onPointerCancel={(event) => { if (dragSession.current?.pointerId === event.pointerId) finishStageDrag(false) }} onLostPointerCapture={(event) => { if (dragSession.current?.pointerId === event.pointerId) finishStageDrag(false) }}>
              <div className="scenario-stage-title"><span>{t('content.stepIndex', { index: String(stageIndex + 1).padStart(2, '0') })}</span><strong>{stage.name || t('content.untitledStep')}</strong></div>
              <div className="scenario-stage-actions">
                <button type="button" className="scenario-stage-remove" aria-label={t('content.deleteStep', { index: stageIndex + 1 })} title={t('content.deleteStepTitle')} onClick={() => patch({ stages: withoutStage })}>×</button>
              </div>
            </header>
            <div className="scenario-stage-body">
              <div className="scenario-stage-fields">
                <label className="field"><span>{t('content.stepName')}</span><input value={stage.name ?? ''} placeholder={t('content.stepIndex', { index: stageIndex + 1 })} onChange={(event) => patch({ stages: flow.stages.map((item) => item.id === stage.id ? { ...item, name: event.target.value } : item) })} /></label>
                <label className="field"><span>Explanation</span><textarea value={stage.note ?? ''} placeholder="What should the audience understand here?" onChange={(event) => patch({ stages: flow.stages.map((item) => item.id === stage.id ? { ...item, note: event.target.value } : item) })} /></label>
                <div className="scenario-shot-settings">
                  <label className="field"><span>Layout</span><select value={stage.layout ?? 'auto'} onChange={(event) => patch({ stages: flow.stages.map((item) => item.id === stage.id ? { ...item, layout: event.target.value as 'auto' | 'single' | 'split' } : item) })}><option value="auto">Automatic</option><option value="single">Single view</option><option value="split">Split when possible</option></select></label>
                  <label className="field"><span>Advance</span><select value={stage.advance?.kind ?? 'auto'} onChange={(event) => patch({ stages: flow.stages.map((item) => item.id === stage.id ? { ...item, advance: event.target.value === 'continue' ? { kind: 'continue' } : { kind: 'auto', afterMs: item.advance?.kind === 'auto' ? item.advance.afterMs : 3400 } } : item) })}><option value="auto">Automatic</option><option value="continue">Wait for Continue</option></select></label>
                  <label className="field"><span>Transition</span><select value={stage.transition?.kind ?? 'travel'} onChange={(event) => patch({ stages: flow.stages.map((item) => item.id === stage.id ? { ...item, transition: { kind: event.target.value as 'cut' | 'fade' | 'travel', durationMs: event.target.value === 'cut' ? 0 : item.transition?.durationMs ?? 520 } } : item) })}><option value="travel">Pan</option><option value="fade">Fade</option><option value="cut">Cut</option></select></label>
                  {stage.advance?.kind !== 'continue' ? <label className="field"><span>Duration</span><input type="number" min="1200" step="100" value={stage.advance?.kind === 'auto' ? stage.advance.afterMs : 3400} onChange={(event) => patch({ stages: flow.stages.map((item) => item.id === stage.id ? { ...item, advance: { kind: 'auto', afterMs: Math.max(1200, Number(event.target.value) || 1200) } } : item) })} /></label> : null}
                </div>
              </div>
              <div className="scenario-branch-heading"><span>{t('content.paths')}</span><small>{t(stage.traversals.length === 1 ? 'content.branchCount' : 'content.branchesCount', { count: stage.traversals.length })}</small></div>
              <div className="scenario-branch-list">{stage.traversals.map((traversal) => {
              const relation = relationById.get(traversal.relationId)
              if (!relation) return <div className="scenario-branch is-missing" key={traversal.id}>{t('content.missingRelation')}</div>
              const resolved = resolveTraversal(traversal, relation)
              const removed = flow.stages.map((item, index) => index === stageIndex ? { ...item, traversals: item.traversals.filter((candidate) => candidate.id !== traversal.id) } : item).filter((item) => item.traversals.length > 0)
              return <div className="scenario-branch" key={traversal.id}>
                <div className="branch-endpoint"><span className="branch-code">{nodeById.get(resolved.sourceId)?.code}</span><span className="branch-name">{nodeById.get(resolved.sourceId)?.name}</span></div>
                <button type="button" className="branch-direction" aria-label={t('content.reverseInScenarioLabel', { name: relation.label })} title={t('content.reverseInScenario')} onClick={() => patch({ stages: flow.stages.map((item, index) => index === stageIndex ? { ...item, traversals: item.traversals.map((candidate) => candidate.id === traversal.id ? { ...candidate, direction: candidate.direction === 'forward' ? 'reverse' : 'forward' } : candidate) } : item) })}>→</button>
                <div className="branch-endpoint"><span className="branch-code">{nodeById.get(resolved.targetId)?.code}</span><span className="branch-name">{nodeById.get(resolved.targetId)?.name}</span></div>
                <div className="branch-actions"><button type="button" className="branch-remove" aria-label={t('content.removeFromStep', { name: relation.label })} onClick={() => patch({ stages: removed })}>×</button></div>
              </div>
            })}</div>
              <RelationCandidatePicker className="is-parallel-branch" label={t('content.addParallelBranch')} options={candidates.map(optionFor)} open={pickerOpen(stage.id)} onOpenChange={(open) => setPickerOpen(stage.id, open)} onSelect={(selection) => addTraversal(stage.id, selection)} onPreview={onRelationPreview} />
              <div className="scenario-callout-editor">
                <div className="scenario-branch-heading"><span>Annotations</span><small>{stage.callouts?.length ?? 0}</small></div>
                {(stage.callouts ?? []).map((callout) => <div className="scenario-callout-row" key={callout.id}>
                  <select aria-label="Annotation tone" value={callout.tone} onChange={(event) => patch({ stages: flow.stages.map((item) => item.id === stage.id ? { ...item, callouts: (item.callouts ?? []).map((candidate) => candidate.id === callout.id ? { ...candidate, tone: event.target.value as typeof callout.tone } : candidate) } : item) })}><option value="information">Information</option><option value="attention">Attention</option><option value="alert">Alert</option></select>
                  <input aria-label="Annotation text" value={callout.text} onChange={(event) => patch({ stages: flow.stages.map((item) => item.id === stage.id ? { ...item, callouts: (item.callouts ?? []).map((candidate) => candidate.id === callout.id ? { ...candidate, text: event.target.value } : candidate) } : item) })} />
                  <select aria-label="Annotation anchor" value={callout.anchor.kind === 'node' ? callout.anchor.nodeId : `point:${callout.anchor.floorId}`} onChange={(event) => patch({ stages: flow.stages.map((item) => item.id === stage.id ? { ...item, callouts: (item.callouts ?? []).map((candidate) => candidate.id === callout.id ? { ...candidate, anchor: event.target.value.startsWith('point:') ? { kind: 'point', floorId: event.target.value.slice(6), gx: 0, gy: 0 } : { kind: 'node', nodeId: event.target.value } } : candidate) } : item) })}>
                    {document.nodes.map((node) => <option value={node.id} key={node.id}>{node.name}</option>)}
                    {document.floors.map((floor) => <option value={`point:${floor.id}`} key={`point:${floor.id}`}>Point on {floor.name}</option>)}
                  </select>
                  <select aria-label="Annotation side" value={callout.side ?? 'left'} onChange={(event) => patch({ stages: flow.stages.map((item) => item.id === stage.id ? { ...item, callouts: (item.callouts ?? []).map((candidate) => candidate.id === callout.id ? { ...candidate, side: event.target.value as 'left' | 'right' } : candidate) } : item) })}><option value="left">Left</option><option value="right">Right</option></select>
                  {callout.anchor.kind === 'point' ? <div className="scenario-point-fields"><input aria-label="Grid X" type="number" step="0.5" value={callout.anchor.gx} onChange={(event) => patch({ stages: flow.stages.map((item) => item.id === stage.id ? { ...item, callouts: (item.callouts ?? []).map((candidate) => candidate.id === callout.id && candidate.anchor.kind === 'point' ? { ...candidate, anchor: { ...candidate.anchor, gx: Number(event.target.value) } } : candidate) } : item) })} /><input aria-label="Grid Y" type="number" step="0.5" value={callout.anchor.gy} onChange={(event) => patch({ stages: flow.stages.map((item) => item.id === stage.id ? { ...item, callouts: (item.callouts ?? []).map((candidate) => candidate.id === callout.id && candidate.anchor.kind === 'point' ? { ...candidate, anchor: { ...candidate.anchor, gy: Number(event.target.value) } } : candidate) } : item) })} /></div> : null}
                  <button type="button" aria-label="Delete annotation" onClick={() => patch({ stages: flow.stages.map((item) => item.id === stage.id ? { ...item, callouts: (item.callouts ?? []).filter((candidate) => candidate.id !== callout.id) } : item) })}>×</button>
                </div>)}
                <button type="button" disabled={!document.nodes[0]} onClick={() => { const relation = relationById.get(stage.traversals[0]?.relationId ?? ''); const nodeId = relation ? resolveTraversal(stage.traversals[0]!, relation).sourceId : document.nodes[0]?.id; if (nodeId) commit((current) => addScenarioCallout(current, flow.id, stage.id, { anchor: { kind: 'node', nodeId }, text: 'Explain what happens here.', tone: 'information', side: 'left' })) }}>+ Add annotation</button>
              </div>
            </div>
          </section>
        })}
        {draggingStageId && dropBeforeStageId === null ? <div className="scenario-stage-drop-end" aria-hidden="true" /> : null}
      </div>
      <RelationCandidatePicker className="is-next-step" label={t('content.addNextStep')} options={nextStageCandidates.map(optionFor)} open={pickerOpen(null)} onOpenChange={(open) => setPickerOpen(null, open)} onSelect={(selection) => addTraversal(null, selection)} onPreview={onRelationPreview} />
    </div>
  </>
}
