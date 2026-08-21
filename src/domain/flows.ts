import type { FlowTraversal, OntologyFlow, OntologyRelation } from './types'

export function resolveTraversal(traversal: FlowTraversal, relation: OntologyRelation): { sourceId: string; targetId: string } {
  return traversal.direction === 'forward'
    ? { sourceId: relation.from, targetId: relation.to }
    : { sourceId: relation.to, targetId: relation.from }
}

export function flowRelationIds(flow: OntologyFlow): string[] {
  return flow.stages.flatMap((stage) => stage.traversals.map((traversal) => traversal.relationId))
}

export function canAppendFlowFrom(flow: OntologyFlow, relations: readonly OntologyRelation[], sourceId: string): boolean {
  const lastStage = flow.stages[flow.stages.length - 1]
  if (!lastStage) return true
  const relationById = new Map(relations.map((relation) => [relation.id, relation]))
  return lastStage.traversals.some((traversal) => {
    const relation = relationById.get(traversal.relationId)
    return relation ? resolveTraversal(traversal, relation).targetId === sourceId : false
  })
}
