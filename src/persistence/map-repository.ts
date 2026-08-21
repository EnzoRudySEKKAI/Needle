import { cloneSample } from '../domain/sample'
import { isOntologyDocument } from '../domain/validation'
import { SCHEMA_VERSION, type BuildingSize, type OntologyDocument } from '../domain/types'

const PREFIX = 'needle:map:'
const INDEX_KEY = 'needle:map-index'
const SAMPLE_INITIALIZED_KEY = 'needle:sample-initialized'

export type MapSummary = Pick<OntologyDocument, 'id' | 'name' | 'description' | 'updatedAt'>

function readIndex(): MapSummary[] {
  try {
    const value = JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]') as unknown
    return Array.isArray(value) ? value as MapSummary[] : []
  } catch {
    return []
  }
}

export function listMaps(): MapSummary[] {
  return [...readIndex()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function loadMap(id: string): OntologyDocument | null {
  try {
    const value = JSON.parse(localStorage.getItem(`${PREFIX}${id}`) ?? 'null') as unknown
    const migrated = migrateDocument(value)
    if (migrated) saveMap(migrated)
    return migrated
  } catch {
    return null
  }
}

export function migrateDocument(value: unknown): OntologyDocument | null {
  if (isOntologyDocument(value)) return value
  if (!value || typeof value !== 'object') return null
  const legacy = value as Record<string, unknown>
  const legacyVersion = legacy.schemaVersion as number
  if (![1, 2, 3, 4].includes(legacyVersion) || !Array.isArray(legacy.nodes) || !Array.isArray(legacy.groups) || !Array.isArray(legacy.relations) || !Array.isArray(legacy.flows)) return null
  const sizeFromMetric = (metric: unknown): BuildingSize => {
    const value = typeof metric === 'number' && Number.isFinite(metric) ? metric : 0
    if (value <= 8) return 'xs'
    if (value <= 24) return 's'
    if (value <= 64) return 'm'
    if (value <= 159) return 'l'
    return 'xl'
  }
  const documentFields = { ...legacy }
  delete documentFields.metricLabel
  const migrated = {
    ...documentFields,
    schemaVersion: SCHEMA_VERSION,
    nodes: legacy.nodes.map((node) => {
      const nodeFields = { ...node as Record<string, unknown> }
      const metric = nodeFields.metric
      delete nodeFields.role
      delete nodeFields.kind
      delete nodeFields.metric
      delete nodeFields.unit
      return legacyVersion >= 4 ? nodeFields : { faceTexture: 'auto', ...nodeFields, size: sizeFromMetric(metric) }
    }),
    flows: legacyVersion >= 3 ? legacy.flows : legacy.flows.map((flow, flowIndex) => {
      const legacyFlow = flow as Record<string, unknown>
      const relationIds = Array.isArray(legacyFlow.relationIds) ? legacyFlow.relationIds : []
      const rest = { ...legacyFlow }
      delete rest.relationIds
      return {
        ...rest,
        stages: relationIds.map((relationId, stageIndex) => ({
          id: `migrated-${flowIndex}-${stageIndex}`,
          traversals: [{ id: `migrated-${flowIndex}-${stageIndex}-a`, relationId, direction: 'forward' }],
        })),
      }
    }),
  }
  return isOntologyDocument(migrated) ? migrated : null
}

export function saveMap(document: OntologyDocument): void {
  localStorage.setItem(`${PREFIX}${document.id}`, JSON.stringify(document))
  const summary: MapSummary = { id: document.id, name: document.name, description: document.description, updatedAt: document.updatedAt }
  const index = readIndex().filter((item) => item.id !== document.id)
  localStorage.setItem(INDEX_KEY, JSON.stringify([summary, ...index]))
}

export function deleteMap(id: string): void {
  localStorage.removeItem(`${PREFIX}${id}`)
  localStorage.setItem(INDEX_KEY, JSON.stringify(readIndex().filter((item) => item.id !== id)))
}

export function ensureSampleMap(): OntologyDocument {
  const existing = loadMap('signal-garden')
  if (existing) return existing
  const sample = cloneSample()
  saveMap(sample)
  return sample
}

export function initializeSampleMap(): void {
  if (localStorage.getItem(SAMPLE_INITIALIZED_KEY)) return
  ensureSampleMap()
  localStorage.setItem(SAMPLE_INITIALIZED_KEY, '1')
}

export function createBlankMap(name = 'Untitled ontology'): OntologyDocument {
  const id = `map-${crypto.randomUUID().slice(0, 8)}`
  const now = new Date().toISOString()
  const document: OntologyDocument = {
    schemaVersion: SCHEMA_VERSION,
    id,
    name,
    version: 'v0.1',
    description: 'Describe what this ontology helps people understand.',
    createdAt: now,
    updatedAt: now,
    groups: [{ id: 'first-neighborhood', name: 'First neighborhood', description: 'A place for related concepts.' }],
    nodes: [],
    relations: [],
    flows: [],
  }
  saveMap(document)
  return document
}
