import { SCHEMA_VERSION, STRUCTURE_TYPES, type BuildingSize, type OntologyDocument, type Selection, type StructureType } from './types'

const BUILDING_SIZES = new Set<BuildingSize>(['xs', 's', 'm', 'l', 'xl'])
const VALID_STRUCTURE_TYPES = new Set<StructureType>(STRUCTURE_TYPES)

export type Diagnostic = {
  level: 'error' | 'warning'
  message: string
  target?: Selection
}

function duplicates(values: string[]): Set<string> {
  const seen = new Set<string>()
  const duplicate = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) duplicate.add(value)
    seen.add(value)
  }
  return duplicate
}

export function validateDocument(document: OntologyDocument): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const floorIds = new Set(document.floors.map((floor) => floor.id))
  const groupIds = new Set(document.groups.map((group) => group.id))
  const nodeIds = new Set(document.nodes.map((node) => node.id))
  const relationById = new Map(document.relations.map((relation) => [relation.id, relation]))
  for (const id of duplicates(document.nodes.map((node) => node.id))) diagnostics.push({ level: 'error', message: `Duplicate node id: ${id}` })
  for (const code of duplicates(document.nodes.map((node) => node.code))) diagnostics.push({ level: 'warning', message: `Duplicate roof code: ${code}` })
  for (const node of document.nodes) {
    if (!floorIds.has(node.floorId)) diagnostics.push({ level: 'error', message: `${node.name} has no valid floor.`, target: { kind: 'node', id: node.id } })
    if (!groupIds.has(node.groupId)) diagnostics.push({ level: 'error', message: `${node.name} has no valid neighborhood.`, target: { kind: 'node', id: node.id } })
    if (!BUILDING_SIZES.has(node.size)) diagnostics.push({ level: 'error', message: `${node.name} has an invalid size.`, target: { kind: 'node', id: node.id } })
  }
  for (const relation of document.relations) {
    if (!nodeIds.has(relation.from) || !nodeIds.has(relation.to)) diagnostics.push({ level: 'error', message: `${relation.label} points to a missing concept.`, target: { kind: 'relation', id: relation.id } })
  }
  for (const flow of document.flows) {
    for (const stage of flow.stages) {
      if (stage.traversals.length === 0) {
        diagnostics.push({ level: 'error', message: `${flow.name} contains an empty step.`, target: { kind: 'flow', id: flow.id } })
        continue
      }
      for (const traversal of stage.traversals) {
        const relation = relationById.get(traversal.relationId)
        if (!relation) {
          diagnostics.push({ level: 'error', message: `${flow.name} uses a missing relation.`, target: { kind: 'flow', id: flow.id } })
          continue
        }
      }
    }
  }
  return diagnostics
}

export function isOntologyDocument(value: unknown): value is OntologyDocument {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<OntologyDocument>
  if (candidate.schemaVersion !== SCHEMA_VERSION || typeof candidate.id !== 'string' || !VALID_STRUCTURE_TYPES.has(candidate.structureType as StructureType) || !Array.isArray(candidate.floors) || !Array.isArray(candidate.groups) || !Array.isArray(candidate.nodes) || !Array.isArray(candidate.relations) || !Array.isArray(candidate.flows)) return false
  if ('metricLabel' in candidate) return false
  const floorsValid = candidate.floors.length > 0 && candidate.floors.every((value) => {
    if (!value || typeof value !== 'object') return false
    const floor = value as unknown as Record<string, unknown>
    if (typeof floor.id !== 'string' || typeof floor.name !== 'string' || !floor.groupFlagPositions || typeof floor.groupFlagPositions !== 'object' || Array.isArray(floor.groupFlagPositions)) return false
    return Object.values(floor.groupFlagPositions).every((position) => {
      if (!position || typeof position !== 'object') return false
      const point = position as Record<string, unknown>
      return typeof point.gx === 'number' && Number.isFinite(point.gx) && typeof point.gy === 'number' && Number.isFinite(point.gy)
    })
  })
  const nodesValid = candidate.nodes.every((value) => {
    if (!value || typeof value !== 'object') return false
    const node = value as unknown as Record<string, unknown>
    return typeof node.id === 'string' && typeof node.floorId === 'string' && BUILDING_SIZES.has(node.size as BuildingSize) && Array.isArray(node.properties) && !('metric' in node) && !('unit' in node) && !('role' in node) && !('kind' in node)
  })
  return floorsValid && nodesValid && candidate.relations.every((value) => Boolean(value && typeof value === 'object' && !('via' in value)))
}
