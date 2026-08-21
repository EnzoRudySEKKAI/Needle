import { describe, expect, it } from 'vitest'
import { cloneSample } from '../../domain/sample'
import { visualiseNodes } from './layout'
import { buildScene } from './scene'

describe('district flags', () => {
  it('reserves more frontage for a longer neighborhood name', () => {
    const document = cloneSample()
    const nodes = visualiseNodes(document.nodes)
    const short = buildScene([{ ...document.groups[0]!, name: 'Short' }], nodes.filter((node) => node.groupId === document.groups[0]!.id), 'short').districts[0]!
    const long = buildScene([{ ...document.groups[0]!, name: 'A neighborhood with a much longer name' }], nodes.filter((node) => node.groupId === document.groups[0]!.id), 'long').districts[0]!
    expect(long.labelWidth).toBeGreaterThan(short.labelWidth)
    expect(long.rect.d).toBeGreaterThan(short.rect.d)
  })
})
