import { useMemo, type CSSProperties } from 'react'
import type { FlowStage, OntologyDocument, OntologyFlow, OntologyNode } from '../domain/types'
import { IsoCanvas } from '../map/components/IsoCanvas'
import { StructureSilhouette } from '../map/components/StructureSilhouette'
import type { FlowProgram, ProgramStage } from '../map/core/program'
import { structureGeometry } from '../map/core/structure-geometry'
import { continueFlow, toggleFlow, useClockActiveKey, useClockState } from '../map/stores/flow-clock'

const noop = () => {}
const singleInsets = { left: 34, right: 34, top: 76, bottom: 34 }

type CinemaLayout = 'single' | 'two' | 'three-vertical' | 'three-top' | 'three-bottom'
type CinemaSlot = 'full' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'vertical-top' | 'vertical-middle' | 'vertical-bottom'
type CinemaViewSnapshot = { floorIds: string[]; views: { floorId: string; slot: CinemaSlot }[]; layout: CinemaLayout; focusNodeIds: Set<string> }

function cinemaViewSnapshot(document: OntologyDocument, nodeById: ReadonlyMap<string, OntologyNode>, runtimeShot: ProgramStage, shot: FlowStage): CinemaViewSnapshot & { scenarioFilter: { relationIds: Set<string>; nodeIds: Set<string> } } {
  const floorIndex = (floorId: string) => document.floors.findIndex((floor) => floor.id === floorId)
  const ordered = (floorIds: string[]) => floorIds.slice().sort((a, b) => floorIndex(b) - floorIndex(a))
  const sourceFloorIds = [...new Set(runtimeShot.sourceIds.map((id) => nodeById.get(id)?.floorId).filter((id): id is string => Boolean(id)))]
  const targetFloorIds = [...new Set(runtimeShot.targetIds.map((id) => nodeById.get(id)?.floorId).filter((id): id is string => Boolean(id)))]
  const floorIds = ordered([...new Set([...sourceFloorIds, ...targetFloorIds])])
  let layout: CinemaLayout = floorIds.length > 1 ? 'two' : 'single'
  let views: { floorId: string; slot: CinemaSlot }[] = floorIds.length === 1 ? [{ floorId: floorIds[0]!, slot: 'full' }] : floorIds.slice(0, 2).map((floorId, index) => ({ floorId, slot: index === 0 ? 'top' : 'bottom' }))

  if (shot.layout === 'single') {
    views = floorIds.length ? [{ floorId: floorIds[0]!, slot: 'full' }] : []
    layout = 'single'
  } else if (floorIds.length >= 3) {
    const destinationFloorId = targetFloorIds.length === 1 ? targetFloorIds[0]! : null
    const originFloorIds = destinationFloorId ? ordered(sourceFloorIds.filter((floorId) => floorId !== destinationFloorId)) : []
    if (destinationFloorId && originFloorIds.length === 2) {
      const destinationIndex = floorIndex(destinationFloorId)
      if (originFloorIds.every((floorId) => floorIndex(floorId) < destinationIndex)) {
        layout = 'three-bottom'
        views = [{ floorId: destinationFloorId, slot: 'top' }, { floorId: originFloorIds[0]!, slot: 'bottom-left' }, { floorId: originFloorIds[1]!, slot: 'bottom-right' }]
      } else if (originFloorIds.every((floorId) => floorIndex(floorId) > destinationIndex)) {
        layout = 'three-top'
        views = [{ floorId: originFloorIds[0]!, slot: 'top-left' }, { floorId: originFloorIds[1]!, slot: 'top-right' }, { floorId: destinationFloorId, slot: 'bottom' }]
      } else {
        layout = 'three-vertical'
        views = floorIds.slice(0, 3).map((floorId, index) => ({ floorId, slot: index === 0 ? 'vertical-top' : index === 1 ? 'vertical-middle' : 'vertical-bottom' }))
      }
    } else {
      layout = 'three-vertical'
      views = floorIds.slice(0, 3).map((floorId, index) => ({ floorId, slot: index === 0 ? 'vertical-top' : index === 1 ? 'vertical-middle' : 'vertical-bottom' }))
    }
  }
  const relationIds = new Set(shot.traversals.map((traversal) => traversal.relationId))
  const focusNodeIds = new Set([...runtimeShot.sourceIds, ...runtimeShot.targetIds])
  return { floorIds: views.map((view) => view.floorId), views, layout, focusNodeIds, scenarioFilter: { relationIds, nodeIds: focusNodeIds } }
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

function CinemaFooter() {
  const clock = useClockState()
  return <footer className="cinema-transport">
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
  const layoutTransitionMs = Math.max(900, transitionDurationMs * 1.5)
  const outgoingViews = previousView && shot.transition?.kind !== 'cut' ? previousView.views.filter(({ floorId }) => !viewModel.floorIds.includes(floorId)) : []

  return <section className={`cinema-mode ${viewModel.floorIds.length > 1 ? 'is-stack' : 'is-single'} layout-${viewModel.layout} transition-${shot.transition?.kind ?? 'travel'}`} style={{ '--cinema-transition': `${transitionDurationMs}ms`, '--cinema-layout-transition': `${layoutTransitionMs}ms` } as CSSProperties} aria-label={`Cinema: ${flow.name}`}>
    <CinemaHeader flow={flow} program={program} onClose={onClose} />
    <div className="cinema-views">
      {viewModel.views.map(({ floorId, slot }, index) => {
        const floorIndex = document.floors.findIndex((floor) => floor.id === floorId)
        const floor = document.floors[floorIndex]
        const hasSource = runtimeShot.sourceIds.some((id) => nodeById.get(id)?.floorId === floorId)
        const hasTarget = runtimeShot.targetIds.some((id) => nodeById.get(id)?.floorId === floorId)
        const role = hasSource && hasTarget ? 'Local path' : hasSource ? 'Departure' : 'Arrival'
        const sequence = hasSource && hasTarget ? 'local' : hasSource ? 'departure' : 'arrival'
        const concepts = [...viewModel.focusNodeIds].map((id) => nodeById.get(id)).filter((node) => node?.floorId === floorId)
        const previousFloorIndex = previousView?.floorIds.indexOf(floorId) ?? -1
        const sameFloor = previousFloorIndex >= 0
        const previousRelationIds = sameFloor ? new Set([...previousView!.scenarioFilter.relationIds].filter((id) => !viewModel.scenarioFilter.relationIds.has(id))) : undefined
        const previousNodeIds = sameFloor ? new Set([...previousView!.scenarioFilter.nodeIds].filter((id) => !viewModel.scenarioFilter.nodeIds.has(id))) : undefined
        const scenarioFilter = sameFloor ? {
          relationIds: new Set([...viewModel.scenarioFilter.relationIds, ...previousRelationIds!]),
          nodeIds: new Set([...viewModel.scenarioFilter.nodeIds, ...previousNodeIds!]),
        } : viewModel.scenarioFilter
        const variant = shotIndex % 2 === 0 ? 'a' : 'b'
        const expands = sameFloor && previousView!.floorIds.length > 1 && viewModel.floorIds.length === 1
        const contracts = sameFloor && previousView!.floorIds.length === 1 && viewModel.floorIds.length > 1
        const transitionClass = shot.transition?.kind === 'cut' ? ''
          : shot.transition?.kind === 'fade' || !sameFloor ? `is-fade-${variant}`
            : expands ? `is-expand-${previousFloorIndex === 0 ? 'top' : 'bottom'}`
              : contracts ? `is-contract-${index === 0 ? 'top' : 'bottom'}`
              : 'is-pan'
        const cameraTransitionMs = transitionClass === 'is-pan' || transitionClass.startsWith('is-expand-') || transitionClass.startsWith('is-contract-') ? layoutTransitionMs : 0
        return <article className={`cinema-view slot-${slot} ${transitionClass}`} key={floorId} aria-label={`${role}: ${floor?.name ?? floorId}`}>
          <CinemaFloorLocator document={document} floorId={floorId} role={role} />
          <div className="cinema-concept-details">{concepts.map((concept) => concept ? <section key={concept.id}><span>{concept.code}</span><h3>{concept.name}</h3>{concept.whatItDoes ? <p>{concept.whatItDoes}</p> : null}{concept.howItsBuilt ? <small>{concept.howItsBuilt}</small> : null}</section> : null)}</div>
          <IsoCanvas document={document} floorId={floorId} svgId={`cinema-${index}-${floorId}`} selection={null} activeFlowId={flow.id} flowProgram={program} editable={false} stepDisplayMode="current" relationPreview={null} stagePreviewTarget={null} relationPickIds={null} onPickRelation={noop} onSelect={noop} onMoveNode={noop} onMoveGroup={noop} onMoveGroupFlag={noop} connectionDraft={null} onToggleConnectionTarget={noop} viewportInsets={singleInsets} dezoom={viewModel.floorIds.length > 1 ? 1.2 : 1} cameraTransitionMs={cameraTransitionMs} scenarioFilter={scenarioFilter} fadedRelationIds={previousRelationIds} fadedNodeIds={previousNodeIds} focusNodeIds={viewModel.focusNodeIds} showGrid={flow.showGrid !== false} cinemaSequence={sequence} hideNodeLabels />
        </article>
      })}
      {previousView ? outgoingViews.map(({ floorId, slot }, index) => {
        const previousRuntimeShot = program.stages[shotIndex - 1]!
        const hasSource = previousRuntimeShot.sourceIds.some((id) => nodeById.get(id)?.floorId === floorId)
        const hasTarget = previousRuntimeShot.targetIds.some((id) => nodeById.get(id)?.floorId === floorId)
        const role = hasSource && hasTarget ? 'Local path' : hasSource ? 'Departure' : 'Arrival'
        const concepts = [...previousView.focusNodeIds].map((id) => nodeById.get(id)).filter((node) => node?.floorId === floorId)
        return <article className={`cinema-view is-exiting from-layout-${previousView.layout} slot-${slot}`} key={`outgoing-${shotIndex}-${floorId}`} aria-hidden="true">
          <CinemaFloorLocator document={document} floorId={floorId} role={role} />
          <div className="cinema-concept-details">{concepts.map((concept) => concept ? <section key={concept.id}><span>{concept.code}</span><h3>{concept.name}</h3>{concept.whatItDoes ? <p>{concept.whatItDoes}</p> : null}{concept.howItsBuilt ? <small>{concept.howItsBuilt}</small> : null}</section> : null)}</div>
          <IsoCanvas document={document} floorId={floorId} svgId={`cinema-outgoing-${index}-${floorId}`} selection={null} activeFlowId={null} flowProgram={null} editable={false} stepDisplayMode="none" relationPreview={null} stagePreviewTarget={null} relationPickIds={null} onPickRelation={noop} onSelect={noop} onMoveNode={noop} onMoveGroup={noop} onMoveGroupFlag={noop} connectionDraft={null} onToggleConnectionTarget={noop} viewportInsets={singleInsets} dezoom={previousView.floorIds.length > 1 ? 1.2 : 1} cameraTransitionMs={0} scenarioFilter={previousView.scenarioFilter} focusNodeIds={previousView.focusNodeIds} showGrid={flow.showGrid !== false} hideNodeLabels />
        </article>
      }) : null}
    </div>
    <CinemaFooter />
  </section>
}
