import type { Footprint, OntologyDocument, VisualNode } from '../../domain/types'
import { portAnchors, type PortSide } from './archetypes'
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
const PORT_CLEARANCE = 0.8
const OBSTACLE_PADDING = 0.35
const LANE_GAP = 14

const DROP_PORTS: Record<ExitDirection, PortSide[]> = { down: ['south', 'east'], up: ['north', 'west'] }
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
    const corners = [toScreen(node.footprint.gx, node.footprint.gy), toScreen(node.footprint.gx + node.footprint.w, node.footprint.gy + node.footprint.d)]
    const min = corners[0]!
    const max = corners[1]!
    return point.x > min.x - OBSTACLE_PADDING * 24 && point.x < max.x + OBSTACLE_PADDING * 24 && point.y > min.y - OBSTACLE_PADDING * 24 && point.y < max.y + OBSTACLE_PADDING * 24
  })
}

export function buildExitRoute(local: VisualNode, direction: ExitDirection, nodes: readonly VisualNode[], lane = 0): { points: ScreenPoint[]; dropStart: ScreenPoint; dropEnd: ScreenPoint; fromSide: PortSide } | null {
  const ports = portAnchors(local.footprint)
  const candidates = DROP_PORTS[direction].map((side) => {
    const anchor = ports[side]
    const normal = { north: { gx: 0, gy: -1 }, east: { gx: 1, gy: 0 }, south: { gx: 0, gy: 1 }, west: { gx: -1, gy: 0 } }[side]
    const clearGrid = { gx: anchor.gx + normal.gx * PORT_CLEARANCE, gy: anchor.gy + normal.gy * PORT_CLEARANCE }
    return { side, anchor: toScreen(anchor.gx, anchor.gy), clear: toScreen(clearGrid.gx, clearGrid.gy) }
  })
  const free = candidates.find((candidate) => !pointBlocked(candidate.clear, local.id, nodes)) ?? candidates[0]
  if (!free) return null
  const sign = direction === 'down' ? 1 : -1
  const dropX = free.clear.x + lane * LANE_GAP * sign
  const elbow: ScreenPoint = { x: dropX, y: free.clear.y }
  const dropStart = elbow
  const dropEnd: ScreenPoint = { x: dropX, y: free.clear.y + EXIT_DROP * sign }
  const points = [free.anchor, elbow, dropEnd]
  return { points, dropStart, dropEnd, fromSide: free.side }
}

export function buildExitGeometries(document: OntologyDocument, floorId: string, nodes: readonly VisualNode[]): ReadonlyMap<string, ExitGeometry> {
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
    const route = buildExitRoute(local, direction, nodes, lane)
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
