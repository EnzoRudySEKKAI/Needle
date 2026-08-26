import { STRUCTURE_TYPES, type StructureType } from '../domain/types'
import { useI18n } from '../i18n/useI18n'
import { StructureSilhouette } from '../map/components/StructureSilhouette'
import { structureGeometry } from '../map/core/structure-geometry'

export function StructureTypePicker({ value, onChange }: { value: StructureType; onChange: (value: StructureType) => void }) {
  const { t } = useI18n()
  return <fieldset className="structure-type-picker"><legend>{t('shell.structure.type')}</legend><div>{STRUCTURE_TYPES.map((type) => {
    const geometry = structureGeometry(type, 4)
    const bounds = geometry.structureBounds
    const label = t(type === 'tower' ? 'structure.tower' : type === 'campus' ? 'structure.campus' : type === 'cruise-ship' ? 'structure.ship' : 'structure.expoPark')
    return <button key={type} type="button" className={value === type ? 'is-selected' : ''} aria-pressed={value === type} onClick={() => onChange(type)}>
      <svg viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`} aria-hidden="true"><StructureSilhouette geometry={geometry} /></svg>
      <span>{label}</span>
    </button>
  })}</div></fieldset>
}
