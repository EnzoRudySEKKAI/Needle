import type { Footprint, OntologyGroup, VisualNode } from '../../domain/types'
import { depthKey, sceneBounds, toScreen, type ScreenPoint } from './iso'

export type District = {
  id: string
  name: string
  displayName: string
  labelWidth: number
  rect: Footprint
  flagAt: { gx: number; gy: number }
  nodeIds: string[]
}
export type Scene = { key: string; shapes: VisualNode[]; districts: District[]; grid: { key: string; a: ScreenPoint; b: ScreenPoint }[]; bounds: ReturnType<typeof sceneBounds> }
export type Camera = { x: number; y: number; k: number }

function includeFlag(rect: Footprint, flagAt: { gx: number; gy: number }, labelWidth: number): Footprint {
  const margin = 0.5
  const labelSpan = (labelWidth + 4) / 48
  const gx0 = Math.min(rect.gx, flagAt.gx - margin)
  const gy0 = Math.min(rect.gy, flagAt.gy - labelSpan - margin)
  const gx1 = Math.max(rect.gx + rect.w, flagAt.gx + labelSpan + margin)
  const gy1 = Math.max(rect.gy + rect.d, flagAt.gy + margin)
  return { gx: gx0, gy: gy0, w: gx1 - gx0, d: gy1 - gy0 }
}

function districtsFor(groups: readonly OntologyGroup[], nodes: readonly VisualNode[], flagWidths: ReadonlyMap<string, number>, flagPositions: Readonly<Record<string, { gx: number; gy: number }>>): District[] {
  return groups.flatMap((group) => {
    const members = nodes.filter((node) => node.groupId === group.id)
    if (members.length === 0) return []
    const displayName = group.name
    const labelWidth = flagWidths.get(group.id) ?? Math.max(24, displayName.length * 4.9 + 12)
    const frontPadding = Math.max(3.2, labelWidth / 24 + 1.5)
    const gx0 = Math.min(...members.map((node) => node.footprint.gx)) - 1.2
    const gy0 = Math.min(...members.map((node) => node.footprint.gy)) - 1.2
    const gx1 = Math.max(...members.map((node) => node.footprint.gx + node.footprint.w)) + 1.2
    const memberGy1 = Math.max(...members.map((node) => node.footprint.gy + node.footprint.d)) + 1.2
    const memberRect = { gx: gx0, gy: gy0, w: gx1 - gx0, d: memberGy1 - gy0 }
    const automaticRect = { ...memberRect, d: memberRect.d + frontPadding - 1.2 }
    const customFlag = flagPositions[group.id]
    const flagAt = customFlag ?? { gx: automaticRect.gx + 0.35, gy: automaticRect.gy + automaticRect.d - 0.5 }
    const rect = customFlag ? includeFlag(memberRect, flagAt, labelWidth) : automaticRect
    return [{
      id: group.id,
      name: group.name,
      displayName,
      labelWidth,
      rect,
      flagAt,
      nodeIds: members.map((node) => node.id),
    }]
  })
}

export function buildScene(groups: readonly OntologyGroup[], nodes: readonly VisualNode[], key: string, flagWidths: ReadonlyMap<string, number> = new Map(), flagPositions: Readonly<Record<string, { gx: number; gy: number }>> = {}, extraExtents: readonly { footprint: Footprint; height: number }[] = []): Scene {
  const shapes = [...nodes].sort((a, b) => depthKey(a.footprint) - depthKey(b.footprint))
  const districts = districtsFor(groups, nodes, flagWidths, flagPositions)
  const extents = [...shapes.map((node) => ({ footprint: node.footprint, height: node.height })), ...districts.map((district) => ({ footprint: district.rect, height: 0 })), ...extraExtents]
  const bounds = sceneBounds(extents)
  if (extents.length === 0) return { key, shapes, districts, grid: [], bounds }
  const minX = Math.floor(Math.min(...extents.map((item) => item.footprint.gx))) - 2
  const minY = Math.floor(Math.min(...extents.map((item) => item.footprint.gy))) - 2
  const maxX = Math.ceil(Math.max(...extents.map((item) => item.footprint.gx + item.footprint.w))) + 2
  const maxY = Math.ceil(Math.max(...extents.map((item) => item.footprint.gy + item.footprint.d))) + 2
  const grid = []
  for (let gx = minX; gx <= maxX; gx += 1) grid.push({ key: `x-${gx}`, a: toScreen(gx, minY), b: toScreen(gx, maxY) })
  for (let gy = minY; gy <= maxY; gy += 1) grid.push({ key: `y-${gy}`, a: toScreen(minX, gy), b: toScreen(maxX, gy) })
  return { key, shapes, districts, grid, bounds }
}

export function fitCamera(width: number, height: number, bounds: Scene['bounds']): Camera {
  const k = Math.max(0.35, Math.min(1.4, Math.min(width / bounds.width, height / bounds.height)))
  return { k, x: (width - bounds.width * k) / 2 - bounds.x * k, y: (height - bounds.height * k) / 2 - bounds.y * k }
}

export function zoomAbout(camera: Camera, factor: number, x: number, y: number): Camera {
  const k = Math.max(0.3, Math.min(3, camera.k * factor))
  const ratio = k / camera.k
  return { k, x: x - (x - camera.x) * ratio, y: y - (y - camera.y) * ratio }
}
