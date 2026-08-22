import { startTransition, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { addFloor, addFlowTraversal, setFloorFlagPosition } from '../domain/commands'
import { makeId } from '../domain/id'
import { IsoCanvas } from '../map/components/IsoCanvas'
import { StructureView } from '../map/components/StructureView'
import { ExportDialog } from '../export/ExportDialog'
import { visualiseNodes } from '../map/core/layout'
import { buildFlowProgram } from '../map/core/program'
import { buildRelationGeometry } from '../map/core/routes'
import type { StepDisplayMode } from '../map/core/step-display'
import { configureFlow, pauseFlow, toggleFlow, useClockActiveKey } from '../map/stores/flow-clock'
import { Inspector } from './Inspector'
import { FloorNavigator } from './FloorNavigator'
import { LeftRail } from './LeftRail'
import { MapHeader } from './MapHeader'
import { useDocumentStore } from './document-store'
import type { ConnectionDraft } from './connection'
import type { RelationPreview } from './RelationCandidatePicker'
import type { RelationPickTarget, StagePreviewTarget } from './ScenarioInspector'

export function BuilderShell({ presentation = false }: { presentation?: boolean }) {
  const { document, selection, setSelection, commit, persistenceError, syncReady } = useDocumentStore()
  const appRef = useRef<HTMLDivElement | null>(null)
  const [editable, setEditable] = useState(!presentation)
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null)
  const [requestedFloorId, setActiveFloorId] = useState(document.floors[0]!.id)
  const [leftCollapsed, setLeftCollapsed] = useState(() => {
    try { return localStorage.getItem('needle:leftCollapsed') === '1' } catch { return false }
  })
  const [rightCollapsed, setRightCollapsed] = useState(() => {
    try { return localStorage.getItem('needle:rightCollapsed') === '1' } catch { return false }
  })
  const [headerCollapsed, setHeaderCollapsed] = useState(() => {
    try { return localStorage.getItem('needle:headerCollapsed') === '1' } catch { return false }
  })
  const activeFloorId = document.floors.some((floor) => floor.id === requestedFloorId) ? requestedFloorId : document.floors[0]!.id
  const [previousFloorId, setPreviousFloorId] = useState<string | null>(null)
  const [floorDirection, setFloorDirection] = useState<'up' | 'down'>('up')
  const [workspaceView, setWorkspaceView] = useState<'floor' | 'structure'>('floor')
  const [structureEntering, setStructureEntering] = useState(false)
  const [enteringFloorId, setEnteringFloorId] = useState<string | null>(null)
  const structureEnterTimer = useRef(0)
  const isStructureView = workspaceView === 'structure'
  const viewportInsets = useMemo(() => {
    const leftVisible = !leftCollapsed && !isStructureView
    const rightVisible = !rightCollapsed
    const headerVisible = !headerCollapsed
    const left = leftVisible ? 256 : 12
    const right = rightVisible ? 364 : 12
    const top = headerVisible ? 72 : 56
    const bottom = 12
    return { left, right, top, bottom }
  }, [leftCollapsed, rightCollapsed, headerCollapsed, isStructureView])
  const structureInsets = useMemo(() => {
    const rightVisible = !rightCollapsed
    const headerVisible = !headerCollapsed
    const left = 12
    const right = rightVisible ? 364 : 12
    const top = headerVisible ? 72 : 56
    const bottom = 12
    return { left, right, top, bottom }
  }, [rightCollapsed, headerCollapsed])
  const [exporting, setExporting] = useState(false)
  const [exportScope, setExportScope] = useState<'floor' | 'structure'>('floor')
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft | null>(null)
  const [relationPreview, setRelationPreview] = useState<RelationPreview | null>(null)
  const [relationPickTarget, setRelationPickTarget] = useState<RelationPickTarget | null>(null)
  const [stagePreviewTarget, setStagePreviewTarget] = useState<StagePreviewTarget | null>(null)
  const [stepDisplayModes, setStepDisplayModes] = useState<{ build: StepDisplayMode; present: StepDisplayMode }>({ build: 'all', present: 'current' })
  const [fullscreen, setFullscreen] = useState(false)
  const [fullscreenError, setFullscreenError] = useState<string | null>(null)
  const [hoveredFloorId, setHoveredFloorId] = useState<string | null>(null)
  const floorTimer = useRef(0)

  useEffect(() => { try { localStorage.setItem('needle:leftCollapsed', leftCollapsed ? '1' : '0') } catch {} }, [leftCollapsed])
  useEffect(() => { try { localStorage.setItem('needle:rightCollapsed', rightCollapsed ? '1' : '0') } catch {} }, [rightCollapsed])
  useEffect(() => { try { localStorage.setItem('needle:headerCollapsed', headerCollapsed ? '1' : '0') } catch {} }, [headerCollapsed])
  const stepDisplayContext = editable ? 'build' : 'present'
  const stepDisplayMode = stepDisplayModes[stepDisplayContext]
  const setStepDisplayMode = (mode: StepDisplayMode) => setStepDisplayModes((current) => ({ ...current, [stepDisplayContext]: mode }))
  const allVisualNodes = useMemo(() => visualiseNodes(document.nodes), [document.nodes])
  const allGeometry = useMemo(() => buildRelationGeometry(allVisualNodes, document.relations), [allVisualNodes, document.relations])
  const activeFlow = document.flows.find((flow) => flow.id === activeFlowId) ?? null
  const flowProgram = useMemo(() => activeFlow ? buildFlowProgram(activeFlow, allVisualNodes, document.relations, allGeometry) : null, [activeFlow, allGeometry, allVisualNodes, document.relations])
  const activeClockKey = useClockActiveKey()

  useEffect(() => {
    const syncFullscreen = () => setFullscreen(window.document.fullscreenElement === appRef.current)
    window.document.addEventListener('fullscreenchange', syncFullscreen)
    return () => window.document.removeEventListener('fullscreenchange', syncFullscreen)
  }, [])

  useEffect(() => () => window.clearTimeout(floorTimer.current), [])
  useEffect(() => () => window.clearTimeout(structureEnterTimer.current), [])

  useEffect(() => {
    configureFlow(flowProgram, !editable)
    return () => configureFlow(null)
  }, [editable, flowProgram])

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
      if (!typing && (event.metaKey || event.ctrlKey) && event.key === '[') { event.preventDefault(); setLeftCollapsed((value) => !value) }
      if (!typing && (event.metaKey || event.ctrlKey) && event.key === ']') { event.preventDefault(); setRightCollapsed((value) => !value) }
      if (!typing && !event.metaKey && !event.ctrlKey && !event.altKey && event.key === '[') { setLeftCollapsed((value) => !value) }
      if (!typing && !event.metaKey && !event.ctrlKey && !event.altKey && event.key === ']') { setRightCollapsed((value) => !value) }
      if (!typing && (event.key === 'h' || event.key === 'H')) { setHeaderCollapsed((value) => !value) }
      if (!typing && (event.metaKey || event.ctrlKey) && (event.key === 'h' || event.key === 'H')) { event.preventDefault(); setHeaderCollapsed((value) => !value) }
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
    if (!nextEditable) { setRelationPickTarget(null); setRelationPreview(null); setStagePreviewTarget(null) }
  }
  const changeActiveFlow = (id: string | null) => {
    setActiveFlowId(id)
    setStagePreviewTarget(null)
    if (relationPickTarget && relationPickTarget.flowId !== id) { setRelationPickTarget(null); setRelationPreview(null) }
  }
  const handleAddFloor = () => {
    const floorId = makeId('floor')
    commit((current) => addFloor(current, activeFloorId, floorId).document)
    setSelection({ kind: 'floor', id: floorId })
    window.clearTimeout(floorTimer.current)
    window.clearTimeout(structureEnterTimer.current)
    const fromStructure = workspaceView === 'structure'
    const fromIndex = document.floors.findIndex((floor) => floor.id === activeFloorId)
    setFloorDirection('up')
    setPreviousFloorId(fromStructure ? null : activeFloorId)
    setStructureEntering(fromStructure)
    if (fromStructure) setEnteringFloorId(floorId)
    setWorkspaceView('floor')
    void fromIndex
    startTransition(() => setActiveFloorId(floorId))
    if (fromStructure) {
      structureEnterTimer.current = window.setTimeout(() => { setStructureEntering(false); setEnteringFloorId(null) }, 520)
    } else {
      floorTimer.current = window.setTimeout(() => setPreviousFloorId(null), 460)
    }
  }
  const handleMoveFloor = (floorId: string, beforeFloorId: string | null) => {
    if (floorId === beforeFloorId) return
    commit((current) => {
      const display = [...current.floors].reverse()
      const fromIndex = display.findIndex((floor) => floor.id === floorId)
      if (fromIndex < 0) return current
      const [moved] = display.splice(fromIndex, 1)
      if (!moved) return current
      let toIndex: number
      if (beforeFloorId === null) toIndex = display.length
      else {
        toIndex = display.findIndex((floor) => floor.id === beforeFloorId)
        if (toIndex < 0) return current
      }
      display.splice(toIndex, 0, moved)
      const nextFloors = [...display].reverse()
      if (nextFloors.every((floor, index) => floor.id === current.floors[index]?.id)) return current
      return { ...current, floors: nextFloors }
    })
  }
  const openFloor = (floorId: string) => {
    if (floorId === activeFloorId && workspaceView === 'floor') return
    const fromIndex = document.floors.findIndex((floor) => floor.id === activeFloorId)
    const toIndex = document.floors.findIndex((floor) => floor.id === floorId)
    if (toIndex < 0) return
    window.clearTimeout(floorTimer.current)
    window.clearTimeout(structureEnterTimer.current)
    const enteringFromStructure = workspaceView === 'structure'
    setFloorDirection(toIndex >= fromIndex ? 'up' : 'down')
    setPreviousFloorId(enteringFromStructure ? null : activeFloorId)
    setStructureEntering(enteringFromStructure)
    if (enteringFromStructure) setEnteringFloorId(floorId)
    setWorkspaceView('floor')
    setRelationPickTarget(null)
    setRelationPreview(null)
    setStagePreviewTarget(null)
    const selectedNode = selection?.kind === 'node' ? document.nodes.find((node) => node.id === selection.id) : null
    if (selectedNode && selectedNode.floorId !== floorId) setSelection(null)
    startTransition(() => setActiveFloorId(floorId))
    if (enteringFromStructure) {
      structureEnterTimer.current = window.setTimeout(() => { setStructureEntering(false); setEnteringFloorId(null) }, 520)
    } else {
      floorTimer.current = window.setTimeout(() => setPreviousFloorId(null), 460)
    }
  }
  const followScenarioFloor = useEffectEvent((floorId: string) => openFloor(floorId))
  useEffect(() => {
    if (!flowProgram || activeClockKey === 'none') return
    const [, indexValue, phase] = activeClockKey.split(':')
    const stage = flowProgram.stages[Number(indexValue)]
    const nodeId = phase === 'target' ? stage?.targetIds[0] : stage?.sourceIds[0]
    const floorId = document.nodes.find((node) => node.id === nodeId)?.floorId
    if (!floorId || floorId === activeFloorId) return
    const timer = window.setTimeout(() => followScenarioFloor(floorId), 0)
    return () => window.clearTimeout(timer)
  }, [activeClockKey, activeFloorId, document.nodes, flowProgram])
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

  return <div ref={appRef} className={`map-app ${editable ? 'is-editing' : 'is-presenting'} ${workspaceView === 'structure' ? 'is-structure-view' : ''} ${selection || connectionDraft || workspaceView === 'structure' ? 'has-inspector' : ''} ${leftCollapsed ? 'left-collapsed' : ''} ${rightCollapsed ? 'right-collapsed' : ''} ${headerCollapsed ? 'header-collapsed' : ''}`}>
    {persistenceError ? <div className="sync-error" role="alert">{persistenceError}</div> : null}
    <MapHeader activeFlowId={activeFlowId} editable={editable} stepDisplayMode={stepDisplayMode} fullscreen={fullscreen} fullscreenError={fullscreenError} onStepDisplayMode={setStepDisplayMode} onFullscreen={toggleFullscreen} onEditable={presentation ? undefined : setEditorMode} onExport={() => { if (previousFloorId) return; pauseFlow(); setExportScope(workspaceView); setExporting(true) }} leftCollapsed={leftCollapsed} rightCollapsed={rightCollapsed} headerCollapsed={headerCollapsed} onToggleLeft={() => setLeftCollapsed((value) => !value)} onToggleRight={() => setRightCollapsed((value) => !value)} onToggleHeader={() => setHeaderCollapsed((value) => !value)} />
    <Link to="/" className="brand brand-floating" aria-label="Needle home"><strong>Needle</strong><span>ONTOLOGY</span></Link>
    <button type="button" className="header-restore" aria-label="Show header" title="Show header ( H )" onClick={() => setHeaderCollapsed(false)}><span aria-hidden="true">⌄</span></button>
    <main className="map-workspace">
      <LeftRail activeFlowId={activeFlowId} onActiveFlow={changeActiveFlow} activeFloorId={activeFloorId} onActiveFloor={openFloor} editable={editable} onCollapse={() => setLeftCollapsed(true)} />
      <section className="stage-column">
        <div className="floor-viewport">
          {structureEntering ? <div className="floor-layer is-outgoing is-structure-exit"><div style={{ position: 'absolute', inset: 0, paddingTop: structureInsets.top, paddingRight: structureInsets.right, paddingBottom: structureInsets.bottom, paddingLeft: structureInsets.left, boxSizing: 'border-box' }}><div style={{ width: '100%', height: '100%', transform: 'scale(1.04)', transformOrigin: '50% 50%' }}><StructureView key={`${document.structureType}-exit`} document={document} activeFloorId={enteringFloorId ?? activeFloorId} hoveredFloorId={hoveredFloorId} onHoverFloor={setHoveredFloorId} onOpenFloor={(floorId) => { openFloor(floorId); setSelection({ kind: 'floor', id: floorId }) }} /></div></div></div> : previousFloorId ? <div className={`floor-layer is-outgoing direction-${floorDirection}`}><IsoCanvas key={previousFloorId} document={document} floorId={previousFloorId} svgId="ontology-map-svg-outgoing" selection={null} activeFlowId={null} flowProgram={null} editable={false} stepDisplayMode={stepDisplayMode} relationPreview={null} stagePreviewTarget={null} relationPickIds={null} onPickRelation={() => {}} connectionDraft={null} onToggleConnectionTarget={() => {}} onSelect={() => {}} onMoveNode={() => {}} onMoveGroupFlag={() => {}} viewportInsets={viewportInsets} /></div> : null}
          {workspaceView === 'structure' ? <div className="floor-layer is-structure"><div style={{ position: 'absolute', inset: 0, paddingTop: structureInsets.top, paddingRight: structureInsets.right, paddingBottom: structureInsets.bottom, paddingLeft: structureInsets.left, boxSizing: 'border-box' }}><div style={{ width: '100%', height: '100%', transform: 'scale(1.04)', transformOrigin: '50% 50%' }}><StructureView key={document.structureType} document={document} activeFloorId={activeFloorId} hoveredFloorId={hoveredFloorId} onHoverFloor={setHoveredFloorId} onOpenFloor={(floorId) => { openFloor(floorId); setSelection({ kind: 'floor', id: floorId }) }} /></div></div></div> : <div className={`floor-layer ${structureEntering ? 'is-incoming is-floor-enter' : previousFloorId ? `is-incoming direction-${floorDirection}` : ''}`}><IsoCanvas key={structureEntering && enteringFloorId ? enteringFloorId : activeFloorId} document={document} floorId={structureEntering && enteringFloorId ? enteringFloorId : activeFloorId} selection={selection} activeFlowId={activeFlowId} flowProgram={flowProgram} editable={editable && !previousFloorId && !structureEntering} stepDisplayMode={stepDisplayMode} relationPreview={relationPreview} stagePreviewTarget={stagePreviewTarget} relationPickIds={relationPickIds} onPickRelation={pickRelation} connectionDraft={connectionDraft} onToggleConnectionTarget={toggleConnectionTarget} onSelect={setSelection} onOpenFloor={openFloor} onMoveNode={(id, gx, gy) => commit((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === id ? { ...node, position: { gx, gy } } : node) }))} onMoveGroupFlag={(id, gx, gy) => commit((current) => setFloorFlagPosition(current, activeFloorId, id, { gx, gy }))} highlightedFloorId={hoveredFloorId} onHoverFloor={setHoveredFloorId} viewportInsets={viewportInsets} /></div>}
          <FloorNavigator floors={document.floors} activeFloorId={activeFloorId} view={workspaceView} onFloor={(floorId) => { openFloor(floorId); setSelection({ kind: 'floor', id: floorId }) }} onStructure={() => { pauseFlow(); setPreviousFloorId(null); setStructureEntering(false); setEnteringFloorId(null); window.clearTimeout(structureEnterTimer.current); setWorkspaceView('structure'); setSelection(null); setConnectionDraft(null); setRelationPickTarget(null); setRelationPreview(null); setStagePreviewTarget(null) }} editable={editable} onAddFloor={handleAddFloor} onMoveFloor={handleMoveFloor} highlightedFloorId={hoveredFloorId} onHoverFloor={setHoveredFloorId} />
          <button type="button" className="rail-restore rail-restore-left" aria-label="Show left rail" title="Show left rail ( [ )" onClick={() => setLeftCollapsed(false)}><span aria-hidden="true">›</span></button>
          <button type="button" className="rail-restore rail-restore-right" aria-label="Show detail rail" title="Show detail rail ( ] )" onClick={() => setRightCollapsed(false)}><span aria-hidden="true">‹</span></button>
        </div>
      </section>
      <Inspector editable={editable} activeFloorId={activeFloorId} hoveredFloorId={hoveredFloorId} isStructureView={workspaceView === 'structure'} onActiveFloor={openFloor} onActiveFlow={changeActiveFlow} relationPickTarget={relationPickTarget} onRelationPickTarget={setRelationPickTarget} onRelationPreview={setRelationPreview} onStagePreview={setStagePreviewTarget} connectionDraft={connectionDraft} onStartConnection={startConnection} onUpdateConnection={setConnectionDraft} onCancelConnection={() => setConnectionDraft(null)} onCommitConnection={commitConnection} onCollapse={() => setRightCollapsed(true)} />
    </main>
    {exporting ? <ExportDialog filename={document.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')} scope={exportScope} onScope={(scope) => { setExportScope(scope); setPreviousFloorId(null); setWorkspaceView(scope) }} onClose={() => setExporting(false)} /> : null}
  </div>
}
