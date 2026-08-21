import type { StructureGeometry } from '../core/structure-geometry'

type StructureSilhouetteProps = {
  geometry: StructureGeometry
  previewIndex?: number | null
  currentIndex?: number
  floorNames?: readonly string[]
  onPreview?: (index: number | null) => void
  onEnter?: (index: number) => void
}

export function StructureSilhouette({ geometry, previewIndex = null, currentIndex = -1, floorNames = [], onPreview, onEnter }: StructureSilhouetteProps) {
  const interactive = Boolean(onPreview && onEnter)
  return <g className={`structure-silhouette structure-${geometry.type} ${previewIndex !== null ? 'has-preview' : ''}`}>
    <g className="structure-paint" aria-hidden="true">{geometry.layers.map((paintLayer) => {
      const floorIndex = paintLayer.owner.kind === 'floor' ? paintLayer.owner.index : null
      return <g key={paintLayer.key} className={`structure-paint-layer ${floorIndex === null ? 'is-shell' : 'is-floor'} ${floorIndex !== null && floorIndex === previewIndex ? 'is-previewed' : ''} ${floorIndex !== null && floorIndex === currentIndex ? 'is-current' : ''}`}>
        <g className="structure-occluders">{paintLayer.faces.map((face, index) => <path key={index} d={face} className="structure-face" />)}</g>
        <g className="structure-layer-ink">{paintLayer.strokes.map((stroke, index) => <path key={index} d={stroke.d} className={`structure-stroke weight-${stroke.weight}`} vectorEffect="non-scaling-stroke" />)}</g>
      </g>
    })}</g>
    {interactive ? <g className="structure-floor-hits">{geometry.floors.map((floor) => {
      const previewed = previewIndex === floor.index
      return <g
        key={floor.index}
        className={`structure-floor-slot ${previewed ? 'is-previewed' : ''} ${currentIndex === floor.index ? 'is-current' : ''}`}
        role="button"
        tabIndex={0}
        aria-label={`Open floor ${floor.index + 1}, ${floorNames[floor.index] ?? ''}`}
        onPointerEnter={() => onPreview?.(floor.index)}
        onPointerLeave={() => onPreview?.(null)}
        onFocus={() => onPreview?.(floor.index)}
        onBlur={() => onPreview?.(null)}
        onClick={() => onEnter?.(floor.index)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          onEnter?.(floor.index)
        }}
      >{floor.hitAreas.map((hitArea, index) => <path key={index} d={hitArea} className="structure-floor-hit" />)}</g>
    })}</g> : null}
  </g>
}
