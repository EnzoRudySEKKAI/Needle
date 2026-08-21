import { describe, expect, it } from 'vitest'
import { cloneSample } from '../../domain/sample'
import { footprintsOverlap } from './iso'
import { deriveHeight, visualiseNodes } from './layout'

describe('derived map geometry', () => {
  it('gives every predefined size a distinct height', () => {
    const heights = (['xs', 's', 'm', 'l', 'xl'] as const).map((size) => deriveHeight(size, 'cube'))
    expect(new Set(heights).size).toBe(5)
    expect(deriveHeight('xl', 'tower')).toBeGreaterThan(deriveHeight('l', 'tower'))
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
