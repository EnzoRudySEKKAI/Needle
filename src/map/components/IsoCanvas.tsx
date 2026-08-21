import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { GridPoint, OntologyDocument, Selection, VisualNode } from '../../domain/types'
import type { ConnectionDraft } from '../../editor/connection'
import type { RelationPreview } from '../../editor/RelationCandidatePicker'
import { portAnchors } from '../core/archetypes'
import { visualiseNodes } from '../core/layout'
import { buildFlowProgram } from '../core/program'
import { nodeIdsForStageState } from '../core/program'
import { buildRelationGeometry } from '../core/routes'
import { buildScene, fitCamera, zoomAbout, type Camera, type District } from '../core/scene'
import { pointsAttribute, toScreen } from '../core/iso'
import { configureFlow, useClockActiveKey } from '../stores/flow-clock'
import { Building } from './Building'
import { FlowAnimation } from './FlowAnimation'

type Props = {
  document: OntologyDocument
  selection: Selection | null
  activeFlowId: string | null
  editable: boolean
  relationPreview: RelationPreview | null
  onSelect: (selection: Selection | null) => void
  onMoveNode: (id: string, gx: number, gy: number) => void
  connectionDraft: ConnectionDraft | null
  onToggleConnectionTarget: (id: string) => void
}

type PanSession = { kind: 'pan'; pointerId: number; x: number; y: number; camera: Camera; moved: boolean }
type NodeDragSession = { kind: 'node'; pointerId: number; nodeId: string; startX: number; startY: number; start: GridPoint; camera: Camera; pending: GridPoint; moved: boolean; frame: number }
type InteractionSession = PanSession | NodeDragSession

function DistrictFlag({ district, selected, onSelect, onMeasure }: { district: District; selected: boolean; onSelect: () => void; onMeasure: (id: string, width: number) => void }) {
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
  return <g className={selected ? 'is-selected' : ''} onClick={(event) => { event.stopPropagation(); onSelect() }}><line x1={flag.x} y1={flag.y} x2={flag.x} y2={flag.y - 34} className="flag-pole" vectorEffect="non-scaling-stroke" /><g transform={`translate(${flag.x + 4} ${flag.y - 34})`}><rect width={district.labelWidth} height="18" className="flag-label" vectorEffect="non-scaling-stroke" /><text ref={textRef} x="6" y="12.5">{district.name}</text></g></g>
}

export function IsoCanvas({ document, selection, activeFlowId, editable, relationPreview, onSelect, onMoveNode, connectionDraft, onToggleConnectionTarget }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [cameraOverride, setCameraOverride] = useState<Camera | null>(null)
  const [flagWidths, setFlagWidths] = useState<ReadonlyMap<string, number>>(() => new Map())
  const [dragPositions, setDragPositions] = useState<ReadonlyMap<string, { gx: number; gy: number }>>(() => new Map())
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const interaction = useRef<InteractionSession | null>(null)
  const committedDrag = useRef<{ id: string; position: GridPoint } | null>(null)
  const suppressCanvasClick = useRef(false)
  const clickSuppressionTimer = useRef(0)
  const positionedNodes = useMemo(() => document.nodes.map((node) => dragPositions.has(node.id) ? { ...node, position: dragPositions.get(node.id)! } : node), [document.nodes, dragPositions])
  const nodes = useMemo(() => visualiseNodes(positionedNodes), [positionedNodes])
  const scene = useMemo(() => buildScene(document.groups, nodes, `${document.id}:${document.updatedAt}`, flagWidths), [document.groups, document.id, document.updatedAt, flagWidths, nodes])
  const geometry = useMemo(() => buildRelationGeometry(nodes, document.relations), [nodes, document.relations])
  const previewRelations = useMemo(() => connectionDraft ? connectionDraft.targets.map((target, index) => ({ id: `preview-${index}`, from: target.direction === 'outbound' ? connectionDraft.sourceId : target.nodeId, to: target.direction === 'outbound' ? target.nodeId : connectionDraft.sourceId, kind: connectionDraft.kind, label: connectionDraft.label })) : [], [connectionDraft])
  const previewGeometry = useMemo(() => buildRelationGeometry(nodes, previewRelations), [nodes, previewRelations])
  const candidateRoute = relationPreview ? geometry.get(relationPreview.relationId) ?? null : null
  const candidatePoints = candidateRoute ? relationPreview?.direction === 'reverse' ? [...candidateRoute.points].reverse() : candidateRoute.points : null
  const activeFlow = document.flows.find((flow) => flow.id === activeFlowId) ?? null
  const program = useMemo(() => activeFlow ? buildFlowProgram(activeFlow, nodes, document.relations, geometry) : null, [activeFlow, nodes, document.relations, geometry])
  const activeClockKey = useClockActiveKey()
  const fitted = size.width > 0 ? fitCamera(size.width, size.height, scene.bounds) : null
  const camera = cameraOverride ?? fitted

  useEffect(() => {
    configureFlow(program, true)
    return () => configureFlow(null)
  }, [program])

  useEffect(() => {
    const committed = committedDrag.current
    if (!committed) return
    const node = document.nodes.find((item) => item.id === committed.id)
    if (!node || node.position.gx !== committed.position.gx || node.position.gy !== committed.position.gy) return
    committedDrag.current = null
    setDragPositions((current) => {
      if (!current.has(committed.id)) return current
      const next = new Map(current)
      next.delete(committed.id)
      return next
    })
  }, [document.nodes])

  useLayoutEffect(() => {
    const element = containerRef.current
    if (!element) return
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const flowNodeIds = program ? new Set(program.nodeIds) : null
  const activeParts = activeClockKey.split(':')
  const activeNodeSet = program && activeParts[0] === program.id
    ? nodeIdsForStageState(program, Number(activeParts[1]), activeParts[2] === 'source' ? 'travel' : activeParts[2] as 'travel' | 'target')
    : new Set<string>()
  const measureFlag = (id: string, width: number) => setFlagWidths((current) => {
    if (Math.abs((current.get(id) ?? 0) - width) < 0.5) return current
    const next = new Map(current)
    next.set(id, width)
    return next
  })
  const previewNodePosition = (id: string, gx: number, gy: number) => setDragPositions((current) => {
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
    setDraggingNodeId(null)
    releasePointer(session.pointerId)
    if (!commit || !session.moved) {
      cancelNodePosition(session.nodeId)
      if (commit && !session.moved) {
        suppressNextClick()
        onSelect({ kind: 'node', id: session.nodeId })
      }
      return
    }
    const position = { gx: Math.round(session.pending.gx * 2) / 2, gy: Math.round(session.pending.gy * 2) / 2 }
    previewNodePosition(session.nodeId, position.gx, position.gy)
    committedDrag.current = { id: session.nodeId, position }
    suppressNextClick()
    onMoveNode(session.nodeId, position.gx, position.gy)
  }
  const cancelInteraction = useEffectEvent(() => endInteraction(false))

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
    setCameraOverride(camera)
    interaction.current = { kind: 'node', pointerId: event.pointerId, nodeId: node.id, startX: event.clientX, startY: event.clientY, start: node.position, camera, pending: node.position, moved: false, frame: 0 }
    setDraggingNodeId(node.id)
    svg.setPointerCapture(event.pointerId)
  }

  const orderedShapes = draggingNodeId
    ? [...scene.shapes.filter((node) => node.id !== draggingNodeId), ...scene.shapes.filter((node) => node.id === draggingNodeId)]
    : scene.shapes

  return (
    <div className="canvas-wrap" ref={containerRef}>
      {document.nodes.length === 0 ? (
        <div className="canvas-empty"><span>Empty ground</span><strong>Add a concept from the left rail.</strong></div>
      ) : null}
      <svg
        ref={svgRef}
        id="ontology-map-svg"
        className="iso-canvas"
        aria-label="Interactive ontology map"
        onClick={() => {
          if (suppressCanvasClick.current) { suppressCanvasClick.current = false; return }
          onSelect(null)
        }}
        onWheel={(event) => {
          event.preventDefault()
          if (!camera || interaction.current?.kind === 'node') return
          const rect = event.currentTarget.getBoundingClientRect()
          setCameraOverride(zoomAbout(camera, Math.exp(-event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top))
        }}
        onPointerDown={(event) => {
          if (event.button !== 0 || !camera || interaction.current) return
          interaction.current = { kind: 'pan', pointerId: event.pointerId, x: event.clientX, y: event.clientY, camera, moved: false }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          const session = interaction.current
          if (!session || session.pointerId !== event.pointerId) return
          if (event.buttons === 0) { endInteraction(session.kind === 'node'); return }
          if (session.kind === 'pan') {
            session.moved ||= Math.hypot(event.clientX - session.x, event.clientY - session.y) > 4
            setCameraOverride({ ...session.camera, x: session.camera.x + event.clientX - session.x, y: session.camera.y + event.clientY - session.y })
            return
          }
          const dx = (event.clientX - session.startX) / session.camera.k
          const dy = (event.clientY - session.startY) / session.camera.k
          session.moved ||= Math.hypot(event.clientX - session.startX, event.clientY - session.startY) > 4
          if (!session.moved) return
          session.pending = { gx: session.start.gx + dx / 48 + dy / 24, gy: session.start.gy + dy / 24 - dx / 48 }
          if (!session.frame) session.frame = requestAnimationFrame(() => {
            if (interaction.current !== session) return
            session.frame = 0
            previewNodePosition(session.nodeId, session.pending.gx, session.pending.gy)
          })
        }}
        onPointerUp={(event) => { if (interaction.current?.pointerId === event.pointerId) endInteraction(true) }}
        onPointerCancel={(event) => { if (interaction.current?.pointerId === event.pointerId) endInteraction(false) }}
        onLostPointerCapture={(event) => { if (interaction.current?.pointerId === event.pointerId) endInteraction(false) }}
      >
        <defs>
          <pattern id="map-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" className="hatch-line" /></pattern>
        </defs>
        {camera ? (
          <g transform={`translate(${camera.x} ${camera.y}) scale(${camera.k})`}>
            <g className="floor-grid">{scene.grid.map((line) => <line key={line.key} x1={line.a.x} y1={line.a.y} x2={line.b.x} y2={line.b.y} vectorEffect="non-scaling-stroke" />)}</g>
            <g className="districts">
              {scene.districts.map((district) => {
                const corners = [toScreen(district.rect.gx, district.rect.gy), toScreen(district.rect.gx + district.rect.w, district.rect.gy), toScreen(district.rect.gx + district.rect.w, district.rect.gy + district.rect.d), toScreen(district.rect.gx, district.rect.gy + district.rect.d)]
                return <g key={district.id} className={selection?.kind === 'group' && selection.id === district.id ? 'is-selected' : ''} onClick={(event) => { event.stopPropagation(); onSelect({ kind: 'group', id: district.id }) }}><polygon points={pointsAttribute(corners)} className="district-plate" vectorEffect="non-scaling-stroke" /></g>
              })}
            </g>
            <g className="relations" onPointerDown={(event) => event.stopPropagation()}>
              {document.relations.map((relation) => {
                const route = geometry.get(relation.id)
                if (!route) return null
                const selected = selection?.kind === 'relation' && selection.id === relation.id
                const end = route.points[route.points.length - 1]!
                const before = route.points[route.points.length - 2] ?? end
                const angle = Math.atan2(end.y - before.y, end.x - before.x) * 180 / Math.PI
                const labelWidth = Math.max(42, relation.label.length * 5.5 + 14)
                return <g key={relation.id} className={`relation relation-${relation.kind} ${selected ? 'is-selected' : ''} ${program ? 'is-dimmed' : ''}`} role="button" tabIndex={0} aria-label={`${relation.label}: ${relation.from} to ${relation.to}`} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect({ kind: 'relation', id: relation.id }) } }} onClick={(event) => { event.stopPropagation(); onSelect({ kind: 'relation', id: relation.id }) }}><polyline points={pointsAttribute(route.points)} className="relation-line" vectorEffect="non-scaling-stroke" />{relation.kind !== 'support' ? <path d="M 0 0 L -7 3.5 L -7 -3.5 Z" transform={`translate(${end.x} ${end.y}) rotate(${angle})`} className="relation-arrow" vectorEffect="non-scaling-stroke" /> : null}<g className="relation-label" transform={`translate(${route.labelPoint.x} ${route.labelPoint.y - 11})`}><rect x={-labelWidth / 2} y="-8" width={labelWidth} height="16" rx="3" vectorEffect="non-scaling-stroke" /><text textAnchor="middle" dominantBaseline="central">{relation.label}</text></g><polyline points={pointsAttribute(route.points)} className="relation-hit" vectorEffect="non-scaling-stroke"><title>{relation.label}</title></polyline></g>
              })}
              {previewRelations.map((relation) => {
                const route = previewGeometry.get(relation.id)
                if (!route) return null
                return <polyline key={relation.id} points={pointsAttribute(route.points)} className="connection-preview" vectorEffect="non-scaling-stroke" />
              })}
              {candidatePoints ? (() => {
                const end = candidatePoints[candidatePoints.length - 1]!
                const before = candidatePoints[candidatePoints.length - 2] ?? end
                const angle = Math.atan2(end.y - before.y, end.x - before.x) * 180 / Math.PI
                return <g className="candidate-relation-preview"><polyline points={pointsAttribute(candidatePoints)} vectorEffect="non-scaling-stroke" /><path d="M 0 0 L -8 4 L -8 -4 Z" transform={`translate(${end.x} ${end.y}) rotate(${angle})`} /></g>
              })() : null}
            </g>
            {orderedShapes.map((node) => <Building key={node.id} node={node} selected={selection?.kind === 'node' && selection.id === node.id} dimmed={flowNodeIds !== null && !flowNodeIds.has(node.id)} active={activeNodeSet.has(node.id)} editable={editable && !connectionDraft} connectionMode={connectionDraft !== null} connectionSource={connectionDraft?.sourceId === node.id} connectionTarget={connectionDraft?.targets.some((target) => target.nodeId === node.id)} onSelect={() => {
              if (suppressCanvasClick.current) { suppressCanvasClick.current = false; return }
              if (connectionDraft) onToggleConnectionTarget(node.id)
              else onSelect({ kind: 'node', id: node.id })
            }} onDragStart={(event) => startNodeDrag(event, node)} />)}
            {program && activeFlow ? <FlowAnimation program={program} flow={activeFlow} editable={editable} /> : null}
            {connectionDraft ? <g className="connection-ports">{scene.shapes.map((node) => Object.entries(portAnchors(node.footprint)).map(([side, point]) => { const screen = toScreen(point.gx, point.gy); const source = node.id === connectionDraft.sourceId; const target = connectionDraft.targets.some((item) => item.nodeId === node.id); return <circle key={`${node.id}-${side}`} cx={screen.x} cy={screen.y} r={source || target ? 4.5 : 3} className={`${source ? 'is-source' : ''} ${target ? 'is-target' : ''}`} vectorEffect="non-scaling-stroke" onClick={(event) => { event.stopPropagation(); onToggleConnectionTarget(node.id) }} /> }))}</g> : null}
            <g className="district-flags">
              {scene.districts.map((district) => <DistrictFlag key={district.id} district={district} selected={selection?.kind === 'group' && selection.id === district.id} onSelect={() => onSelect({ kind: 'group', id: district.id })} onMeasure={measureFlag} />)}
            </g>
          </g>
        ) : null}
      </svg>
      <div className="camera-controls"><button type="button" onClick={() => setCameraOverride(null)} title="Recenter">⌾</button><button type="button" onClick={() => camera && setCameraOverride(zoomAbout(camera, 1.25, size.width / 2, size.height / 2))}>+</button><button type="button" onClick={() => camera && setCameraOverride(zoomAbout(camera, 0.8, size.width / 2, size.height / 2))}>−</button></div>
    </div>
  )
}
