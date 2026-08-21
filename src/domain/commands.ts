import type { OntologyDocument } from './types'

export function deleteGroupCascade(document: OntologyDocument, groupId: string): OntologyDocument {
  const removedNodeIds = new Set(document.nodes.filter((node) => node.groupId === groupId).map((node) => node.id))
  const removedRelationIds = new Set(document.relations.filter((relation) => removedNodeIds.has(relation.from) || removedNodeIds.has(relation.to)).map((relation) => relation.id))
  return {
    ...document,
    groups: document.groups.filter((group) => group.id !== groupId),
    nodes: document.nodes.filter((node) => !removedNodeIds.has(node.id)),
    relations: document.relations.filter((relation) => !removedRelationIds.has(relation.id)),
    flows: document.flows.map((flow) => ({
      ...flow,
      stages: flow.stages
        .map((stage) => ({ ...stage, traversals: stage.traversals.filter((traversal) => !removedRelationIds.has(traversal.relationId)) }))
        .filter((stage) => stage.traversals.length > 0),
    })),
  }
}
