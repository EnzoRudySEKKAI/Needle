import type { OntologyDocument } from '../../domain/types'
import { projectFloor } from '../../domain/floors'
import { visualiseNodes } from '../core/layout'
import { depthKey, pointsAttribute, sceneBounds, toScreen } from '../core/iso'
import { buildRelationGeometry } from '../core/routes'
import { ConceptVolume } from './ConceptVolume'

function neighborhoodTone(id: string): number {
  let hash = 0
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) | 0
  return Math.abs(hash) % 5
}

export function FloorMiniPlan({ document, floorId, x = 0, y = 0, width = 330, height = 200 }: { document: OntologyDocument; floorId: string; x?: number; y?: number; width?: number; height?: number }) {
  const projection = projectFloor(document, floorId)
  const nodes = projection ? visualiseNodes(projection.nodes).sort((a, b) => depthKey(a.footprint) - depthKey(b.footprint)) : []
  const neighborhoods = projection ? projection.groups.flatMap((group) => {
    const members = nodes.filter((node) => node.groupId === group.id)
    if (members.length === 0) return []
    const gx0 = Math.min(...members.map((node) => node.footprint.gx)) - 1
    const gy0 = Math.min(...members.map((node) => node.footprint.gy)) - 1
    const gx1 = Math.max(...members.map((node) => node.footprint.gx + node.footprint.w)) + 1
    const gy1 = Math.max(...members.map((node) => node.footprint.gy + node.footprint.d)) + 1
    return [{ id: group.id, tone: neighborhoodTone(group.id), footprint: { gx: gx0, gy: gy0, w: gx1 - gx0, d: gy1 - gy0 } }]
  }) : []
  const geometry = projection ? buildRelationGeometry(nodes, projection.relations) : new Map()
  const bounds = sceneBounds([...nodes, ...neighborhoods.map((neighborhood) => ({ footprint: neighborhood.footprint, height: 0 }))], 30)
  const emptyPad = [toScreen(-2, -2), toScreen(2, -2), toScreen(2, 2), toScreen(-2, 2)]
  return <svg className="floor-mini-plan" x={x} y={y} width={width} height={height} viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    {nodes.length ? <>
      <g className="mini-neighborhoods">{neighborhoods.map((neighborhood) => {
        const { gx, gy, w, d } = neighborhood.footprint
        const corners = [toScreen(gx, gy), toScreen(gx + w, gy), toScreen(gx + w, gy + d), toScreen(gx, gy + d)]
        return <polygon key={neighborhood.id} points={pointsAttribute(corners)} className={`mini-neighborhood tone-${neighborhood.tone}`} />
      })}</g>
      <g className="mini-relations">{projection?.relations.map((relation) => {
        const route = geometry.get(relation.id)
        if (!route) return null
        const end = route.points[route.points.length - 1]!
        const before = route.points[route.points.length - 2] ?? end
        const angle = Math.atan2(end.y - before.y, end.x - before.x) * 180 / Math.PI
        return <g key={relation.id} className={`mini-relation relation-${relation.kind}`}><polyline points={pointsAttribute(route.points)} className="mini-relation-line" vectorEffect="non-scaling-stroke" /><path d="M 0 0 L -6 3 L -6 -3 Z" transform={`translate(${end.x} ${end.y}) rotate(${angle})`} className="mini-relation-arrow" vectorEffect="non-scaling-stroke" /></g>
      })}</g>
      {nodes.map((node) => <ConceptVolume key={node.id} node={node} className="mini-concept-volume" />)}
    </> : <polygon points={pointsAttribute(emptyPad)} className="mini-plan-empty" vectorEffect="non-scaling-stroke" />}
  </svg>
}
