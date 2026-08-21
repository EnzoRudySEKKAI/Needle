import type { OntologyFlow, OntologyRelation, VisualNode } from '../../domain/types'
import { pointAtLength, type ScreenPoint } from './iso'
import type { RelationGeometry } from './routes'

export type FlowStep = { relationId: string; fromId: string; toId: string; start: number; duration: number; geometry: RelationGeometry }
export type FlowProgram = { id: string; total: number; steps: FlowStep[]; nodeIds: string[] }

const DWELL = 850

export function buildFlowProgram(flow: OntologyFlow, nodes: readonly VisualNode[], relations: readonly OntologyRelation[], geometry: ReadonlyMap<string, RelationGeometry>): FlowProgram | null {
  const relationById = new Map(relations.map((relation) => [relation.id, relation]))
  const nodeIds = new Set(nodes.map((node) => node.id))
  const steps: FlowStep[] = []
  let at = DWELL
  for (const relationId of flow.relationIds) {
    const relation = relationById.get(relationId)
    const route = geometry.get(relationId)
    if (!relation || !route || !nodeIds.has(relation.from) || !nodeIds.has(relation.to)) return null
    const duration = Math.max(900, Math.min(2100, route.total * 5))
    steps.push({ relationId, fromId: relation.from, toId: relation.to, start: at, duration, geometry: route })
    at += duration + DWELL
  }
  if (steps.length === 0) return null
  return { id: flow.id, total: at + 900, steps, nodeIds: [steps[0]!.fromId, ...steps.map((step) => step.toId)] }
}

export function flowPosition(program: FlowProgram, time: number): ScreenPoint {
  const wrapped = time % program.total
  const first = program.steps[0]!
  if (wrapped < first.start) return first.geometry.points[0]!
  for (const step of program.steps) {
    if (wrapped <= step.start + step.duration) {
      const progress = Math.max(0, Math.min(1, (wrapped - step.start) / step.duration))
      const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2
      return pointAtLength(step.geometry.points, step.geometry.cumulative, eased * step.geometry.total)
    }
    if (wrapped < step.start + step.duration + DWELL) return step.geometry.points[step.geometry.points.length - 1]!
  }
  const last = program.steps[program.steps.length - 1]!
  return last.geometry.points[last.geometry.points.length - 1]!
}

export function activeStepIndex(program: FlowProgram, time: number): number {
  const wrapped = time % program.total
  return program.steps.findIndex((step) => wrapped >= step.start && wrapped <= step.start + step.duration)
}
