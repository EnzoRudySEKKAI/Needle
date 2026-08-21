import type { GridPoint, OntologyRelation, VisualNode } from '../../domain/types'
import { portAnchors, type PortSide } from './archetypes'
import { gridRouteToScreen, polylineLengths, type ScreenPoint } from './iso'

export type RelationGeometry = {
  points: ScreenPoint[]
  cumulative: number[]
  total: number
  fromSide: PortSide
  toSide: PortSide
  labelPoint: ScreenPoint
}

const PORT_SIDES: PortSide[] = ['north', 'east', 'south', 'west']
const PORT_NORMALS: Record<PortSide, GridPoint> = {
  north: { gx: 0, gy: -1 },
  east: { gx: 1, gy: 0 },
  south: { gx: 0, gy: 1 },
  west: { gx: -1, gy: 0 },
}
const PORT_CLEARANCE = 0.8

function distance(a: GridPoint, b: GridPoint): number {
  return Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy)
}

function offset(point: GridPoint, side: PortSide): GridPoint {
  const normal = PORT_NORMALS[side]
  return { gx: point.gx + normal.gx * PORT_CLEARANCE, gy: point.gy + normal.gy * PORT_CLEARANCE }
}

export function closestAnchorPair(from: VisualNode, to: VisualNode, via: readonly GridPoint[] = []): { fromSide: PortSide; toSide: PortSide; start: GridPoint; end: GridPoint } {
  const fromPorts = portAnchors(from.footprint)
  const toPorts = portAnchors(to.footprint)
  const sourceTarget = via[0] ?? to.position
  const destinationTarget = via[via.length - 1] ?? from.position
  let best = { fromSide: 'south' as PortSide, toSide: 'north' as PortSide, start: fromPorts.south, end: toPorts.north }
  let bestDistance = Infinity
  for (const fromSide of PORT_SIDES) {
    for (const toSide of PORT_SIDES) {
      const candidate = distance(offset(fromPorts[fromSide], fromSide), sourceTarget) + distance(destinationTarget, offset(toPorts[toSide], toSide))
      if (candidate < bestDistance) {
        bestDistance = candidate
        best = { fromSide, toSide, start: fromPorts[fromSide], end: toPorts[toSide] }
      }
    }
  }
  return best
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
  const unique = points.filter((point, index) => index === 0 || point.gx !== points[index - 1]?.gx || point.gy !== points[index - 1]?.gy)
  return unique.filter((point, index) => {
    const previous = unique[index - 1]
    const next = unique[index + 1]
    if (!previous || !next) return true
    return !(previous.gx === point.gx && point.gx === next.gx) && !(previous.gy === point.gy && point.gy === next.gy)
  })
}

function routeIsClear(route: readonly GridPoint[], obstacles: readonly VisualNode[]): boolean {
  return route.slice(1).every((point, index) => !obstacles.some((node) => segmentHits(route[index]!, point, node)))
}

function routeScore(route: readonly GridPoint[]): number {
  return route.slice(1).reduce((total, point, index) => total + distance(route[index]!, point), 0) + Math.max(0, route.length - 2) * 0.45
}

function legCandidates(start: GridPoint, end: GridPoint, obstacles: readonly VisualNode[]): GridPoint[][] {
  if (start.gx === end.gx || start.gy === end.gy) return [[start, end]]
  const minGx = Math.min(start.gx, end.gx, ...obstacles.map((node) => node.footprint.gx)) - 1.2
  const maxGx = Math.max(start.gx, end.gx, ...obstacles.map((node) => node.footprint.gx + node.footprint.w)) + 1.2
  const minGy = Math.min(start.gy, end.gy, ...obstacles.map((node) => node.footprint.gy)) - 1.2
  const maxGy = Math.max(start.gy, end.gy, ...obstacles.map((node) => node.footprint.gy + node.footprint.d)) + 1.2
  return [
    [start, { gx: end.gx, gy: start.gy }, end],
    [start, { gx: start.gx, gy: end.gy }, end],
    [start, { gx: start.gx, gy: minGy }, { gx: end.gx, gy: minGy }, end],
    [start, { gx: start.gx, gy: maxGy }, { gx: end.gx, gy: maxGy }, end],
    [start, { gx: minGx, gy: start.gy }, { gx: minGx, gy: end.gy }, end],
    [start, { gx: maxGx, gy: start.gy }, { gx: maxGx, gy: end.gy }, end],
  ]
}

function routeCore(points: readonly GridPoint[], obstacles: readonly VisualNode[]): GridPoint[] | null {
  let route: GridPoint[] = [points[0]!]
  for (const destination of points.slice(1)) {
    const start = route[route.length - 1]!
    const leg = legCandidates(start, destination, obstacles)
      .map(cleanRoute)
      .filter((candidate) => routeIsClear(candidate, obstacles))
      .sort((a, b) => routeScore(a) - routeScore(b))[0]
    if (!leg) return null
    route = cleanRoute([...route, ...leg.slice(1)])
  }
  return route
}

function routeFor(from: VisualNode, to: VisualNode, relation: OntologyRelation, nodes: readonly VisualNode[]): { route: GridPoint[]; fromSide: PortSide; toSide: PortSide } | null {
  const fromPorts = portAnchors(from.footprint)
  const toPorts = portAnchors(to.footprint)
  const candidates: { route: GridPoint[]; fromSide: PortSide; toSide: PortSide }[] = []

  for (const fromSide of PORT_SIDES) {
    for (const toSide of PORT_SIDES) {
      if (from.id === to.id && fromSide === toSide) continue
      const start = fromPorts[fromSide]
      const end = toPorts[toSide]
      const startClear = offset(start, fromSide)
      const endClear = offset(end, toSide)
      const core = routeCore([startClear, ...(relation.via ?? []), endClear], nodes)
      if (!core) continue
      const route = cleanRoute([start, ...core, end])
      const clear = route.slice(1).every((point, index) => {
        const obstacles = nodes.filter((node) => !(index === 0 && node.id === from.id) && !(index === route.length - 2 && node.id === to.id))
        return !obstacles.some((node) => segmentHits(route[index]!, point, node))
      })
      if (clear) candidates.push({ route, fromSide, toSide })
    }
  }

  return candidates.sort((a, b) => routeScore(a.route) - routeScore(b.route))[0] ?? null
}

function longestSegmentMidpoint(points: readonly ScreenPoint[]): ScreenPoint {
  let longest = { length: -1, point: points[0] ?? { x: 0, y: 0 } }
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]!
    const end = points[index]!
    const length = Math.hypot(end.x - start.x, end.y - start.y)
    if (length > longest.length) longest = { length, point: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 } }
  }
  return longest.point
}

export function buildRelationGeometry(nodes: readonly VisualNode[], relations: readonly OntologyRelation[]): ReadonlyMap<string, RelationGeometry> {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const result = new Map<string, RelationGeometry>()
  for (const relation of relations) {
    const from = byId.get(relation.from)
    const to = byId.get(relation.to)
    if (!from || !to) continue
    const routed = routeFor(from, to, relation, nodes)
    if (!routed) continue
    const points = gridRouteToScreen(routed.route)
    const { cumulative, total } = polylineLengths(points)
    result.set(relation.id, { points, cumulative, total, fromSide: routed.fromSide, toSide: routed.toSide, labelPoint: longestSegmentMidpoint(points) })
  }
  return result
}
