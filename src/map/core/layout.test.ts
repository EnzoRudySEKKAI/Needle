import { describe, expect, it } from 'vitest'
import { cloneSample } from '../../domain/sample'
import { footprintsOverlap } from './iso'
import { deriveHeight, visualiseNodes } from './layout'

describe('derived map geometry', () => {
  it('grows logarithmically and stays bounded', () => {
    expect(deriveHeight(0, 'cube')).toBe(1.2)
    expect(deriveHeight(100, 'cube')).toBeGreaterThan(deriveHeight(10, 'cube'))
    expect(deriveHeight(100_000, 'tower')).toBe(6)
  })

  it('keeps the authored sample footprints separate', () => {
    const nodes = visualiseNodes(cloneSample().nodes)
    for (let left = 0; left < nodes.length; left += 1) {
      for (let right = left + 1; right < nodes.length; right += 1) {
        expect(footprintsOverlap(nodes[left]!.footprint, nodes[right]!.footprint)).toBe(false)
      }
    }
  })
})
