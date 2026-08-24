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
const OBSTACLE_PADDING = 0.35
const BEND_PENALTY = 1.2
const ALIGNMENT_EPSILON = 1e-9
const PARALLEL_LANE_GAP = 18

function distance(a: GridPoint, b: GridPoint): number {
  return Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy)
}

function offset(point: GridPoint, side: PortSide): GridPoint {
  const normal = PORT_NORMALS[side]
  return { gx: point.gx + normal.gx * PORT_CLEARANCE, gy: point.gy + normal.gy * PORT_CLEARANCE }
}

export function closestAnchorPair(from: VisualNode, to: VisualNode): { fromSide: PortSide; toSide: PortSide; start: GridPoint; end: GridPoint } {
  const fromPorts = portAnchors(from.footprint)
  const toPorts = portAnchors(to.footprint)
  const sourceTarget = { gx: to.footprint.gx + to.footprint.w / 2, gy: to.footprint.gy + to.footprint.d / 2 }
  const destinationTarget = { gx: from.footprint.gx + from.footprint.w / 2, gy: from.footprint.gy + from.footprint.d / 2 }
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
  if (pointA.gx === pointB.gx) {
    const min = Math.min(pointA.gy, pointB.gy)
    const max = Math.max(pointA.gy, pointB.gy)
    return pointA.gx > rect.gx - OBSTACLE_PADDING && pointA.gx < rect.gx + rect.w + OBSTACLE_PADDING && max > rect.gy - OBSTACLE_PADDING && min < rect.gy + rect.d + OBSTACLE_PADDING
  }
  const min = Math.min(pointA.gx, pointB.gx)
  const max = Math.max(pointA.gx, pointB.gx)
  return pointA.gy > rect.gy - OBSTACLE_PADDING && pointA.gy < rect.gy + rect.d + OBSTACLE_PADDING && max > rect.gx - OBSTACLE_PADDING && min < rect.gx + rect.w + OBSTACLE_PADDING
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

function pointHits(point: GridPoint, node: VisualNode): boolean {
  const rect = node.footprint
  return point.gx > rect.gx - OBSTACLE_PADDING && point.gx < rect.gx + rect.w + OBSTACLE_PADDING && point.gy > rect.gy - OBSTACLE_PADDING && point.gy < rect.gy + rect.d + OBSTACLE_PADDING
}

type TravelAxis = 0 | 1
type GraphEdge = { to: number; axis: TravelAxis; length: number }
type RoutingGraph = { points: GridPoint[]; pointIndex: ReadonlyMap<string, number>; edges: GraphEdge[][] }
type PortOption = { side: PortSide; sideIndex: number; axis: TravelAxis; anchor: GridPoint; clear: GridPoint }
type QueueEntry = { state: number; cost: number }

const SIDE_AXES: Record<PortSide, TravelAxis> = { north: 1, east: 0, south: 1, west: 0 }
const STATE_STRIDE = 8

function pointKey(point: GridPoint): string {
  return `${point.gx}:${point.gy}`
}

function queueBefore(a: QueueEntry, b: QueueEntry): boolean {
  return a.cost < b.cost || (a.cost === b.cost && a.state < b.state)
}

function queuePush(queue: QueueEntry[], entry: QueueEntry): void {
  queue.push(entry)
  let index = queue.length - 1
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2)
    if (queueBefore(queue[parent]!, entry)) break
    queue[index] = queue[parent]!
    index = parent
  }
  queue[index] = entry
}

function queuePop(queue: QueueEntry[]): QueueEntry | undefined {
  const first = queue[0]
  const last = queue.pop()
  if (!first || !last || queue.length === 0) return first
  let index = 0
  while (true) {
    const left = index * 2 + 1
    if (left >= queue.length) break
    const right = left + 1
    const child = right < queue.length && queueBefore(queue[right]!, queue[left]!) ? right : left
    if (queueBefore(last, queue[child]!)) break
    queue[index] = queue[child]!
    index = child
  }
  queue[index] = last
  return first
}

function buildRoutingGraph(nodes: readonly VisualNode[]): RoutingGraph {
  const xs = new Set<number>()
  const ys = new Set<number>()
  for (const node of nodes) {
    xs.add(node.footprint.gx - OBSTACLE_PADDING)
    xs.add(node.footprint.gx + node.footprint.w + OBSTACLE_PADDING)
    ys.add(node.footprint.gy - OBSTACLE_PADDING)
    ys.add(node.footprint.gy + node.footprint.d + OBSTACLE_PADDING)
    const ports = portAnchors(node.footprint)
    for (const side of PORT_SIDES) {
      const clear = offset(ports[side], side)
      xs.add(clear.gx)
      ys.add(clear.gy)
    }
  }
  const xValues = [...xs].sort((a, b) => a - b)
  const yValues = [...ys].sort((a, b) => a - b)
  const points = xValues.flatMap((gx) => yValues.map((gy) => ({ gx, gy }))).filter((point) => !nodes.some((node) => pointHits(point, node)))
  const pointIndex = new Map(points.map((point, index) => [pointKey(point), index]))
  const edges: GraphEdge[][] = points.map(() => [])
  const rows = new Map<number, number[]>()
  const columns = new Map<number, number[]>()
  points.forEach((point, index) => {
    const row = rows.get(point.gy)
    if (row) row.push(index)
    else rows.set(point.gy, [index])
    const column = columns.get(point.gx)
    if (column) column.push(index)
    else columns.set(point.gx, [index])
  })
  const connectVisible = (indices: number[], axis: TravelAxis) => {
    indices.sort((a, b) => axis === 0 ? points[a]!.gx - points[b]!.gx : points[a]!.gy - points[b]!.gy)
    for (let index = 1; index < indices.length; index += 1) {
      const fromIndex = indices[index - 1]!
      const toIndex = indices[index]!
      const fromPoint = points[fromIndex]!
      const toPoint = points[toIndex]!
      if (!routeIsClear([fromPoint, toPoint], nodes)) continue
      const length = distance(fromPoint, toPoint)
      edges[fromIndex]!.push({ to: toIndex, axis, length })
      edges[toIndex]!.push({ to: fromIndex, axis, length })
    }
  }
  rows.forEach((indices) => connectVisible(indices, 0))
  columns.forEach((indices) => connectVisible(indices, 1))
  return { points, pointIndex, edges }
}

function stateId(pointIndex: number, axis: TravelAxis, originSide: number): number {
  return pointIndex * STATE_STRIDE + axis * PORT_SIDES.length + originSide
}

function routeCore(graph: RoutingGraph, starts: readonly PortOption[], ends: readonly PortOption[], selfRelation: boolean): { points: GridPoint[]; fromSide: PortSide; toSide: PortSide } | null {
  const stateCount = graph.points.length * STATE_STRIDE
  const costs = new Float64Array(stateCount)
  costs.fill(Infinity)
  const previous = new Int32Array(stateCount)
  previous.fill(-1)
  const queue: QueueEntry[] = []
  for (const start of starts) {
    const index = graph.pointIndex.get(pointKey(start.clear))
    if (index === undefined) continue
    const state = stateId(index, start.axis, start.sideIndex)
    costs[state] = 0
    queuePush(queue, { state, cost: 0 })
  }
  while (queue.length > 0) {
    const current = queuePop(queue)!
    if (current.cost !== costs[current.state]) continue
    const pointIndex = Math.floor(current.state / STATE_STRIDE)
    const currentAxis = Math.floor((current.state % STATE_STRIDE) / PORT_SIDES.length) as TravelAxis
    const originSide = current.state % PORT_SIDES.length
    for (const edge of graph.edges[pointIndex]!) {
      const nextState = stateId(edge.to, edge.axis, originSide)
      const nextCost = current.cost + edge.length + (currentAxis === edge.axis ? 0 : BEND_PENALTY)
      if (nextCost >= costs[nextState]!) continue
      costs[nextState] = nextCost
      previous[nextState] = current.state
      queuePush(queue, { state: nextState, cost: nextCost })
    }
  }

  let best: { state: number; cost: number; target: PortOption } | null = null
  for (const target of ends) {
    const index = graph.pointIndex.get(pointKey(target.clear))
    if (index === undefined) continue
    for (let originSide = 0; originSide < PORT_SIDES.length; originSide += 1) {
      if (selfRelation && originSide === target.sideIndex) continue
      for (const axis of [0, 1] as const) {
        const state = stateId(index, axis, originSide)
        const cost = costs[state]! + (axis === target.axis ? 0 : BEND_PENALTY)
        if (!Number.isFinite(cost)) continue
        if (!best || cost < best.cost || (cost === best.cost && state < best.state)) best = { state, cost, target }
      }
    }
  }
  if (!best) return null
  const points: GridPoint[] = []
  for (let state = best.state; state >= 0; state = previous[state]!) points.push(graph.points[Math.floor(state / STATE_STRIDE)]!)
  const originSide = best.state % PORT_SIDES.length
  return { points: cleanRoute(points.reverse()), fromSide: PORT_SIDES[originSide]!, toSide: best.target.side }
}

function portOptions(node: VisualNode, nodes: readonly VisualNode[]): PortOption[] {
  const anchors = portAnchors(node.footprint)
  return PORT_SIDES.map((side, sideIndex) => ({ side, sideIndex, axis: SIDE_AXES[side], anchor: anchors[side], clear: offset(anchors[side], side) }))
    .filter((option) => !nodes.some((obstacle) => obstacle.id !== node.id && segmentHits(option.anchor, option.clear, obstacle)))
}

function directCenteredRoute(from: VisualNode, to: VisualNode, nodes: readonly VisualNode[]): { route: GridPoint[]; fromSide: PortSide; toSide: PortSide } | null {
  if (from.id === to.id) return null
  const fromRect = from.footprint
  const toRect = to.footprint
  const fromPorts = portAnchors(fromRect)
  const toPorts = portAnchors(toRect)
  const fromCenter = { gx: fromRect.gx + fromRect.w / 2, gy: fromRect.gy + fromRect.d / 2 }
  const toCenter = { gx: toRect.gx + toRect.w / 2, gy: toRect.gy + toRect.d / 2 }
  const obstacles = nodes.filter((node) => node.id !== from.id && node.id !== to.id)
  const candidates: { route: GridPoint[]; fromSide: PortSide; toSide: PortSide }[] = []
  if (Math.abs(fromCenter.gx - toCenter.gx) < ALIGNMENT_EPSILON) {
    if (fromRect.gy + fromRect.d < toRect.gy) candidates.push({ route: [fromPorts.south, toPorts.north], fromSide: 'south', toSide: 'north' })
    if (toRect.gy + toRect.d < fromRect.gy) candidates.push({ route: [fromPorts.north, toPorts.south], fromSide: 'north', toSide: 'south' })
  }
  if (Math.abs(fromCenter.gy - toCenter.gy) < ALIGNMENT_EPSILON) {
    if (fromRect.gx + fromRect.w < toRect.gx) candidates.push({ route: [fromPorts.east, toPorts.west], fromSide: 'east', toSide: 'west' })
    if (toRect.gx + toRect.w < fromRect.gx) candidates.push({ route: [fromPorts.west, toPorts.east], fromSide: 'west', toSide: 'east' })
  }
  return candidates.filter((candidate) => routeIsClear(candidate.route, obstacles)).sort((a, b) => distance(a.route[0]!, a.route[1]!) - distance(b.route[0]!, b.route[1]!))[0] ?? null
}

function routeFor(from: VisualNode, to: VisualNode, nodes: readonly VisualNode[], graph: RoutingGraph): { route: GridPoint[]; fromSide: PortSide; toSide: PortSide } | null {
  const direct = directCenteredRoute(from, to, nodes)
  if (direct) return direct
  const starts = portOptions(from, nodes)
  const ends = portOptions(to, nodes)
  const core = routeCore(graph, starts, ends, from.id === to.id)
  if (core) {
    const start = starts.find((option) => option.side === core.fromSide)!
    const end = ends.find((option) => option.side === core.toSide)!
    const route = cleanRoute([start.anchor, ...core.points, end.anchor])
    return { route, fromSide: core.fromSide, toSide: core.toSide }
  }
  const pair = closestAnchorPair(from, to)
  return { route: [pair.start, pair.end], fromSide: pair.fromSide, toSide: pair.toSide }
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

function segmentNormal(start: ScreenPoint, end: ScreenPoint): ScreenPoint {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)
  return length === 0 ? { x: 0, y: 0 } : { x: -dy / length, y: dx / length }
}

function offsetRoute(points: readonly ScreenPoint[], amount: number): ScreenPoint[] {
  if (amount === 0 || points.length < 2) return [...points]
  return points.map((point, index) => {
    const before = index > 0 ? segmentNormal(points[index - 1]!, point) : segmentNormal(point, points[index + 1]!)
    const after = index < points.length - 1 ? segmentNormal(point, points[index + 1]!) : before
    const miterLength = Math.hypot(before.x + after.x, before.y + after.y)
    if (miterLength < ALIGNMENT_EPSILON) return { x: point.x + after.x * amount, y: point.y + after.y * amount }
    const miter = { x: (before.x + after.x) / miterLength, y: (before.y + after.y) / miterLength }
    const projection = miter.x * after.x + miter.y * after.y
    const scale = Math.abs(projection) < ALIGNMENT_EPSILON ? amount : amount / projection
    return { x: point.x + miter.x * scale, y: point.y + miter.y * scale }
  })
}

export function buildRelationGeometry(nodes: readonly VisualNode[], relations: readonly OntologyRelation[]): ReadonlyMap<string, RelationGeometry> {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const result = new Map<string, RelationGeometry>()
  if (relations.length === 0) return result
  const graph = buildRoutingGraph(nodes)
  const parallelGroups = new Map<string, OntologyRelation[]>()
  for (const relation of relations) {
    const key = JSON.stringify(relation.from < relation.to ? [relation.from, relation.to] : [relation.to, relation.from])
    const group = parallelGroups.get(key)
    if (group) group.push(relation)
    else parallelGroups.set(key, [relation])
  }
  const laneOffsets = new Map<string, number>()
  for (const group of parallelGroups.values()) group.forEach((relation, index) => {
    const canonicalDirection = relation.from <= relation.to ? 1 : -1
    laneOffsets.set(relation.id, (index - (group.length - 1) / 2) * PARALLEL_LANE_GAP * canonicalDirection)
  })
  for (const relation of relations) {
    const from = byId.get(relation.from)
    const to = byId.get(relation.to)
    if (!from || !to) continue
    const routed = routeFor(from, to, nodes, graph)
    if (!routed) continue
    const points = offsetRoute(gridRouteToScreen(routed.route), laneOffsets.get(relation.id) ?? 0)
    const { cumulative, total } = polylineLengths(points)
    result.set(relation.id, { points, cumulative, total, fromSide: routed.fromSide, toSide: routed.toSide, labelPoint: longestSegmentMidpoint(points) })
  }
  return result
}
