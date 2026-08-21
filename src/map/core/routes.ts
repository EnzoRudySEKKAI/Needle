import type { GridPoint, OntologyRelation, VisualNode } from '../../domain/types'
import { portAnchors, type PortSide } from './archetypes'
import { gridRouteToScreen, polylineLengths, type ScreenPoint } from './iso'

export type RelationGeometry = {
  points: ScreenPoint[]
  cumulative: number[]
  total: number
  fromSide: PortSide
  toSide: PortSide
}

const PORT_SIDES: PortSide[] = ['north', 'east', 'south', 'west']

export function closestAnchorPair(from: VisualNode, to: VisualNode, via: readonly GridPoint[] = []): { fromSide: PortSide; toSide: PortSide; start: GridPoint; end: GridPoint } {
  const fromPorts = portAnchors(from.footprint)
  const toPorts = portAnchors(to.footprint)
  const sourceTarget = via[0]
  const destinationTarget = via[via.length - 1]
  if (sourceTarget && destinationTarget) {
    const fromSide = PORT_SIDES.reduce((best, side) => distance(fromPorts[side], sourceTarget) < distance(fromPorts[best], sourceTarget) ? side : best)
    const toSide = PORT_SIDES.reduce((best, side) => distance(toPorts[side], destinationTarget) < distance(toPorts[best], destinationTarget) ? side : best)
    return { fromSide, toSide, start: fromPorts[fromSide], end: toPorts[toSide] }
  }
  let best = { fromSide: 'south' as PortSide, toSide: 'north' as PortSide, start: fromPorts.south, end: toPorts.north }
  let bestDistance = Infinity
  for (const fromSide of PORT_SIDES) {
    for (const toSide of PORT_SIDES) {
      const candidate = distance(fromPorts[fromSide], toPorts[toSide])
      if (candidate < bestDistance) {
        bestDistance = candidate
        best = { fromSide, toSide, start: fromPorts[fromSide], end: toPorts[toSide] }
      }
    }
  }
  return best
}

function distance(a: GridPoint, b: GridPoint): number {
  return Math.hypot(a.gx - b.gx, a.gy - b.gy)
}

function segmentHits(pointA: GridPoint, pointB: GridPoint, node: VisualNode): boolean {
  const rect = node.footprint
  const padding = 0.35
  if (pointA.gx === pointB.gx) {
    const min = Math.min(pointA.gy, pointB.gy)
    const max = Math.max(pointA.gy, pointB.gy)
    return pointA.gx > rect.gx - padding && pointA.gx < rect.gx + rect.w + padding && max > rect.gy - padding && min < rect.gy + rect.d + padding
  }
  const min = Math.min(pointA.gx, pointB.gx)
  const max = Math.max(pointA.gx, pointB.gx)
  return pointA.gy > rect.gy - padding && pointA.gy < rect.gy + rect.d + padding && max > rect.gx - padding && min < rect.gx + rect.w + padding
}

function cleanRoute(points: GridPoint[]): GridPoint[] {
  return points.filter((point, index) => index === 0 || point.gx !== points[index - 1]?.gx || point.gy !== points[index - 1]?.gy)
}

function manhattan(points: GridPoint[]): GridPoint[] {
  const result: GridPoint[] = [points[0]!]
  for (const next of points.slice(1)) {
    const previous = result[result.length - 1]!
    if (previous.gx !== next.gx && previous.gy !== next.gy) result.push({ gx: next.gx, gy: previous.gy })
    result.push(next)
  }
  return cleanRoute(result)
}

function routeFor(from: VisualNode, to: VisualNode, relation: OntologyRelation, nodes: readonly VisualNode[]): { route: GridPoint[]; fromSide: PortSide; toSide: PortSide } {
  const { start, end, fromSide, toSide } = closestAnchorPair(from, to, relation.via)
  if (relation.via?.length) return { route: manhattan([start, ...relation.via, end]), fromSide, toSide }
  const obstacles = nodes.filter((node) => node.id !== from.id && node.id !== to.id)
  const directCandidates = [
    cleanRoute([start, { gx: end.gx, gy: start.gy }, end]),
    cleanRoute([start, { gx: start.gx, gy: end.gy }, end]),
  ]
  const clear = directCandidates.find((route) => route.slice(1).every((point, index) => !obstacles.some((node) => segmentHits(route[index]!, point, node))))
  if (clear) return { route: clear, fromSide, toSide }
  const maxGy = Math.max(start.gy, end.gy, ...obstacles.map((node) => node.footprint.gy + node.footprint.d)) + 1.5
  const minGy = Math.min(start.gy, end.gy, ...obstacles.map((node) => node.footprint.gy)) - 1.5
  const candidates = [
    cleanRoute([start, { gx: start.gx, gy: maxGy }, { gx: end.gx, gy: maxGy }, end]),
    cleanRoute([start, { gx: start.gx, gy: minGy }, { gx: end.gx, gy: minGy }, end]),
  ]
  return { route: candidates.find((route) => route.slice(1).every((point, index) => !obstacles.some((node) => segmentHits(route[index]!, point, node)))) ?? directCandidates[0]!, fromSide, toSide }
}

export function buildRelationGeometry(nodes: readonly VisualNode[], relations: readonly OntologyRelation[]): ReadonlyMap<string, RelationGeometry> {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const result = new Map<string, RelationGeometry>()
  for (const relation of relations) {
    const from = byId.get(relation.from)
    const to = byId.get(relation.to)
    if (!from || !to) continue
    const routed = routeFor(from, to, relation, nodes)
    const points = gridRouteToScreen(routed.route)
    const { cumulative, total } = polylineLengths(points)
    result.set(relation.id, { points, cumulative, total, fromSide: routed.fromSide, toSide: routed.toSide })
  }
  return result
}
