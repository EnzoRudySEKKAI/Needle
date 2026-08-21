import type { FlowTraversal, OntologyFlow, OntologyRelation } from './types'

export function resolveTraversal(traversal: FlowTraversal, relation: OntologyRelation): { sourceId: string; targetId: string } {
  return traversal.direction === 'forward'
    ? { sourceId: relation.from, targetId: relation.to }
    : { sourceId: relation.to, targetId: relation.from }
}

export function flowRelationIds(flow: OntologyFlow): string[] {
  return flow.stages.flatMap((stage) => stage.traversals.map((traversal) => traversal.relationId))
}
