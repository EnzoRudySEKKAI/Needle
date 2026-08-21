import { describe, expect, it } from 'vitest'
import type { VisualNode } from '../../domain/types'
import { closestAnchorPair } from './routes'

function node(id: string, gx: number, gy: number): VisualNode {
  return { id, code: id, name: id, role: '', groupId: 'g', kind: 'concept', whatItDoes: '', howItsBuilt: '', size: 'm', properties: [], position: { gx, gy }, faceTexture: 'plain', archetype: 'cube', footprint: { gx, gy, w: 2, d: 2 }, height: 2 }
}

describe('dynamic relation anchors', () => {
  it('uses east and west ports for horizontal neighbors', () => {
    const pair = closestAnchorPair(node('a', 0, 0), node('b', 6, 0))
    expect(pair.fromSide).toBe('east')
    expect(pair.toSide).toBe('west')
  })

  it('uses south and north ports for vertical neighbors', () => {
    const pair = closestAnchorPair(node('a', 0, 0), node('b', 0, 6))
    expect(pair.fromSide).toBe('south')
    expect(pair.toSide).toBe('north')
  })

  it('chooses ports nearest authored waypoints', () => {
    const pair = closestAnchorPair(node('a', 0, 0), node('b', 6, 0), [{ gx: 1, gy: -4 }, { gx: 7, gy: -4 }])
    expect(pair.fromSide).toBe('north')
    expect(pair.toSide).toBe('north')
  })
})
