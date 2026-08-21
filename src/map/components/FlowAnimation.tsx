import type { OntologyFlow } from '../../domain/types'
import { activeStageState, flowPositions, type FlowProgram } from '../core/program'
import { pointAtLength, pointsAttribute } from '../core/iso'
import { useClockState } from '../stores/flow-clock'

export function FlowAnimation({ program, flow, editable }: { program: FlowProgram; flow: OntologyFlow; editable: boolean }) {
  const clock = useClockState()
  const time = clock.program?.id === program.id ? clock.time : 0
  const positions = flowPositions(program, time)
  const activeIndex = activeStageState(program, time).index
  const showAllSteps = editable || clock.program?.id !== program.id || !clock.playing
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
        <g key={branch.traversalId} className={index === activeIndex ? 'is-current' : index < activeIndex ? 'is-visited' : 'is-upcoming'}>
          <polyline points={pointsAttribute(branch.geometry.points)} className="flow-trace" vectorEffect="non-scaling-stroke" />
          <path d="M 0 0 L -7 3.5 L -7 -3.5 Z" className="flow-arrow" transform={`translate(${branch.geometry.points[branch.geometry.points.length - 1]!.x} ${branch.geometry.points[branch.geometry.points.length - 1]!.y}) rotate(${Math.atan2(branch.geometry.points[branch.geometry.points.length - 1]!.y - (branch.geometry.points[branch.geometry.points.length - 2] ?? branch.geometry.points[branch.geometry.points.length - 1]!).y, branch.geometry.points[branch.geometry.points.length - 1]!.x - (branch.geometry.points[branch.geometry.points.length - 2] ?? branch.geometry.points[branch.geometry.points.length - 1]!).x) * 180 / Math.PI})`} />
        </g>
      )))}
      {markers.filter((marker) => showAllSteps || marker.stageIndex === activeIndex).map((marker) => {
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
