import { resolveTraversal } from '../../domain/flows'
import type { FlowTraversal, OntologyFlow, OntologyRelation, VisualNode } from '../../domain/types'
import { pointAtLength, polylineLengths, type ScreenPoint } from './iso'
import type { RelationGeometry } from './routes'

export type ProgramBranch = {
  traversalId: string
  relationId: string
  sourceId: string
  targetId: string
  geometry: RelationGeometry
}

export type ProgramStage = {
  id: string
  start: number
  travelStart: number
  targetStart: number
  end: number
  duration: number
  branches: ProgramBranch[]
  sourceIds: string[]
  targetIds: string[]
}

export type FlowProgram = { id: string; total: number; stages: ProgramStage[]; nodeIds: string[] }
export type StagePhase = 'source' | 'travel' | 'target'

export const DWELL = 850

function geometryForTraversal(traversal: FlowTraversal, geometry: RelationGeometry): RelationGeometry {
  if (traversal.direction === 'forward') return geometry
  const points = [...geometry.points].reverse()
  const { cumulative, total } = polylineLengths(points)
  return { points, cumulative, total, fromSide: geometry.toSide, toSide: geometry.fromSide, labelPoint: geometry.labelPoint }
}

export function buildFlowProgram(flow: OntologyFlow, nodes: readonly VisualNode[], relations: readonly OntologyRelation[], geometry: ReadonlyMap<string, RelationGeometry>): FlowProgram | null {
  const relationById = new Map(relations.map((relation) => [relation.id, relation]))
  const nodeIds = new Set(nodes.map((node) => node.id))
  const stages: ProgramStage[] = []
  let at = 0
  for (const stage of flow.stages) {
    const branches: ProgramBranch[] = []
    for (const traversal of stage.traversals) {
      const relation = relationById.get(traversal.relationId)
      const baseGeometry = geometry.get(traversal.relationId)
      if (!relation || !baseGeometry) return null
      const { sourceId, targetId } = resolveTraversal(traversal, relation)
      if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) return null
      branches.push({ traversalId: traversal.id, relationId: relation.id, sourceId, targetId, geometry: geometryForTraversal(traversal, baseGeometry) })
    }
    if (branches.length === 0) return null
    const duration = Math.max(...branches.map((branch) => Math.max(900, Math.min(2100, branch.geometry.total * 5))))
    const start = at
    const travelStart = start + DWELL
    const targetStart = travelStart + duration
    const end = targetStart + DWELL
    stages.push({ id: stage.id, start, travelStart, targetStart, end, duration, branches, sourceIds: [...new Set(branches.map((branch) => branch.sourceId))], targetIds: [...new Set(branches.map((branch) => branch.targetId))] })
    at = end
  }
  if (stages.length === 0) return null
  return { id: flow.id, total: at + 900, stages, nodeIds: [...new Set(stages.flatMap((stage) => [...stage.sourceIds, ...stage.targetIds]))] }
}

export function activeStageState(program: FlowProgram, time: number): { index: number; phase: StagePhase } {
  const wrapped = ((time % program.total) + program.total) % program.total
  let index = 0
  for (let candidate = program.stages.length - 1; candidate >= 0; candidate -= 1) {
    if (wrapped >= program.stages[candidate]!.start) { index = candidate; break }
  }
  const stage = program.stages[index]!
  if (wrapped < stage.travelStart) return { index, phase: 'source' }
  if (wrapped < stage.targetStart) return { index, phase: 'travel' }
  return { index, phase: 'target' }
}

export function activeNodeIds(program: FlowProgram, time: number): Set<string> {
  const { index, phase } = activeStageState(program, time)
  return nodeIdsForStageState(program, index, phase)
}

export function nodeIdsForStageState(program: FlowProgram, index: number, phase: StagePhase): Set<string> {
  const stage = program.stages[index]!
  if (phase === 'source') return new Set(stage.sourceIds)
  if (phase === 'target') return new Set(stage.targetIds)
  return new Set([...stage.sourceIds, ...stage.targetIds])
}

export function flowPositions(program: FlowProgram, time: number): ScreenPoint[] {
  const wrapped = ((time % program.total) + program.total) % program.total
  const { index, phase } = activeStageState(program, wrapped)
  const stage = program.stages[index]!
  return stage.branches.map((branch) => {
    if (phase === 'source') return branch.geometry.points[0]!
    if (phase === 'target') return branch.geometry.points[branch.geometry.points.length - 1]!
    const progress = Math.max(0, Math.min(1, (wrapped - stage.travelStart) / stage.duration))
    const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2
    return pointAtLength(branch.geometry.points, branch.geometry.cumulative, eased * branch.geometry.total)
  })
}
