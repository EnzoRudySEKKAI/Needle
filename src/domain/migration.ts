import { isOntologyDocument } from './validation'
import { SCHEMA_VERSION, type BuildingSize, type OntologyDocument } from './types'

const MIGRATED_FLOOR_ID = 'floor-1'

function migrateRelationKinds(relations: unknown): unknown {
  if (!Array.isArray(relations)) return relations
  return relations.map((relation) => {
    if (!relation || typeof relation !== 'object') return relation
    const fields = relation as Record<string, unknown>
    const kind = fields.kind === 'support' || fields.kind === 'retry' || fields.kind === 'dotted' ? 'dotted' : 'full'
    return { ...fields, kind }
  })
}

export function migrateDocument(value: unknown): OntologyDocument | null {
  if (!value || typeof value !== 'object') return null
  const legacy = value as Record<string, unknown>
  const legacyVersion = legacy.schemaVersion as number
  if (legacyVersion === SCHEMA_VERSION) {
    const current: Record<string, unknown> = { ...legacy, relations: migrateRelationKinds(legacy.relations) }
    delete current.comments
    return isOntologyDocument(current) ? current : null
  }
  if (legacyVersion === 8) {
    const migrated: Record<string, unknown> = { ...legacy, schemaVersion: SCHEMA_VERSION, relations: migrateRelationKinds(legacy.relations) }
    delete migrated.comments
    return isOntologyDocument(migrated) ? migrated : null
  }
  if (legacyVersion === 7) {
    const migrated: Record<string, unknown> = { ...legacy, schemaVersion: SCHEMA_VERSION, structureType: 'tower', relations: migrateRelationKinds(legacy.relations) }
    delete migrated.comments
    return isOntologyDocument(migrated) ? migrated : null
  }
  if (![1, 2, 3, 4, 5, 6].includes(legacyVersion) || !Array.isArray(legacy.nodes) || !Array.isArray(legacy.groups) || !Array.isArray(legacy.relations) || !Array.isArray(legacy.flows)) return null
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
  delete documentFields.floors
  delete documentFields.comments
  const groupFlagPositions: Record<string, { gx: number; gy: number }> = {}
  const groups = legacy.groups.map((group) => {
    const fields = { ...group as Record<string, unknown> }
    const position = fields.flagPosition as { gx?: unknown; gy?: unknown } | undefined
    if (position && typeof position.gx === 'number' && Number.isFinite(position.gx) && typeof position.gy === 'number' && Number.isFinite(position.gy)) groupFlagPositions[String(fields.id)] = { gx: position.gx, gy: position.gy }
    delete fields.flagPosition
    return fields
  })
  const migrated = {
    ...documentFields,
    schemaVersion: SCHEMA_VERSION,
    structureType: 'tower',
    floors: [{ id: MIGRATED_FLOOR_ID, name: 'Floor 1', groupFlagPositions }],
    groups,
    nodes: legacy.nodes.map((node) => {
      const nodeFields = { ...node as Record<string, unknown> }
      const metric = nodeFields.metric
      delete nodeFields.role
      delete nodeFields.kind
      delete nodeFields.metric
      delete nodeFields.unit
      const current = legacyVersion >= 4 ? nodeFields : { faceTexture: 'auto', ...nodeFields, size: sizeFromMetric(metric) }
      return { ...current, floorId: MIGRATED_FLOOR_ID }
    }),
    relations: (migrateRelationKinds(legacy.relations) as unknown[]).map((relation) => {
      const relationFields = { ...relation as Record<string, unknown> }
      delete relationFields.via
      return relationFields
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
