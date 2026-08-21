import { memo, type PointerEvent as ReactPointerEvent } from 'react'
import type { VisualNode } from '../../domain/types'
import { chipAnchor } from '../core/archetypes'
import { ConceptVolume } from './ConceptVolume'

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
  const chip = chipAnchor(node.footprint, node.height)
  const code = node.code.trim()
  const label = selected || active || previewed ? `${code} · ${node.name}` : code
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
      <ConceptVolume node={node} />
      {code ? <g className="roof-chip" transform={`translate(${chip.x} ${chip.y - 12})`}><rect x={-half} y={-9} width={half * 2} height={18} rx={3} vectorEffect="non-scaling-stroke" /><text textAnchor="middle" dominantBaseline="central">{label}</text></g> : null}
    </g>
  )
}

export const Building = memo(BuildingInner)
