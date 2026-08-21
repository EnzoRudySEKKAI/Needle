import type { StructureType } from '../../domain/types'
import type { ScreenPoint } from './iso'

export type StructurePolygon = {
  points: ScreenPoint[]
  tone: 'front' | 'side' | 'top' | 'glass' | 'hull'
}

export type StructureDetail = {
  x1: number
  y1: number
  x2: number
  y2: number
  tone?: 'window' | 'seam' | 'balcony'
}

export type StructureFloorSlot = {
  index: number
  centerY: number
  polygons: StructurePolygon[]
  details: StructureDetail[]
}

export type StructureGeometry = {
  type: StructureType
  structureBounds: { x: number; y: number; width: number; height: number }
  viewBox: { x: number; y: number; width: number; height: number }
  previewX: number
  floors: StructureFloorSlot[]
  shell: StructurePolygon[]
  details: StructureDetail[]
}

const polygon = (tone: StructurePolygon['tone'], points: ScreenPoint[]): StructurePolygon => ({ tone, points })
const detail = (x1: number, y1: number, x2: number, y2: number, tone: StructureDetail['tone'] = 'window'): StructureDetail => ({ x1, y1, x2, y2, tone })

function windowGrid(x0: number, x1: number, y0: number, y1: number, rowGap = 25, moduleWidth = 13, moduleGap = 9): StructureDetail[] {
  const lines: StructureDetail[] = []
  for (let y = y0 + rowGap / 2; y < y1 - 5; y += rowGap) {
    for (let x = x0 + 12; x + moduleWidth < x1 - 8; x += moduleWidth + moduleGap) lines.push(detail(x, y, x + moduleWidth, y))
  }
  return lines
}

function towerGeometry(count: number): StructureGeometry {
  const topY = -178
  const baseY = 174
  const height = (baseY - topY) / count
  const widthAt = (y: number) => {
    const progress = (y - topY) / (baseY - topY)
    if (progress < .22) return 98
    if (progress < .68) return 124
    return 148
  }
  const floors = Array.from({ length: count }, (_, index): StructureFloorSlot => {
    const y = baseY - index * height
    const top = y - height
    const topHalf = widthAt(top)
    const bottomHalf = widthAt(y)
    const centerX = -18
    const topLeft = centerX - topHalf
    const topRight = centerX + topHalf
    const bottomLeft = centerX - bottomHalf
    const bottomRight = centerX + bottomHalf
    return {
      index,
      centerY: top + height / 2,
      polygons: [
        polygon('front', [{ x: topLeft, y: top }, { x: topRight, y: top }, { x: bottomRight, y }, { x: bottomLeft, y }]),
        polygon('side', [{ x: topRight, y: top }, { x: topRight + 48, y: top - 26 }, { x: bottomRight + 48, y: y - 26 }, { x: bottomRight, y }]),
      ],
      details: [
        ...windowGrid(Math.max(topLeft, bottomLeft), Math.min(topRight, bottomRight), top + 6, y - 3, 24, 14, 10),
        detail(topRight + 12, top + height * .35 - 8, bottomRight + 35, top + height * .35 - 20),
        detail(topRight + 12, top + height * .68 - 8, bottomRight + 35, top + height * .68 - 20),
      ],
    }
  })
  const roofHalf = widthAt(topY)
  return {
    type: 'tower',
    structureBounds: { x: -190, y: topY - 92, width: 410, height: baseY - topY + 128 },
    viewBox: { x: -400, y: -292, width: 1200, height: 650 },
    previewX: 270,
    floors,
    shell: [
      polygon('top', [{ x: -18 - roofHalf, y: topY }, { x: -18 + roofHalf, y: topY }, { x: 30 + roofHalf, y: topY - 26 }, { x: 30 - roofHalf, y: topY - 26 }]),
      polygon('glass', [{ x: -68, y: topY - 26 }, { x: 54, y: topY - 26 }, { x: 78, y: topY - 52 }, { x: -44, y: topY - 52 }]),
      polygon('side', [{ x: -180, y: baseY }, { x: 130, y: baseY }, { x: 146, y: baseY + 18 }, { x: -196, y: baseY + 18 }]),
    ],
    details: [
      detail(4, topY - 52, 4, topY - 90, 'seam'),
      detail(-34, topY - 90, 42, topY - 90, 'seam'),
      detail(-166, baseY + 5, 128, baseY + 5, 'balcony'),
    ],
  }
}

function campusGeometry(count: number): StructureGeometry {
  const topY = -72
  const baseY = 144
  const height = (baseY - topY) / count
  const floors = Array.from({ length: count }, (_, index): StructureFloorSlot => {
    const y = baseY - index * height
    const top = y - height
    return {
      index,
      centerY: top + height / 2,
      polygons: [
        polygon('glass', [{ x: -76, y: top - 52 }, { x: 72, y: top - 52 }, { x: 72, y: y - 52 }, { x: -76, y: y - 52 }]),
        polygon('side', [{ x: 72, y: top - 52 }, { x: 118, y: top - 77 }, { x: 118, y: y - 77 }, { x: 72, y: y - 52 }]),
        polygon('front', [{ x: -286, y: top }, { x: -58, y: top }, { x: -58, y }, { x: -286, y }]),
        polygon('front', [{ x: 38, y: top }, { x: 272, y: top }, { x: 272, y }, { x: 38, y }]),
        polygon('side', [{ x: 272, y: top }, { x: 318, y: top - 25 }, { x: 318, y: y - 25 }, { x: 272, y }]),
      ],
      details: [
        ...windowGrid(-276, -68, top + 5, y - 3, 25, 14, 9),
        ...windowGrid(48, 262, top + 5, y - 3, 25, 14, 9),
        ...windowGrid(-66, 62, top - 47, y - 55, 25, 12, 8),
      ],
    }
  })
  return {
    type: 'campus',
    structureBounds: { x: -320, y: topY - 130, width: 670, height: baseY - topY + 168 },
    viewBox: { x: -430, y: -270, width: 1280, height: 650 },
    previewX: 360,
    floors,
    shell: [
      polygon('top', [{ x: -286, y: topY }, { x: -58, y: topY }, { x: -12, y: topY - 25 }, { x: -240, y: topY - 25 }]),
      polygon('top', [{ x: 38, y: topY }, { x: 272, y: topY }, { x: 318, y: topY - 25 }, { x: 84, y: topY - 25 }]),
      polygon('top', [{ x: -76, y: topY - 52 }, { x: 72, y: topY - 52 }, { x: 118, y: topY - 77 }, { x: -30, y: topY - 77 }]),
      polygon('glass', [{ x: -62, y: topY + 20 }, { x: 42, y: topY + 20 }, { x: 88, y: topY - 5 }, { x: -16, y: topY - 5 }]),
      polygon('top', [{ x: -300, y: baseY + 7 }, { x: 286, y: baseY + 7 }, { x: 322, y: baseY - 12 }, { x: -264, y: baseY - 12 }]),
    ],
    details: [
      detail(4, topY - 77, 4, topY - 112, 'seam'),
      detail(-32, topY - 112, 40, topY - 112, 'seam'),
      detail(-46, topY + 7, 56, topY - 18, 'balcony'),
    ],
  }
}

function shipGeometry(count: number): StructureGeometry {
  const topY = -12
  const baseY = 166
  const height = (baseY - topY) / count
  const edgeAt = (y: number) => {
    if (y <= 45) {
      const progress = (y - topY) / (45 - topY)
      return { left: -340 - progress * 25, right: 270 + progress * 90 }
    }
    if (y <= 100) {
      const progress = (y - 45) / 55
      return { left: -365 - progress * 5, right: 360 + progress * 95 }
    }
    const progress = (y - 100) / (baseY - 100)
    return { left: -370 + progress * 20, right: 455 - progress * 135 }
  }
  const floors = Array.from({ length: count }, (_, index): StructureFloorSlot => {
    const y = baseY - index * height
    const top = y - height
    const upper = edgeAt(top)
    const lower = edgeAt(y)
    const centerY = top + height / 2
    const windows = windowGrid(Math.max(upper.left, lower.left), Math.min(upper.right, lower.right), top + 4, y - 2, centerY > 105 ? 25 : 21, centerY > 105 ? 9 : 15, centerY > 105 ? 11 : 8)
    return {
      index,
      centerY,
      polygons: [polygon(centerY > 100 ? 'hull' : 'front', [{ x: upper.left, y: top }, { x: upper.right, y: top }, { x: lower.right, y }, { x: lower.left, y }])],
      details: [...windows, detail(upper.left + 18, y - 5, lower.right - 18, y - 5, 'balcony')],
    }
  })
  return {
    type: 'cruise-ship',
    structureBounds: { x: -420, y: -146, width: 890, height: 342 },
    viewBox: { x: -510, y: -220, width: 1510, height: 620 },
    previewX: 480,
    floors,
    shell: [
      polygon('top', [{ x: -310, y: topY }, { x: 300, y: topY }, { x: 275, y: topY - 12 }, { x: -286, y: topY - 12 }]),
      polygon('front', [{ x: -258, y: topY - 12 }, { x: 246, y: topY - 12 }, { x: 220, y: topY - 39 }, { x: -232, y: topY - 39 }]),
      polygon('glass', [{ x: 62, y: topY - 39 }, { x: 258, y: topY - 39 }, { x: 222, y: topY - 66 }, { x: 82, y: topY - 66 }]),
      polygon('front', [{ x: -218, y: topY - 39 }, { x: 20, y: topY - 39 }, { x: 2, y: topY - 65 }, { x: -190, y: topY - 65 }]),
      polygon('side', [{ x: -112, y: topY - 65 }, { x: -46, y: topY - 65 }, { x: -56, y: topY - 99 }, { x: -101, y: topY - 99 }]),
      polygon('front', [{ x: -362, y: 54 }, { x: -324, y: 54 }, { x: -318, y: 75 }, { x: -370, y: 75 }]),
      polygon('front', [{ x: 338, y: 48 }, { x: 392, y: 48 }, { x: 382, y: 72 }, { x: 330, y: 72 }]),
    ],
    details: [
      detail(168, topY - 66, 168, topY - 112, 'seam'),
      detail(136, topY - 112, 205, topY - 112, 'seam'),
      detail(-360, 84, 405, 84, 'balcony'),
      detail(-380, 105, 410, 105, 'seam'),
      detail(-318, 166, 332, 166, 'balcony'),
    ],
  }
}

export function structureGeometry(type: StructureType, floorCount: number): StructureGeometry {
  const count = Math.max(1, floorCount)
  if (type === 'campus') return campusGeometry(count)
  if (type === 'cruise-ship') return shipGeometry(count)
  return towerGeometry(count)
}
