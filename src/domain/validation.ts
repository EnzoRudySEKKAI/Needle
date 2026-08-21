import type { BuildingSize, OntologyDocument } from './types'

const BUILDING_SIZES = new Set<BuildingSize>(['xs', 's', 'm', 'l', 'xl'])

export type Diagnostic = {
  level: 'error' | 'warning'
  message: string
  target?: { kind: 'node' | 'relation' | 'flow'; id: string }
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
  const groupIds = new Set(document.groups.map((group) => group.id))
  const nodeIds = new Set(document.nodes.map((node) => node.id))
  const relationById = new Map(document.relations.map((relation) => [relation.id, relation]))

  for (const id of duplicates(document.nodes.map((node) => node.id))) diagnostics.push({ level: 'error', message: `Duplicate node id: ${id}` })
  for (const code of duplicates(document.nodes.map((node) => node.code))) diagnostics.push({ level: 'warning', message: `Duplicate roof code: ${code}` })
  for (const node of document.nodes) {
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
  if (candidate.schemaVersion !== 6 || typeof candidate.id !== 'string' || !Array.isArray(candidate.groups) || !Array.isArray(candidate.nodes) || !Array.isArray(candidate.relations) || !Array.isArray(candidate.flows)) return false
  if ('metricLabel' in candidate) return false
  const groupsValid = candidate.groups.every((value) => {
    if (!value || typeof value !== 'object') return false
    const flagPosition = (value as unknown as Record<string, unknown>).flagPosition
    if (flagPosition === undefined) return true
    if (!flagPosition || typeof flagPosition !== 'object') return false
    const point = flagPosition as Record<string, unknown>
    return typeof point.gx === 'number' && Number.isFinite(point.gx) && typeof point.gy === 'number' && Number.isFinite(point.gy)
  })
  const nodesValid = candidate.nodes.every((value) => {
    if (!value || typeof value !== 'object') return false
    const node = value as unknown as Record<string, unknown>
    return typeof node.id === 'string' && BUILDING_SIZES.has(node.size as BuildingSize) && Array.isArray(node.properties) && !('metric' in node) && !('unit' in node) && !('role' in node) && !('kind' in node)
  })
  return groupsValid && nodesValid && candidate.relations.every((value) => Boolean(value && typeof value === 'object' && !('via' in value)))
}
