import type { StructureType } from '../../domain/types'
import type { ScreenPoint } from './iso'

export type StructureStrokeWeight = 'primary' | 'secondary' | 'detail'

export type StructureStroke = {
  d: string
  weight: StructureStrokeWeight
}

export type StructureFloorSlot = {
  index: number
  centerY: number
  paths: StructureStroke[]
  hitArea: string
}

export type StructureGeometry = {
  type: StructureType
  structureBounds: { x: number; y: number; width: number; height: number }
  viewBox: { x: number; y: number; width: number; height: number }
  previewX: number
  floors: StructureFloorSlot[]
  shell: StructureStroke[]
}

type PlanRect = { x: number; y: number; w: number; d: number }
type Project = (x: number, y: number, elevation: number) => ScreenPoint

const path = (d: string, weight: StructureStrokeWeight = 'secondary'): StructureStroke => ({ d, weight })
const number = (value: number) => value.toFixed(2)
const move = (point: ScreenPoint) => `M ${number(point.x)} ${number(point.y)}`
const line = (point: ScreenPoint) => `L ${number(point.x)} ${number(point.y)}`

function closed(points: readonly ScreenPoint[]): string {
  return `${points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${number(point.x)} ${number(point.y)}`).join(' ')} Z`
}

function open(points: readonly ScreenPoint[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${number(point.x)} ${number(point.y)}`).join(' ')
}

function interpolate(a: ScreenPoint, b: ScreenPoint, ratio: number): ScreenPoint {
  return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio }
}

function contour(rect: PlanRect, elevation: number, project: Project): ScreenPoint[] {
  return [
    project(rect.x, rect.y, elevation),
    project(rect.x + rect.w, rect.y, elevation),
    project(rect.x + rect.w, rect.y + rect.d, elevation),
    project(rect.x, rect.y + rect.d, elevation),
  ]
}

function facadeGrid(rect: PlanRect, bottomElevation: number, topElevation: number, project: Project, bayWidth = 28): StructureStroke[] {
  const bottom = contour(rect, bottomElevation, project)
  const top = contour(rect, topElevation, project)
  const result: StructureStroke[] = []
  const visibleEdges: Array<[number, number, number]> = [[1, 2, rect.d], [2, 3, rect.w]]

  for (const [startIndex, endIndex, span] of visibleEdges) {
    const bays = Math.max(2, Math.round(span / bayWidth))
    for (let bay = 1; bay < bays; bay += 1) {
      const ratio = bay / bays
      const topPoint = interpolate(top[startIndex]!, top[endIndex]!, ratio)
      const bottomPoint = interpolate(bottom[startIndex]!, bottom[endIndex]!, ratio)
      result.push(path(`${move(topPoint)} ${line(bottomPoint)}`, 'detail'))
    }

    const rows = Math.max(1, Math.round((topElevation - bottomElevation) / 26))
    for (let row = 1; row <= rows; row += 1) {
      const ratio = row / (rows + 1)
      const a = interpolate(bottom[startIndex]!, top[startIndex]!, ratio)
      const b = interpolate(bottom[endIndex]!, top[endIndex]!, ratio)
      result.push(path(`${move(a)} ${line(b)}`, 'detail'))
    }
  }
  return result
}

function prism(rect: PlanRect, bottomElevation: number, topElevation: number, project: Project): StructureStroke[] {
  const bottom = contour(rect, bottomElevation, project)
  const top = contour(rect, topElevation, project)
  return [
    path(closed(top), 'secondary'),
    path(`${move(top[1]!)} ${line(bottom[1]!)} ${line(bottom[2]!)} ${line(bottom[3]!)} ${line(top[3]!)}`, 'secondary'),
    path(`${move(top[2]!)} ${line(bottom[2]!)}`, 'detail'),
  ]
}

const towerProject: Project = (x, y, elevation) => ({ x: (x - y) * .82, y: (x + y) * .35 - elevation })

function towerPlan(index: number, count: number): PlanRect {
  if (index === 0 && count > 2) return { x: -154, y: -92, w: 308, d: 184 }
  const progress = index / Math.max(1, count - 1)
  if (progress < .64) return { x: -91, y: -63, w: 182, d: 126 }
  if (progress < .88) return { x: -74, y: -54, w: 148, d: 108 }
  return { x: -58, y: -45, w: 116, d: 90 }
}

function towerGeometry(count: number): StructureGeometry {
  const totalHeight = 356
  const floorHeight = totalHeight / count
  const floors = Array.from({ length: count }, (_, index): StructureFloorSlot => {
    const rect = towerPlan(index, count)
    const bottomElevation = index * floorHeight
    const topElevation = (index + 1) * floorHeight
    const bottom = contour(rect, bottomElevation, towerProject)
    const top = contour(rect, topElevation, towerProject)
    const visibleFace = [top[1]!, top[2]!, top[3]!, bottom[3]!, bottom[2]!, bottom[1]!]

    return {
      index,
      centerY: (Math.min(...visibleFace.map((point) => point.y)) + Math.max(...visibleFace.map((point) => point.y))) / 2,
      paths: [
        path(closed(top), 'primary'),
        path(`${move(top[1]!)} ${line(bottom[1]!)} ${line(bottom[2]!)} ${line(bottom[3]!)} ${line(top[3]!)}`, 'secondary'),
        path(`${move(top[2]!)} ${line(bottom[2]!)}`, 'primary'),
        ...facadeGrid(rect, bottomElevation, topElevation, towerProject, 24),
      ],
      hitArea: `${move({ x: Math.min(...visibleFace.map((point) => point.x)) - 10, y: Math.min(...visibleFace.map((point) => point.y)) - 8 })} H ${number(Math.max(...visibleFace.map((point) => point.x)) + 10)} V ${number(Math.max(...visibleFace.map((point) => point.y)) + 8)} H ${number(Math.min(...visibleFace.map((point) => point.x)) - 10)} Z`,
    }
  })

  const roofRect = towerPlan(count - 1, count)
  const roof = contour(roofRect, totalHeight, towerProject)
  const podiumTop = count > 2 ? floorHeight : 0
  const terrace = contour({ x: -154, y: -92, w: 308, d: 184 }, podiumTop, towerProject)
  const crownRect = { x: -34, y: -30, w: 68, d: 60 }
  const crown = prism(crownRect, totalHeight, totalHeight + 24, towerProject)
  const crownTop = contour(crownRect, totalHeight + 24, towerProject)
  const mastBase = towerProject(0, 0, totalHeight + 24)

  return {
    type: 'tower',
    structureBounds: { x: -225, y: -416, width: 460, height: 540 },
    viewBox: { x: -440, y: -440, width: 1280, height: 760 },
    previewX: 290,
    floors,
    shell: [
      path(closed(terrace), 'primary'),
      path(closed(roof), 'primary'),
      ...crown,
      path(`${move(interpolate(crownTop[0]!, crownTop[1]!, .2))} ${line(interpolate(crownTop[3]!, crownTop[2]!, .2))}`, 'detail'),
      path(`${move(interpolate(crownTop[0]!, crownTop[1]!, .8))} ${line(interpolate(crownTop[3]!, crownTop[2]!, .8))}`, 'detail'),
      path(`M ${number(mastBase.x)} ${number(mastBase.y)} V ${number(mastBase.y - 58)}`, 'primary'),
      path(`M ${number(mastBase.x - 18)} ${number(mastBase.y - 38)} H ${number(mastBase.x + 18)} M ${number(mastBase.x - 11)} ${number(mastBase.y - 49)} H ${number(mastBase.x + 11)}`, 'detail'),
      path(open([towerProject(-174, -112, 0), towerProject(174, -112, 0), towerProject(174, 112, 0), towerProject(-174, 112, 0), towerProject(-174, -112, 0)]), 'secondary'),
      path(open([towerProject(-178, 116, 0), towerProject(178, 116, 0)]), 'primary'),
      ...prism({ x: -48, y: 92, w: 96, d: 20 }, 0, 11, towerProject),
      path(open([towerProject(-124, 104, 1), towerProject(-70, 104, 1), towerProject(-70, 114, 1), towerProject(-124, 114, 1)]), 'detail'),
      path(open([towerProject(70, 104, 1), towerProject(124, 104, 1), towerProject(124, 114, 1), towerProject(70, 114, 1)]), 'detail'),
    ],
  }
}

const campusProject: Project = (x, y, elevation) => ({ x: (x - y) * .82, y: (x + y) * .34 - elevation })

function campusGeometry(count: number): StructureGeometry {
  const wings: PlanRect[] = [
    { x: -172, y: -112, w: 344, d: 76 },
    { x: -172, y: -36, w: 92, d: 214 },
    { x: 80, y: -36, w: 92, d: 214 },
  ]
  const totalHeight = 148
  const floorHeight = totalHeight / count
  const floors = Array.from({ length: count }, (_, index): StructureFloorSlot => {
    const bottomElevation = index * floorHeight
    const topElevation = (index + 1) * floorHeight
    const floorPaths = wings.flatMap((wing) => {
      const bottom = contour(wing, bottomElevation, campusProject)
      const top = contour(wing, topElevation, campusProject)
      return [
        path(closed(top), 'primary'),
        path(`${move(top[1]!)} ${line(bottom[1]!)} ${line(bottom[2]!)} ${line(bottom[3]!)} ${line(top[3]!)}`, 'secondary'),
        path(`${move(top[2]!)} ${line(bottom[2]!)}`, 'primary'),
        ...facadeGrid(wing, bottomElevation, topElevation, campusProject, 30),
      ]
    })
    const center = campusProject(0, 20, (bottomElevation + topElevation) / 2)

    return {
      index,
      centerY: center.y,
      paths: floorPaths,
      hitArea: `M -330 ${number(-topElevation - 92)} H 330 V ${number(150 - bottomElevation)} H -330 Z`,
    }
  })

  const courtyard = { x: -72, y: -22, w: 144, d: 190 }
  const courtOuter = contour(courtyard, 1, campusProject)
  const courtInner = contour({ x: -56, y: -4, w: 112, d: 150 }, 1, campusProject)
  const roofPaths = wings.flatMap((wing) => [path(closed(contour(wing, totalHeight, campusProject)), 'primary')])
  const bridgeRect = { x: -80, y: 76, w: 160, d: 30 }
  const skylights: PlanRect[] = [
    { x: -124, y: -89, w: 76, d: 28 },
    { x: 48, y: -89, w: 76, d: 28 },
    { x: -145, y: 38, w: 38, d: 74 },
    { x: 107, y: 38, w: 38, d: 74 },
  ]

  return {
    type: 'campus',
    structureBounds: { x: -330, y: -250, width: 660, height: 420 },
    viewBox: { x: -470, y: -300, width: 1360, height: 660 },
    previewX: 385,
    floors,
    shell: [
      path(closed(contour({ x: -198, y: -136, w: 396, d: 340 }, 0, campusProject)), 'secondary'),
      ...roofPaths,
      path(closed(courtOuter), 'secondary'),
      path(closed(courtInner), 'detail'),
      path(`${move(interpolate(courtOuter[0]!, courtOuter[1]!, .5))} ${line(interpolate(courtInner[0]!, courtInner[1]!, .5))}`, 'detail'),
      path(`${move(interpolate(courtOuter[2]!, courtOuter[3]!, .5))} ${line(interpolate(courtInner[2]!, courtInner[3]!, .5))}`, 'detail'),
      ...prism(bridgeRect, totalHeight * .53, totalHeight * .69, campusProject),
      ...skylights.flatMap((skylight) => prism(skylight, totalHeight, totalHeight + 10, campusProject)),
      ...prism({ x: -60, y: 154, w: 120, d: 28 }, 0, 13, campusProject),
      path(open([campusProject(-184, 193, 0), campusProject(184, 193, 0)]), 'primary'),
      path(`M -38 59 c -9 -8 -9 -18 0 -26 c 9 8 9 18 0 26 Z M 38 85 c -9 -8 -9 -18 0 -26 c 9 8 9 18 0 26 Z`, 'detail'),
    ],
  }
}

type ShipPlan = { stern: number; bow: number; width: number }

const shipProject: Project = (x, y, elevation) => ({ x: (x - y) * .9, y: (x + y) * .22 - elevation })

function shipPlan(index: number, count: number): ShipPlan {
  const progress = index / Math.max(1, count - 1)
  if (index === 0) return { stern: -300, bow: 288, width: 72 }
  return { stern: -272 + progress * 55, bow: 264 - progress * 42, width: 62 - progress * 13 }
}

function shipContour(plan: ShipPlan, elevation: number): ScreenPoint[] {
  return [
    shipProject(plan.stern, -plan.width, elevation),
    shipProject(plan.bow, -plan.width, elevation),
    shipProject(plan.bow + 68, 0, elevation),
    shipProject(plan.bow, plan.width, elevation),
    shipProject(plan.stern, plan.width, elevation),
    shipProject(plan.stern - 26, 0, elevation),
  ]
}

function shipFacadeGrid(plan: ShipPlan, bottomElevation: number, topElevation: number): StructureStroke[] {
  const bottom = shipContour(plan, bottomElevation)
  const top = shipContour(plan, topElevation)
  const result: StructureStroke[] = []
  const bays = Math.max(8, Math.round((plan.bow - plan.stern) / 34))
  for (let bay = 1; bay < bays; bay += 1) {
    const ratio = bay / bays
    result.push(path(`${move(interpolate(top[3]!, top[4]!, ratio))} ${line(interpolate(bottom[3]!, bottom[4]!, ratio))}`, 'detail'))
  }
  const rows = Math.max(1, Math.round((topElevation - bottomElevation) / 25))
  for (let row = 1; row <= rows; row += 1) {
    const ratio = row / (rows + 1)
    result.push(path(`${move(interpolate(bottom[3]!, top[3]!, ratio))} ${line(interpolate(bottom[4]!, top[4]!, ratio))}`, 'detail'))
    result.push(path(`${move(interpolate(bottom[2]!, top[2]!, ratio))} ${line(interpolate(bottom[3]!, top[3]!, ratio))}`, 'detail'))
  }
  return result
}

function shipGeometry(count: number): StructureGeometry {
  const totalHeight = 184
  const floorHeight = totalHeight / count
  const floors = Array.from({ length: count }, (_, index): StructureFloorSlot => {
    const plan = shipPlan(index, count)
    const bottomElevation = index * floorHeight
    const topElevation = (index + 1) * floorHeight
    const bottom = shipContour(plan, bottomElevation)
    const top = shipContour(plan, topElevation)
    const points = [...bottom, ...top]
    const left = Math.min(...points.map((point) => point.x))
    const right = Math.max(...points.map((point) => point.x))
    const topY = Math.min(...points.map((point) => point.y))
    const bottomY = Math.max(...points.map((point) => point.y))

    return {
      index,
      centerY: (topY + bottomY) / 2,
      paths: [
        path(closed(top), 'primary'),
        path(`${move(top[2]!)} ${line(bottom[2]!)} ${line(bottom[3]!)} ${line(bottom[4]!)} ${line(bottom[5]!)} ${line(top[5]!)}`, 'secondary'),
        path(`${move(top[3]!)} ${line(bottom[3]!)}`, 'primary'),
        path(`${move(top[4]!)} ${line(bottom[4]!)}`, 'secondary'),
        ...shipFacadeGrid(plan, bottomElevation, topElevation),
      ],
      hitArea: `M ${number(left - 12)} ${number(topY - 10)} H ${number(right + 12)} V ${number(bottomY + 10)} H ${number(left - 12)} Z`,
    }
  })

  const mainPlan = shipPlan(0, count)
  const hullTop = shipContour(mainPlan, 0)
  const keel = [
    shipProject(mainPlan.bow + 39, 0, -49),
    shipProject(mainPlan.bow - 30, mainPlan.width * .58, -49),
    shipProject(mainPlan.stern + 28, mainPlan.width * .58, -40),
    shipProject(mainPlan.stern - 16, 0, -24),
  ]
  const roofPlan = shipPlan(count - 1, count)
  const roof = shipContour(roofPlan, totalHeight)
  const bridgeRect = { x: 74, y: -44, w: 122, d: 88 }
  const bridgeTop = contour(bridgeRect, totalHeight + 32, shipProject)
  const lifeboats = Array.from({ length: 7 }, (_, index) => {
    const boat = contour({ x: -184 + index * 62, y: 54, w: 42, d: 10 }, totalHeight * .39, shipProject)
    return path(closed(boat), 'secondary')
  })
  const railPosts = Array.from({ length: 16 }, (_, index) => {
    const point = shipProject(-210 + index * 29, roofPlan.width, totalHeight + 2)
    return path(`M ${number(point.x)} ${number(point.y)} v -11`, 'detail')
  })
  const portholes = Array.from({ length: 17 }, (_, index) => {
    const point = shipProject(-225 + index * 31, mainPlan.width, 15)
    return path(`M ${number(point.x - 2.5)} ${number(point.y)} a 2.5 2.5 0 1 0 5 0 a 2.5 2.5 0 1 0 -5 0`, 'detail')
  })
  const mast = shipProject(154, 0, totalHeight + 32)

  return {
    type: 'cruise-ship',
    structureBounds: { x: -370, y: -265, width: 760, height: 390 },
    viewBox: { x: -500, y: -330, width: 1500, height: 700 },
    previewX: 455,
    floors,
    shell: [
      path(`${move(hullTop[2]!)} ${line(keel[0]!)} ${line(keel[1]!)} ${line(keel[2]!)} ${line(keel[3]!)} ${line(hullTop[5]!)}`, 'primary'),
      path(`${move(hullTop[3]!)} ${line(keel[1]!)} ${line(hullTop[4]!)}`, 'secondary'),
      path(closed(roof), 'primary'),
      ...prism({ x: -142, y: -40, w: 98, d: 80 }, totalHeight, totalHeight + 22, shipProject),
      ...prism(bridgeRect, totalHeight, totalHeight + 32, shipProject),
      path(`${move(interpolate(bridgeTop[1]!, bridgeTop[2]!, .18))} ${line(interpolate(bridgeTop[1]!, bridgeTop[2]!, .82))}`, 'detail'),
      path(`${move(interpolate(bridgeTop[2]!, bridgeTop[3]!, .12))} ${line(interpolate(bridgeTop[2]!, bridgeTop[3]!, .88))}`, 'detail'),
      ...prism({ x: -28, y: -23, w: 48, d: 46 }, totalHeight + 22, totalHeight + 69, shipProject),
      path(`M ${number(mast.x)} ${number(mast.y)} v -57`, 'primary'),
      path(`M ${number(mast.x - 18)} ${number(mast.y - 38)} h 36 M ${number(mast.x - 11)} ${number(mast.y - 48)} h 22`, 'detail'),
      ...railPosts,
      path(open([shipProject(-220, roofPlan.width, totalHeight + 13), shipProject(226, roofPlan.width, totalHeight + 13)]), 'detail'),
      ...lifeboats,
      ...portholes,
      path(open([shipProject(-245, mainPlan.width, -17), shipProject(240, mainPlan.width, -17)]), 'detail'),
      path(`${move(shipProject(mainPlan.bow + 23, mainPlan.width * .32, -15))} l 18 -2 l -10 15 Z`, 'secondary'),
    ],
  }
}

export function structureGeometry(type: StructureType, floorCount: number): StructureGeometry {
  const count = Math.max(1, floorCount)
  if (type === 'campus') return campusGeometry(count)
  if (type === 'cruise-ship') return shipGeometry(count)
  return towerGeometry(count)
}
