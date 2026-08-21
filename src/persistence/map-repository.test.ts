import { describe, expect, it } from 'vitest'
import { cloneSample } from '../domain/sample'
import { migrateDocument } from './map-repository'

describe('map migrations', () => {
  it('adds automatic face texture to version 1 documents', () => {
    const legacy = structuredClone(cloneSample()) as unknown as Record<string, unknown>
    legacy.schemaVersion = 1
    legacy.flows = (legacy.flows as Record<string, unknown>[]).map((flow) => {
      const copy = { ...flow }
      copy.relationIds = (copy.stages as { traversals: { relationId: string }[] }[]).flatMap((stage) => stage.traversals.map((traversal) => traversal.relationId))
      delete copy.stages
      return copy
    })
    legacy.nodes = (legacy.nodes as Record<string, unknown>[]).map((node) => {
      const copy = { ...node }
      delete copy.faceTexture
      delete copy.size
      copy.metric = 12
      copy.unit = 'items'
      return copy
    })
    const migrated = migrateDocument(legacy)
    expect(migrated?.schemaVersion).toBe(6)
    expect(migrated?.nodes.every((node) => node.faceTexture === 'auto')).toBe(true)
    expect(migrated?.nodes.every((node) => node.size === 's' && !('metric' in node) && !('unit' in node))).toBe(true)
    expect(migrated?.flows[0]?.stages.length).toBeGreaterThan(0)
  })
})
