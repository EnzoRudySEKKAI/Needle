import type { OntologyFlow } from '../../domain/types'
import { activeStepIndex, flowPosition, type FlowProgram } from '../core/program'
import { pointsAttribute } from '../core/iso'
import { useClockState } from '../stores/flow-clock'

export function FlowAnimation({ program, flow }: { program: FlowProgram; flow: OntologyFlow }) {
  const clock = useClockState()
  const time = clock.program?.id === program.id ? clock.time : 0
  const position = flowPosition(program, time)
  const activeIndex = activeStepIndex(program, time)

  return (
    <g className="flow-animation" aria-hidden="true">
      {program.steps.map((step, index) => (
        <g key={step.relationId} className={index === activeIndex ? 'is-current' : index < activeIndex ? 'is-visited' : 'is-upcoming'}>
          <polyline points={pointsAttribute(step.geometry.points)} className="flow-trace" vectorEffect="non-scaling-stroke" />
          <g transform={`translate(${step.geometry.points[Math.floor(step.geometry.points.length / 2)]?.x ?? 0} ${step.geometry.points[Math.floor(step.geometry.points.length / 2)]?.y ?? 0})`}>
            <circle r="8" className="step-disc" vectorEffect="non-scaling-stroke" />
            <text className="step-number" textAnchor="middle" dominantBaseline="central">{index + 1}</text>
          </g>
        </g>
      ))}
      <circle cx={position.x} cy={position.y} r="9" className="payload-halo" />
      <circle cx={position.x} cy={position.y} r="4.5" className="payload-dot"><title>{flow.payload}</title></circle>
    </g>
  )
}
