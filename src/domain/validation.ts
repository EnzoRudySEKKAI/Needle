import type { OntologyDocument } from './types'

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
    if (!Number.isFinite(node.metric) || node.metric < 0) diagnostics.push({ level: 'error', message: `${node.name} has an invalid metric.`, target: { kind: 'node', id: node.id } })
  }
  for (const relation of document.relations) {
    if (!nodeIds.has(relation.from) || !nodeIds.has(relation.to)) diagnostics.push({ level: 'error', message: `${relation.label} points to a missing concept.`, target: { kind: 'relation', id: relation.id } })
  }
  for (const flow of document.flows) {
    let expectedFrom: string | null = null
    for (const relationId of flow.relationIds) {
      const relation = relationById.get(relationId)
      if (!relation) {
        diagnostics.push({ level: 'error', message: `${flow.name} uses a missing relation.`, target: { kind: 'flow', id: flow.id } })
        break
      }
      if (expectedFrom !== null && relation.from !== expectedFrom) {
        diagnostics.push({ level: 'error', message: `${flow.name} is not a continuous path.`, target: { kind: 'flow', id: flow.id } })
        break
      }
      expectedFrom = relation.to
    }
  }
  return diagnostics
}

export function isOntologyDocument(value: unknown): value is OntologyDocument {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<OntologyDocument>
  return candidate.schemaVersion === 2 && typeof candidate.id === 'string' && Array.isArray(candidate.groups) && Array.isArray(candidate.nodes) && Array.isArray(candidate.relations) && Array.isArray(candidate.flows)
}
