import { cloneSample } from '../domain/sample'
import { isOntologyDocument } from '../domain/validation'
import { SCHEMA_VERSION, type OntologyDocument } from '../domain/types'

const PREFIX = 'needle:map:'
const INDEX_KEY = 'needle:map-index'

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
  if (legacy.schemaVersion !== 1 || !Array.isArray(legacy.nodes) || !Array.isArray(legacy.groups) || !Array.isArray(legacy.relations) || !Array.isArray(legacy.flows)) return null
  const migrated = {
    ...legacy,
    schemaVersion: SCHEMA_VERSION,
    nodes: legacy.nodes.map((node) => ({ ...(node as object), faceTexture: 'auto' })),
  }
  return isOntologyDocument(migrated) ? migrated : null
}

export function saveMap(document: OntologyDocument): void {
  localStorage.setItem(`${PREFIX}${document.id}`, JSON.stringify(document))
  const summary: MapSummary = { id: document.id, name: document.name, description: document.description, updatedAt: document.updatedAt }
  const index = readIndex().filter((item) => item.id !== document.id)
  localStorage.setItem(INDEX_KEY, JSON.stringify([summary, ...index]))
}

export function ensureSampleMap(): OntologyDocument {
  const existing = loadMap('signal-garden')
  if (existing) return existing
  const sample = cloneSample()
  saveMap(sample)
  return sample
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
    metricLabel: 'structural weight',
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
