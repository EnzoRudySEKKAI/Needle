import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { OntologyDocument, Selection } from '../../domain/types'
import { visualiseNodes } from '../core/layout'
import { buildFlowProgram } from '../core/program'
import { buildRelationGeometry } from '../core/routes'
import { buildScene, fitCamera, zoomAbout, type Camera } from '../core/scene'
import { pointsAttribute, toScreen } from '../core/iso'
import { configureFlow } from '../stores/flow-clock'
import { Building } from './Building'
import { FlowAnimation } from './FlowAnimation'

type Props = {
  document: OntologyDocument
  selection: Selection | null
  activeFlowId: string | null
  editable: boolean
  onSelect: (selection: Selection | null) => void
  onMoveNode: (id: string, gx: number, gy: number) => void
}

export function IsoCanvas({ document, selection, activeFlowId, editable, onSelect, onMoveNode }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [cameraOverride, setCameraOverride] = useState<Camera | null>(null)
  const gesture = useRef<{ x: number; y: number; camera: Camera } | null>(null)
  const nodes = useMemo(() => visualiseNodes(document.nodes), [document.nodes])
  const scene = useMemo(() => buildScene(document.groups, nodes, `${document.id}:${document.updatedAt}`), [document.groups, document.id, document.updatedAt, nodes])
  const geometry = useMemo(() => buildRelationGeometry(nodes, document.relations), [nodes, document.relations])
  const activeFlow = document.flows.find((flow) => flow.id === activeFlowId) ?? null
  const program = useMemo(() => activeFlow ? buildFlowProgram(activeFlow, nodes, document.relations, geometry) : null, [activeFlow, nodes, document.relations, geometry])
  const fitted = size.width > 0 ? fitCamera(size.width, size.height, scene.bounds) : null
  const camera = cameraOverride ?? fitted

  useEffect(() => {
    configureFlow(program, true)
    return () => configureFlow(null)
  }, [program])

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

  return (
    <div className="canvas-wrap" ref={containerRef}>
      {document.nodes.length === 0 ? (
        <div className="canvas-empty"><span>Empty ground</span><strong>Add a concept from the left rail.</strong></div>
      ) : null}
      <svg
        id="ontology-map-svg"
        className="iso-canvas"
        aria-label="Interactive ontology map"
        onClick={() => onSelect(null)}
        onWheel={(event) => {
          event.preventDefault()
          if (!camera) return
          const rect = event.currentTarget.getBoundingClientRect()
          setCameraOverride(zoomAbout(camera, Math.exp(-event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top))
        }}
        onPointerDown={(event) => {
          if (event.button !== 0 || !camera) return
          gesture.current = { x: event.clientX, y: event.clientY, camera }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          const start = gesture.current
          if (!start) return
          setCameraOverride({ ...start.camera, x: start.camera.x + event.clientX - start.x, y: start.camera.y + event.clientY - start.y })
        }}
        onPointerUp={() => { gesture.current = null }}
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
            <g className="relations">
              {document.relations.map((relation) => {
                const route = geometry.get(relation.id)
                if (!route) return null
                const selected = selection?.kind === 'relation' && selection.id === relation.id
                return <g key={relation.id} className={`relation relation-${relation.kind} ${selected ? 'is-selected' : ''} ${program ? 'is-dimmed' : ''}`} onClick={(event) => { event.stopPropagation(); onSelect({ kind: 'relation', id: relation.id }) }}><polyline points={pointsAttribute(route.points)} className="relation-line" vectorEffect="non-scaling-stroke" /><polyline points={pointsAttribute(route.points)} className="relation-hit" vectorEffect="non-scaling-stroke"><title>{relation.label}</title></polyline></g>
              })}
            </g>
            {scene.shapes.map((node) => <Building key={node.id} node={node} selected={selection?.kind === 'node' && selection.id === node.id} dimmed={flowNodeIds !== null && !flowNodeIds.has(node.id)} active={flowNodeIds?.has(node.id) ?? false} editable={editable} cameraScale={camera.k} onSelect={() => onSelect({ kind: 'node', id: node.id })} onMove={(gx, gy) => onMoveNode(node.id, gx, gy)} />)}
            {program && activeFlow ? <FlowAnimation program={program} flow={activeFlow} /> : null}
            <g className="district-flags">
              {scene.districts.map((district) => {
                const flag = toScreen(district.flagAt.gx, district.flagAt.gy)
                const selected = selection?.kind === 'group' && selection.id === district.id
                return <g key={district.id} className={selected ? 'is-selected' : ''} onClick={(event) => { event.stopPropagation(); onSelect({ kind: 'group', id: district.id }) }}><line x1={flag.x} y1={flag.y} x2={flag.x} y2={flag.y - 34} className="flag-pole" vectorEffect="non-scaling-stroke" /><g transform={`translate(${flag.x + 4} ${flag.y - 34})`}><rect width={district.labelWidth} height="18" className="flag-label" vectorEffect="non-scaling-stroke" /><text x="6" y="12.5">{district.displayName}<title>{district.name}</title></text></g></g>
              })}
            </g>
          </g>
        ) : null}
      </svg>
      <div className="camera-controls"><button type="button" onClick={() => setCameraOverride(null)} title="Recenter">⌾</button><button type="button" onClick={() => camera && setCameraOverride(zoomAbout(camera, 1.25, size.width / 2, size.height / 2))}>+</button><button type="button" onClick={() => camera && setCameraOverride(zoomAbout(camera, 0.8, size.width / 2, size.height / 2))}>−</button></div>
    </div>
  )
}
