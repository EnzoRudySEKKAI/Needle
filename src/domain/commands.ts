import { makeId } from './id'
import type { FlowDirection, OntologyDocument } from './types'

export function addFlowTraversal(document: OntologyDocument, flowId: string, stageId: string | null, relationId: string, direction: FlowDirection): OntologyDocument {
  if (!document.relations.some((relation) => relation.id === relationId)) return document
  const flow = document.flows.find((candidate) => candidate.id === flowId)
  if (!flow) return document
  if (stageId === null) {
    const stage = { id: makeId('stage'), traversals: [{ id: makeId('traversal'), relationId, direction }] }
    return { ...document, flows: document.flows.map((candidate) => candidate.id === flowId ? { ...candidate, stages: [...candidate.stages, stage] } : candidate) }
  }
  const target = flow.stages.find((stage) => stage.id === stageId)
  if (!target || target.traversals.some((traversal) => traversal.relationId === relationId)) return document
  return {
    ...document,
    flows: document.flows.map((candidate) => candidate.id === flowId ? {
      ...candidate,
      stages: candidate.stages.map((stage) => stage.id === stageId ? { ...stage, traversals: [...stage.traversals, { id: makeId('traversal'), relationId, direction }] } : stage),
    } : candidate),
  }
}

export function moveFlowStage(document: OntologyDocument, flowId: string, stageId: string, beforeStageId: string | null): OntologyDocument {
  const flow = document.flows.find((candidate) => candidate.id === flowId)
  if (!flow || beforeStageId === stageId || flow.stages.filter((stage) => stage.id === stageId).length !== 1) return document
  if (beforeStageId !== null && flow.stages.filter((stage) => stage.id === beforeStageId).length !== 1) return document
  const source = flow.stages.find((stage) => stage.id === stageId)!
  const stages = flow.stages.filter((stage) => stage.id !== stageId)
  const destination = beforeStageId === null ? stages.length : stages.findIndex((stage) => stage.id === beforeStageId)
  if (destination < 0) return document
  stages.splice(destination, 0, source)
  if (stages.every((stage, index) => stage.id === flow.stages[index]?.id)) return document
  return { ...document, flows: document.flows.map((candidate) => candidate.id === flowId ? { ...candidate, stages } : candidate) }
}

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
