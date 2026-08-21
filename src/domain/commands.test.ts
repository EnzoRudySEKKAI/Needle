import { describe, expect, it } from 'vitest'
import { cloneSample } from './sample'
import { deleteGroupCascade } from './commands'
import { flowRelationIds } from './flows'

describe('ontology commands', () => {
  it('deletes a neighborhood and every dependent path', () => {
    const result = deleteGroupCascade(cloneSample(), 'decision')
    expect(result.groups.some((group) => group.id === 'decision')).toBe(false)
    expect(result.nodes.some((node) => node.groupId === 'decision')).toBe(false)
    expect(result.relations.some((relation) => ['review', 'dispatch'].includes(relation.from) || ['review', 'dispatch'].includes(relation.to))).toBe(false)
    expect(result.flows.flatMap(flowRelationIds)).not.toContain('review-dispatch')
  })

  it('allows the last empty neighborhood to be removed', () => {
    const document = cloneSample()
    document.groups = [{ id: 'empty', name: 'Empty', description: '' }]
    document.nodes = []
    document.relations = []
    document.flows = []
    expect(deleteGroupCascade(document, 'empty').groups).toEqual([])
  })
})
