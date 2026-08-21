import { memo, useEffect, useRef } from 'react'
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
  onMovePreview: (gx: number, gy: number) => void
  onMoveEnd: (gx: number, gy: number) => void
  onMoveCancel: () => void
  onDragState: (dragging: boolean) => void
  cameraScale: number
  connectionSource?: boolean
  connectionTarget?: boolean
  connectionMode?: boolean
}

function BuildingInner({ node, selected, dimmed, active, editable, onSelect, onMovePreview, onMoveEnd, onMoveCancel, onDragState, cameraScale, connectionSource = false, connectionTarget = false, connectionMode = false }: BuildingProps) {
  const faces = buildingFaces(node.archetype, node.footprint, node.height, node.properties.length)
  const chip = chipAnchor(node.footprint, node.height)
  const label = selected || active ? `${node.code} · ${node.name}` : node.code
  const half = Math.max(15, label.length * 3.2 + 8)
  const cleanupRef = useRef<(() => void) | null>(null)
  const suppressClickRef = useRef(false)

  useEffect(() => () => cleanupRef.current?.(), [])

  return (
    <g
      className={`building ${selected ? 'is-selected' : ''} ${active ? 'is-active' : ''} ${connectionSource ? 'is-connect-source' : ''} ${connectionTarget ? 'is-connect-target' : ''}`}
      opacity={dimmed ? 0.28 : 1}
      role="button"
      tabIndex={0}
      aria-label={node.name}
      onClick={(event) => {
        event.stopPropagation()
        if (suppressClickRef.current) { suppressClickRef.current = false; return }
        onSelect()
      }}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect() }}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        if (connectionMode) { event.stopPropagation(); return }
        if (!editable) return
        event.stopPropagation()
        const target = event.currentTarget
        const pointerId = event.pointerId
        const startX = event.clientX
        const startY = event.clientY
        const start = node.position
        const scale = cameraScale
        let frame = 0
        let dragging = true
        let moved = false
        let pending = start

        const preview = () => {
          frame = 0
          onMovePreview(pending.gx, pending.gy)
        }
        const cleanup = () => {
          target.removeEventListener('pointermove', move)
          target.removeEventListener('pointerup', finish)
          target.removeEventListener('pointercancel', cancel)
          target.removeEventListener('lostpointercapture', lostCapture)
          window.removeEventListener('blur', cancel)
          document.removeEventListener('visibilitychange', visibilityChange)
          if (frame) cancelAnimationFrame(frame)
          cleanupRef.current = null
        }
        const end = (commit: boolean, preserveClickSuppression: boolean) => {
          if (!dragging) return
          dragging = false
          cleanup()
          if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId)
          if (commit && moved) onMoveEnd(Math.round(pending.gx * 2) / 2, Math.round(pending.gy * 2) / 2)
          else if (moved) onMoveCancel()
          if (!preserveClickSuppression) suppressClickRef.current = false
          onDragState(false)
        }
        const move = (moveEvent: PointerEvent) => {
          if (moveEvent.buttons === 0) { end(true, true); return }
          const dx = (moveEvent.clientX - startX) / scale
          const dy = (moveEvent.clientY - startY) / scale
          moved ||= Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 4
          if (!moved) return
          suppressClickRef.current = true
          pending = { gx: start.gx + dx / 48 + dy / 24, gy: start.gy + dy / 24 - dx / 48 }
          if (!frame) frame = requestAnimationFrame(preview)
        }
        const finish = () => end(true, true)
        const cancel = () => end(true, false)
        const lostCapture = () => end(true, false)
        const visibilityChange = () => { if (document.hidden) end(true, false) }

        cleanupRef.current = () => end(false, false)
        onDragState(true)
        target.setPointerCapture(pointerId)
        target.addEventListener('pointermove', move)
        target.addEventListener('pointerup', finish)
        target.addEventListener('pointercancel', cancel)
        target.addEventListener('lostpointercapture', lostCapture)
        window.addEventListener('blur', cancel)
        document.addEventListener('visibilitychange', visibilityChange)
      }}
    >
      {faces.map((face, index) => <polygon key={index} points={pointsAttribute(face.points)} className={`building-face face-${face.shade} ${node.faceTexture === 'hatched' || (node.faceTexture === 'auto' && face.hatch) ? 'is-hatched' : ''}`} vectorEffect="non-scaling-stroke" />)}
      <g className="roof-chip" transform={`translate(${chip.x} ${chip.y - 12})`}><rect x={-half} y={-9} width={half * 2} height={18} rx={3} vectorEffect="non-scaling-stroke" /><text textAnchor="middle" dominantBaseline="central">{label}</text></g>
    </g>
  )
}

export const Building = memo(BuildingInner)
