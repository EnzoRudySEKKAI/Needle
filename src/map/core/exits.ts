import type { Footprint, OntologyDocument, VisualNode } from '../../domain/types'
import type { PortSide } from './archetypes'
import { polylineLengths, toScreen, type ScreenPoint } from './iso'
import type { RelationGeometry } from './routes'

export type ExitDirection = 'up' | 'down'

export type ExitGeometry = {
  relationId: string
  localNodeId: string
  remoteNodeId: string
  floorId: string
  floorName: string
  direction: ExitDirection
  fromSide: PortSide
  toSide: PortSide
  points: ScreenPoint[]
  cumulative: number[]
  total: number
  dropStart: ScreenPoint
  dropEnd: ScreenPoint
  labelPoint: ScreenPoint
}

const EXIT_DROP = 96
const PORT_CLEARANCE = 20
const OBSTACLE_PADDING = 0.35
const LANE_GAP = 14

const EXIT_TO_SIDE: Record<ExitDirection, PortSide> = { down: 'north', up: 'south' }

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

function pointBlocked(point: ScreenPoint, localId: string, nodes: readonly VisualNode[]): boolean {
  return nodes.some((node) => {
    if (node.id === localId) return false
    const { gx, gy, w, d } = node.footprint
    const corners = [toScreen(gx, gy), toScreen(gx + w, gy), toScreen(gx + w, gy + d), toScreen(gx, gy + d)]
    const minX = Math.min(...corners.map((corner) => corner.x))
    const maxX = Math.max(...corners.map((corner) => corner.x))
    const minY = Math.min(...corners.map((corner) => corner.y))
    const maxY = Math.max(...corners.map((corner) => corner.y))
    return point.x > minX - OBSTACLE_PADDING * 24 && point.x < maxX + OBSTACLE_PADDING * 24 && point.y > minY - OBSTACLE_PADDING * 24 && point.y < maxY + OBSTACLE_PADDING * 24
  })
}

export function buildExitRoute(local: VisualNode, direction: ExitDirection, nodes: readonly VisualNode[], lane = 0, preferredSide?: 'west' | 'east'): { points: ScreenPoint[]; dropStart: ScreenPoint; dropEnd: ScreenPoint; fromSide: PortSide } | null {
  const { gx, gy, w, d } = local.footprint
  const left = toScreen(gx, gy + d)
  const right = toScreen(gx + w, gy)
  const sign = direction === 'down' ? 1 : -1
  const depth = PORT_CLEARANCE / 2 * sign
  const candidates: { side: PortSide; anchor: ScreenPoint; clear: ScreenPoint }[] = [
    { side: 'west', anchor: left, clear: { x: left.x - PORT_CLEARANCE, y: left.y + depth } },
    { side: 'east', anchor: right, clear: { x: right.x + PORT_CLEARANCE, y: right.y + depth } },
  ]
  if (preferredSide === 'east' || (!preferredSide && lane % 2 === 1)) candidates.reverse()
  const free = preferredSide ? candidates[0] : candidates.find((candidate) => !pointBlocked(candidate.clear, local.id, nodes)) ?? candidates[0]
  if (!free) return null
  const sideSign = free.side === 'west' ? -1 : 1
  const dropX = free.clear.x + (preferredSide ? lane : Math.floor(lane / 2)) * LANE_GAP * sideSign
  const elbow: ScreenPoint = { x: dropX, y: free.anchor.y + Math.abs(dropX - free.anchor.x) / 2 * sign }
  const dropStart = elbow
  const dropEnd: ScreenPoint = { x: dropX, y: free.clear.y + EXIT_DROP * sign }
  const points = [free.anchor, elbow, dropEnd]
  return { points, dropStart, dropEnd, fromSide: free.side }
}

export function buildExitGeometries(document: OntologyDocument, floorId: string, nodes: readonly VisualNode[], preferredSides?: ReadonlyMap<string, 'west' | 'east'>): ReadonlyMap<string, ExitGeometry> {
  const result = new Map<string, ExitGeometry>()
  const currentIndex = document.floors.findIndex((floor) => floor.id === floorId)
  if (currentIndex < 0) return result
  const localVisualById = new Map(nodes.map((node) => [node.id, node]))
  const lanes = new Map<string, number>()
  for (const relation of document.relations) {
    const from = document.nodes.find((node) => node.id === relation.from)
    const to = document.nodes.find((node) => node.id === relation.to)
    if (!from || !to) continue
    const fromOnFloor = from.floorId === floorId
    const toOnFloor = to.floorId === floorId
    if (fromOnFloor === toOnFloor) continue
    const local = localVisualById.get(fromOnFloor ? from.id : to.id)
    if (!local) continue
    const remote = fromOnFloor ? to : from
    const remoteFloor = document.floors.find((floor) => floor.id === remote.floorId)
    if (!remoteFloor) continue
    const remoteIndex = document.floors.indexOf(remoteFloor)
    const direction: ExitDirection = remoteIndex > currentIndex ? 'up' : 'down'
    const laneKey = `${local.id}:${direction}`
    const lane = lanes.get(laneKey) ?? 0
    lanes.set(laneKey, lane + 1)
    const route = buildExitRoute(local, direction, nodes, lane, preferredSides?.get(relation.id))
    if (!route) continue
    const { cumulative, total } = polylineLengths(route.points)
    result.set(relation.id, {
      relationId: relation.id,
      localNodeId: local.id,
      remoteNodeId: remote.id,
      floorId: remoteFloor.id,
      floorName: remoteFloor.name,
      direction,
      fromSide: route.fromSide,
      toSide: EXIT_TO_SIDE[direction],
      points: route.points,
      cumulative,
      total,
      dropStart: route.dropStart,
      dropEnd: route.dropEnd,
      labelPoint: longestSegmentMidpoint(route.points),
    })
  }
  return result
}

export function exitRelationGeometry(exit: ExitGeometry, reverse: boolean): RelationGeometry {
  if (!reverse) return { points: exit.points, cumulative: exit.cumulative, total: exit.total, fromSide: exit.fromSide, toSide: exit.toSide, labelPoint: exit.labelPoint }
  const points = [...exit.points].reverse()
  const { cumulative, total } = polylineLengths(points)
  return { points, cumulative, total, fromSide: exit.toSide, toSide: exit.fromSide, labelPoint: exit.labelPoint }
}

export function exitExtent(exit: ExitGeometry): { footprint: Footprint; height: number } {
  const { x, y } = exit.dropEnd
  const gx = (x / 24 + y / 12) / 2
  const gy = (y / 12 - x / 24) / 2
  return { footprint: { gx, gy, w: 0.01, d: 0.01 }, height: 0 }
}
