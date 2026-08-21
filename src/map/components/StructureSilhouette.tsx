import type { StructureGeometry } from '../core/structure-geometry'
import { pointsAttribute } from '../core/iso'

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
    <g className="structure-shell">{geometry.shell.map((face, index) => <polygon key={index} points={pointsAttribute(face.points)} className={`structure-face tone-${face.tone}`} vectorEffect="non-scaling-stroke" />)}</g>
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
        {interactive ? <g className="structure-floor-hit">{floor.polygons.map((face, index) => <polygon key={index} points={pointsAttribute(face.points)} />)}</g> : null}
        <g className="structure-floor-visual">
          {floor.polygons.map((face, index) => <polygon key={index} points={pointsAttribute(face.points)} className={`structure-face tone-${face.tone}`} vectorEffect="non-scaling-stroke" />)}
          {floor.details.map((line, index) => <line key={index} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} className={`structure-detail tone-${line.tone ?? 'window'}`} vectorEffect="non-scaling-stroke" />)}
        </g>
      </g>
    })}
    <g className="structure-details">{geometry.details.map((line, index) => <line key={index} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} className={`structure-detail tone-${line.tone ?? 'window'}`} vectorEffect="non-scaling-stroke" />)}</g>
  </g>
}
