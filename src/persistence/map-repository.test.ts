import { describe, expect, it } from 'vitest'
import { cloneSample } from '../domain/sample'
import { migrateDocument } from './map-repository'

describe('map migrations', () => {
  it('adds automatic face texture to version 1 documents', () => {
    const legacy = structuredClone(cloneSample()) as unknown as Record<string, unknown>
    legacy.schemaVersion = 1
    legacy.nodes = (legacy.nodes as Record<string, unknown>[]).map((node) => {
      const copy = { ...node }
      delete copy.faceTexture
      return copy
    })
    const migrated = migrateDocument(legacy)
    expect(migrated?.schemaVersion).toBe(2)
    expect(migrated?.nodes.every((node) => node.faceTexture === 'auto')).toBe(true)
  })
})
