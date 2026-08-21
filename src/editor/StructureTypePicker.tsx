import { STRUCTURE_TYPES, type StructureType } from '../domain/types'
import { StructureSilhouette } from '../map/components/StructureSilhouette'
import { structureGeometry } from '../map/core/structure-geometry'

const LABELS: Record<StructureType, string> = {
  tower: 'Tower',
  campus: 'Campus',
  'cruise-ship': 'Cruise ship',
}

export function StructureTypePicker({ value, onChange }: { value: StructureType; onChange: (value: StructureType) => void }) {
  return <fieldset className="structure-type-picker"><legend>Structure type</legend><div>{STRUCTURE_TYPES.map((type) => {
    const geometry = structureGeometry(type, 4)
    const bounds = geometry.structureBounds
    return <button key={type} type="button" className={value === type ? 'is-selected' : ''} aria-pressed={value === type} onClick={() => onChange(type)}>
      <svg viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`} aria-hidden="true"><StructureSilhouette geometry={geometry} /></svg>
      <span>{LABELS[type]}</span>
    </button>
  })}</div></fieldset>
}
