import type { Footprint, GridPoint } from '../../domain/types'

export const TILE_W = 48
export const TILE_H = 24
export const ELEVATION = 14

export type ScreenPoint = { x: number; y: number }

export function toScreen(gx: number, gy: number, z = 0): ScreenPoint {
  return { x: (gx - gy) * (TILE_W / 2), y: (gx + gy) * (TILE_H / 2) - z * ELEVATION }
}

export function depthKey(footprint: Footprint): number {
  return footprint.gx + footprint.w + footprint.gy + footprint.d
}

export function footprintsOverlap(a: Footprint, b: Footprint, gap = 0): boolean {
  return a.gx < b.gx + b.w + gap && b.gx < a.gx + a.w + gap && a.gy < b.gy + b.d + gap && b.gy < a.gy + a.d + gap
}

export function gridRouteToScreen(route: GridPoint[]): ScreenPoint[] {
  return route.map((point) => toScreen(point.gx, point.gy))
}

export function polylineLengths(points: ScreenPoint[]): { total: number; cumulative: number[] } {
  const cumulative = [0]
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1]
    const current = points[i]
    if (!previous || !current) continue
    cumulative.push(cumulative[cumulative.length - 1]! + Math.hypot(current.x - previous.x, current.y - previous.y))
  }
  return { total: cumulative[cumulative.length - 1] ?? 0, cumulative }
}

export function pointAtLength(points: ScreenPoint[], cumulative: number[], distance: number): ScreenPoint {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return points[0]!
  const total = cumulative[cumulative.length - 1] ?? 0
  const at = Math.max(0, Math.min(distance, total))
  let index = 1
  while (index < cumulative.length - 1 && cumulative[index]! < at) index += 1
  const before = points[index - 1]!
  const after = points[index]!
  const span = cumulative[index]! - cumulative[index - 1]!
  const progress = span === 0 ? 0 : (at - cumulative[index - 1]!) / span
  return { x: before.x + (after.x - before.x) * progress, y: before.y + (after.y - before.y) * progress }
}

export function pointsAttribute(points: ScreenPoint[]): string {
  return points.map((point) => `${Math.round(point.x * 100) / 100},${Math.round(point.y * 100) / 100}`).join(' ')
}

export function sceneBounds(items: { footprint: Footprint; height: number }[], margin = 64) {
  if (items.length === 0) return { x: -300, y: -180, width: 600, height: 360 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const { footprint, height } of items) {
    const corners = [
      toScreen(footprint.gx, footprint.gy, height),
      toScreen(footprint.gx + footprint.w, footprint.gy, height),
      toScreen(footprint.gx + footprint.w, footprint.gy + footprint.d),
      toScreen(footprint.gx, footprint.gy + footprint.d),
    ]
    for (const corner of corners) {
      minX = Math.min(minX, corner.x)
      minY = Math.min(minY, corner.y)
      maxX = Math.max(maxX, corner.x)
      maxY = Math.max(maxY, corner.y)
    }
  }
  return { x: minX - margin, y: minY - margin, width: maxX - minX + margin * 2, height: maxY - minY + margin * 2 }
}
