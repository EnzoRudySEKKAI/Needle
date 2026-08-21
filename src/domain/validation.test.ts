import { describe, expect, it } from 'vitest'
import { cloneSample } from './sample'
import { validateDocument } from './validation'

describe('ontology validation', () => {
  it('accepts the demonstration map', () => {
    expect(validateDocument(cloneSample())).toEqual([])
  })

  it('reports a discontinuous scenario', () => {
    const document = cloneSample()
    document.flows[0]!.relationIds = ['ob-intake', 'review-dispatch']
    expect(validateDocument(document)).toContainEqual(expect.objectContaining({ message: 'Raise an alert is not a continuous path.' }))
  })

  it('reports a relation to a missing concept', () => {
    const document = cloneSample()
    document.relations[0]!.to = 'missing'
    expect(validateDocument(document)).toContainEqual(expect.objectContaining({ message: 'field report points to a missing concept.' }))
  })
})
