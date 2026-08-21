import type { GridPoint, OntologyRelation, VisualNode } from '../../domain/types'
import { portAnchor } from './archetypes'
import { gridRouteToScreen, polylineLengths, type ScreenPoint } from './iso'

export type RelationGeometry = { points: ScreenPoint[]; cumulative: number[]; total: number }

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

function routeFor(from: VisualNode, to: VisualNode, relation: OntologyRelation, nodes: readonly VisualNode[]): GridPoint[] {
  const start = portAnchor(from.footprint)
  const end = portAnchor(to.footprint)
  if (relation.via?.length) return manhattan([start, ...relation.via, end])
  const obstacles = nodes.filter((node) => node.id !== from.id && node.id !== to.id)
  const directCandidates = [
    cleanRoute([start, { gx: end.gx, gy: start.gy }, end]),
    cleanRoute([start, { gx: start.gx, gy: end.gy }, end]),
  ]
  const clear = directCandidates.find((route) => route.slice(1).every((point, index) => !obstacles.some((node) => segmentHits(route[index]!, point, node))))
  if (clear) return clear
  const maxGy = Math.max(start.gy, end.gy, ...obstacles.map((node) => node.footprint.gy + node.footprint.d)) + 1.5
  const minGy = Math.min(start.gy, end.gy, ...obstacles.map((node) => node.footprint.gy)) - 1.5
  const candidates = [
    cleanRoute([start, { gx: start.gx, gy: maxGy }, { gx: end.gx, gy: maxGy }, end]),
    cleanRoute([start, { gx: start.gx, gy: minGy }, { gx: end.gx, gy: minGy }, end]),
  ]
  return candidates.find((route) => route.slice(1).every((point, index) => !obstacles.some((node) => segmentHits(route[index]!, point, node)))) ?? directCandidates[0]!
}

export function buildRelationGeometry(nodes: readonly VisualNode[], relations: readonly OntologyRelation[]): ReadonlyMap<string, RelationGeometry> {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const result = new Map<string, RelationGeometry>()
  for (const relation of relations) {
    const from = byId.get(relation.from)
    const to = byId.get(relation.to)
    if (!from || !to) continue
    const points = gridRouteToScreen(routeFor(from, to, relation, nodes))
    const { cumulative, total } = polylineLengths(points)
    result.set(relation.id, { points, cumulative, total })
  }
  return result
}
