import { useMemo } from 'react'
import type { OntologyDocument } from '../../domain/types'
import { useI18n } from '../../i18n/useI18n'
import { structureGeometry } from '../core/structure-geometry'
import { FloorMiniPlan } from './FloorMiniPlan'
import { StructureSilhouette } from './StructureSilhouette'

export function StructureView({ document, activeFloorId, hoveredFloorId, onHoverFloor, onOpenFloor }: { document: OntologyDocument; activeFloorId: string; hoveredFloorId?: string | null; onHoverFloor?: (floorId: string | null) => void; onOpenFloor: (floorId: string) => void }) {
  const { t, formatNumber } = useI18n()
  const geometry = useMemo(() => structureGeometry(document.structureType, document.floors.length), [document.floors.length, document.structureType])
  const currentIndex = document.floors.findIndex((floor) => floor.id === activeFloorId)
  const previewIndex = hoveredFloorId ? document.floors.findIndex((floor) => floor.id === hoveredFloorId) : -1
  const resolvedPreviewIndex = previewIndex >= 0 ? previewIndex : null
  const previewFloor = resolvedPreviewIndex === null ? null : document.floors[resolvedPreviewIndex] ?? null
  const previewSlot = resolvedPreviewIndex === null ? null : geometry.floors[resolvedPreviewIndex] ?? null
  const previewY = previewSlot
    ? Math.max(geometry.viewBox.y + 88, Math.min(previewSlot.centerY - 82, geometry.viewBox.y + geometry.viewBox.height - 250))
    : 0
  const conceptCount = previewFloor ? document.nodes.filter((node) => node.floorId === previewFloor.id).length : 0
  const structureName = t(document.structureType === 'tower' ? 'structure.tower' : document.structureType === 'campus' ? 'structure.campus' : document.structureType === 'cruise-ship' ? 'structure.ship' : 'structure.expoPark')
  const handlePreview = (index: number | null) => {
    if (!onHoverFloor) return
    if (index === null) onHoverFloor(null)
    else {
      const floor = document.floors[index]
      onHoverFloor(floor ? floor.id : null)
    }
  }

  return <div className="structure-view">
    <svg id="ontology-map-svg" className="structure-view-svg" viewBox={`${geometry.viewBox.x} ${geometry.viewBox.y} ${geometry.viewBox.width} ${geometry.viewBox.height}`} preserveAspectRatio="xMidYMid meet" aria-label={t('shell.structure.viewLabel', { structure: structureName })}>
      <defs>
        <pattern id="map-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" className="hatch-line" /></pattern>
      </defs>
      <StructureSilhouette geometry={geometry} previewIndex={resolvedPreviewIndex} currentIndex={currentIndex} floorNames={document.floors.map((floor) => floor.name)} onPreview={handlePreview} onEnter={(index) => { const floor = document.floors[index]; if (floor) onOpenFloor(floor.id) }} />
      {previewFloor && previewSlot ? <g className="structure-preview" aria-live="polite">
        <text x={geometry.previewX} y={previewY - 26} className="structure-preview-index">{t('shell.structure.floorIndex', { number: String(resolvedPreviewIndex! + 1).padStart(2, '0') })}</text>
        <text x={geometry.previewX} y={previewY - 4} className="structure-preview-name">{previewFloor.name}</text>
        <text x={geometry.previewX} y={previewY + 15} className="structure-preview-count">{t(conceptCount === 1 ? 'shell.structure.oneConcept' : 'shell.structure.manyConcepts', { count: formatNumber(conceptCount) })}</text>
        <FloorMiniPlan document={document} floorId={previewFloor.id} x={geometry.previewX} y={previewY + 28} />
      </g> : <g className="structure-rest-copy">
        <text x={geometry.previewX} y={-12} className="structure-preview-index">{t('shell.floor.structureView')}</text>
        <text x={geometry.previewX} y={16} className="structure-preview-name">{structureName}</text>
        <text x={geometry.previewX} y={40} className="structure-preview-count">{t(document.floors.length === 1 ? 'shell.structure.oneFloor' : 'shell.structure.manyFloors', { count: formatNumber(document.floors.length) })}</text>
        <text x={geometry.previewX} y={80} className="structure-preview-hint">{t('shell.structure.hoverHint')}</text>
        <text x={geometry.previewX} y={98} className="structure-preview-hint">{t('shell.structure.enterHint')}</text>
      </g>}
    </svg>
  </div>
}
