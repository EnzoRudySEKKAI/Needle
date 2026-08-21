import { describe, expect, it } from 'vitest'
import { cloneSample } from '../../domain/sample'
import type { OntologyFlow } from '../../domain/types'
import { visualiseNodes } from './layout'
import { activeNodeIds, buildFlowProgram, flowPositions } from './program'
import { buildRelationGeometry } from './routes'

describe('branched flow programs', () => {
  it('duplicates payloads across parallel traversals', () => {
    const document = cloneSample()
    const nodes = visualiseNodes(document.nodes)
    const flow: OntologyFlow = {
      id: 'fan-out', name: 'Fan out', payload: 'evidence', summary: '',
      stages: [{ id: 'stage-1', traversals: [
        { id: 'a', relationId: 'ob-intake', direction: 'forward' },
        { id: 'b', relationId: 'habitat-observer', direction: 'reverse' },
      ] }],
    }
    const program = buildFlowProgram(flow, nodes, document.relations, buildRelationGeometry(nodes, document.relations))!
    expect(program.stages[0]?.branches).toHaveLength(2)
    expect(flowPositions(program, program.stages[0]!.start + 100)).toHaveLength(2)
    expect(activeNodeIds(program, program.stages[0]!.start + 100)).toEqual(new Set(['observer', 'habitat']))
  })
})
