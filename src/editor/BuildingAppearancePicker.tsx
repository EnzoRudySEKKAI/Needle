import type { Archetype, FaceTexture } from '../domain/types'
import { buildingFaces } from '../map/core/archetypes'
import { pointsAttribute } from '../map/core/iso'

const FORMS: { value: Archetype | null; label: string }[] = [
  { value: null, label: 'Automatic' },
  { value: 'cube', label: 'Cube' },
  { value: 'tower', label: 'Tower' },
  { value: 'low-slab', label: 'Low slab' },
  { value: 'slab-stack', label: 'Slab stack' },
  { value: 'fin-row', label: 'Fin row' },
  { value: 'podium-tower', label: 'Podium tower' },
  { value: 'twin-towers', label: 'Twin towers' },
  { value: 'courtyard', label: 'Courtyard' },
  { value: 'bridge', label: 'Bridge' },
  { value: 'stepped-pyramid', label: 'Stepped pyramid' },
  { value: 'server-rack', label: 'Server rack' },
  { value: 'monitor', label: 'Monitor' },
  { value: 'phone', label: 'Phone' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'laptop', label: 'Laptop' },
  { value: 'database', label: 'Database' },
]

function FormPreview({ archetype }: { archetype: Archetype | null }) {
  const previewHeight = archetype === 'low-slab' ? 0.7 : archetype === 'tablet' ? 0.85 : archetype === 'laptop' ? 1.25 : archetype === 'phone' ? 1.9 : archetype === 'database' ? 1.6 : archetype === 'monitor' ? 1.95 : 3.2
  const faces = buildingFaces(archetype ?? 'cube', { gx: 0, gy: 0, w: 4, d: 3 }, previewHeight, 4)
  const points = faces.flatMap((face) => face.points)
  const minX = Math.min(...points.map((point) => point.x)) - 8
  const minY = Math.min(...points.map((point) => point.y)) - 8
  const maxX = Math.max(...points.map((point) => point.x)) + 8
  const maxY = Math.max(...points.map((point) => point.y)) + 8
  return <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} aria-hidden="true">{faces.map((face, index) => <polygon key={index} points={pointsAttribute(face.points)} className={`building-face face-${face.shade}`} />)}{archetype === null ? <text x="12" y="17">A</text> : null}</svg>
}

export function BuildingAppearancePicker({ archetype, texture, onArchetype, onTexture }: { archetype?: Archetype; texture: FaceTexture; onArchetype: (value: Archetype | undefined) => void; onTexture: (value: FaceTexture) => void }) {
  return <div className="appearance-picker"><fieldset className="form-picker"><legend>Building form</legend><div>{FORMS.map((form) => { const selected = (archetype ?? null) === form.value; return <button type="button" key={form.label} className={selected ? 'is-selected' : ''} aria-pressed={selected} title={form.label} onClick={() => onArchetype(form.value ?? undefined)}><FormPreview archetype={form.value} /><span>{form.label}</span></button> })}</div></fieldset><fieldset className="texture-picker"><legend>Face texture</legend><div>{(['auto', 'plain', 'hatched'] as const).map((value) => <button type="button" key={value} className={texture === value ? 'is-selected' : ''} aria-pressed={texture === value} onClick={() => onTexture(value)}>{value}</button>)}</div></fieldset></div>
}
