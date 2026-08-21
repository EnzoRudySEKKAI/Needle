import type { OntologyDocument, OntologyFloor, OntologyGroup, OntologyNode, OntologyRelation } from './types'

export type FloorProjection = {
  floor: OntologyFloor
  nodes: OntologyNode[]
  groups: OntologyGroup[]
  relations: OntologyRelation[]
  crossFloorRelations: OntologyRelation[]
}

export function projectFloor(document: OntologyDocument, floorId: string): FloorProjection | null {
  const floor = document.floors.find((candidate) => candidate.id === floorId)
  if (!floor) return null
  const nodes = document.nodes.filter((node) => node.floorId === floorId)
  const nodeIds = new Set(nodes.map((node) => node.id))
  const groupIds = new Set(nodes.map((node) => node.groupId))
  const relations = document.relations.filter((relation) => nodeIds.has(relation.from) && nodeIds.has(relation.to))
  const crossFloorRelations = document.relations.filter((relation) => nodeIds.has(relation.from) !== nodeIds.has(relation.to))
  return { floor, nodes, groups: document.groups.filter((group) => groupIds.has(group.id)), relations, crossFloorRelations }
}

export function floorForNode(document: OntologyDocument, nodeId: string): OntologyFloor | null {
  const floorId = document.nodes.find((node) => node.id === nodeId)?.floorId
  return document.floors.find((floor) => floor.id === floorId) ?? null
}
