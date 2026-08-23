import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import type { GridPoint, OntologyDocument, Selection, VisualNode } from '../../domain/types'
import { projectFloor } from '../../domain/floors'
import type { ConnectionDraft } from '../../editor/connection'
import type { RelationPreview } from '../../editor/RelationCandidatePicker'
import type { StagePreviewTarget } from '../../editor/ScenarioInspector'
import { portAnchors } from '../core/archetypes'
import { buildExitGeometries, buildExitRoute, exitExtent, exitRelationGeometry, type ExitGeometry } from '../core/exits'
import { visualiseNodes } from '../core/layout'
import { nodeIdsForStageState, type FlowProgram } from '../core/program'
import { buildRelationGeometry, type RelationGeometry } from '../core/routes'
import { buildScene, fitCamera, zoomAbout, type Camera, type District } from '../core/scene'
import type { StepDisplayMode } from '../core/step-display'
import { pointsAttribute, polylineLengths, toScreen } from '../core/iso'
import { useClockActiveKey } from '../stores/flow-clock'
import { Building } from './Building'
import { FlowAnimation } from './FlowAnimation'

type Props = {
  document: OntologyDocument
  floorId: string
  svgId?: string
  initialCamera?: Camera | null
  onCameraChange?: (camera: Camera | null) => void
  selection: Selection | null
  activeFlowId: string | null
  flowProgram: FlowProgram | null
  editable: boolean
  stepDisplayMode: StepDisplayMode
  relationPreview: RelationPreview | null
  stagePreviewTarget: StagePreviewTarget | null
  relationPickIds: ReadonlySet<string> | null
  onPickRelation: (id: string) => void
  onSelect: (selection: Selection | null) => void
  onOpenFloor?: (id: string) => void
  onMoveNode: (id: string, gx: number, gy: number) => void
  onMoveGroupFlag: (id: string, gx: number, gy: number) => void
  connectionDraft: ConnectionDraft | null
  onToggleConnectionTarget: (id: string) => void
  highlightedFloorId?: string | null
  viewportInsets?: { left: number; right: number; top: number; bottom: number }
  dezoom?: number
  onAddConcept?: () => void
}

function EmptyFloorPrompt({ onAddConcept }: { onAddConcept?: () => void }) {
  return <div className="canvas-empty">
    <div className="empty-floor-scene">
      <svg viewBox="0 0 440 250" aria-hidden="true">
        <defs><clipPath id="empty-floor-ground"><polygon points="34,131 218,35 406,130 220,230" /></clipPath></defs>
        <polygon className="empty-floor-shadow" points="42,141 218,49 398,140 220,238" />
        <polygon className="empty-floor-ground" points="34,131 218,35 406,130 220,230" />
        <g className="empty-floor-grid" clipPath="url(#empty-floor-ground)">
          <line x1="79" y1="107" x2="265" y2="203" /><line x1="125" y1="83" x2="312" y2="178" /><line x1="171" y1="59" x2="359" y2="154" />
          <line x1="80" y1="156" x2="266" y2="59" /><line x1="126" y1="181" x2="313" y2="83" /><line x1="173" y1="206" x2="360" y2="107" />
        </g>
        <polygon className="empty-floor-edge" points="34,131 218,35 406,130 220,230" />
        <ellipse className="empty-floor-target" cx="220" cy="132" rx="34" ry="17" />
      </svg>
      {onAddConcept ? <button type="button" className="empty-floor-action" onClick={onAddConcept}><i aria-hidden="true">+</i><span>Place first concept</span></button> : <span className="empty-floor-readonly">Add a concept from the left rail</span>}
    </div>
  </div>
}

type PanSession = { kind: 'pan'; pointerId: number; x: number; y: number; camera: Camera; moved: boolean; deferCapture: boolean }
type NodeDragSession = { kind: 'node'; pointerId: number; nodeId: string; startX: number; startY: number; start: GridPoint; alignments: GridPoint[]; camera: Camera; pending: GridPoint; centerOffset: GridPoint; guides: { gx?: number; gy?: number } | null; moved: boolean; frame: number }
type FlagDragSession = { kind: 'flag'; pointerId: number; groupId: string; startX: number; startY: number; start: GridPoint; camera: Camera; pending: GridPoint; moved: boolean; frame: number }
type InteractionSession = PanSession | NodeDragSession | FlagDragSession
type PointerPoint = { x: number; y: number }
type PinchSession = { pointerIds: [number, number]; distance: number; midpoint: PointerPoint; camera: Camera }

const ALIGNMENT_SNAP_DISTANCE = 0.6

function snapGridPoint(point: GridPoint): GridPoint {
  return { gx: Math.round(point.gx * 2) / 2, gy: Math.round(point.gy * 2) / 2 }
}

function snapToConnectedAxes(point: GridPoint, alignments: readonly GridPoint[]): GridPoint {
  let gx = point.gx
  let gy = point.gy
  let closestX = ALIGNMENT_SNAP_DISTANCE
  let closestY = ALIGNMENT_SNAP_DISTANCE
  for (const alignment of alignments) {
    const dx = Math.abs(point.gx - alignment.gx)
    if (dx < closestX) { gx = alignment.gx; closestX = dx }
    const dy = Math.abs(point.gy - alignment.gy)
    if (dy < closestY) { gy = alignment.gy; closestY = dy }
  }
  return { gx, gy }
}

function DistrictFlag({ district, selected, hovered, editable, dragging, onSelect, onHover, onMeasure, onDragStart }: { district: District; selected: boolean; hovered: boolean; editable: boolean; dragging: boolean; onSelect: () => void; onHover: (id: string | null) => void; onMeasure: (id: string, width: number) => void; onDragStart: (event: ReactPointerEvent<SVGGElement>) => void }) {
  const textRef = useRef<SVGTextElement | null>(null)
  useLayoutEffect(() => {
    let cancelled = false
    const measure = () => {
      if (cancelled || !textRef.current) return
      onMeasure(district.id, Math.ceil(textRef.current.getComputedTextLength()) + 12)
    }
    measure()
    void document.fonts.ready.then(measure)
    return () => { cancelled = true }
  }, [district.id, district.name, onMeasure])
  const flag = toScreen(district.flagAt.gx, district.flagAt.gy)
  return <g className={`district-flag ${selected ? 'is-selected' : ''} ${hovered ? 'is-hovered' : ''} ${dragging ? 'is-dragging' : ''}`} role="button" tabIndex={0} aria-label={`${district.name} neighborhood`} onPointerEnter={() => onHover(district.id)} onPointerLeave={() => onHover(null)} onFocus={() => onHover(district.id)} onBlur={() => onHover(null)} onPointerDown={(event) => { if (event.button !== 0 || !editable) return; event.stopPropagation(); onDragStart(event) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onSelect() } }} onClick={(event) => { event.stopPropagation(); onSelect() }}><line x1={flag.x} y1={flag.y} x2={flag.x} y2={flag.y - 34} className="flag-pole" vectorEffect="non-scaling-stroke" /><g transform={`translate(${flag.x + 4} ${flag.y - 34})`}><rect width={district.labelWidth} height="18" className="flag-label" vectorEffect="non-scaling-stroke" /><text ref={textRef} x="6" y="12.5">{district.name}</text></g></g>
}

function orientGeometry(geometry: RelationGeometry, reverse: boolean): RelationGeometry {
  if (!reverse) return geometry
  const points = [...geometry.points].reverse()
  const { cumulative, total } = polylineLengths(points)
  return { ...geometry, points, cumulative, total, fromSide: geometry.toSide, toSide: geometry.fromSide }
}

export function IsoCanvas({ document, floorId, svgId = 'ontology-map-svg', initialCamera = null, onCameraChange, selection, activeFlowId, flowProgram, editable, stepDisplayMode, relationPreview, stagePreviewTarget, relationPickIds, onPickRelation, onSelect, onOpenFloor, onMoveNode, onMoveGroupFlag, connectionDraft, onToggleConnectionTarget, highlightedFloorId, viewportInsets, dezoom, onAddConcept }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [cameraOverride, setCameraOverride] = useState<Camera | null>(initialCamera)
  const [flagWidths, setFlagWidths] = useState<ReadonlyMap<string, number>>(() => new Map())
  const [dragPositions, setDragPositions] = useState<ReadonlyMap<string, { gx: number; gy: number }>>(() => new Map())
  const [dragFlagPositions, setDragFlagPositions] = useState<ReadonlyMap<string, GridPoint>>(() => new Map())
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const [alignmentGuides, setAlignmentGuides] = useState<{ gx?: number; gy?: number } | null>(null)
  const [draggingFlagId, setDraggingFlagId] = useState<string | null>(null)
  const [hoveredDistrictId, setHoveredDistrictId] = useState<string | null>(null)
  const [hoveredExitId, setHoveredExitId] = useState<string | null>(null)
  const interaction = useRef<InteractionSession | null>(null)
  const activePointers = useRef(new Map<number, PointerPoint>())
  const pinch = useRef<PinchSession | null>(null)
  const suppressCanvasClick = useRef(false)
  const clickSuppressionTimer = useRef(0)
  const projection = useMemo(() => projectFloor(document, floorId), [document, floorId])
  const positionedNodes = useMemo(() => (projection?.nodes ?? []).map((node) => dragPositions.has(node.id) ? { ...node, position: dragPositions.get(node.id)! } : node), [dragPositions, projection])
  const nodes = useMemo(() => visualiseNodes(positionedNodes), [positionedNodes])
  const flagPositions = useMemo(() => ({ ...projection?.floor.groupFlagPositions, ...Object.fromEntries(dragFlagPositions) }), [dragFlagPositions, projection?.floor.groupFlagPositions])
  const exits = useMemo(() => buildExitGeometries(document, floorId, nodes), [document, floorId, nodes])
  const exitExtents = useMemo(() => [...exits.values()].map(exitExtent), [exits])
  const scene = useMemo(() => buildScene(projection?.groups ?? [], nodes, `${document.id}:${floorId}:${document.updatedAt}`, flagWidths, flagPositions, exitExtents), [document.id, document.updatedAt, exitExtents, flagPositions, flagWidths, floorId, nodes, projection?.groups])
  const visibleRelations = useMemo(() => projection?.relations ?? [], [projection])
  const geometry = useMemo(() => buildRelationGeometry(nodes, visibleRelations), [nodes, visibleRelations])
  const previewRelations = useMemo(() => connectionDraft ? connectionDraft.targets.map((target, index) => ({ id: `preview-${index}`, from: target.direction === 'outbound' ? connectionDraft.sourceId : target.nodeId, to: target.direction === 'outbound' ? target.nodeId : connectionDraft.sourceId, kind: connectionDraft.kind, label: connectionDraft.label })) : [], [connectionDraft])
  const previewGeometry = useMemo(() => buildRelationGeometry(nodes, previewRelations), [nodes, previewRelations])
  const connectionExitPreviews = useMemo(() => {
    if (!connectionDraft) return []
    const localById = new Map(nodes.map((node) => [node.id, node]))
    return connectionDraft.targets.flatMap((target) => {
      const sourceLocal = localById.get(connectionDraft.sourceId)
      const targetLocal = localById.get(target.nodeId)
      const local = sourceLocal && !targetLocal ? sourceLocal : targetLocal && !sourceLocal ? targetLocal : null
      if (!local) return []
      const remoteId = local.id === connectionDraft.sourceId ? target.nodeId : connectionDraft.sourceId
      const remote = document.nodes.find((candidate) => candidate.id === remoteId)
      if (!remote) return []
      const currentIndex = document.floors.findIndex((floor) => floor.id === floorId)
      const remoteIndex = document.floors.findIndex((floor) => floor.id === remote.floorId)
      if (currentIndex < 0 || remoteIndex < 0 || remoteIndex === currentIndex) return []
      const route = buildExitRoute(local, remoteIndex > currentIndex ? 'down' : 'up', nodes)
      return route ? [{ key: `exit-preview-${target.nodeId}`, points: route.points }] : []
    })
  }, [connectionDraft, document.floors, document.nodes, floorId, nodes])
  const previewStage = stagePreviewTarget ? document.flows.find((flow) => flow.id === stagePreviewTarget.flowId)?.stages.find((stage) => stage.id === stagePreviewTarget.stageId) ?? null : null
  const routePreviews = (relationPreview
    ? [{ key: 'candidate', relationId: relationPreview.relationId, direction: relationPreview.direction }]
    : previewStage?.traversals.map((traversal) => ({ key: traversal.id, relationId: traversal.relationId, direction: traversal.direction })) ?? [])
    .flatMap((preview) => {
      const route = geometry.get(preview.relationId)
      if (route) return [{ key: preview.key, points: preview.direction === 'reverse' ? [...route.points].reverse() : route.points }]
      const exit = exits.get(preview.relationId)
      if (!exit) return []
      const relation = document.relations.find((candidate) => candidate.id === preview.relationId)
      const outwardIsForward = relation ? relation.from === exit.localNodeId : true
      return [{ key: preview.key, points: exitRelationGeometry(exit, preview.direction === 'forward' ? !outwardIsForward : outwardIsForward).points }]
    })
  const previewNodeIds = new Set<string>()
  if (!relationPreview && previewStage) {
    for (const traversal of previewStage.traversals) {
      const relation = document.relations.find((candidate) => candidate.id === traversal.relationId)
      if (relation) { previewNodeIds.add(relation.from); previewNodeIds.add(relation.to) }
    }
  }
  const activeFlow = document.flows.find((flow) => flow.id === activeFlowId) ?? null
  const relationById = useMemo(() => new Map(document.relations.map((relation) => [relation.id, relation])), [document.relations])
  const nodeById = useMemo(() => new Map(document.nodes.map((node) => [node.id, node])), [document.nodes])
  const program = useMemo(() => flowProgram ? {
    ...flowProgram,
    stages: flowProgram.stages.map((stage) => ({
      ...stage,
      branches: stage.branches.flatMap((branch) => {
        const route = geometry.get(branch.relationId)
        const relation = relationById.get(branch.relationId)
        if (route && relation) return [{ ...branch, geometry: orientGeometry(route, branch.sourceId !== relation.from) }]
        const exit = exits.get(branch.relationId)
        if (!exit || !relation) return []
        return [{ ...branch, geometry: exitRelationGeometry(exit, branch.sourceId !== exit.localNodeId) }]
      }),
    })),
  } : null, [exits, flowProgram, geometry, relationById])
  const activeClockKey = useClockActiveKey()
  const arrivalIds = useMemo(() => {
    if (!program) return undefined
    const ids = new Set<string>()
    for (const stage of program.stages) for (const branch of stage.branches) {
      const exit = exits.get(branch.relationId)
      if (exit && branch.targetId === exit.localNodeId) ids.add(branch.relationId)
    }
    return ids.size ? ids : undefined
  }, [exits, program])
  const groupedExits = useMemo(() => {
    const map = new Map<string, { floorId: string; floorName: string; direction: ExitGeometry['direction']; exits: ExitGeometry[] }>()
    for (const exit of exits.values()) {
      const entry = map.get(exit.floorId)
      if (entry) entry.exits.push(exit)
      else map.set(exit.floorId, { floorId: exit.floorId, floorName: exit.floorName, direction: exit.direction, exits: [exit] })
    }
    return [...map.values()]
  }, [exits])
  const insets = viewportInsets ?? { left: 0, right: 0, top: 0, bottom: 0 }
  const fitted = size.width > 0 ? fitCamera(size.width, size.height, scene.bounds, insets, dezoom) : null
  const camera = cameraOverride ?? fitted
  const relationPicking = relationPickIds !== null
  const updateCamera = (next: Camera | null) => {
    setCameraOverride(next)
    onCameraChange?.(next)
  }
  const zoomAtCenter = (factor: number) => {
    if (!camera) return
    const cx = insets.left + (size.width - insets.left - insets.right) / 2
    const cy = insets.top + (size.height - insets.top - insets.bottom) / 2
    updateCamera(zoomAbout(camera, factor, cx, cy))
  }
  const selectNode = (id: string) => onSelect({ kind: 'node', id })
  const conceptLabel = (id: string) => {
    const node = nodeById.get(id)
    if (!node) return 'Unknown concept'
    const code = node.code.trim()
    return code ? `${code} ${node.name}` : node.name
  }

  useLayoutEffect(() => {
    const element = containerRef.current
    if (!element) return
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const handler = (event: WheelEvent) => {
      event.preventDefault()
      if (!camera || (interaction.current && interaction.current.kind !== 'pan')) return
      const rect = svg.getBoundingClientRect()
      updateCamera(zoomAbout(camera, Math.exp(-event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top))
    }
    svg.addEventListener('wheel', handler, { passive: false })
    return () => svg.removeEventListener('wheel', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera])

  const flowNodeIds = program ? new Set(program.nodeIds) : null
  const activeParts = activeClockKey.split(':')
  const activeNodeSet = program && activeParts[0] === program.id
    ? nodeIdsForStageState(program, Number(activeParts[1]), 'travel')
    : new Set<string>()
  const measureFlag = useCallback((id: string, width: number) => setFlagWidths((current) => {
    if (Math.abs((current.get(id) ?? 0) - width) < 0.5) return current
    const next = new Map(current)
    next.set(id, width)
    return next
  }), [])
  const previewNodePosition = (id: string, gx: number, gy: number) => setDragPositions((current) => {
    const existing = current.get(id)
    if (existing?.gx === gx && existing.gy === gy) return current
    const next = new Map(current)
    next.set(id, { gx, gy })
    return next
  })
  const cancelNodePosition = (id: string) => setDragPositions((current) => {
    if (!current.has(id)) return current
    const next = new Map(current)
    next.delete(id)
    return next
  })
  const previewFlagPosition = (id: string, position: GridPoint) => setDragFlagPositions((current) => {
    const existing = current.get(id)
    if (existing?.gx === position.gx && existing.gy === position.gy) return current
    const next = new Map(current)
    next.set(id, position)
    return next
  })
  const cancelFlagPosition = (id: string) => setDragFlagPositions((current) => {
    if (!current.has(id)) return current
    const next = new Map(current)
    next.delete(id)
    return next
  })
  const releasePointer = (pointerId: number) => {
    const svg = svgRef.current
    if (svg?.hasPointerCapture(pointerId)) svg.releasePointerCapture(pointerId)
  }
  const suppressNextClick = () => {
    suppressCanvasClick.current = true
    window.clearTimeout(clickSuppressionTimer.current)
    clickSuppressionTimer.current = window.setTimeout(() => { suppressCanvasClick.current = false }, 0)
  }
  const endInteraction = (commit: boolean) => {
    const session = interaction.current
    if (!session) return
    interaction.current = null
    if (session.kind === 'pan') {
      releasePointer(session.pointerId)
      if (session.moved) suppressNextClick()
      return
    }
    if (session.frame) cancelAnimationFrame(session.frame)
    releasePointer(session.pointerId)
    if (session.kind === 'node') {
      setDraggingNodeId(null)
      setAlignmentGuides(null)
      if (!commit || !session.moved) {
        cancelNodePosition(session.nodeId)
        if (commit && !session.moved) {
          suppressNextClick()
          selectNode(session.nodeId)
        }
        return
      }
      const position = session.pending
      cancelNodePosition(session.nodeId)
      suppressNextClick()
      onMoveNode(session.nodeId, position.gx, position.gy)
      return
    }
    setDraggingFlagId(null)
    if (!commit || !session.moved) {
      cancelFlagPosition(session.groupId)
      if (commit && !session.moved) {
        suppressNextClick()
        onSelect({ kind: 'group', id: session.groupId })
      }
      return
    }
    const position = session.pending
    cancelFlagPosition(session.groupId)
    suppressNextClick()
    onMoveGroupFlag(session.groupId, position.gx, position.gy)
  }
  const cancelInteraction = useEffectEvent(() => {
    const pointerIds = pinch.current?.pointerIds
    pinch.current = null
    activePointers.current.clear()
    if (pointerIds) {
      interaction.current = null
      for (const pointerId of pointerIds) releasePointer(pointerId)
      return
    }
    endInteraction(false)
  })

  useEffect(() => {
    const cancel = () => cancelInteraction()
    const visibility = () => { if (window.document.hidden) cancel() }
    window.addEventListener('blur', cancel)
    window.document.addEventListener('visibilitychange', visibility)
    return () => {
      window.removeEventListener('blur', cancel)
      window.document.removeEventListener('visibilitychange', visibility)
      window.clearTimeout(clickSuppressionTimer.current)
      cancel()
    }
  }, [])

  const startNodeDrag = (event: ReactPointerEvent<SVGGElement>, node: VisualNode) => {
    if (!camera || interaction.current) return
    const svg = svgRef.current
    if (!svg) return
    const connectedIds = new Set(visibleRelations.flatMap((relation) => relation.from === node.id ? [relation.to] : relation.to === node.id ? [relation.from] : []))
    const alignments = nodes.filter((candidate) => connectedIds.has(candidate.id)).map((candidate) => ({
      gx: candidate.footprint.gx + candidate.footprint.w / 2 - node.footprint.w / 2,
      gy: candidate.footprint.gy + candidate.footprint.d / 2 - node.footprint.d / 2,
    }))
    updateCamera(camera)
    interaction.current = { kind: 'node', pointerId: event.pointerId, nodeId: node.id, startX: event.clientX, startY: event.clientY, start: node.position, alignments, camera, pending: node.position, centerOffset: { gx: node.footprint.w / 2, gy: node.footprint.d / 2 }, guides: null, moved: false, frame: 0 }
    setDraggingNodeId(node.id)
    svg.setPointerCapture(event.pointerId)
  }
  const startFlagDrag = (event: ReactPointerEvent<SVGGElement>, district: District) => {
    if (!camera || interaction.current) return
    const svg = svgRef.current
    if (!svg) return
    updateCamera(camera)
    interaction.current = { kind: 'flag', pointerId: event.pointerId, groupId: district.id, startX: event.clientX, startY: event.clientY, start: district.flagAt, camera, pending: district.flagAt, moved: false, frame: 0 }
    setDraggingFlagId(district.id)
    svg.setPointerCapture(event.pointerId)
  }

  const orderedShapes = draggingNodeId
    ? [...scene.shapes.filter((node) => node.id !== draggingNodeId), ...scene.shapes.filter((node) => node.id === draggingNodeId)]
    : scene.shapes
  const exitFloorHoverClass = (remoteFloorId: string) => {
    const highlightedRemoteFloorId = highlightedFloorId === floorId ? null : highlightedFloorId
    return highlightedRemoteFloorId ? highlightedRemoteFloorId === remoteFloorId ? 'is-floor-hovered' : 'is-floor-hover-dimmed' : ''
  }
  const guideExtent = useMemo(() => {
    if (!nodes.length) return null
    return {
      minGx: Math.floor(Math.min(...nodes.map((node) => node.footprint.gx))) - 2,
      minGy: Math.floor(Math.min(...nodes.map((node) => node.footprint.gy))) - 2,
      maxGx: Math.ceil(Math.max(...nodes.map((node) => node.footprint.gx + node.footprint.w))) + 2,
      maxGy: Math.ceil(Math.max(...nodes.map((node) => node.footprint.gy + node.footprint.d))) + 2,
    }
  }, [nodes])

  return (
    <div className={`canvas-wrap ${relationPicking ? 'is-relation-picking' : ''}`} ref={containerRef}>
      {nodes.length === 0 ? (
        <EmptyFloorPrompt onAddConcept={editable ? onAddConcept : undefined} />
      ) : null}
      <svg
        ref={svgRef}
        id={svgId}
        className="iso-canvas"
        tabIndex={0}
        aria-label="Interactive ontology map"
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return
          if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomAtCenter(1.25) }
          else if (event.key === '-') { event.preventDefault(); zoomAtCenter(0.8) }
          else if (event.key === '0') { event.preventDefault(); updateCamera(null) }
        }}
        onClick={() => {
          if (suppressCanvasClick.current) { suppressCanvasClick.current = false; return }
          if (!relationPicking) onSelect(null)
        }}
        onPointerDown={(event) => {
          if (event.button !== 0 || !camera) return
          activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
          const session = interaction.current
          if (session?.kind === 'pan' && session.pointerId !== event.pointerId) {
            const first = activePointers.current.get(session.pointerId)
            if (!first) return
            const dx = event.clientX - first.x
            const dy = event.clientY - first.y
            pinch.current = { pointerIds: [session.pointerId, event.pointerId], distance: Math.max(1, Math.hypot(dx, dy)), midpoint: { x: (first.x + event.clientX) / 2, y: (first.y + event.clientY) / 2 }, camera }
            if (!event.currentTarget.hasPointerCapture(session.pointerId)) event.currentTarget.setPointerCapture(session.pointerId)
            event.currentTarget.setPointerCapture(event.pointerId)
            return
          }
          if (interaction.current) return
          const target = event.target as Element
          const deferCapture = Boolean(target.closest('.district, .district-flag'))
          interaction.current = { kind: 'pan', pointerId: event.pointerId, x: event.clientX, y: event.clientY, camera, moved: false, deferCapture }
          if (!deferCapture) event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (activePointers.current.has(event.pointerId)) activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
          const pinchSession = pinch.current
          if (pinchSession?.pointerIds.includes(event.pointerId)) {
            const first = activePointers.current.get(pinchSession.pointerIds[0])
            const second = activePointers.current.get(pinchSession.pointerIds[1])
            if (!first || !second) return
            const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }
            const next = zoomAbout(pinchSession.camera, Math.hypot(second.x - first.x, second.y - first.y) / pinchSession.distance, pinchSession.midpoint.x, pinchSession.midpoint.y)
            updateCamera({ ...next, x: next.x + midpoint.x - pinchSession.midpoint.x, y: next.y + midpoint.y - pinchSession.midpoint.y })
            return
          }
          const session = interaction.current
          if (!session || session.pointerId !== event.pointerId) return
          if (event.buttons === 0) { endInteraction(session.kind !== 'pan'); return }
          if (session.kind === 'pan') {
            if (!session.moved) {
              if (Math.hypot(event.clientX - session.x, event.clientY - session.y) <= 4) return
              session.moved = true
              if (session.deferCapture && !event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId)
            }
            updateCamera({ ...session.camera, x: session.camera.x + event.clientX - session.x, y: session.camera.y + event.clientY - session.y })
            return
          }
          const dx = (event.clientX - session.startX) / session.camera.k
          const dy = (event.clientY - session.startY) / session.camera.k
          session.moved ||= Math.hypot(event.clientX - session.startX, event.clientY - session.startY) > 4
          if (!session.moved) return
          const pending = snapGridPoint({ gx: session.start.gx + dx / 48 + dy / 24, gy: session.start.gy + dy / 24 - dx / 48 })
          if (session.kind === 'node') {
            session.pending = snapToConnectedAxes(pending, session.alignments)
            session.guides = {
              gx: session.pending.gx !== pending.gx ? session.pending.gx + session.centerOffset.gx : undefined,
              gy: session.pending.gy !== pending.gy ? session.pending.gy + session.centerOffset.gy : undefined,
            }
          } else session.pending = pending
          if (!session.frame) session.frame = requestAnimationFrame(() => {
            if (interaction.current !== session) return
            session.frame = 0
            if (session.kind === 'node') {
              previewNodePosition(session.nodeId, session.pending.gx, session.pending.gy)
              setAlignmentGuides(session.guides)
            } else previewFlagPosition(session.groupId, session.pending)
          })
        }}
        onPointerUp={(event) => {
          activePointers.current.delete(event.pointerId)
          if (pinch.current?.pointerIds.includes(event.pointerId)) {
            const pointerIds = pinch.current.pointerIds
            pinch.current = null
            interaction.current = null
            activePointers.current.clear()
            for (const pointerId of pointerIds) releasePointer(pointerId)
            suppressNextClick()
            return
          }
          if (interaction.current?.pointerId === event.pointerId) endInteraction(true)
        }}
        onPointerCancel={(event) => {
          activePointers.current.delete(event.pointerId)
          if (pinch.current?.pointerIds.includes(event.pointerId)) {
            const pointerIds = pinch.current.pointerIds
            pinch.current = null
            interaction.current = null
            activePointers.current.clear()
            for (const pointerId of pointerIds) releasePointer(pointerId)
            return
          }
          if (interaction.current?.pointerId === event.pointerId) endInteraction(false)
        }}
        onLostPointerCapture={(event) => { if (interaction.current?.pointerId === event.pointerId) endInteraction(false) }}
      >
        <defs>
          <pattern id="map-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" className="hatch-line" /></pattern>
        </defs>
        {camera ? (
          <g transform={`translate(${camera.x} ${camera.y}) scale(${camera.k})`}>
            <g className="floor-grid">{scene.grid.map((line) => <line key={line.key} x1={line.a.x} y1={line.a.y} x2={line.b.x} y2={line.b.y} vectorEffect="non-scaling-stroke" />)}</g>
            {alignmentGuides && guideExtent ? <g className="floor-grid alignment-guides" aria-hidden="true">
              {alignmentGuides.gx !== undefined ? (() => { const a = toScreen(alignmentGuides.gx, guideExtent.minGy); const b = toScreen(alignmentGuides.gx, guideExtent.maxGy); return <line className="alignment-guide alignment-guide-x" x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={{ stroke: 'var(--accent)', strokeWidth: 1.5 }} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" /> })() : null}
              {alignmentGuides.gy !== undefined ? (() => { const a = toScreen(guideExtent.minGx, alignmentGuides.gy); const b = toScreen(guideExtent.maxGx, alignmentGuides.gy); return <line className="alignment-guide alignment-guide-y" x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={{ stroke: 'var(--accent)', strokeWidth: 1.5 }} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" /> })() : null}
            </g> : null}
            <g className="districts">
              {scene.districts.map((district) => {
                const corners = [toScreen(district.rect.gx, district.rect.gy), toScreen(district.rect.gx + district.rect.w, district.rect.gy), toScreen(district.rect.gx + district.rect.w, district.rect.gy + district.rect.d), toScreen(district.rect.gx, district.rect.gy + district.rect.d)]
                 return <g key={district.id} className={`district ${selection?.kind === 'group' && selection.id === district.id ? 'is-selected' : ''} ${hoveredDistrictId === district.id ? 'is-hovered' : ''}`} role="button" tabIndex={0} aria-label={`${district.name} neighborhood`} onPointerEnter={() => setHoveredDistrictId(district.id)} onPointerLeave={() => setHoveredDistrictId(null)} onFocus={() => setHoveredDistrictId(district.id)} onBlur={() => setHoveredDistrictId(null)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); if (!relationPicking) onSelect({ kind: 'group', id: district.id }) } }} onClick={(event) => { event.stopPropagation(); if (!relationPicking) onSelect({ kind: 'group', id: district.id }) }}><polygon points={pointsAttribute(corners)} className="district-plate" vectorEffect="non-scaling-stroke" /></g>
              })}
            </g>
            <g className="relations" onPointerDown={(event) => event.stopPropagation()}>
              {visibleRelations.map((relation) => {
                const route = geometry.get(relation.id)
                if (!route) return null
                const selected = selection?.kind === 'relation' && selection.id === relation.id
                const pickable = relationPickIds?.has(relation.id) ?? false
                const end = route.points[route.points.length - 1]!
                const before = route.points[route.points.length - 2] ?? end
                const angle = Math.atan2(end.y - before.y, end.x - before.x) * 180 / Math.PI
                const labelWidth = Math.max(42, relation.label.length * 5.5 + 14)
                 return <g key={relation.id} className={`relation relation-${relation.kind} ${selected ? 'is-selected' : ''} ${program && !relationPicking ? 'is-dimmed' : ''} ${relationPicking ? pickable ? 'is-pickable' : 'is-pick-disabled' : ''}`} role="button" tabIndex={pickable || !relationPicking ? 0 : -1} aria-label={`${relation.label}: ${conceptLabel(relation.from)} to ${conceptLabel(relation.to)}`} aria-disabled={relationPicking && !pickable ? true : undefined} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); if (relationPicking) { if (pickable) onPickRelation(relation.id) } else onSelect({ kind: 'relation', id: relation.id }) } }} onClick={(event) => { event.stopPropagation(); if (relationPicking) { if (pickable) onPickRelation(relation.id) } else onSelect({ kind: 'relation', id: relation.id }) }}><polyline points={pointsAttribute(route.points)} className="relation-line" vectorEffect="non-scaling-stroke" /><path d="M 0 0 L -7 3.5 L -7 -3.5 Z" transform={`translate(${end.x} ${end.y}) rotate(${angle})`} className="relation-arrow" vectorEffect="non-scaling-stroke" /><g className="relation-label" transform={`translate(${route.labelPoint.x} ${route.labelPoint.y - 11})`}><rect x={-labelWidth / 2} y="-8" width={labelWidth} height="16" rx="3" vectorEffect="non-scaling-stroke" /><text textAnchor="middle" dominantBaseline="central">{relation.label}</text></g><polyline points={pointsAttribute(route.points)} className="relation-hit" vectorEffect="non-scaling-stroke"><title>{relation.label}</title></polyline></g>
              })}
              {previewRelations.map((relation) => {
                const route = previewGeometry.get(relation.id)
                if (!route) return null
                return <polyline key={relation.id} points={pointsAttribute(route.points)} className="connection-preview" vectorEffect="non-scaling-stroke" />
              })}
              {connectionExitPreviews.map((preview) => <polyline key={preview.key} points={pointsAttribute(preview.points)} className="connection-preview" vectorEffect="non-scaling-stroke" />)}
              {routePreviews.map((preview) => {
                const end = preview.points[preview.points.length - 1]!
                const before = preview.points[preview.points.length - 2] ?? end
                const angle = Math.atan2(end.y - before.y, end.x - before.x) * 180 / Math.PI
                return <g key={preview.key} className="candidate-relation-preview"><polyline points={pointsAttribute(preview.points)} vectorEffect="non-scaling-stroke" /><path d="M 0 0 L -8 4 L -8 -4 Z" transform={`translate(${end.x} ${end.y}) rotate(${angle})`} /></g>
              })}
             </g>
             <g className="floor-exit-ground-routes">{groupedExits.flatMap((group) => group.exits.map((exit) => {
               const relation = relationById.get(exit.relationId)
               if (!relation) return null
               const selected = selection?.kind === 'relation' && selection.id === exit.relationId
               const pickable = relationPickIds?.has(exit.relationId) ?? false
               const dimmed = program !== null && !relationPicking
               const isOutgoing = relation.from === exit.localNodeId
               const arrowAngle = isOutgoing ? (exit.direction === 'down' ? 90 : -90) : (exit.direction === 'down' ? -90 : 90)
               const gradientId = `${svgId}-exit-fade-${exit.relationId}`
               const handleSelect = () => {
                 if (relationPicking) { if (pickable) onPickRelation(exit.relationId) }
                 else onSelect({ kind: 'relation', id: exit.relationId })
               }
               return <g key={exit.relationId} className={`floor-exit-ground floor-exit relation-${relation.kind} ${isOutgoing ? 'is-outgoing' : 'is-incoming'} ${hoveredExitId === exit.relationId ? 'is-hovered' : ''} ${selected ? 'is-selected' : ''} ${dimmed ? 'is-dimmed' : ''} ${exitFloorHoverClass(group.floorId)} ${relationPicking ? pickable ? 'is-pickable' : 'is-pick-disabled' : ''}`} onPointerEnter={() => setHoveredExitId(exit.relationId)} onPointerLeave={() => setHoveredExitId(null)} onClick={(event) => { event.stopPropagation(); handleSelect() }} onDoubleClick={(event) => { event.stopPropagation(); onOpenFloor?.(group.floorId) }}>
                  <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={exit.dropStart.x} y1={exit.dropStart.y} x2={exit.dropEnd.x} y2={exit.dropEnd.y}><stop offset="0" className="exit-fade-from" /><stop offset=".7" className="exit-fade-from" /><stop offset="1" className="exit-fade-to" /></linearGradient>
                 <polyline points={pointsAttribute([exit.points[0]!, exit.points[1]!])} className="relation-line" vectorEffect="non-scaling-stroke" />
                 <polyline points={pointsAttribute([exit.dropStart, exit.dropEnd])} className={`relation-line exit-drop ${isOutgoing ? '' : 'is-incoming'}`} style={{ '--exit-stroke': `url(#${gradientId})` } as CSSProperties} vectorEffect="non-scaling-stroke" />
                 <path d="M 0 0 L -7 3.5 L -7 -3.5 Z" transform={`translate(${exit.dropEnd.x} ${exit.dropEnd.y}) rotate(${arrowAngle})`} className="relation-arrow" vectorEffect="non-scaling-stroke" />
                 <polyline points={pointsAttribute(exit.points)} className="relation-hit" vectorEffect="non-scaling-stroke"><title>{relation.label} {isOutgoing ? '→' : '←'} {group.floorName}</title></polyline>
               </g>
             }))}</g>
             {orderedShapes.map((node) => <Building key={node.id} node={node} selected={selection?.kind === 'node' && selection.id === node.id} dimmed={flowNodeIds !== null && !flowNodeIds.has(node.id)} active={activeNodeSet.has(node.id)} previewed={previewNodeIds.has(node.id)} editable={editable && !connectionDraft && !relationPicking} connectionMode={connectionDraft !== null} connectionSource={connectionDraft?.sourceId === node.id} connectionTarget={connectionDraft?.targets.some((target) => target.nodeId === node.id)} onSelect={() => {
               if (suppressCanvasClick.current) { suppressCanvasClick.current = false; return }
               if (connectionDraft) onToggleConnectionTarget(node.id)
               else if (!relationPicking) selectNode(node.id)
             }} onDragStart={(event) => startNodeDrag(event, node)} />)}
             {selection?.kind === 'relation' ? <g className="selected-relation-overlay" pointerEvents="none">
               {visibleRelations.filter((relation) => relation.id === selection.id).map((relation) => {
                 const route = geometry.get(relation.id)
                 if (!route) return null
                 const end = route.points[route.points.length - 1]!
                 const before = route.points[route.points.length - 2] ?? end
                 const angle = Math.atan2(end.y - before.y, end.x - before.x) * 180 / Math.PI
                 const labelWidth = Math.max(42, relation.label.length * 5.5 + 14)
                 return <g key={relation.id} className={`relation relation-${relation.kind} is-selected`}><polyline points={pointsAttribute(route.points)} className="relation-line" vectorEffect="non-scaling-stroke" /><path d="M 0 0 L -7 3.5 L -7 -3.5 Z" transform={`translate(${end.x} ${end.y}) rotate(${angle})`} className="relation-arrow" vectorEffect="non-scaling-stroke" /><g className="relation-label" transform={`translate(${route.labelPoint.x} ${route.labelPoint.y - 11})`}><rect x={-labelWidth / 2} y="-8" width={labelWidth} height="16" rx="3" vectorEffect="non-scaling-stroke" /><text textAnchor="middle" dominantBaseline="central">{relation.label}</text></g></g>
               })}
               {groupedExits.flatMap((group) => group.exits.filter((exit) => exit.relationId === selection.id).map((exit) => {
                 const relation = relationById.get(exit.relationId)
                 if (!relation) return null
                 const isOutgoing = relation.from === exit.localNodeId
                 const arrowAngle = isOutgoing ? (exit.direction === 'down' ? 90 : -90) : (exit.direction === 'down' ? -90 : 90)
                 const gradientId = `${svgId}-exit-fade-${exit.relationId}`
                 return <g key={exit.relationId} className={`floor-exit relation-${relation.kind} ${isOutgoing ? 'is-outgoing' : 'is-incoming'} is-selected`}><polyline points={pointsAttribute([exit.points[0]!, exit.points[1]!])} className="relation-line" vectorEffect="non-scaling-stroke" /><polyline points={pointsAttribute([exit.dropStart, exit.dropEnd])} className={`relation-line exit-drop ${isOutgoing ? '' : 'is-incoming'}`} style={{ '--exit-stroke': `url(#${gradientId})` } as CSSProperties} vectorEffect="non-scaling-stroke" /><path d="M 0 0 L -7 3.5 L -7 -3.5 Z" transform={`translate(${exit.dropEnd.x} ${exit.dropEnd.y}) rotate(${arrowAngle})`} className="relation-arrow" vectorEffect="non-scaling-stroke" /></g>
               }))}
             </g> : null}
             <g className="floor-exits" onPointerDown={(event) => event.stopPropagation()}>{groupedExits.map((group) => {
              return <g key={group.floorId} className="floor-exit-group">
                {group.exits.map((exit) => {
                  const relation = relationById.get(exit.relationId)
                  if (!relation) return null
                  const selected = selection?.kind === 'relation' && selection.id === exit.relationId
                   const pickable = relationPickIds?.has(exit.relationId) ?? false
                   const dimmed = program !== null && !relationPicking
                   const floorHoverClass = exitFloorHoverClass(group.floorId)
                   const isOutgoing = relation.from === exit.localNodeId
                   const labelWidth = Math.max(42, relation.label.length * 5.5 + 14)
                  const handleSelect = () => {
                    if (relationPicking) { if (pickable) onPickRelation(exit.relationId) }
                    else onSelect({ kind: 'relation', id: exit.relationId })
                  }
                   return <g key={exit.relationId} className={`floor-exit relation-${relation.kind} ${isOutgoing ? 'is-outgoing' : 'is-incoming'} ${selected ? 'is-selected' : ''} ${dimmed ? 'is-dimmed' : ''} ${floorHoverClass} ${relationPicking ? pickable ? 'is-pickable' : 'is-pick-disabled' : ''}`} onPointerEnter={() => setHoveredExitId(exit.relationId)} onPointerLeave={() => setHoveredExitId(null)} onFocusCapture={() => setHoveredExitId(exit.relationId)} onBlurCapture={() => setHoveredExitId(null)}>
                      <g role="button" tabIndex={pickable || !relationPicking ? 0 : -1} aria-label={`${relation.label}: ${conceptLabel(relation.from)} to ${conceptLabel(relation.to)}, ${group.floorName}`} aria-disabled={relationPicking && !pickable ? true : undefined} className="floor-exit-line" onClick={(event) => { event.stopPropagation(); handleSelect() }} onDoubleClick={(event) => { event.stopPropagation(); onOpenFloor?.(group.floorId) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); handleSelect() } }}>
                       <g className="relation-label" transform={`translate(${exit.labelPoint.x} ${exit.labelPoint.y - 11})`}>
                         <rect x={-labelWidth / 2} y="-8" width={labelWidth} height="16" rx="3" vectorEffect="non-scaling-stroke" />
                         <text textAnchor="middle" dominantBaseline="central">{relation.label}</text>
                       </g>
                       <polyline points={pointsAttribute(exit.points)} className="relation-hit" vectorEffect="non-scaling-stroke"><title>{relation.label} {isOutgoing ? '→' : '←'} {group.floorName}</title></polyline>
                       <polyline points={pointsAttribute([exit.dropStart, exit.dropEnd])} className="relation-hit" vectorEffect="non-scaling-stroke" />
                      </g>
                  </g>
                })}
              </g>
            })}</g>
            {program && activeFlow ? <FlowAnimation program={program} flow={activeFlow} stepDisplayMode={stepDisplayMode} arrivalIds={arrivalIds} /> : null}
            {connectionDraft ? <g className="connection-ports">{scene.shapes.map((node) => Object.entries(portAnchors(node.footprint)).map(([side, point]) => { const screen = toScreen(point.gx, point.gy); const source = node.id === connectionDraft.sourceId; const target = connectionDraft.targets.some((item) => item.nodeId === node.id); return <circle key={`${node.id}-${side}`} cx={screen.x} cy={screen.y} r={source || target ? 4.5 : 3} className={`${source ? 'is-source' : ''} ${target ? 'is-target' : ''}`} vectorEffect="non-scaling-stroke" onClick={(event) => { event.stopPropagation(); onToggleConnectionTarget(node.id) }} /> }))}</g> : null}
            <g className="district-flags">
              {scene.districts.map((district) => <DistrictFlag key={district.id} district={district} selected={selection?.kind === 'group' && selection.id === district.id} hovered={hoveredDistrictId === district.id} editable={editable && !connectionDraft && !relationPicking} dragging={draggingFlagId === district.id} onSelect={() => { if (suppressCanvasClick.current) { suppressCanvasClick.current = false; return }; if (!relationPicking) onSelect({ kind: 'group', id: district.id }) }} onHover={setHoveredDistrictId} onMeasure={measureFlag} onDragStart={(event) => startFlagDrag(event, district)} />)}
            </g>
          </g>
        ) : null}
      </svg>
      <div className="camera-controls"><button type="button" onClick={() => updateCamera(null)} aria-label="Recenter map" title="Recenter">⌾</button><button type="button" onClick={() => zoomAtCenter(1.25)} aria-label="Zoom in">+</button><button type="button" onClick={() => zoomAtCenter(0.8)} aria-label="Zoom out">−</button></div>
    </div>
  )
}
