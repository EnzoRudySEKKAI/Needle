import type { OntologyFlow } from '../../domain/types'
import { activeStageState, flowPositions, type FlowProgram } from '../core/program'
import { pointAtLength, pointsAttribute } from '../core/iso'
import type { StepDisplayMode } from '../core/step-display'
import { useClockState } from '../stores/flow-clock'

export function FlowAnimation({ program, flow, stepDisplayMode, arrivalIds, cinemaSequence, fadedRelationIds }: { program: FlowProgram; flow: OntologyFlow; stepDisplayMode: StepDisplayMode; arrivalIds?: ReadonlySet<string>; cinemaSequence?: 'departure' | 'arrival' | 'local'; fadedRelationIds?: ReadonlySet<string> }) {
  const clock = useClockState()
  const time = clock.program?.id === program.id ? clock.time : 0
  const started = clock.program?.id === program.id && clock.started
  const playbackState = started ? activeStageState(program, time) : null
  const activeStage = playbackState ? program.stages[playbackState.index]! : null
  const sequenceSplit = activeStage ? activeStage.travelStart + (activeStage.end - activeStage.travelStart) / 2 : 0
  const sequenceVisible = !cinemaSequence || cinemaSequence === 'local' || (cinemaSequence === 'departure' ? time < sequenceSplit : time >= sequenceSplit)
  const positions = (() => {
    if (!started || !sequenceVisible) return [] as ReturnType<typeof flowPositions>
    if (activeStage && cinemaSequence === 'departure') {
      const progress = Math.max(0, Math.min(1, (time - activeStage.travelStart) / Math.max(1, sequenceSplit - activeStage.travelStart)))
      const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2
      return activeStage.branches.map((branch) => pointAtLength(branch.geometry.points, branch.geometry.cumulative, eased * branch.geometry.total))
    }
    if (activeStage && cinemaSequence === 'arrival') {
      const progress = Math.max(0, Math.min(1, (time - sequenceSplit) / Math.max(1, activeStage.end - sequenceSplit)))
      const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2
      return activeStage.branches.map((branch) => arrivalIds?.has(branch.relationId)
        ? pointAtLength(branch.geometry.points, branch.geometry.cumulative, eased * branch.geometry.total)
        : branch.geometry.points[branch.geometry.points.length - 1]!)
    }
    if (!arrivalIds || arrivalIds.size === 0) return flowPositions(program, time)
    const wrapped = Math.max(0, Math.min(time, program.total))
    const { index, phase } = playbackState!
    if (phase !== 'target') return flowPositions(program, time)
    const stage = program.stages[index]!
    return stage.branches.map((branch) => {
      if (!arrivalIds.has(branch.relationId)) return branch.geometry.points[branch.geometry.points.length - 1]!
      const progress = Math.max(0, Math.min(1, (wrapped - stage.targetStart) / Math.max(1, stage.end - stage.targetStart)))
      const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2
      return pointAtLength(branch.geometry.points, branch.geometry.cumulative, eased * branch.geometry.total)
    })
  })()
  const activeIndex = playbackState?.index ?? -1
  const markers = program.stages.flatMap((stage, stageIndex) => stage.branches.map((branch, branchIndex) => ({
    branch,
    branchIndex,
    label: `${stageIndex + 1}${stage.branches.length > 1 ? String.fromCharCode(97 + branchIndex) : ''}`,
    stageIndex,
  })))
  const markersByRelation = new Map<string, typeof markers>()
  for (const marker of markers) {
    const related = markersByRelation.get(marker.branch.relationId) ?? []
    related.push(marker)
    markersByRelation.set(marker.branch.relationId, related)
  }

  return (
    <g className="flow-animation" aria-hidden="true">
      {program.stages.map((stage, index) => stage.branches.map((branch) => (
        <g key={branch.traversalId} className={`${index === activeIndex ? 'is-current' : index < activeIndex ? 'is-visited' : 'is-upcoming'} ${index === activeIndex && !sequenceVisible ? 'is-sequence-hidden' : ''} ${fadedRelationIds?.has(branch.relationId) ? 'is-cinema-previous' : ''}`}>
          <polyline points={pointsAttribute(branch.geometry.points)} className="flow-trace" vectorEffect="non-scaling-stroke" />
          <path d="M 0 0 L -7 3.5 L -7 -3.5 Z" className="flow-arrow" transform={`translate(${branch.geometry.points[branch.geometry.points.length - 1]!.x} ${branch.geometry.points[branch.geometry.points.length - 1]!.y}) rotate(${Math.atan2(branch.geometry.points[branch.geometry.points.length - 1]!.y - (branch.geometry.points[branch.geometry.points.length - 2] ?? branch.geometry.points[branch.geometry.points.length - 1]!).y, branch.geometry.points[branch.geometry.points.length - 1]!.x - (branch.geometry.points[branch.geometry.points.length - 2] ?? branch.geometry.points[branch.geometry.points.length - 1]!).x) * 180 / Math.PI})`} />
        </g>
      )))}
      {markers.filter((marker) => !cinemaSequence && sequenceVisible && (stepDisplayMode === 'all' || (stepDisplayMode === 'current' && marker.stageIndex === activeIndex))).map((marker) => {
        const related = markersByRelation.get(marker.branch.relationId)!
        const slot = related.indexOf(marker)
        const route = related[0]!.branch.geometry
        const position = pointAtLength(route.points, route.cumulative, route.total * (slot + 1) / (related.length + 1))
        return <g key={`step-${marker.branch.traversalId}`} className={marker.stageIndex === activeIndex ? 'is-current' : marker.stageIndex < activeIndex ? 'is-visited' : 'is-upcoming'} transform={`translate(${position.x} ${position.y})`}><circle r="8" className="step-disc" vectorEffect="non-scaling-stroke" /><text className="step-number" textAnchor="middle" dominantBaseline="central">{marker.label}</text></g>
      })}
      {positions.map((position, index) => <g key={program.stages[activeIndex]?.branches[index]?.traversalId ?? index}><circle cx={position.x} cy={position.y} r="9" className="payload-halo" /><circle cx={position.x} cy={position.y} r="4.5" className="payload-dot"><title>{flow.payload}</title></circle></g>)}
    </g>
  )
}
