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

function verticalFace(a: { gx: number; gy: number }, b: { gx: number; gy: number }, z0: number, z1: number, shade: 'left' | 'right', hatch = false): Face {
  return { points: [toScreen(a.gx, a.gy, z1), toScreen(b.gx, b.gy, z1), toScreen(b.gx, b.gy, z0), toScreen(a.gx, a.gy, z0)], shade, hatch }
}

function topFace(points: { gx: number; gy: number }[], height: number): Face {
  return { points: points.map((point) => toScreen(point.gx, point.gy, height)), shade: 'top' }
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
    const { gx, gy, w, d } = footprint
    const wing = Math.min(w * 0.27, d * 0.27)
    const innerLeft = gx + wing
    const innerRight = gx + w - wing
    const innerBack = gy + d - wing
    return [
      verticalFace({ gx, gy: gy + d }, { gx: gx + w, gy: gy + d }, 0, height, 'left'),
      verticalFace({ gx: gx + w, gy }, { gx: gx + w, gy: gy + d }, 0, height, 'right'),
      verticalFace({ gx: innerLeft, gy }, { gx: innerLeft, gy: innerBack }, 0, height, 'right'),
      verticalFace({ gx: innerLeft, gy: innerBack }, { gx: innerRight, gy: innerBack }, 0, height, 'left'),
      verticalFace({ gx, gy }, { gx: innerLeft, gy }, 0, height, 'left'),
      verticalFace({ gx: innerRight, gy }, { gx: gx + w, gy }, 0, height, 'left'),
      topFace([
        { gx, gy },
        { gx: innerLeft, gy },
        { gx: innerLeft, gy: innerBack },
        { gx: innerRight, gy: innerBack },
        { gx: innerRight, gy },
        { gx: gx + w, gy },
        { gx: gx + w, gy: gy + d },
        { gx, gy: gy + d },
      ], height),
    ]
  }
  if (archetype === 'bridge') {
    const { gx, gy, w, d } = footprint
    const support = w * 0.24
    const openingLeft = gx + support
    const openingRight = gx + w - support
    const beamBottom = height * 0.64
    return [
      {
        points: [
          toScreen(gx, gy + d, height),
          toScreen(gx + w, gy + d, height),
          toScreen(gx + w, gy + d, 0),
          toScreen(openingRight, gy + d, 0),
          toScreen(openingRight, gy + d, beamBottom),
          toScreen(openingLeft, gy + d, beamBottom),
          toScreen(openingLeft, gy + d, 0),
          toScreen(gx, gy + d, 0),
        ],
        shade: 'left',
        hatch: true,
      },
      verticalFace({ gx: gx + w, gy }, { gx: gx + w, gy: gy + d }, 0, height, 'right', true),
      verticalFace({ gx: openingLeft, gy }, { gx: openingLeft, gy: gy + d }, 0, beamBottom, 'right', true),
      {
        points: [
          toScreen(openingLeft, gy, beamBottom),
          toScreen(openingRight, gy, beamBottom),
          toScreen(openingRight, gy + d, beamBottom),
          toScreen(openingLeft, gy + d, beamBottom),
        ],
        shade: 'left',
      },
      topFace([{ gx, gy }, { gx: gx + w, gy }, { gx: gx + w, gy: gy + d }, { gx, gy: gy + d }], height),
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

export type PortSide = 'north' | 'east' | 'south' | 'west'

export function portAnchors(footprint: Footprint): Record<PortSide, { gx: number; gy: number }> {
  return {
    north: { gx: footprint.gx + footprint.w / 2, gy: footprint.gy },
    east: { gx: footprint.gx + footprint.w, gy: footprint.gy + footprint.d / 2 },
    south: { gx: footprint.gx + footprint.w / 2, gy: footprint.gy + footprint.d },
    west: { gx: footprint.gx, gy: footprint.gy + footprint.d / 2 },
  }
}
