import { startTransition, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { addFloor, addFlowTraversal, deleteNodeCascade, setFloorFlagPosition } from '../domain/commands'
import { codeFromName, makeId } from '../domain/id'
import { IsoCanvas } from '../map/components/IsoCanvas'
import { StructureView } from '../map/components/StructureView'
import { ExportDialog } from '../export/ExportDialog'
import { nextFreePosition, visualiseNodes } from '../map/core/layout'
import { buildFlowProgram } from '../map/core/program'
import { buildRelationGeometry } from '../map/core/routes'
import type { StepDisplayMode } from '../map/core/step-display'
import { configureFlow, pauseFlow, seekFlowStage, syncFlowPlayback, toggleFlow, useClockActiveKey, useClockPresenceState } from '../map/stores/flow-clock'
import { useI18n } from '../i18n/useI18n'
import { Inspector } from './Inspector'
import { FloorNavigator } from './FloorNavigator'
import { LeftRail } from './LeftRail'
import { MapHeader } from './MapHeader'
import { useDocumentStore } from './document-store'
import { CommandPalette } from './CommandPalette'
import { HistoryPanel } from './HistoryPanel'
import { PresenceBar } from './PresenceBar'
import { ScenarioControls } from './ScenarioControls'
import { CinemaMode } from './CinemaMode'
import { ShortcutHelp } from './ShortcutHelp'
import type { ConnectionDraft } from './connection'
import type { RelationPreview } from './RelationCandidatePicker'
import type { RelationPickTarget, StagePreviewTarget } from './ScenarioInspector'

export function BuilderShell({ presentation = false }: { presentation?: boolean }) {
  const { t } = useI18n()
  const { document, selection, setSelection, commit, undo, redo, canUndo, canRedo, persistenceError, syncReady, presences, sendPresence, conflict, resolveConflict, restoreDocument } = useDocumentStore()
  const appRef = useRef<HTMLDivElement | null>(null)
  const [editable, setEditable] = useState(!presentation)
  const initialQuery = useMemo(() => new URLSearchParams(window.location.search), [])
  const [activeFlowId, setActiveFlowId] = useState<string | null>(() => initialQuery.get('flow'))
  const [requestedFloorId, setActiveFloorId] = useState(() => initialQuery.get('floor') ?? document.floors[0]!.id)
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
  const [workspaceView, setWorkspaceView] = useState<'floor' | 'structure'>(() => initialQuery.get('view') === 'structure' ? 'structure' : 'floor')
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
    const bottom = activeFlowId ? 76 : 12
    return { left, right, top, bottom }
  }, [activeFlowId, leftCollapsed, rightCollapsed, headerCollapsed, isStructureView])
  const structureInsets = useMemo(() => {
    const rightVisible = !rightCollapsed
    const headerVisible = !headerCollapsed
    const left = 12
    const right = rightVisible ? 364 : 12
    const top = headerVisible ? 72 : 56
    const bottom = activeFlowId ? 76 : 12
    return { left, right, top, bottom }
  }, [activeFlowId, rightCollapsed, headerCollapsed])
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
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [cinema, setCinema] = useState(false)
  const [followingId, setFollowingId] = useState<string | null>(null)
  const [savedDisplayName, setSavedDisplayName] = useState(() => localStorage.getItem('needle:displayName')?.trim() || '')
  const displayName = savedDisplayName || t('common.anonymous')
  const floorTimer = useRef(0)
  const clockPresence = useClockPresenceState()
  const [scenarioFocus, setScenarioFocus] = useState(() => {
    try { return localStorage.getItem('needle:scenarioFocus') === '1' } catch { return false }
  })

  useEffect(() => { try { localStorage.setItem('needle:leftCollapsed', leftCollapsed ? '1' : '0') } catch { /* Storage can be disabled by the browser. */ } }, [leftCollapsed])
  useEffect(() => { try { localStorage.setItem('needle:rightCollapsed', rightCollapsed ? '1' : '0') } catch { /* Storage can be disabled by the browser. */ } }, [rightCollapsed])
  useEffect(() => { try { localStorage.setItem('needle:headerCollapsed', headerCollapsed ? '1' : '0') } catch { /* Storage can be disabled by the browser. */ } }, [headerCollapsed])
  useEffect(() => { try { localStorage.setItem('needle:scenarioFocus', scenarioFocus ? '1' : '0') } catch { /* Storage can be disabled. */ } }, [scenarioFocus])
  useEffect(() => {
    const kind = initialQuery.get('kind')
    const id = initialQuery.get('selection')
    if (id && ['floor', 'node', 'relation', 'group', 'flow'].includes(kind ?? '')) setSelection({ kind: kind as NonNullable<typeof selection>['kind'], id })
  }, [initialQuery, setSelection])
  useEffect(() => {
    const query = new URLSearchParams()
    query.set('floor', activeFloorId)
    if (workspaceView === 'structure') query.set('view', 'structure')
    if (selection) { query.set('kind', selection.kind); query.set('selection', selection.id) }
    if (activeFlowId) query.set('flow', activeFlowId)
    window.history.replaceState(null, '', `${window.location.pathname}?${query}`)
  }, [activeFloorId, activeFlowId, selection, workspaceView])
  useEffect(() => {
    const updateName = (event: Event) => setSavedDisplayName((event as CustomEvent<string>).detail.trim())
    window.addEventListener('needle:display-name', updateName)
    return () => window.removeEventListener('needle:display-name', updateName)
  }, [])
  useEffect(() => {
    const currentPlayback = clockPresence.programId === activeFlowId ? clockPresence : null
    sendPresence({ selection, activeFloorId: workspaceView === 'floor' ? activeFloorId : null, activeFlowId, activeFlowStageId: currentPlayback?.stageId ?? null, flowPlaying: currentPlayback?.playing ?? false, flowSpeed: currentPlayback?.speed ?? 1, flowTime: currentPlayback?.time ?? 0, flowEpoch: currentPlayback?.epoch ?? 0, presenter: !editable || cinema, displayName })
  }, [activeFloorId, activeFlowId, cinema, clockPresence, displayName, editable, selection, sendPresence, workspaceView])
  const stepDisplayContext = editable ? 'build' : 'present'
  const stepDisplayMode = stepDisplayModes[stepDisplayContext]
  const setStepDisplayMode = (mode: StepDisplayMode) => setStepDisplayModes((current) => ({ ...current, [stepDisplayContext]: mode }))
  const allVisualNodes = useMemo(() => visualiseNodes(document.nodes), [document.nodes])
  const allGeometry = useMemo(() => buildRelationGeometry(allVisualNodes, document.relations), [allVisualNodes, document.relations])
  const activeFlow = document.flows.find((flow) => flow.id === activeFlowId) ?? null
  const flowProgram = useMemo(() => activeFlow ? buildFlowProgram(activeFlow, allVisualNodes, document.relations, allGeometry) : null, [activeFlow, allGeometry, allVisualNodes, document.relations])
  const activeClockKey = useClockActiveKey()
  const scenarioFilter = useMemo(() => {
    if (!activeFlow || !scenarioFocus) return null
    const relationIds = new Set(activeFlow.stages.flatMap((stage) => stage.traversals.map((traversal) => traversal.relationId)))
    const relationById = new Map(document.relations.map((relation) => [relation.id, relation]))
    const nodeIds = new Set<string>()
    for (const relationId of relationIds) {
      const relation = relationById.get(relationId)
      if (relation) { nodeIds.add(relation.from); nodeIds.add(relation.to) }
    }
    return { relationIds, nodeIds }
  }, [activeFlow, document.relations, scenarioFocus])
  const scenarioFocusActive = Boolean(scenarioFilter)

  useEffect(() => {
    const syncFullscreen = () => setFullscreen(window.document.fullscreenElement === appRef.current)
    window.document.addEventListener('fullscreenchange', syncFullscreen)
    return () => window.document.removeEventListener('fullscreenchange', syncFullscreen)
  }, [])

  useEffect(() => () => window.clearTimeout(floorTimer.current), [])
  useEffect(() => () => window.clearTimeout(structureEnterTimer.current), [])

  useEffect(() => {
    configureFlow(flowProgram, cinema || !editable, activeFlow?.endBehavior === 'loop')
    return () => configureFlow(null)
  }, [activeFlow?.endBehavior, cinema, editable, flowProgram])

  useEffect(() => {
    const onPlaybackKeyDown = (event: KeyboardEvent) => {
      if (event.key !== ' ' || event.repeat || !activeFlowId) return
      const target = event.target as HTMLInputElement | HTMLElement | null
      const textInput = target?.tagName === 'TEXTAREA' || (target?.tagName === 'INPUT' && !['button', 'checkbox', 'radio', 'range'].includes((target as HTMLInputElement).type))
      if (target?.isContentEditable || textInput) return
      event.preventDefault()
      event.stopPropagation()
      toggleFlow()
    }
    window.addEventListener('keydown', onPlaybackKeyDown, true)
    return () => window.removeEventListener('keydown', onPlaybackKeyDown, true)
  }, [activeFlowId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (!target?.closest('.presence-dock')) setFollowingId(null)
      if (event.key === 'Escape') {
        if (cinema) { pauseFlow(); setCinema(false); return }
        if (window.document.fullscreenElement) return
        if (relationPickTarget) { setRelationPickTarget(null); setRelationPreview(null) }
        else if (relationPreview) setRelationPreview(null)
        else if (connectionDraft) setConnectionDraft(null)
        else { setSelection(null); setActiveFlowId(null) }
      }
      const typing = target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')
      if (!typing && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandPaletteOpen(true) }
      if (!typing && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo() }
      if (!typing && event.ctrlKey && event.key.toLowerCase() === 'y') { event.preventDefault(); redo() }
      if (!typing && event.key === '?') { event.preventDefault(); setShortcutHelpOpen(true) }
      if (!typing && editable && (event.key === 'Delete' || event.key === 'Backspace')) {
        if (selection?.kind === 'node' && window.confirm(t('shell.deleteConcept.confirm'))) {
          event.preventDefault()
          commit((current) => deleteNodeCascade(current, selection.id))
          setSelection(null)
        }
      }
      if (!typing && event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault()
        const index = document.floors.findIndex((floor) => floor.id === activeFloorId)
        const next = document.floors[index + (event.key === 'ArrowUp' ? 1 : -1)]
        if (next) { setWorkspaceView('floor'); setActiveFloorId(next.id) }
      }
      if (!typing && event.altKey && (event.key === 'Home' || event.key === 'End')) {
        event.preventDefault()
        const next = event.key === 'Home' ? document.floors[0] : document.floors[document.floors.length - 1]
        if (next) { setWorkspaceView('floor'); setActiveFloorId(next.id) }
      }
      if (!typing && !editable && flowProgram && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault()
        const currentIndex = activeClockKey.startsWith(`${flowProgram.id}:`) ? Number(activeClockKey.split(':')[1]) : -1
        const nextIndex = Math.max(0, Math.min(flowProgram.stages.length - 1, currentIndex + (event.key === 'ArrowRight' ? 1 : -1)))
        const stage = flowProgram.stages[nextIndex]
        if (stage) seekFlowStage(flowProgram.id, stage.id)
      }
      if (!typing && (event.metaKey || event.ctrlKey) && event.key === '[') { event.preventDefault(); setLeftCollapsed((value) => !value) }
      if (!typing && (event.metaKey || event.ctrlKey) && event.key === ']') { event.preventDefault(); setRightCollapsed((value) => !value) }
      if (!typing && !event.metaKey && !event.ctrlKey && !event.altKey && event.key === '[') { setLeftCollapsed((value) => !value) }
      if (!typing && !event.metaKey && !event.ctrlKey && !event.altKey && event.key === ']') { setRightCollapsed((value) => !value) }
      if (!typing && (event.key === 'h' || event.key === 'H')) { setHeaderCollapsed((value) => !value) }
      if (!typing && (event.metaKey || event.ctrlKey) && (event.key === 'h' || event.key === 'H')) { event.preventDefault(); setHeaderCollapsed((value) => !value) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeClockKey, activeFloorId, activeFlowId, cinema, commit, connectionDraft, document.floors, editable, flowProgram, redo, relationPickTarget, relationPreview, selection, setSelection, t, undo])

  const toggleFullscreen = async () => {
    setFullscreenError(null)
    try {
      if (window.document.fullscreenElement) await window.document.exitFullscreen()
      else await appRef.current?.requestFullscreen()
    } catch {
      setFullscreenError(t('shell.fullscreen.unavailable'))
    }
  }

  const startConnection = (sourceId: string) => {
    const activeFlow = document.flows.find((flow) => flow.id === activeFlowId)
    const flowId = activeFlow?.id ?? null
    setConnectionDraft({ sourceId, targets: [], label: 'new relation', kind: 'full', flowId })
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
        stages: [...flow.stages, { id: makeId('stage'), layout: 'auto' as const, advance: { kind: 'auto' as const, afterMs: 3400 }, transition: { kind: 'travel' as const, durationMs: 520 }, callouts: [], traversals: relations.map((relation, index) => ({ id: makeId('traversal'), relationId: relation.id, direction: connectionDraft.targets[index]!.direction === 'outbound' ? 'forward' as const : 'reverse' as const })) }],
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
  const openFloor = (floorId: string, nextSelection?: Parameters<typeof setSelection>[0]) => {
    if (floorId === activeFloorId && workspaceView === 'floor') {
      if (nextSelection !== undefined) setSelection(nextSelection)
      return
    }
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
    if (nextSelection === undefined && selectedNode && selectedNode.floorId !== floorId) setSelection(null)
    startTransition(() => {
      setActiveFloorId(floorId)
      if (nextSelection !== undefined) setSelection(nextSelection)
    })
    if (enteringFromStructure) {
      structureEnterTimer.current = window.setTimeout(() => { setStructureEntering(false); setEnteringFloorId(null) }, 520)
    } else {
      floorTimer.current = window.setTimeout(() => setPreviousFloorId(null), 460)
    }
  }
  const applyCollaboratorPresence = (followed: (typeof presences)[number]) => {
    if (followed.activeFloorId) {
      openFloor(followed.activeFloorId, followed.selection)
    } else {
      window.clearTimeout(floorTimer.current)
      window.clearTimeout(structureEnterTimer.current)
      setPreviousFloorId(null)
      setStructureEntering(false)
      setEnteringFloorId(null)
      setWorkspaceView('structure')
      setSelection(followed.selection)
    }
    if (followed.activeFlowId !== activeFlowId) setActiveFlowId(followed.activeFlowId)
  }
  const followCollaborator = useEffectEvent(applyCollaboratorPresence)
  useEffect(() => {
    if (!followingId) return
    const followed = presences.find((presence) => presence.clientId === followingId)
    if (!followed) return
    const timer = window.setTimeout(() => followCollaborator(followed), 0)
    return () => window.clearTimeout(timer)
  }, [followingId, presences])
  useEffect(() => {
    if (!followingId || !flowProgram) return
    const followed = presences.find((presence) => presence.clientId === followingId)
    if (!followed || followed.activeFlowId !== flowProgram.id) return
    const timer = window.setTimeout(() => syncFlowPlayback(flowProgram.id, followed.activeFlowStageId, followed.flowPlaying, followed.flowSpeed, followed.flowTime, followed.flowEpoch), 0)
    return () => window.clearTimeout(timer)
  }, [followingId, flowProgram, presences])
  const changeFollowing = (presenceId: string | null) => {
    setFollowingId(presenceId)
    const followed = presences.find((presence) => presence.clientId === presenceId)
    if (followed) window.setTimeout(() => applyCollaboratorPresence(followed), 0)
  }
  const followScenarioFloor = useEffectEvent((floorId: string) => openFloor(floorId))
  const openScenarioStage = (stageId: string) => {
    const stage = flowProgram?.stages.find((candidate) => candidate.id === stageId)
    const nodeId = stage?.sourceIds[0] ?? stage?.targetIds[0]
    const floorId = document.nodes.find((node) => node.id === nodeId)?.floorId
    if (floorId && floorId !== activeFloorId) openFloor(floorId)
  }
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
  const addConceptToFloor = () => {
    const group = document.groups.find((candidate) => document.nodes.some((node) => node.floorId === activeFloorId && node.groupId === candidate.id)) ?? document.groups[0]
    if (!group) return
    const id = makeId('node')
    const name = 'New concept'
    const node = { id, code: codeFromName(name, new Set(document.nodes.map((candidate) => candidate.code))), name, groupId: group.id, floorId: activeFloorId, whatItDoes: 'Explain what this concept changes or makes possible.', howItsBuilt: '', size: 'm' as const, properties: [], position: nextFreePosition(document.nodes.filter((candidate) => candidate.floorId === activeFloorId), group.id), faceTexture: 'auto' as const }
    commit((current) => ({ ...current, nodes: [...current.nodes, node] }))
    setSelection({ kind: 'node', id })
  }

  if (!syncReady) return <main className="map-load-state"><span>{t('shell.sync.connecting')}</span></main>

  return <div ref={appRef} className={`map-app ${editable ? 'is-editing' : 'is-presenting'} ${cinema ? 'is-cinema' : ''} ${workspaceView === 'structure' ? 'is-structure-view' : ''} ${selection || connectionDraft || hoveredFloorId || workspaceView === 'structure' ? 'has-inspector' : ''} ${leftCollapsed ? 'left-collapsed' : ''} ${rightCollapsed ? 'right-collapsed' : ''} ${headerCollapsed ? 'header-collapsed' : ''}`} onPointerDownCapture={(event) => { if (!(event.target as Element).closest('.presence-dock')) setFollowingId(null) }} onClickCapture={(event) => { if (!(event.target as Element).closest('.presence-dock')) setFollowingId(null) }} onWheelCapture={(event) => { if (!(event.target as Element).closest('.presence-dock')) setFollowingId(null) }}>
    {persistenceError ? <div className="sync-error" role="alert">{t('shell.sync.error', { error: persistenceError })}</div> : null}
    {conflict ? <div className="sync-error conflict-banner" role="alert"><span>{t('shell.conflict.message')}</span><button type="button" onClick={() => resolveConflict('remote')}>{t('shell.conflict.loadTheirs')}</button><button type="button" onClick={() => resolveConflict('local')}>{t('shell.conflict.keepMine')}</button></div> : null}
    <MapHeader editable={editable} fullscreen={fullscreen} fullscreenError={fullscreenError} historyOpen={historyOpen} onFullscreen={toggleFullscreen} onEditable={presentation ? undefined : setEditorMode} onExport={() => { if (previousFloorId) return; pauseFlow(); setExportScope(workspaceView); setExporting(true) }} onSearch={() => setCommandPaletteOpen(true)} onHistory={() => setHistoryOpen((current) => !current)} onShortcuts={() => setShortcutHelpOpen(true)} leftCollapsed={leftCollapsed} rightCollapsed={rightCollapsed} headerCollapsed={headerCollapsed} onToggleLeft={() => setLeftCollapsed((value) => !value)} onToggleRight={() => setRightCollapsed((value) => !value)} onToggleHeader={() => setHeaderCollapsed((value) => !value)} />
    <div className="presence-dock">
      <PresenceBar entries={presences.map((presence, index) => ({ id: presence.clientId, name: presence.displayName, color: ['#3979d6', '#8267b8', '#3d8c70', '#a4683a'][index % 4]!, floorId: presence.activeFloorId ?? undefined, floorName: document.floors.find((floor) => floor.id === presence.activeFloorId)?.name, selection: presence.selection, presenting: presence.presenter }))} followingId={followingId} onFollow={changeFollowing} />
      <button type="button" className="header-restore" aria-label={t('shell.header.showHeader')} onClick={() => setHeaderCollapsed(false)}><span aria-hidden="true">⌄</span></button>
    </div>
    {activeFlow ? <ScenarioControls flow={activeFlow} program={flowProgram} stepDisplayMode={stepDisplayMode} onStepDisplayMode={setStepDisplayMode} onOpenStage={openScenarioStage} focusActive={scenarioFocusActive} onFocusChange={setScenarioFocus} onCinema={() => setCinema(true)} /> : null}
    <Link to="/" className="brand brand-floating" aria-label={t('shell.home')}><strong>Needle</strong><span>{t('shell.brand.ontology')}</span></Link>
    <main className="map-workspace">
      <LeftRail activeFlowId={activeFlowId} onActiveFlow={changeActiveFlow} activeFloorId={activeFloorId} onActiveFloor={openFloor} editable={editable} onStartConnection={startConnection} onCollapse={() => setLeftCollapsed(true)} scenarioFilter={scenarioFilter} />
      <section className="stage-column">
        <div className="floor-viewport">
          {structureEntering ? <div className="floor-layer is-outgoing is-structure-exit"><div className="structure-stage" style={{ position: 'absolute', inset: 0, paddingTop: structureInsets.top, paddingRight: structureInsets.right, paddingBottom: structureInsets.bottom, paddingLeft: structureInsets.left, boxSizing: 'border-box' }}><div style={{ width: '100%', height: '100%', transform: 'scale(1.04)', transformOrigin: '50% 50%' }}><StructureView key={`${document.structureType}-exit`} document={document} activeFloorId={enteringFloorId ?? activeFloorId} hoveredFloorId={hoveredFloorId} onHoverFloor={setHoveredFloorId} onOpenFloor={(floorId) => { openFloor(floorId); setSelection({ kind: 'floor', id: floorId }) }} /></div></div></div> : previousFloorId ? <div className={`floor-layer is-outgoing direction-${floorDirection}`}><IsoCanvas key={previousFloorId} document={document} floorId={previousFloorId} svgId="ontology-map-svg-outgoing" selection={null} activeFlowId={null} flowProgram={null} editable={false} stepDisplayMode={stepDisplayMode} relationPreview={null} stagePreviewTarget={null} relationPickIds={null} onPickRelation={() => {}} connectionDraft={null} onToggleConnectionTarget={() => {}} onSelect={() => {}} onMoveNode={() => {}} onMoveGroup={() => {}} onMoveGroupFlag={() => {}} viewportInsets={viewportInsets} /></div> : null}
          {workspaceView === 'structure' ? <div className="floor-layer is-structure"><div style={{ position: 'absolute', inset: 0, paddingTop: structureInsets.top, paddingRight: structureInsets.right, paddingBottom: structureInsets.bottom, paddingLeft: structureInsets.left, boxSizing: 'border-box' }}><div style={{ width: '100%', height: '100%', transform: 'scale(1.04)', transformOrigin: '50% 50%' }}><StructureView key={document.structureType} document={document} activeFloorId={activeFloorId} hoveredFloorId={hoveredFloorId} onHoverFloor={setHoveredFloorId} onOpenFloor={(floorId) => { openFloor(floorId); setSelection({ kind: 'floor', id: floorId }) }} /></div></div></div> : <div className={`floor-layer ${structureEntering ? 'is-incoming is-floor-enter' : previousFloorId ? `is-incoming direction-${floorDirection}` : ''}`}><IsoCanvas key={structureEntering && enteringFloorId ? enteringFloorId : activeFloorId} document={document} floorId={structureEntering && enteringFloorId ? enteringFloorId : activeFloorId} selection={selection} activeFlowId={activeFlowId} flowProgram={flowProgram} editable={editable && !previousFloorId && !structureEntering} stepDisplayMode={stepDisplayMode} relationPreview={relationPreview} stagePreviewTarget={stagePreviewTarget} relationPickIds={relationPickIds} onPickRelation={pickRelation} connectionDraft={connectionDraft} onToggleConnectionTarget={toggleConnectionTarget} onSelect={setSelection} onOpenFloor={openFloor} onMoveNode={(id, gx, gy) => commit((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === id ? { ...node, position: { gx, gy } } : node) }))} onMoveGroup={(id, floorId, delta, flagPosition) => commit((current) => { const moved = flagPosition ? setFloorFlagPosition(current, floorId, id, flagPosition) : current; return { ...moved, nodes: moved.nodes.map((node) => node.floorId === floorId && node.groupId === id ? { ...node, position: { gx: node.position.gx + delta.gx, gy: node.position.gy + delta.gy } } : node) } })} onMoveGroupFlag={(id, gx, gy) => commit((current) => setFloorFlagPosition(current, activeFloorId, id, { gx, gy }))} highlightedFloorId={hoveredFloorId} viewportInsets={viewportInsets} scenarioFilter={scenarioFilter} onAddConcept={editable ? addConceptToFloor : undefined} /></div>}
          <FloorNavigator floors={document.floors} activeFloorId={activeFloorId} view={workspaceView} onFloor={(floorId) => { openFloor(floorId); setSelection({ kind: 'floor', id: floorId }) }} onStructure={() => { pauseFlow(); setPreviousFloorId(null); setStructureEntering(false); setEnteringFloorId(null); window.clearTimeout(structureEnterTimer.current); setWorkspaceView('structure'); setSelection(null); setConnectionDraft(null); setRelationPickTarget(null); setRelationPreview(null); setStagePreviewTarget(null) }} editable={editable} onAddFloor={handleAddFloor} onMoveFloor={handleMoveFloor} highlightedFloorId={hoveredFloorId} onHoverFloor={setHoveredFloorId} />
          <button type="button" className="rail-restore rail-restore-left" aria-label={t('shell.header.showConcepts')} onClick={() => setLeftCollapsed(false)}><span aria-hidden="true">›</span></button>
          <button type="button" className="rail-restore rail-restore-right" aria-label={t('shell.header.showDetails')} onClick={() => setRightCollapsed(false)}><span aria-hidden="true">‹</span></button>
        </div>
      </section>
      <Inspector editable={editable} activeFloorId={activeFloorId} hoveredFloorId={hoveredFloorId} isStructureView={workspaceView === 'structure'} onActiveFloor={openFloor} onActiveFlow={changeActiveFlow} relationPickTarget={relationPickTarget} onRelationPickTarget={setRelationPickTarget} onRelationPreview={setRelationPreview} onStagePreview={setStagePreviewTarget} connectionDraft={connectionDraft} onStartConnection={startConnection} onUpdateConnection={setConnectionDraft} onCancelConnection={() => setConnectionDraft(null)} onCommitConnection={commitConnection} onCollapse={() => setRightCollapsed(true)} scenarioFocusActive={scenarioFocusActive} onScenarioFocusChange={setScenarioFocus} />
      {historyOpen ? <aside className="utility-panel"><button type="button" className="rail-collapse-button rail-collapse-right" aria-label={t('shell.history.close')} onClick={() => setHistoryOpen(false)}>×</button><HistoryPanel documentId={document.id} onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo} onRestored={restoreDocument} /></aside> : null}
    </main>
    {exporting ? <ExportDialog document={document} activeFloorId={activeFloorId} filename={document.name} scope={exportScope} onScope={(scope) => { setExportScope(scope); setPreviousFloorId(null); setWorkspaceView(scope) }} onClose={() => setExporting(false)} /> : null}
    <CommandPalette open={commandPaletteOpen} document={document} activeFloorId={activeFloorId} onClose={() => setCommandPaletteOpen(false)} onSelect={(next, floorId) => { if (floorId) openFloor(floorId, next); else setSelection(next) }} onOpenFlow={(flowId) => { changeActiveFlow(flowId); setSelection({ kind: 'flow', id: flowId }) }} />
    <ShortcutHelp open={shortcutHelpOpen} onClose={() => setShortcutHelpOpen(false)} />
    {cinema && activeFlow && flowProgram ? <CinemaMode document={document} flow={activeFlow} program={flowProgram} onClose={() => { pauseFlow(); setCinema(false) }} /> : null}
  </div>
}
