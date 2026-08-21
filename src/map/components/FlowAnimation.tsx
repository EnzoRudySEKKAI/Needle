import type { OntologyFlow } from '../../domain/types'
import { activeStageState, flowPositions, type FlowProgram } from '../core/program'
import { pointsAttribute } from '../core/iso'
import { useClockState } from '../stores/flow-clock'

export function FlowAnimation({ program, flow }: { program: FlowProgram; flow: OntologyFlow }) {
  const clock = useClockState()
  const time = clock.program?.id === program.id ? clock.time : 0
  const positions = flowPositions(program, time)
  const activeIndex = activeStageState(program, time).index

  return (
    <g className="flow-animation" aria-hidden="true">
      {program.stages.map((stage, index) => stage.branches.map((branch, branchIndex) => (
        <g key={branch.traversalId} className={index === activeIndex ? 'is-current' : index < activeIndex ? 'is-visited' : 'is-upcoming'}>
          <polyline points={pointsAttribute(branch.geometry.points)} className="flow-trace" vectorEffect="non-scaling-stroke" />
          <path d="M 0 0 L -7 3.5 L -7 -3.5 Z" className="flow-arrow" transform={`translate(${branch.geometry.points[branch.geometry.points.length - 1]!.x} ${branch.geometry.points[branch.geometry.points.length - 1]!.y}) rotate(${Math.atan2(branch.geometry.points[branch.geometry.points.length - 1]!.y - (branch.geometry.points[branch.geometry.points.length - 2] ?? branch.geometry.points[branch.geometry.points.length - 1]!).y, branch.geometry.points[branch.geometry.points.length - 1]!.x - (branch.geometry.points[branch.geometry.points.length - 2] ?? branch.geometry.points[branch.geometry.points.length - 1]!).x) * 180 / Math.PI})`} />
          <g transform={`translate(${branch.geometry.points[Math.floor(branch.geometry.points.length / 2)]?.x ?? 0} ${branch.geometry.points[Math.floor(branch.geometry.points.length / 2)]?.y ?? 0})`}>
            <circle r="8" className="step-disc" vectorEffect="non-scaling-stroke" />
            <text className="step-number" textAnchor="middle" dominantBaseline="central">{index + 1}{stage.branches.length > 1 ? String.fromCharCode(97 + branchIndex) : ''}</text>
          </g>
        </g>
      )))}
      {positions.map((position, index) => <g key={program.stages[activeIndex]?.branches[index]?.traversalId ?? index}><circle cx={position.x} cy={position.y} r="9" className="payload-halo" /><circle cx={position.x} cy={position.y} r="4.5" className="payload-dot"><title>{flow.payload}</title></circle></g>)}
    </g>
  )
}
