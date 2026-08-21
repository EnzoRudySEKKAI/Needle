import type { OntologyDocument } from './types'

export function deleteRelationsCascade(document: OntologyDocument, relationIds: ReadonlySet<string>): OntologyDocument {
  return {
    ...document,
    relations: document.relations.filter((relation) => !relationIds.has(relation.id)),
    flows: document.flows.map((flow) => ({
      ...flow,
      stages: flow.stages
        .map((stage) => ({ ...stage, traversals: stage.traversals.filter((traversal) => !relationIds.has(traversal.relationId)) }))
        .filter((stage) => stage.traversals.length > 0),
    })),
  }
}

export function deleteNodeCascade(document: OntologyDocument, nodeId: string): OntologyDocument {
  const removedRelationIds = new Set(document.relations.filter((relation) => relation.from === nodeId || relation.to === nodeId).map((relation) => relation.id))
  return { ...deleteRelationsCascade(document, removedRelationIds), nodes: document.nodes.filter((node) => node.id !== nodeId) }
}

export function deleteGroupCascade(document: OntologyDocument, groupId: string): OntologyDocument {
  const removedNodeIds = new Set(document.nodes.filter((node) => node.groupId === groupId).map((node) => node.id))
  const removedRelationIds = new Set(document.relations.filter((relation) => removedNodeIds.has(relation.from) || removedNodeIds.has(relation.to)).map((relation) => relation.id))
  return {
    ...deleteRelationsCascade(document, removedRelationIds),
    groups: document.groups.filter((group) => group.id !== groupId),
    nodes: document.nodes.filter((node) => !removedNodeIds.has(node.id)),
  }
}
