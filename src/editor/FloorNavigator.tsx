import { useEffect, useEffectEvent, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { OntologyFloor } from '../domain/types'
import { useDocumentStore } from './document-store'

type DragSession = { pointerId: number; floorId: string; beforeFloorId: string | null; startY: number; clientY: number; moved: boolean; frame: number; owner: HTMLElement }

export function FloorNavigator({ floors, activeFloorId, view, onFloor, onStructure, editable = false, onAddFloor, onMoveFloor, highlightedFloorId, onHoverFloor }: { floors: readonly OntologyFloor[]; activeFloorId: string; view: 'floor' | 'structure'; onFloor: (id: string) => void; onStructure: () => void; editable?: boolean; onAddFloor?: () => void; onMoveFloor?: (floorId: string, beforeFloorId: string | null) => void; highlightedFloorId?: string | null; onHoverFloor?: (floorId: string | null) => void }) {
  const { document } = useDocumentStore()
  const activeIndex = floors.findIndex((floor) => floor.id === activeFloorId)
  const wheelLocked = useRef(false)
  const wheelTimer = useRef(0)
  const floorElements = useRef(new Map<string, HTMLElement>())
  const dragSession = useRef<DragSession | null>(null)
  const [draggingFloorId, setDraggingFloorId] = useState<string | null>(null)
  const [dropBeforeFloorId, setDropBeforeFloorId] = useState<string | null>(null)
  useEffect(() => () => window.clearTimeout(wheelTimer.current), [])
  const displayFloors = [...floors].reverse()
  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (wheelLocked.current || Math.abs(event.deltaY) < 8 || floors.length < 2) return
    const next = Math.max(0, Math.min(floors.length - 1, activeIndex + (event.deltaY > 0 ? 1 : -1)))
    if (floors[next] && next !== activeIndex) {
      wheelLocked.current = true
      onFloor(floors[next].id)
      wheelTimer.current = window.setTimeout(() => { wheelLocked.current = false }, 480)
    }
  }

  const updateDropTarget = (clientY: number) => {
    const session = dragSession.current
    if (!session) return
    const before = displayFloors
      .filter((floor) => floor.id !== session.floorId)
      .find((floor) => {
        const bounds = floorElements.current.get(floor.id)?.getBoundingClientRect()
        return bounds ? clientY < bounds.top + bounds.height / 2 : false
      })?.id ?? null
    session.beforeFloorId = before
    setDropBeforeFloorId(before)
  }

  const finishDrag = (shouldCommit: boolean) => {
    const session = dragSession.current
    if (!session) return
    dragSession.current = null
    if (session.frame) cancelAnimationFrame(session.frame)
    if (session.owner.hasPointerCapture(session.pointerId)) session.owner.releasePointerCapture(session.pointerId)
    setDraggingFloorId(null)
    setDropBeforeFloorId(null)
    if (shouldCommit && session.moved && onMoveFloor) onMoveFloor(session.floorId, session.beforeFloorId)
  }
  const cancelDrag = useEffectEvent(() => finishDrag(false))

  useEffect(() => {
    const cancel = () => cancelDrag()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !dragSession.current) return
      event.preventDefault()
      event.stopImmediatePropagation()
      cancel()
    }
    window.addEventListener('blur', cancel)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('blur', cancel)
      window.removeEventListener('keydown', onKeyDown, true)
      cancel()
    }
  }, [])

  const startDrag = (event: ReactPointerEvent<HTMLElement>, floorId: string) => {
    if (!editable || !onMoveFloor || event.button !== 0 || dragSession.current) return
    const target = event.target as Element
    if (target.closest('button')) {
      const isHandle = (event.currentTarget as HTMLElement).classList.contains('floor-drag-handle')
      if (!isHandle) return
    }
    event.preventDefault()
    event.stopPropagation()
    dragSession.current = { pointerId: event.pointerId, floorId, beforeFloorId: floorId, startY: event.clientY, clientY: event.clientY, moved: false, frame: 0, owner: event.currentTarget as HTMLElement }
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    setDraggingFloorId(floorId)
    setDropBeforeFloorId(floorId)
  }

  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const session = dragSession.current
    if (!session || session.pointerId !== event.pointerId) return
    session.clientY = event.clientY
    session.moved ||= Math.abs(event.clientY - session.startY) > 5
    if (!session.moved) return
    updateDropTarget(event.clientY)
  }

  return <div className="floor-navigator" aria-label="Floors" onWheel={onWheel}>
    <div className="floor-navigator-header">
      <span>Floors</span>
      {editable && onAddFloor ? <button type="button" className="floor-add-button" aria-label="Add floor" onClick={onAddFloor}>+</button> : null}
    </div>
    <div className="floor-navigator-list">
      {displayFloors.map((floor) => {
        const index = floors.indexOf(floor)
        const isActive = view === 'floor' && floor.id === activeFloorId
        const isHighlighted = highlightedFloorId === floor.id
        const isDragging = draggingFloorId === floor.id
        const isDropBefore = draggingFloorId && dropBeforeFloorId === floor.id
        const count = document.nodes.filter((node) => node.floorId === floor.id).length
        return <div
          key={floor.id}
          ref={(element) => { if (element) floorElements.current.set(floor.id, element); else floorElements.current.delete(floor.id) }}
          data-floor-id={floor.id}
          className={`floor-navigator-item ${isActive ? 'is-active' : ''} ${isHighlighted ? 'is-highlighted' : ''} ${isDragging ? 'is-dragging' : ''} ${isDropBefore ? 'is-drop-before' : ''}`}
          onPointerEnter={() => onHoverFloor?.(floor.id)}
          onPointerLeave={() => onHoverFloor?.(null)}
          onFocusCapture={() => onHoverFloor?.(floor.id)}
          onBlurCapture={() => onHoverFloor?.(null)}
          onPointerMove={moveDrag}
          onPointerUp={(event) => { if (dragSession.current?.pointerId === event.pointerId) finishDrag(true) }}
          onPointerCancel={(event) => { if (dragSession.current?.pointerId === event.pointerId) finishDrag(false) }}
          onLostPointerCapture={(event) => { if (dragSession.current?.pointerId === event.pointerId) finishDrag(false) }}
        >
          <button type="button" className={isActive ? 'is-active' : ''} aria-current={isActive ? 'true' : undefined} onClick={() => onFloor(floor.id)}><b>{String(index + 1).padStart(2, '0')}</b><span>{floor.name}</span><small className="floor-node-count">{count}</small></button>
          {editable && onMoveFloor ? <button type="button" className="floor-drag-handle" aria-label={`Drag ${floor.name} to reorder`} onPointerDown={(event) => startDrag(event, floor.id)} onPointerMove={moveDrag} onPointerUp={(event) => { if (dragSession.current?.pointerId === event.pointerId) finishDrag(true) }} onPointerCancel={(event) => { if (dragSession.current?.pointerId === event.pointerId) finishDrag(false) }} onLostPointerCapture={(event) => { if (dragSession.current?.pointerId === event.pointerId) finishDrag(false) }}><span aria-hidden="true">⋮⋮</span></button> : null}
        </div>
      })}
      {draggingFloorId && dropBeforeFloorId === null ? <div className="floor-drop-end" aria-hidden="true" /> : null}
    </div>
    <button type="button" className={`structure-view-button ${view === 'structure' ? 'is-active' : ''}`} onClick={onStructure}>Structure view</button>
  </div>
}
