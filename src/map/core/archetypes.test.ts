import { describe, expect, it } from 'vitest'
import type { Archetype } from '../../domain/types'
import { buildingFaces } from './archetypes'

const FORMS: Archetype[] = ['cube', 'tower', 'low-slab', 'slab-stack', 'fin-row', 'podium-tower', 'twin-towers', 'courtyard', 'bridge', 'stepped-pyramid', 'server-rack', 'monitor', 'camera', 'database']

describe('building archetypes', () => {
  it.each(FORMS)('builds finite faces for %s', (archetype) => {
    const faces = buildingFaces(archetype, { gx: 0, gy: 0, w: 4.8, d: 4 }, 4, 5)
    expect(faces.length).toBeGreaterThan(0)
    expect(faces.flatMap((face) => face.points).every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true)
  })

  it('gives the composite forms distinct structures', () => {
    const faceCounts = new Set(['podium-tower', 'twin-towers', 'courtyard', 'bridge', 'stepped-pyramid'].map((archetype) => buildingFaces(archetype as Archetype, { gx: 0, gy: 0, w: 4.8, d: 4 }, 4, 5).length))
    expect(faceCounts.size).toBeGreaterThanOrEqual(3)
  })
})
