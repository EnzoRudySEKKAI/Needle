import type { StructureType } from '../../domain/types'
import type { ScreenPoint } from './iso'

export type StructureStrokeWeight = 'primary' | 'secondary' | 'detail'

export type StructureStroke = {
  d: string
  weight: StructureStrokeWeight
}

export type StructureLayerOwner = { kind: 'shell' } | { kind: 'floor'; index: number }

export type StructurePaintLayer = {
  key: string
  owner: StructureLayerOwner
  faces: string[]
  strokes: StructureStroke[]
}

export type StructureFloorSlot = {
  index: number
  centerY: number
  hitAreas: string[]
}

export type StructureGeometry = {
  type: StructureType
  structureBounds: { x: number; y: number; width: number; height: number }
  viewBox: { x: number; y: number; width: number; height: number }
  previewX: number
  floors: StructureFloorSlot[]
  layers: StructurePaintLayer[]
}

type PlanRect = { x: number; y: number; w: number; d: number }
type Project = (x: number, y: number, elevation: number) => ScreenPoint

const shellOwner: StructureLayerOwner = { kind: 'shell' }
const floorOwner = (index: number): StructureLayerOwner => ({ kind: 'floor', index })
const path = (d: string, weight: StructureStrokeWeight = 'secondary'): StructureStroke => ({ d, weight })
const layer = (key: string, owner: StructureLayerOwner, faces: string[], strokes: StructureStroke[]): StructurePaintLayer => ({ key, owner, faces, strokes })
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

function sameRect(a: PlanRect, b: PlanRect): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.d === b.d
}

function contour(rect: PlanRect, elevation: number, project: Project): ScreenPoint[] {
  return [
    project(rect.x, rect.y, elevation),
    project(rect.x + rect.w, rect.y, elevation),
    project(rect.x + rect.w, rect.y + rect.d, elevation),
    project(rect.x, rect.y + rect.d, elevation),
  ]
}

function rectFaces(bottom: readonly ScreenPoint[], top: readonly ScreenPoint[]): string[] {
  return [
    closed(top),
    closed([top[1]!, top[2]!, bottom[2]!, bottom[1]!]),
    closed([top[2]!, top[3]!, bottom[3]!, bottom[2]!]),
  ]
}

function rectVolume(rect: PlanRect, bottomElevation: number, topElevation: number, project: Project, weight: StructureStrokeWeight = 'secondary'): { faces: string[]; strokes: StructureStroke[] } {
  const bottom = contour(rect, bottomElevation, project)
  const top = contour(rect, topElevation, project)
  return {
    faces: rectFaces(bottom, top),
    strokes: [
      path(closed(top), weight),
      path(`${move(top[1]!)} ${line(bottom[1]!)} ${line(bottom[2]!)} ${line(bottom[3]!)} ${line(top[3]!)}`, weight),
      path(`${move(top[2]!)} ${line(bottom[2]!)}`, 'detail'),
    ],
  }
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
      result.push(path(`${move(interpolate(top[startIndex]!, top[endIndex]!, ratio))} ${line(interpolate(bottom[startIndex]!, bottom[endIndex]!, ratio))}`, 'detail'))
    }

    const rows = Math.max(1, Math.round((topElevation - bottomElevation) / 26))
    for (let row = 1; row <= rows; row += 1) {
      const ratio = row / (rows + 1)
      result.push(path(`${move(interpolate(bottom[startIndex]!, top[startIndex]!, ratio))} ${line(interpolate(bottom[endIndex]!, top[endIndex]!, ratio))}`, 'detail'))
    }
  }
  return result
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
  const floors: StructureFloorSlot[] = []
  const layers: StructurePaintLayer[] = [layer('tower-site', shellOwner, [], [
    path(open([towerProject(-174, -112, 0), towerProject(174, -112, 0), towerProject(174, 112, 0), towerProject(-174, 112, 0), towerProject(-174, -112, 0)]), 'secondary'),
    path(open([towerProject(-124, 104, 1), towerProject(-70, 104, 1), towerProject(-70, 114, 1), towerProject(-124, 114, 1)]), 'detail'),
    path(open([towerProject(70, 104, 1), towerProject(124, 104, 1), towerProject(124, 114, 1), towerProject(70, 114, 1)]), 'detail'),
  ])]

  for (let index = 0; index < count; index += 1) {
    const rect = towerPlan(index, count)
    const nextRect = index + 1 < count ? towerPlan(index + 1, count) : null
    const bottomElevation = index * floorHeight
    const topElevation = (index + 1) * floorHeight
    const bottom = contour(rect, bottomElevation, towerProject)
    const top = contour(rect, topElevation, towerProject)
    const faces = rectFaces(bottom, top)
    const visiblePoints = [top[1]!, top[2]!, top[3]!, bottom[3]!, bottom[2]!, bottom[1]!]
    const topOutline = !nextRect || !sameRect(rect, nextRect) ? closed(top) : open([top[1]!, top[2]!, top[3]!])

    floors.push({
      index,
      centerY: (Math.min(...visiblePoints.map((point) => point.y)) + Math.max(...visiblePoints.map((point) => point.y))) / 2,
      hitAreas: faces,
    })
    layers.push(layer(`tower-floor-${index}`, floorOwner(index), faces, [
      path(topOutline, 'primary'),
      path(`${move(top[1]!)} ${line(bottom[1]!)} ${line(bottom[2]!)} ${line(bottom[3]!)} ${line(top[3]!)}`, 'secondary'),
      path(`${move(top[2]!)} ${line(bottom[2]!)}`, 'primary'),
      ...facadeGrid(rect, bottomElevation, topElevation, towerProject, 24),
    ]))
  }

  const crownRect = { x: -34, y: -30, w: 68, d: 60 }
  const crown = rectVolume(crownRect, totalHeight, totalHeight + 24, towerProject)
  const crownTop = contour(crownRect, totalHeight + 24, towerProject)
  const mastBase = towerProject(0, 0, totalHeight + 24)
  layers.push(layer('tower-crown', shellOwner, crown.faces, [
    ...crown.strokes,
    path(`${move(interpolate(crownTop[0]!, crownTop[1]!, .2))} ${line(interpolate(crownTop[3]!, crownTop[2]!, .2))}`, 'detail'),
    path(`${move(interpolate(crownTop[0]!, crownTop[1]!, .8))} ${line(interpolate(crownTop[3]!, crownTop[2]!, .8))}`, 'detail'),
  ]))
  layers.push(layer('tower-mast', shellOwner, [], [
    path(`M ${number(mastBase.x)} ${number(mastBase.y)} V ${number(mastBase.y - 58)}`, 'primary'),
    path(`M ${number(mastBase.x - 18)} ${number(mastBase.y - 38)} H ${number(mastBase.x + 18)} M ${number(mastBase.x - 11)} ${number(mastBase.y - 49)} H ${number(mastBase.x + 11)}`, 'detail'),
  ]))

  return {
    type: 'tower',
    structureBounds: { x: -225, y: -416, width: 460, height: 540 },
    viewBox: { x: -440, y: -440, width: 1280, height: 760 },
    previewX: 290,
    floors,
    layers,
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
  const courtyard = { x: -72, y: -22, w: 144, d: 190 }
  const courtOuter = contour(courtyard, 1, campusProject)
  const courtInner = contour({ x: -56, y: -4, w: 112, d: 150 }, 1, campusProject)
  const floors: StructureFloorSlot[] = Array.from({ length: count }, (_, index) => ({
    index,
    centerY: campusProject(0, 20, (index + .5) * floorHeight).y,
    hitAreas: [],
  }))
  const layers: StructurePaintLayer[] = [layer('campus-site', shellOwner, [], [
    path(closed(contour({ x: -198, y: -136, w: 396, d: 340 }, 0, campusProject)), 'secondary'),
    path(closed(courtOuter), 'secondary'),
    path(closed(courtInner), 'detail'),
    path(`${move(interpolate(courtOuter[0]!, courtOuter[1]!, .5))} ${line(interpolate(courtInner[0]!, courtInner[1]!, .5))}`, 'detail'),
    path(`${move(interpolate(courtOuter[2]!, courtOuter[3]!, .5))} ${line(interpolate(courtInner[2]!, courtInner[3]!, .5))}`, 'detail'),
    path(`M -38 59 c -9 -8 -9 -18 0 -26 c 9 8 9 18 0 26 Z M 38 85 c -9 -8 -9 -18 0 -26 c 9 8 9 18 0 26 Z`, 'detail'),
  ])]
  const atoms: Array<{ depth: number; paint: StructurePaintLayer }> = []

  for (let index = 0; index < count; index += 1) {
    const bottomElevation = index * floorHeight
    const topElevation = (index + 1) * floorHeight
    wings.forEach((wing, wingIndex) => {
      const bottom = contour(wing, bottomElevation, campusProject)
      const top = contour(wing, topElevation, campusProject)
      const faces = rectFaces(bottom, top)
      floors[index]!.hitAreas.push(...faces)
      atoms.push({
        depth: wing.x + wing.w / 2 + wing.y + wing.d / 2 + .68 * (bottomElevation + topElevation) / 2,
        paint: layer(`campus-floor-${index}-wing-${wingIndex}`, floorOwner(index), faces, [
          path(index === count - 1 ? closed(top) : open([top[1]!, top[2]!, top[3]!]), 'primary'),
          path(`${move(top[1]!)} ${line(bottom[1]!)} ${line(bottom[2]!)} ${line(bottom[3]!)} ${line(top[3]!)}`, 'secondary'),
          path(`${move(top[2]!)} ${line(bottom[2]!)}`, 'primary'),
          ...facadeGrid(wing, bottomElevation, topElevation, campusProject, 30),
        ]),
      })
    })
  }

  const bridgeRect = { x: -80, y: 76, w: 160, d: 30 }
  const bridgeBottom = totalHeight * .53
  const bridgeTop = totalHeight * .69
  const bridge = rectVolume(bridgeRect, bridgeBottom, bridgeTop, campusProject)
  atoms.push({
    depth: bridgeRect.x + bridgeRect.w / 2 + bridgeRect.y + bridgeRect.d / 2 + .68 * (bridgeBottom + bridgeTop) / 2,
    paint: layer('campus-bridge', shellOwner, bridge.faces, bridge.strokes),
  })
  layers.push(...atoms.sort((a, b) => a.depth - b.depth).map((atom) => atom.paint))

  const skylights: PlanRect[] = [
    { x: -124, y: -89, w: 76, d: 28 },
    { x: 48, y: -89, w: 76, d: 28 },
    { x: -145, y: 38, w: 38, d: 74 },
    { x: 107, y: 38, w: 38, d: 74 },
  ]
  skylights
    .map((rect, index) => ({ rect, index, depth: rect.x + rect.w / 2 + rect.y + rect.d / 2 }))
    .sort((a, b) => a.depth - b.depth)
    .forEach(({ rect, index }) => {
      const skylight = rectVolume(rect, totalHeight, totalHeight + 10, campusProject)
      layers.push(layer(`campus-skylight-${index}`, shellOwner, skylight.faces, skylight.strokes))
    })
  return {
    type: 'campus',
    structureBounds: { x: -330, y: -250, width: 660, height: 420 },
    viewBox: { x: -470, y: -300, width: 1360, height: 660 },
    previewX: 385,
    floors,
    layers,
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

function shipFaces(bottom: readonly ScreenPoint[], top: readonly ScreenPoint[]): string[] {
  return [
    closed(top),
    closed([top[2]!, top[3]!, bottom[3]!, bottom[2]!]),
    closed([top[3]!, top[4]!, bottom[4]!, bottom[3]!]),
    closed([top[4]!, top[5]!, bottom[5]!, bottom[4]!]),
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
  const mainPlan = shipPlan(0, count)
  const hullTop = shipContour(mainPlan, 0)
  const keel = [
    shipProject(mainPlan.bow + 39, 0, -49),
    shipProject(mainPlan.bow - 30, mainPlan.width * .58, -49),
    shipProject(mainPlan.stern + 28, mainPlan.width * .58, -40),
    shipProject(mainPlan.stern - 16, 0, -24),
  ]
  const portholes = Array.from({ length: 17 }, (_, index) => {
    const point = shipProject(-225 + index * 31, mainPlan.width, 15)
    return path(`M ${number(point.x - 2.5)} ${number(point.y)} a 2.5 2.5 0 1 0 5 0 a 2.5 2.5 0 1 0 -5 0`, 'detail')
  })
  const layers: StructurePaintLayer[] = [layer('ship-hull', shellOwner, [
    closed([hullTop[2]!, keel[0]!, keel[1]!, hullTop[3]!]),
    closed([hullTop[3]!, keel[1]!, keel[2]!, hullTop[4]!]),
    closed([hullTop[4]!, keel[2]!, keel[3]!, hullTop[5]!]),
  ], [
    path(`${move(hullTop[2]!)} ${line(keel[0]!)} ${line(keel[1]!)} ${line(keel[2]!)} ${line(keel[3]!)} ${line(hullTop[5]!)}`, 'primary'),
    path(`${move(shipProject(mainPlan.bow + 23, mainPlan.width * .32, -15))} l 18 -2 l -10 15 Z`, 'secondary'),
  ])]
  const floors: StructureFloorSlot[] = []
  const lifeboatElevation = totalHeight * .39
  const lifeboatFloor = Math.min(count - 1, Math.max(0, Math.ceil(lifeboatElevation / floorHeight) - 1))

  for (let index = 0; index < count; index += 1) {
    const plan = shipPlan(index, count)
    const bottomElevation = index * floorHeight
    const topElevation = (index + 1) * floorHeight
    const bottom = shipContour(plan, bottomElevation)
    const top = shipContour(plan, topElevation)
    const faces = shipFaces(bottom, top)
    const strokes = [
      path(closed(top), 'primary'),
      path(`${move(top[2]!)} ${line(bottom[2]!)} ${line(bottom[3]!)} ${line(bottom[4]!)} ${line(bottom[5]!)} ${line(top[5]!)}`, 'secondary'),
      path(`${move(top[3]!)} ${line(bottom[3]!)}`, 'primary'),
      path(`${move(top[4]!)} ${line(bottom[4]!)}`, 'secondary'),
      ...shipFacadeGrid(plan, bottomElevation, topElevation),
      ...(index === 0 ? portholes : []),
    ]
    floors.push({ index, centerY: (top[3]!.y + bottom[4]!.y) / 2, hitAreas: faces })
    layers.push(layer(`ship-floor-${index}`, floorOwner(index), faces, strokes))

    if (index === lifeboatFloor) {
      const boats = Array.from({ length: 7 }, (_, boatIndex) => contour({ x: -184 + boatIndex * 62, y: 54, w: 42, d: 10 }, lifeboatElevation, shipProject))
      layers.push(layer('ship-lifeboats', shellOwner, boats.map(closed), boats.map((boat) => path(closed(boat), 'secondary'))))
    }
  }

  const roofPlan = shipPlan(count - 1, count)
  const railPosts = Array.from({ length: 16 }, (_, index) => {
    const point = shipProject(-210 + index * 29, roofPlan.width, totalHeight + 2)
    return path(`M ${number(point.x)} ${number(point.y)} v -11`, 'detail')
  })
  layers.push(layer('ship-rails', shellOwner, [], [
    ...railPosts,
    path(open([shipProject(-220, roofPlan.width, totalHeight + 13), shipProject(226, roofPlan.width, totalHeight + 13)]), 'detail'),
  ]))

  const mast = shipProject(154, 0, totalHeight)
  layers.push(layer('ship-mast', shellOwner, [], [
    path(`M ${number(mast.x)} ${number(mast.y)} v -57`, 'primary'),
    path(`M ${number(mast.x - 18)} ${number(mast.y - 38)} h 36 M ${number(mast.x - 11)} ${number(mast.y - 48)} h 22`, 'detail'),
  ]))

  return {
    type: 'cruise-ship',
    structureBounds: { x: -370, y: -265, width: 760, height: 390 },
    viewBox: { x: -500, y: -330, width: 1500, height: 700 },
    previewX: 455,
    floors,
    layers,
  }
}


const expoParkProject: Project = (x, y, elevation) => ({ x: (x - y) * .82, y: (x + y) * .34 - elevation })

function expoParkGeometry(count: number): StructureGeometry {
  const hangarW = 78
  const hangarD = 52
  const gapX = 32
  const gapY = 32
  const alley = 26
  const hallHeight = 26
  const roofHeight = 7
  const cols = Math.ceil(Math.sqrt(count))
  const rows = Math.ceil(count / cols)
  const totalW = cols * hangarW + (cols - 1) * gapX
  const totalD = rows * hangarD + (rows - 1) * gapY + (rows > 1 ? alley : 0)
  const leftOffset = 26
  const x0 = -totalW / 2 - leftOffset
  const y0 = -totalD / 2
  const hangars: PlanRect[] = []
  for (let index = 0; index < count; index += 1) {
    const col = index % cols
    const row = Math.floor(index / cols)
    const x = x0 + col * (hangarW + gapX)
    const y = y0 + row * (hangarD + gapY) + (row > 0 && rows > 1 ? alley : 0)
    hangars.push({ x, y, w: hangarW, d: hangarD })
  }
  const siteMargin = 42
  const siteRect = { x: x0 - siteMargin, y: y0 - siteMargin, w: totalW + siteMargin * 2, d: totalD + siteMargin * 2 }
  const floors: StructureFloorSlot[] = []
  const layers: StructurePaintLayer[] = [layer('expo-site', shellOwner, [], [
    path(closed(contour(siteRect, 0, expoParkProject)), 'secondary'),
    ...(rows > 1 ? [path(open([expoParkProject(siteRect.x + 14, siteRect.y + totalD / 2 + siteMargin / 2, 0.5), expoParkProject(siteRect.x + siteRect.w - 14, siteRect.y + totalD / 2 + siteMargin / 2, 0.5)]), 'detail')] : []),
  ])]

  hangars.forEach((rect, index) => {
    const bottom = contour(rect, 0, expoParkProject)
    const top = contour(rect, hallHeight, expoParkProject)
    const roofBase = { x: rect.x + 8, y: rect.y + 8, w: rect.w - 16, d: rect.d - 16 }
    const roofRidge = { x: rect.x + rect.w / 2 - 2, y: rect.y + 8, w: 4, d: rect.d - 16 }
    const roofBottom = contour(roofBase, hallHeight, expoParkProject)
    const roofTop = contour(roofRidge, hallHeight + roofHeight, expoParkProject)
    const doorW = 24
    const doorH = 13
    const doorX = rect.x + rect.w / 2 - doorW / 2
    const doorY = rect.y + rect.d - 3
    const doorRect = { x: doorX, y: doorY, w: doorW, d: 5 }
    const faces = rectFaces(bottom, top)
    const centerY = (Math.min(...top.map((p) => p.y)) + Math.max(...bottom.map((p) => p.y))) / 2
    floors.push({ index, centerY, hitAreas: faces })
    const doorBottom = contour(doorRect, 0, expoParkProject)
    const doorTop = contour(doorRect, doorH, expoParkProject)
    const doorFaces = rectFaces(doorBottom, doorTop)
    layers.push(layer(`expo-hangar-${index}`, floorOwner(index), [...faces, closed(roofBottom), ...doorFaces], [
      path(closed(top), 'primary'),
      path(`${move(top[1]!)} ${line(bottom[1]!)} ${line(bottom[2]!)} ${line(bottom[3]!)} ${line(top[3]!)}`, 'secondary'),
      path(`${move(top[2]!)} ${line(bottom[2]!)}`, 'primary'),
      path(closed(roofBottom), 'secondary'),
      path(closed(roofTop), 'primary'),
      path(`${move(roofTop[1]!)} ${line(roofBottom[1]!)}`, 'detail'),
      path(`${move(roofTop[2]!)} ${line(roofBottom[2]!)}`, 'detail'),
      ...facadeGrid(rect, 0, hallHeight, expoParkProject, 28),
      path(closed(doorTop), 'secondary'),
    ]))
  })

  // Accurate bounds from all projected points
  const allPoints: ScreenPoint[] = []
  for (const r of [siteRect, ...hangars]) {
    for (const elev of [0, hallHeight + roofHeight]) allPoints.push(...contour(r, elev, expoParkProject))
  }
  const minPx = Math.min(...allPoints.map((p) => p.x))
  const maxPx = Math.max(...allPoints.map((p) => p.x))
  const minPy = Math.min(...allPoints.map((p) => p.y))
  const maxPy = Math.max(...allPoints.map((p) => p.y))
  const pad = 36
  const dezoomView = Math.max(1, Math.sqrt(count) / 1.85)
  const bounds = { x: minPx - pad * dezoomView, y: minPy - pad * dezoomView, width: (maxPx - minPx + pad * 2) * dezoomView, height: (maxPy - minPy + pad * 2) * dezoomView }
  return {
    type: 'expo-park',
    structureBounds: bounds,
    viewBox: { x: bounds.x - 24 * dezoomView, y: bounds.y - 24 * dezoomView, width: bounds.width + 48 * dezoomView, height: bounds.height + 48 * dezoomView },
    previewX: bounds.x + bounds.width * 0.62,
    floors,
    layers,
  }
}

export function structureGeometry(type: StructureType, floorCount: number): StructureGeometry {
  const count = Math.max(1, floorCount)
  if (type === 'campus') return campusGeometry(count)
  if (type === 'cruise-ship') return shipGeometry(count)
  if (type === 'expo-park') return expoParkGeometry(count)
  return towerGeometry(count)
}
