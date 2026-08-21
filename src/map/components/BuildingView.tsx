import { useMemo } from 'react'
import { projectFloor } from '../../domain/floors'
import type { OntologyDocument, Selection, VisualNode } from '../../domain/types'
import { visualiseNodes } from '../core/layout'
import { buildRelationGeometry } from '../core/routes'
import { buildScene } from '../core/scene'
import { pointsAttribute, toScreen } from '../core/iso'
import { Building } from './Building'

type FloorLayer = {
  floorId: string
  name: string
  offsetY: number
  nodes: VisualNode[]
  scene: ReturnType<typeof buildScene>
  geometry: ReturnType<typeof buildRelationGeometry>
}

export function BuildingView({ document, selection, onOpenFloor, onSelectNode }: { document: OntologyDocument; selection: Selection | null; onOpenFloor: (floorId: string) => void; onSelectNode: (nodeId: string, floorId: string) => void }) {
  const layers = useMemo(() => document.floors.map((floor, index): FloorLayer => {
    const projection = projectFloor(document, floor.id)!
    const nodes = visualiseNodes(projection.nodes)
    return {
      floorId: floor.id,
      name: floor.name,
      offsetY: -(index * 142),
      nodes,
      scene: buildScene(projection.groups, nodes, `${document.id}:${floor.id}:building`, new Map(), floor.groupFlagPositions),
      geometry: buildRelationGeometry(nodes, projection.relations),
    }
  }), [document])
  const commonPlate = useMemo(() => {
    const nodes = layers.flatMap((layer) => layer.nodes)
    const gx0 = nodes.length ? Math.min(...nodes.map((node) => node.footprint.gx)) - 2 : -4
    const gy0 = nodes.length ? Math.min(...nodes.map((node) => node.footprint.gy)) - 2 : -4
    const gx1 = nodes.length ? Math.max(...nodes.map((node) => node.footprint.gx + node.footprint.w)) + 2 : 4
    const gy1 = nodes.length ? Math.max(...nodes.map((node) => node.footprint.gy + node.footprint.d)) + 2 : 4
    const corners = [toScreen(gx0, gy0), toScreen(gx1, gy0), toScreen(gx1, gy1), toScreen(gx0, gy1)]
    return { corners, minX: Math.min(...corners.map((point) => point.x)), maxX: Math.max(...corners.map((point) => point.x)), minY: Math.min(...corners.map((point) => point.y)), maxY: Math.max(...corners.map((point) => point.y)) }
  }, [layers])
  const bounds = useMemo(() => {
    if (layers.length === 0) return { x: -300, y: -220, width: 600, height: 440 }
    const occupied = layers.filter((layer) => layer.nodes.length > 0)
    const minX = Math.min(commonPlate.minX, ...occupied.map((layer) => layer.scene.bounds.x)) - 80
    const minY = Math.min(...layers.map((layer) => commonPlate.minY + layer.offsetY), ...occupied.map((layer) => layer.scene.bounds.y + layer.offsetY)) - 55
    const maxX = Math.max(commonPlate.maxX, ...occupied.map((layer) => layer.scene.bounds.x + layer.scene.bounds.width)) + 80
    const maxY = Math.max(...layers.map((layer) => commonPlate.maxY + layer.offsetY), ...occupied.map((layer) => layer.scene.bounds.y + layer.scene.bounds.height + layer.offsetY)) + 55
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }, [commonPlate, layers])
  const nodePosition = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>()
    for (const layer of layers) for (const node of layer.nodes) {
      const point = toScreen(node.footprint.gx + node.footprint.w / 2, node.footprint.gy + node.footprint.d / 2, node.height)
      positions.set(node.id, { x: point.x, y: point.y + layer.offsetY })
    }
    return positions
  }, [layers])
  const crossRelations = document.relations.flatMap((relation) => {
    const from = document.nodes.find((node) => node.id === relation.from)
    const to = document.nodes.find((node) => node.id === relation.to)
    const a = nodePosition.get(relation.from)
    const b = nodePosition.get(relation.to)
    return from && to && from.floorId !== to.floorId && a && b ? [{ relation, a, b }] : []
  })

  return <div className="building-view"><svg id="ontology-map-svg" className="building-view-svg" viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`} preserveAspectRatio="xMidYMid meet" aria-label="Exploded building view">
    <defs><pattern id="map-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" className="hatch-line" /></pattern></defs>
    <g className="vertical-relations">{crossRelations.map(({ relation, a, b }) => <g key={relation.id}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`vertical-connector relation-${relation.kind}`} vectorEffect="non-scaling-stroke"><title>{relation.label}</title></line><circle cx={a.x} cy={a.y} r="3" vectorEffect="non-scaling-stroke" /><circle cx={b.x} cy={b.y} r="3" vectorEffect="non-scaling-stroke" /></g>)}</g>
    {layers.map((layer, layerIndex) => <g key={layer.floorId} className="building-floor" transform={`translate(0 ${layer.offsetY})`} onClick={() => onOpenFloor(layer.floorId)}>
      <polygon points={pointsAttribute(commonPlate.corners)} className="building-floor-slab" vectorEffect="non-scaling-stroke" />
      <text className="building-floor-index" x={commonPlate.minX} y={commonPlate.minY - 18}>{String(layerIndex + 1).padStart(2, '0')} · {layer.name}</text>
      {layer.scene.districts.map((district) => {
        const corners = [toScreen(district.rect.gx, district.rect.gy), toScreen(district.rect.gx + district.rect.w, district.rect.gy), toScreen(district.rect.gx + district.rect.w, district.rect.gy + district.rect.d), toScreen(district.rect.gx, district.rect.gy + district.rect.d)]
        return <polygon key={district.id} points={pointsAttribute(corners)} className="building-floor-plate" vectorEffect="non-scaling-stroke" />
      })}
      <g className="relations">{[...layer.geometry.entries()].map(([id, route]) => <polyline key={id} points={pointsAttribute(route.points)} className="relation-line" vectorEffect="non-scaling-stroke" />)}</g>
      {layer.scene.shapes.map((node) => <Building key={node.id} node={node} selected={selection?.kind === 'node' && selection.id === node.id} dimmed={false} active={false} previewed={false} editable={false} onSelect={() => onSelectNode(node.id, layer.floorId)} onDragStart={() => {}} />)}
    </g>)}
  </svg><div className="building-view-caption"><span>Building view</span><strong>{document.floors.length} floors · select a floor or concept to enter</strong></div></div>
}
