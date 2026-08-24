import { useEffect, useRef } from 'react'
import type { Archetype, Footprint, GridPoint } from '../domain/types'
import { useI18n } from '../i18n/useI18n'
import { buildingFaces, chipAnchor } from '../map/core/archetypes'
import { depthKey, gridRouteToScreen, pointAtLength, pointsAttribute, polylineLengths } from '../map/core/iso'

type HeroBuilding = {
  id: string
  code: string
  nameKey: 'home.hero.building.noise' | 'home.hero.building.filter' | 'home.hero.building.pattern' | 'home.hero.building.finding'
  archetype: Archetype
  footprint: Footprint
  height: number
  properties: number
  finding?: boolean
}

const BUILDINGS = ([
  { id: 'noise', code: 'NS', nameKey: 'home.hero.building.noise', archetype: 'fin-row', footprint: { gx: 0.6, gy: 7.4, w: 2.6, d: 1.8 }, height: 1.05, properties: 4 },
  { id: 'filter', code: 'FL', nameKey: 'home.hero.building.filter', archetype: 'tower', footprint: { gx: 5.6, gy: 6.6, w: 1.7, d: 1.7 }, height: 2.8, properties: 3 },
  { id: 'pattern', code: 'PT', nameKey: 'home.hero.building.pattern', archetype: 'slab-stack', footprint: { gx: 10.2, gy: 3.9, w: 2.35, d: 2 }, height: 2.4, properties: 3 },
  { id: 'finding', code: 'FN', nameKey: 'home.hero.building.finding', archetype: 'stepped-pyramid', footprint: { gx: 15.1, gy: 2.1, w: 2.1, d: 2.1 }, height: 2.2, properties: 3, finding: true },
] satisfies HeroBuilding[]).sort((a, b) => depthKey(a.footprint) - depthKey(b.footprint))

const ROUTES: GridPoint[][] = [
  [{ gx: 3.2, gy: 8.3 }, { gx: 4.1, gy: 8.3 }, { gx: 4.1, gy: 7.45 }, { gx: 5.6, gy: 7.45 }],
  [{ gx: 7.3, gy: 7.45 }, { gx: 8.6, gy: 7.45 }, { gx: 8.6, gy: 4.9 }, { gx: 10.2, gy: 4.9 }],
  [{ gx: 12.55, gy: 4.9 }, { gx: 13.65, gy: 4.9 }, { gx: 13.65, gy: 3.15 }, { gx: 15.1, gy: 3.15 }],
]
const ROUTE_POINTS = ROUTES.map(gridRouteToScreen)
const ROUTE_METRICS = ROUTE_POINTS.map(polylineLengths)

function BuildingGlyph({ building }: { building: HeroBuilding }) {
  const { t } = useI18n()
  const faces = buildingFaces(building.archetype, building.footprint, building.height, building.properties)
  const chip = chipAnchor(building.footprint, building.height)
  const label = `${building.code} · ${t(building.nameKey)}`
  const half = Math.max(18, label.length * 3.2 + 8)
  return <g className={`hero-map-building hero-building-${building.id} ${building.finding ? 'is-finding' : ''}`}>
    {faces.map((face, index) => <polygon key={index} points={pointsAttribute(face.points)} className={`building-face face-${face.shade}`} vectorEffect="non-scaling-stroke" />)}
    <g className="roof-chip" transform={`translate(${chip.x} ${chip.y - 12})`}>
      <rect x={-half} y={-9} width={half * 2} height="18" rx="3" vectorEffect="non-scaling-stroke" />
      <text textAnchor="middle" dominantBaseline="central">{label}</text>
    </g>
  </g>
}

export function HeroMiniMap() {
  const { t } = useI18n()
  const exampleRef = useRef<HTMLDivElement | null>(null)
  const payloadRef = useRef<SVGGElement | null>(null)

  useEffect(() => {
    const example = exampleRef.current
    const payload = payloadRef.current
    if (!example || !payload) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let startedAt = performance.now()
    let renderedStage = -1
    let payloadVisible = false
    const renderRestingPayload = () => {
      const points = ROUTE_POINTS[ROUTE_POINTS.length - 1]!
      const point = points[points.length - 1]!
      example.dataset.stage = '3'
      payload.setAttribute('transform', `translate(${point.x} ${point.y})`)
      payload.style.opacity = '1'
    }
    const tick = (now: number) => {
      const elapsed = ((now - startedAt) % 7500 + 7500) % 7500
      const stageIndex = Math.floor(elapsed / 2500)
      if (stageIndex !== renderedStage) {
        renderedStage = stageIndex
        example.dataset.stage = String(stageIndex + 1)
      }
      const stageTime = elapsed % 2500
      const progress = Math.min(stageTime / 1900, 1)
      const points = ROUTE_POINTS[stageIndex]!
      const metrics = ROUTE_METRICS[stageIndex]!
      const point = pointAtLength(points, metrics.cumulative, metrics.total * progress)
      payload.setAttribute('transform', `translate(${point.x} ${point.y})`)
      const visible = stageTime < 2100
      if (visible !== payloadVisible) {
        payloadVisible = visible
        payload.style.opacity = visible ? '1' : '0'
      }
      frame = requestAnimationFrame(tick)
    }
    const start = () => {
      cancelAnimationFrame(frame)
      if (reducedMotion.matches) { renderRestingPayload(); return }
      startedAt = performance.now()
      renderedStage = -1
      payloadVisible = false
      frame = requestAnimationFrame(tick)
    }
    start()
    reducedMotion.addEventListener('change', start)
    return () => { cancelAnimationFrame(frame); reducedMotion.removeEventListener('change', start) }
  }, [])

  return <div ref={exampleRef} className="hero-example" data-stage="1">
    <svg className="hero-mini-map" viewBox="-250 35 680 290" role="img" aria-label={t('home.hero.mapAria')}>
      <desc>{t('home.hero.mapDescription')}</desc>
      <defs><filter id="hero-finding-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="7" /></filter></defs>
      <ellipse className="hero-finding-halo" cx="320" cy="225" rx="58" ry="25" filter="url(#hero-finding-glow)" />
      <g className="hero-routes">
        {ROUTE_POINTS.map((points, index) => {
          const end = points[points.length - 1]!
          const before = points[points.length - 2] ?? end
          const angle = Math.atan2(end.y - before.y, end.x - before.x) * 180 / Math.PI
          return <g key={index} className={`hero-route hero-route-${index + 1}`}><polyline points={pointsAttribute(points)} className="flow-trace" vectorEffect="non-scaling-stroke" /><path d="M 0 0 L -7 3.5 L -7 -3.5 Z" transform={`translate(${end.x} ${end.y}) rotate(${angle})`} className="flow-arrow" vectorEffect="non-scaling-stroke" /></g>
        })}
      </g>
      <g ref={payloadRef} className="hero-payload" aria-hidden="true"><circle className="payload-halo" r="10" /><circle className="payload-dot" r="4.5" /></g>
      {BUILDINGS.map((building) => <BuildingGlyph key={building.id} building={building} />)}
      <g className="hero-step-markers">
        {ROUTE_POINTS.map((points, index) => {
          const metrics = ROUTE_METRICS[index]!
          const marker = pointAtLength(points, metrics.cumulative, metrics.total / 2)
          return <g key={index} className={`hero-step-marker hero-route hero-route-${index + 1}`} transform={`translate(${marker.x} ${marker.y - 13})`}><circle className="step-disc" r="9" vectorEffect="non-scaling-stroke" /><text className="step-number" textAnchor="middle" dominantBaseline="central">{String(index + 1).padStart(2, '0')}</text></g>
        })}
      </g>
    </svg>
    <div className="hero-note">{t('home.hero.note')}</div>
  </div>
}
