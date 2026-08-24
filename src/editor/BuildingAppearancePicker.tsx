import type { Archetype, FaceTexture } from '../domain/types'
import { buildingFaces } from '../map/core/archetypes'
import { pointsAttribute } from '../map/core/iso'
import { useI18n } from '../i18n/useI18n'

const FORMS = [
  { value: null, key: 'content.formAutomatic' },
  { value: 'cube', key: 'content.formCube' },
  { value: 'tower', key: 'content.formTower' },
  { value: 'low-slab', key: 'content.formLowSlab' },
  { value: 'slab-stack', key: 'content.formSlabStack' },
  { value: 'fin-row', key: 'content.formFinRow' },
  { value: 'podium-tower', key: 'content.formPodiumTower' },
  { value: 'twin-towers', key: 'content.formTwinTowers' },
  { value: 'courtyard', key: 'content.formCourtyard' },
  { value: 'bridge', key: 'content.formBridge' },
  { value: 'stepped-pyramid', key: 'content.formSteppedPyramid' },
  { value: 'server-rack', key: 'content.formServerRack' },
  { value: 'database', key: 'content.formDatabase' },
  { value: 'monitor', key: 'content.formMonitor' },
  { value: 'camera', key: 'content.formCamera' },
] as const satisfies ReadonlyArray<{ value: Archetype | null; key: string }>

function FormPreview({ archetype }: { archetype: Archetype | null }) {
  const previewHeight = archetype === 'low-slab' ? 0.7 : archetype === 'monitor' ? 1.85 : archetype === 'camera' ? 1.45 : archetype === 'database' ? 1.6 : 3.2
  const faces = buildingFaces(archetype ?? 'cube', { gx: 0, gy: 0, w: 4, d: 3 }, previewHeight, 4)
  const points = faces.flatMap((face) => face.points)
  const minX = Math.min(...points.map((point) => point.x)) - 8
  const minY = Math.min(...points.map((point) => point.y)) - 8
  const maxX = Math.max(...points.map((point) => point.x)) + 8
  const maxY = Math.max(...points.map((point) => point.y)) + 8
  return <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} aria-hidden="true">{faces.map((face, index) => <polygon key={index} points={pointsAttribute(face.points)} className={`building-face face-${face.shade}`} />)}{archetype === null ? <text x="12" y="17">A</text> : null}</svg>
}

export function BuildingAppearancePicker({ archetype, texture, onArchetype, onTexture }: { archetype?: Archetype; texture: FaceTexture; onArchetype: (value: Archetype | undefined) => void; onTexture: (value: FaceTexture) => void }) {
  const { t } = useI18n()
  return <div className="appearance-picker"><fieldset className="form-picker"><legend>{t('content.buildingForm')}</legend><div>{FORMS.map((form) => { const selected = (archetype ?? null) === form.value; const label = t(form.key); return <button type="button" key={form.key} className={selected ? 'is-selected' : ''} aria-pressed={selected} title={label} onClick={() => onArchetype(form.value ?? undefined)}><FormPreview archetype={form.value} /><span>{label}</span></button> })}</div></fieldset><fieldset className="texture-picker"><legend>{t('content.faceTexture')}</legend><div>{(['auto', 'plain', 'hatched'] as const).map((value) => <button type="button" key={value} className={texture === value ? 'is-selected' : ''} aria-pressed={texture === value} onClick={() => onTexture(value)}>{t(value === 'auto' ? 'content.textureAuto' : value === 'plain' ? 'content.texturePlain' : 'content.textureHatched')}</button>)}</div></fieldset></div>
}
