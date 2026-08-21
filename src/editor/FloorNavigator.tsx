import { useEffect, useRef, type WheelEvent } from 'react'
import type { OntologyFloor } from '../domain/types'

export function FloorNavigator({ floors, activeFloorId, buildingView, onFloor, onBuilding }: { floors: readonly OntologyFloor[]; activeFloorId: string; buildingView: boolean; onFloor: (id: string) => void; onBuilding: () => void }) {
  const activeIndex = floors.findIndex((floor) => floor.id === activeFloorId)
  const wheelLocked = useRef(false)
  const wheelTimer = useRef(0)
  useEffect(() => () => window.clearTimeout(wheelTimer.current), [])
  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (wheelLocked.current || Math.abs(event.deltaY) < 8 || floors.length < 2) return
    const next = Math.max(0, Math.min(floors.length - 1, activeIndex + (event.deltaY > 0 ? 1 : -1)))
    if (floors[next] && next !== activeIndex) {
      wheelLocked.current = true
      onFloor(floors[next].id)
      wheelTimer.current = window.setTimeout(() => { wheelLocked.current = false }, 480)
    }
  }
  return <div className="floor-navigator" aria-label="Floors" onWheel={onWheel}>
    <span>Floors</span>
    <div className="floor-navigator-list">
      {[...floors].reverse().map((floor) => {
        const index = floors.indexOf(floor)
        return <button key={floor.id} type="button" className={!buildingView && floor.id === activeFloorId ? 'is-active' : ''} aria-current={!buildingView && floor.id === activeFloorId ? 'true' : undefined} onClick={() => onFloor(floor.id)}><b>{String(index + 1).padStart(2, '0')}</b><span>{floor.name}</span></button>
      })}
    </div>
    <button type="button" className={`building-view-button ${buildingView ? 'is-active' : ''}`} onClick={onBuilding}>Building view</button>
  </div>
}
