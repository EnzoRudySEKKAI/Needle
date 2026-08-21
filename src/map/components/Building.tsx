import { memo } from 'react'
import type { VisualNode } from '../../domain/types'
import { buildingFaces, chipAnchor } from '../core/archetypes'
import { pointsAttribute } from '../core/iso'

type BuildingProps = {
  node: VisualNode
  selected: boolean
  dimmed: boolean
  active: boolean
  editable: boolean
  onSelect: () => void
  onMove: (gx: number, gy: number) => void
  cameraScale: number
}

function BuildingInner({ node, selected, dimmed, active, editable, onSelect, onMove, cameraScale }: BuildingProps) {
  const faces = buildingFaces(node.archetype, node.footprint, node.height, node.properties.length)
  const chip = chipAnchor(node.footprint, node.height)
  const label = selected || active ? `${node.code} · ${node.name}` : node.code
  const half = Math.max(15, label.length * 3.2 + 8)

  return (
    <g
      className={`building ${selected ? 'is-selected' : ''} ${active ? 'is-active' : ''}`}
      opacity={dimmed ? 0.28 : 1}
      role="button"
      tabIndex={0}
      aria-label={node.name}
      onClick={(event) => { event.stopPropagation(); onSelect() }}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect() }}
      onPointerDown={(event) => {
        if (!editable || event.button !== 0) return
        event.stopPropagation()
        const target = event.currentTarget
        target.setPointerCapture(event.pointerId)
        const startX = event.clientX
        const startY = event.clientY
        const start = node.position
        const move = (moveEvent: PointerEvent) => {
          const dx = (moveEvent.clientX - startX) / cameraScale
          const dy = (moveEvent.clientY - startY) / cameraScale
          const dgx = dx / 48 + dy / 24
          const dgy = dy / 24 - dx / 48
          onMove(Math.round((start.gx + dgx) * 2) / 2, Math.round((start.gy + dgy) * 2) / 2)
        }
        const up = () => {
          target.removeEventListener('pointermove', move)
          target.removeEventListener('pointerup', up)
        }
        target.addEventListener('pointermove', move)
        target.addEventListener('pointerup', up)
      }}
    >
      {faces.map((face, index) => (
        <polygon key={index} points={pointsAttribute(face.points)} className={`building-face face-${face.shade} ${node.faceTexture === 'hatched' || (node.faceTexture === 'auto' && face.hatch) ? 'is-hatched' : ''}`} vectorEffect="non-scaling-stroke" />
      ))}
      <g className="roof-chip" transform={`translate(${chip.x} ${chip.y - 12})`}>
        <rect x={-half} y={-9} width={half * 2} height={18} rx={3} vectorEffect="non-scaling-stroke" />
        <text textAnchor="middle" dominantBaseline="central">{label}</text>
      </g>
    </g>
  )
}

export const Building = memo(BuildingInner)
