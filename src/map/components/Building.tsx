import { memo, type PointerEvent as ReactPointerEvent } from 'react'
import type { VisualNode } from '../../domain/types'
import { buildingFaces, chipAnchor } from '../core/archetypes'
import { pointsAttribute } from '../core/iso'

type BuildingProps = {
  node: VisualNode
  selected: boolean
  dimmed: boolean
  active: boolean
  previewed: boolean
  editable: boolean
  onSelect: () => void
  onDragStart: (event: ReactPointerEvent<SVGGElement>) => void
  connectionSource?: boolean
  connectionTarget?: boolean
  connectionMode?: boolean
}

function BuildingInner({ node, selected, dimmed, active, previewed, editable, onSelect, onDragStart, connectionSource = false, connectionTarget = false, connectionMode = false }: BuildingProps) {
  const faces = buildingFaces(node.archetype, node.footprint, node.height, node.properties.length)
  const chip = chipAnchor(node.footprint, node.height)
  const label = selected || active || previewed ? `${node.code} · ${node.name}` : node.code
  const half = Math.max(15, label.length * 3.2 + 8)

  return (
    <g
      className={`building ${selected ? 'is-selected' : ''} ${active ? 'is-active' : ''} ${previewed ? 'is-previewed' : ''} ${connectionSource ? 'is-connect-source' : ''} ${connectionTarget ? 'is-connect-target' : ''}`}
      opacity={dimmed ? 0.28 : 1}
      role="button"
      tabIndex={0}
      aria-label={node.name}
      onClick={(event) => { event.stopPropagation(); onSelect() }}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect() }}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.stopPropagation()
        if (connectionMode) return
        if (!editable) return
        onDragStart(event)
      }}
    >
      {faces.map((face, index) => <polygon key={index} points={pointsAttribute(face.points)} className={`building-face face-${face.shade} ${node.faceTexture === 'hatched' || (node.faceTexture === 'auto' && face.hatch) ? 'is-hatched' : ''}`} vectorEffect="non-scaling-stroke" />)}
      <g className="roof-chip" transform={`translate(${chip.x} ${chip.y - 12})`}><rect x={-half} y={-9} width={half * 2} height={18} rx={3} vectorEffect="non-scaling-stroke" /><text textAnchor="middle" dominantBaseline="central">{label}</text></g>
    </g>
  )
}

export const Building = memo(BuildingInner)
