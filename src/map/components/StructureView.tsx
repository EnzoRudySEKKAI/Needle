import { useMemo, useState } from 'react'
import type { OntologyDocument } from '../../domain/types'
import { structureGeometry } from '../core/structure-geometry'
import { FloorMiniPlan } from './FloorMiniPlan'
import { StructureSilhouette } from './StructureSilhouette'

const STRUCTURE_NAMES = {
  tower: 'Tower',
  campus: 'Campus',
  'cruise-ship': 'Cruise ship',
} as const

export function StructureView({ document, activeFloorId, onOpenFloor }: { document: OntologyDocument; activeFloorId: string; onOpenFloor: (floorId: string) => void }) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const geometry = useMemo(() => structureGeometry(document.structureType, document.floors.length), [document.floors.length, document.structureType])
  const currentIndex = document.floors.findIndex((floor) => floor.id === activeFloorId)
  const previewFloor = previewIndex === null ? null : document.floors[previewIndex] ?? null
  const previewSlot = previewIndex === null ? null : geometry.floors[previewIndex] ?? null
  const previewY = previewSlot
    ? Math.max(geometry.viewBox.y + 88, Math.min(previewSlot.centerY - 82, geometry.viewBox.y + geometry.viewBox.height - 250))
    : 0
  const conceptCount = previewFloor ? document.nodes.filter((node) => node.floorId === previewFloor.id).length : 0
  const structureName = STRUCTURE_NAMES[document.structureType]

  return <div className="structure-view">
    <svg id="ontology-map-svg" className="structure-view-svg" viewBox={`${geometry.viewBox.x} ${geometry.viewBox.y} ${geometry.viewBox.width} ${geometry.viewBox.height}`} preserveAspectRatio="xMidYMid meet" aria-label={`${structureName} structure view`}>
      <defs><pattern id="map-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" className="hatch-line" /></pattern></defs>
      <StructureSilhouette geometry={geometry} previewIndex={previewIndex} currentIndex={currentIndex} floorNames={document.floors.map((floor) => floor.name)} onPreview={setPreviewIndex} onEnter={(index) => { const floor = document.floors[index]; if (floor) onOpenFloor(floor.id) }} />
      {previewFloor && previewSlot ? <g className="structure-preview" aria-live="polite">
        <text x={geometry.previewX} y={previewY - 26} className="structure-preview-index">Floor {String(previewIndex! + 1).padStart(2, '0')}</text>
        <text x={geometry.previewX} y={previewY - 4} className="structure-preview-name">{previewFloor.name}</text>
        <text x={geometry.previewX} y={previewY + 15} className="structure-preview-count">{conceptCount} concept{conceptCount === 1 ? '' : 's'}</text>
        <FloorMiniPlan document={document} floorId={previewFloor.id} x={geometry.previewX} y={previewY + 28} />
      </g> : <g className="structure-rest-copy">
        <text x={geometry.previewX} y={-12} className="structure-preview-index">Structure view</text>
        <text x={geometry.previewX} y={16} className="structure-preview-name">{structureName}</text>
        <text x={geometry.previewX} y={40} className="structure-preview-count">{document.floors.length} floor{document.floors.length === 1 ? '' : 's'}</text>
        <text x={geometry.previewX} y={80} className="structure-preview-hint">Hover a floor to reveal its plan.</text>
        <text x={geometry.previewX} y={98} className="structure-preview-hint">Click to enter.</text>
      </g>}
    </svg>
  </div>
}
