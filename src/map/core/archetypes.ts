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
      verticalFace({ gx: innerLeft, gy }, { gx: innerLeft, gy: innerBack }, 0, height, 'right'),
      verticalFace({ gx, gy: gy + d }, { gx: gx + w, gy: gy + d }, 0, height, 'left'),
      verticalFace({ gx: gx + w, gy }, { gx: gx + w, gy: gy + d }, 0, height, 'right'),
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
      verticalFace({ gx: openingLeft, gy }, { gx: openingLeft, gy: gy + d }, 0, beamBottom, 'right', true),
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
  if (archetype === 'server-rack') {
    const modules = 4
    const gap = height * 0.05
    const moduleH = (height - gap * (modules - 1)) / modules
    const result: Face[] = []
    for (let i = 0; i < modules; i += 1) {
      const z0 = i * (moduleH + gap)
      const z1 = z0 + moduleH
      result.push(...boxFaces(footprint, z0, z1, true))
      if (i < modules - 1) {
        const ventY = footprint.gy + footprint.d * 0.18
        const ventH = gap * 0.55
        result.push(...boxFaces({ gx: footprint.gx + 0.08, gy: ventY, w: footprint.w - 0.16, d: 0.08 }, z1 + (gap - ventH) / 2, z1 + (gap + ventH) / 2))
      }
    }
    return result
  }
  if (archetype === 'monitor') {
    const baseH = height * 0.11
    const standH = baseH + height * 0.22
    const screenBottom = standH
    const screenH = height - screenBottom - 0.08
    const screenTh = 0.095
    const screenW = footprint.w * 0.88
    const screenX = footprint.gx + (footprint.w - screenW) / 2
    const screenY = footprint.gy + (footprint.d - screenTh) / 2
    const footW = footprint.w * 0.56
    const footD = footprint.d * 0.34
    const footX = footprint.gx + (footprint.w - footW) / 2
    const footY = footprint.gy + (footprint.d - footD) / 2
    const standW = footprint.w * 0.15
    const standD = footprint.d * 0.15
    const standX = footprint.gx + (footprint.w - standW) / 2
    const standY = footprint.gy + (footprint.d - standD) / 2
    const bezel = 0.07
    const innerW = screenW - bezel * 2
    const innerTh = screenTh * 0.65
    const innerX = screenX + bezel
    const innerY = screenY + (screenTh - innerTh) / 2
    const camW = screenW * 0.08
    const camH = 0.045
    const camX = screenX + (screenW - camW) / 2
    const logoW = screenW * 0.11
    const logoH = 0.03
    const logoX = screenX + (screenW - logoW) / 2
    return [
      ...boxFaces({ gx: footX, gy: footY, w: footW, d: footD }, 0, baseH),
      ...boxFaces({ gx: standX, gy: standY, w: standW, d: standD }, baseH, standH),
      ...boxFaces({ gx: screenX, gy: screenY, w: screenW, d: screenTh }, screenBottom, screenBottom + screenH),
      ...boxFaces({ gx: innerX, gy: innerY, w: innerW, d: innerTh }, screenBottom + 0.04, screenBottom + screenH - 0.04, true),
      ...boxFaces({ gx: camX, gy: screenY + screenTh * 0.38, w: camW, d: camH }, screenBottom + screenH, screenBottom + screenH + 0.07),
      ...boxFaces({ gx: logoX, gy: innerY + innerTh - 0.02, w: logoW, d: logoH }, screenBottom + 0.04, screenBottom + 0.08),
    ]
  }
  if (archetype === 'database') {
    const cx = footprint.gx + footprint.w / 2
    const cy = footprint.gy + footprint.d / 2
    const rx = footprint.w * 0.44
    const ry = footprint.d * 0.44
    const ring = (rScale: number, yScale = 1) => Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4
      return { gx: cx + Math.cos(a) * rx * rScale, gy: cy + Math.sin(a) * ry * rScale * yScale }
    })
    const h1 = height * 0.38
    const h2 = height * 0.82
    const lower = ring(1)
    const upper = ring(1)
    const result: Face[] = []
    for (let i = 0; i < 8; i += 1) {
      const a = lower[i]!
      const b = lower[(i + 1) % 8]!
      const shade: 'left' | 'right' = i < 2 || i === 7 ? 'right' : 'left'
      result.push(verticalFace(a, b, 0, h1, shade, i % 2 === 0))
      result.push(verticalFace(a, b, h1 + 0.06, h2, shade, i % 2 === 0))
    }
    result.push(topFace(lower, h1))
    result.push(topFace(upper, h2))
    result.push(topFace(ring(0.72), h1 + 0.03))
    result.push(topFace(ring(0.72), h2 + 0.03))
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
