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
    <g className="structure-shell">{geometry.shell.map((stroke, index) => <path key={index} d={stroke.d} className={`structure-stroke weight-${stroke.weight}`} vectorEffect="non-scaling-stroke" />)}</g>
    {geometry.floors.map((floor) => {
      const previewed = previewIndex === floor.index
      return <g
        key={floor.index}
        className={`structure-floor-slot ${previewed ? 'is-previewed' : ''} ${currentIndex === floor.index ? 'is-current' : ''}`}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? `Open floor ${floor.index + 1}, ${floorNames[floor.index] ?? ''}` : undefined}
        onPointerEnter={interactive ? () => onPreview?.(floor.index) : undefined}
        onPointerLeave={interactive ? () => onPreview?.(null) : undefined}
        onFocus={interactive ? () => onPreview?.(floor.index) : undefined}
        onBlur={interactive ? () => onPreview?.(null) : undefined}
        onClick={interactive ? () => onEnter?.(floor.index) : undefined}
        onKeyDown={interactive ? (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          onEnter?.(floor.index)
        } : undefined}
      >
        {interactive ? <path d={floor.hitArea} className="structure-floor-hit" /> : null}
        <g className="structure-floor-visual">
          {floor.paths.map((stroke, index) => <path key={index} d={stroke.d} className={`structure-stroke weight-${stroke.weight}`} vectorEffect="non-scaling-stroke" />)}
        </g>
      </g>
    })}
  </g>
}
