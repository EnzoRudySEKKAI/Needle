import { useMemo, type CSSProperties } from 'react'
import type { FlowStage, OntologyDocument, OntologyFlow, OntologyNode } from '../domain/types'
import { IsoCanvas } from '../map/components/IsoCanvas'
import { StructureSilhouette } from '../map/components/StructureSilhouette'
import type { FlowProgram, ProgramStage } from '../map/core/program'
import { structureGeometry } from '../map/core/structure-geometry'
import { continueFlow, toggleFlow, useClockActiveKey, useClockState } from '../map/stores/flow-clock'

const noop = () => {}
const singleInsets = { left: 34, right: 34, top: 76, bottom: 34 }
const stackedTopInsets = { left: 34, right: 34, top: 76, bottom: 18 }
const stackedBottomInsets = { left: 34, right: 34, top: 48, bottom: 24 }

type CinemaViewSnapshot = { floorIds: string[]; focusNodeIds: Set<string> }

function cinemaViewSnapshot(document: OntologyDocument, nodeById: ReadonlyMap<string, OntologyNode>, runtimeShot: ProgramStage, shot: FlowStage): CinemaViewSnapshot & { scenarioFilter: { relationIds: Set<string>; nodeIds: Set<string> } } {
  const floorIds = [...new Set([...runtimeShot.sourceIds, ...runtimeShot.targetIds].map((id) => nodeById.get(id)?.floorId).filter((id): id is string => Boolean(id)))]
  const visibleFloorIds = shot.layout === 'single' ? floorIds.slice(0, 1) : floorIds
    .slice()
    .sort((a, b) => document.floors.findIndex((floor) => floor.id === b) - document.floors.findIndex((floor) => floor.id === a))
    .slice(0, 2)
  const relationIds = new Set(shot.traversals.map((traversal) => traversal.relationId))
  const focusNodeIds = new Set([...runtimeShot.sourceIds, ...runtimeShot.targetIds])
  return { floorIds: visibleFloorIds, focusNodeIds, scenarioFilter: { relationIds, nodeIds: focusNodeIds } }
}

function CinemaHeader({ flow, program, onClose }: { flow: OntologyFlow; program: FlowProgram; onClose: () => void }) {
  const clock = useClockState()
  const progress = program.total ? Math.min(1, clock.time / program.total) : 0
  return <header className="cinema-header">
    <div><span>Needle Cinema</span><strong>{flow.name}</strong></div>
    <div className="cinema-progress" aria-hidden="true"><i style={{ width: `${progress * 100}%` }} /></div>
    <button type="button" onClick={onClose} aria-label="Exit cinema mode">Exit</button>
  </header>
}

function CinemaFooter({ flow, shotIndex }: { flow: OntologyFlow; shotIndex: number }) {
  const clock = useClockState()
  const shot = flow.stages[shotIndex]!
  return <footer className="cinema-caption">
    <div className="cinema-caption-copy"><span>Plan {String(shotIndex + 1).padStart(2, '0')} / {String(flow.stages.length).padStart(2, '0')}</span><h2>{shot.name || `Plan ${shotIndex + 1}`}</h2>{shot.note ? <p className="cinema-shot-note">{shot.note}</p> : null}{flow.summary ? <p className="cinema-scenario-summary">{flow.summary}</p> : null}</div>
    {clock.waiting ? <button type="button" className="cinema-continue" onClick={continueFlow}>Continue</button> : <button type="button" className="cinema-playback" onClick={toggleFlow}>{clock.playing ? 'Pause' : clock.ended ? 'Replay' : 'Play'}</button>}
  </footer>
}

function CinemaFloorLocator({ document, floorId, role }: { document: OntologyDocument; floorId: string; role: string }) {
  const floorIndex = document.floors.findIndex((floor) => floor.id === floorId)
  const floor = document.floors[floorIndex]
  const geometry = useMemo(() => structureGeometry(document.structureType, document.floors.length), [document.floors.length, document.structureType])
  if (!floor) return null

  return <aside className="cinema-floor-locator" aria-label={`Floor ${floorIndex + 1}: ${floor.name}`}>
    <div className="cinema-view-label"><span>Floor {String(floorIndex + 1).padStart(2, '0')} · {role}</span><strong>{floor.name}</strong></div>
    <svg className="cinema-structure-locator" viewBox={`${geometry.structureBounds.x} ${geometry.structureBounds.y} ${geometry.structureBounds.width} ${geometry.structureBounds.height}`} aria-hidden="true">
      <StructureSilhouette geometry={geometry} previewIndex={floorIndex} currentIndex={floorIndex} />
    </svg>
  </aside>
}

export function CinemaMode({ document, flow, program, onClose }: { document: OntologyDocument; flow: OntologyFlow; program: FlowProgram; onClose: () => void }) {
  const activeKey = useClockActiveKey()
  const activeParts = activeKey.split(':')
  const shotIndex = activeParts[0] === program.id ? Number(activeParts[1]) : 0
  const runtimeShot = program.stages[shotIndex]!
  const shot = flow.stages[shotIndex]!
  const nodeById = useMemo(() => new Map(document.nodes.map((node) => [node.id, node])), [document.nodes])
  const viewModel = useMemo(() => cinemaViewSnapshot(document, nodeById, runtimeShot, shot), [document, nodeById, runtimeShot, shot])
  const previousView = useMemo(() => shotIndex > 0 ? cinemaViewSnapshot(document, nodeById, program.stages[shotIndex - 1]!, flow.stages[shotIndex - 1]!) : null, [document, flow.stages, nodeById, program.stages, shotIndex])
  const transitionDurationMs = shot.transition?.durationMs ?? 520

  return <section className={`cinema-mode ${viewModel.floorIds.length > 1 ? 'is-stack' : 'is-single'} transition-${shot.transition?.kind ?? 'travel'}`} style={{ '--cinema-transition': `${transitionDurationMs}ms` } as CSSProperties} aria-label={`Cinema: ${flow.name}`}>
    <CinemaHeader flow={flow} program={program} onClose={onClose} />
    <div className="cinema-views">
      {viewModel.floorIds.map((floorId, index) => {
        const floorIndex = document.floors.findIndex((floor) => floor.id === floorId)
        const floor = document.floors[floorIndex]
        const hasSource = runtimeShot.sourceIds.some((id) => nodeById.get(id)?.floorId === floorId)
        const hasTarget = runtimeShot.targetIds.some((id) => nodeById.get(id)?.floorId === floorId)
        const role = hasSource && hasTarget ? 'Local path' : hasSource ? 'Departure' : 'Arrival'
        const sequence = hasSource && hasTarget ? 'local' : hasSource ? 'departure' : 'arrival'
        const concepts = [...viewModel.focusNodeIds].map((id) => nodeById.get(id)).filter((node) => node?.floorId === floorId)
        const previousFloorIndex = previousView?.floorIds.indexOf(floorId) ?? -1
        const sameFloor = previousFloorIndex >= 0
        const variant = shotIndex % 2 === 0 ? 'a' : 'b'
        const expands = sameFloor && previousView!.floorIds.length > 1 && viewModel.floorIds.length === 1
        const transitionClass = shot.transition?.kind === 'cut' ? ''
          : shot.transition?.kind === 'fade' || !sameFloor ? `is-fade-${variant}`
            : expands ? `is-expand-${previousFloorIndex === 0 ? 'top' : 'bottom'}`
              : 'is-pan'
        const cameraTransitionMs = transitionClass === 'is-pan' ? Math.max(900, transitionDurationMs * 1.5) : transitionClass.startsWith('is-expand-') ? transitionDurationMs : 0
        return <article className={`cinema-view ${transitionClass}`} key={floorId} aria-label={`${role}: ${floor?.name ?? floorId}`}>
          <CinemaFloorLocator document={document} floorId={floorId} role={role} />
          <div className="cinema-concept-details">{concepts.map((concept) => concept ? <section key={concept.id}><span>{concept.code}</span><h3>{concept.name}</h3>{concept.whatItDoes ? <p>{concept.whatItDoes}</p> : null}{concept.howItsBuilt ? <small>{concept.howItsBuilt}</small> : null}</section> : null)}</div>
          <IsoCanvas document={document} floorId={floorId} svgId={`cinema-${index}-${floorId}`} selection={null} activeFlowId={flow.id} flowProgram={program} editable={false} stepDisplayMode="current" relationPreview={null} stagePreviewTarget={null} relationPickIds={null} onPickRelation={noop} onSelect={noop} onMoveNode={noop} onMoveGroup={noop} onMoveGroupFlag={noop} connectionDraft={null} onToggleConnectionTarget={noop} viewportInsets={viewModel.floorIds.length > 1 ? index === 0 ? stackedTopInsets : stackedBottomInsets : singleInsets} dezoom={viewModel.floorIds.length > 1 ? 1.2 : 1} cameraTransitionMs={cameraTransitionMs} scenarioFilter={viewModel.scenarioFilter} focusNodeIds={viewModel.focusNodeIds} showGrid={flow.showGrid !== false} cinemaSequence={sequence} hideNodeLabels />
        </article>
      })}
    </div>
    <CinemaFooter flow={flow} shotIndex={shotIndex} />
  </section>
}
