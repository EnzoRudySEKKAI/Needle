import type { Archetype, Footprint } from '../../domain/types'
import { toScreen, type ScreenPoint } from './iso'

export type Face = { points: ScreenPoint[]; shade: 'top' | 'left' | 'right'; hatch?: boolean }

function boxFaces(footprint: Footprint, z0: number, z1: number, hatch = false): Face[] {
  const { gx, gy, w, d } = footprint
  const a1 = toScreen(gx, gy, z1)
  const b1 = toScreen(gx + w, gy, z1)
  const c1 = toScreen(gx + w, gy + d, z1)
  const d1 = toScreen(gx, gy + d, z1)
  const b0 = toScreen(gx + w, gy, z0)
  const c0 = toScreen(gx + w, gy + d, z0)
  const d0 = toScreen(gx, gy + d, z0)
  return [
    { points: [d1, c1, c0, d0], shade: 'left', hatch },
    { points: [b1, c1, c0, b0], shade: 'right', hatch },
    { points: [a1, b1, c1, d1], shade: 'top' },
  ]
}

export function buildingFaces(archetype: Archetype, footprint: Footprint, height: number, propertyCount: number): Face[] {
  if (archetype === 'tower') return boxFaces(footprint, 0, height, true)
  if (archetype === 'slab-stack') {
    const levels = Math.max(2, Math.min(4, Math.ceil(height / 1.4)))
    const result: Face[] = []
    for (let level = 0; level < levels; level += 1) {
      const inset = level * 0.16
      result.push(...boxFaces({ gx: footprint.gx + inset, gy: footprint.gy + inset, w: footprint.w - inset * 2, d: footprint.d - inset * 2 }, level * height / levels, (level + 1) * height / levels, true))
    }
    return result
  }
  if (archetype === 'fin-row') {
    const count = Math.max(2, Math.min(7, propertyCount + 1))
    const pitch = footprint.w / count
    const result: Face[] = []
    for (let index = 0; index < count; index += 1) result.push(...boxFaces({ gx: footprint.gx + index * pitch, gy: footprint.gy, w: pitch * 0.58, d: footprint.d }, 0, height, true))
    return result
  }
  if (archetype === 'podium-tower') {
    const podiumHeight = Math.max(0.65, height * 0.28)
    const insetX = footprint.w * 0.24
    const insetY = footprint.d * 0.2
    return [
      ...boxFaces(footprint, 0, podiumHeight),
      ...boxFaces({ gx: footprint.gx + insetX, gy: footprint.gy + insetY, w: footprint.w - insetX * 2, d: footprint.d - insetY * 2 }, podiumHeight, height, true),
    ]
  }
  if (archetype === 'twin-towers') {
    const gap = footprint.w * 0.12
    const width = (footprint.w - gap) / 2
    return [
      ...boxFaces({ ...footprint, w: width }, 0, height, true),
      ...boxFaces({ gx: footprint.gx + width + gap, gy: footprint.gy + 0.25, w: width, d: footprint.d - 0.25 }, 0, height * 0.76, true),
    ]
  }
  if (archetype === 'courtyard') {
    const wing = Math.min(1, footprint.w * 0.23, footprint.d * 0.23)
    const wallHeight = Math.max(0.9, height * 0.52)
    return [
      ...boxFaces({ gx: footprint.gx, gy: footprint.gy, w: wing, d: footprint.d }, 0, wallHeight),
      ...boxFaces({ gx: footprint.gx + footprint.w - wing, gy: footprint.gy, w: wing, d: footprint.d }, 0, wallHeight),
      ...boxFaces({ gx: footprint.gx + wing, gy: footprint.gy + footprint.d - wing, w: footprint.w - wing * 2, d: wing }, 0, wallHeight),
    ]
  }
  if (archetype === 'bridge') {
    const towerWidth = footprint.w * 0.27
    const towerHeight = Math.max(1.6, height)
    const deckBottom = towerHeight * 0.48
    const deckTop = towerHeight * 0.66
    return [
      ...boxFaces({ ...footprint, w: towerWidth }, 0, towerHeight, true),
      ...boxFaces({ gx: footprint.gx + footprint.w - towerWidth, gy: footprint.gy, w: towerWidth, d: footprint.d }, 0, towerHeight, true),
      ...boxFaces({ gx: footprint.gx + towerWidth, gy: footprint.gy + footprint.d * 0.22, w: footprint.w - towerWidth * 2, d: footprint.d * 0.56 }, deckBottom, deckTop),
    ]
  }
  if (archetype === 'stepped-pyramid') {
    const levels = 4
    const result: Face[] = []
    for (let level = 0; level < levels; level += 1) {
      const inset = level * Math.min(footprint.w, footprint.d) * 0.095
      result.push(...boxFaces({ gx: footprint.gx + inset, gy: footprint.gy + inset, w: footprint.w - inset * 2, d: footprint.d - inset * 2 }, level * height / levels, (level + 1) * height / levels, level > 1))
    }
    return result
  }
  return boxFaces(footprint, 0, height)
}

export function chipAnchor(footprint: Footprint, height: number): ScreenPoint {
  return toScreen(footprint.gx + footprint.w / 2, footprint.gy + footprint.d / 2, height)
}

export function portAnchor(footprint: Footprint): { gx: number; gy: number } {
  return { gx: footprint.gx + footprint.w / 2, gy: footprint.gy + footprint.d }
}
