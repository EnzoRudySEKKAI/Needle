import { resolveTraversal } from '../domain/flows'
import { makeId } from '../domain/id'
import type { FlowDirection, OntologyDocument, OntologyFlow, OntologyRelation } from '../domain/types'

type Commit = (transform: (document: OntologyDocument) => OntologyDocument) => void
type TraversalCandidate = { relation: OntologyRelation; direction: FlowDirection }

function traversalCandidates(relations: readonly OntologyRelation[]): TraversalCandidate[] {
  return relations.flatMap((relation) => {
    return [{ relation, direction: 'forward' as const }, { relation, direction: 'reverse' as const }]
  })
}

function candidateValue(candidate: TraversalCandidate): string {
  return `${candidate.relation.id}|${candidate.direction}`
}

function parseCandidate(value: string, relations: readonly OntologyRelation[]): TraversalCandidate | null {
  const separator = value.lastIndexOf('|')
  const relation = relations.find((item) => item.id === value.slice(0, separator))
  const direction = value.slice(separator + 1)
  return relation && (direction === 'forward' || direction === 'reverse') ? { relation, direction } : null
}

export function ScenarioInspector({ flow, document, commit, editable }: { flow: OntologyFlow; document: OntologyDocument; commit: Commit; editable: boolean }) {
  const patch = (value: Partial<OntologyFlow>) => commit((current) => ({ ...current, flows: current.flows.map((item) => item.id === flow.id ? { ...item, ...value } : item) }))
  const nodeById = new Map(document.nodes.map((node) => [node.id, node]))
  const relationById = new Map(document.relations.map((relation) => [relation.id, relation]))

  const appendStage = (value: string) => {
    const candidate = parseCandidate(value, document.relations)
    if (!candidate) return
    patch({ stages: [...flow.stages, { id: makeId('stage'), traversals: [{ id: makeId('traversal'), relationId: candidate.relation.id, direction: candidate.direction }] }] })
  }

  const addBranch = (stageIndex: number, value: string) => {
    const candidate = parseCandidate(value, document.relations)
    if (!candidate) return
    patch({ stages: flow.stages.map((stage, index) => index === stageIndex ? { ...stage, traversals: [...stage.traversals, { id: makeId('traversal'), relationId: candidate.relation.id, direction: candidate.direction }] } : stage) })
  }

  const candidateLabel = ({ relation, direction }: TraversalCandidate): string => {
    const sourceId = direction === 'forward' ? relation.from : relation.to
    const targetId = direction === 'forward' ? relation.to : relation.from
    return `${nodeById.get(sourceId)?.name} → ${nodeById.get(targetId)?.name} · ${relation.label}`
  }

  if (!editable) return <><span className="eyebrow">Animated scenario</span><h2>{flow.name}</h2><p className="lede">{flow.stages.length} steps · {flow.payload}</p><p>{flow.summary}</p></>

  const nextStageCandidates = traversalCandidates(document.relations)

  return <>
    <span className="eyebrow">Animated scenario</span>
    <h2>{flow.name}</h2>
    <p className="lede">{flow.stages.length} steps · {flow.payload}</p>
    <div className="form-stack">
      <label className="field"><span>Name</span><input value={flow.name} onChange={(event) => patch({ name: event.target.value })} /></label>
      <label className="field"><span>Payload</span><input value={flow.payload} onChange={(event) => patch({ payload: event.target.value })} /></label>
      <label className="field"><span>Outcome</span><textarea rows={3} value={flow.summary} onChange={(event) => patch({ summary: event.target.value })} /></label>
      <div className="scenario-stages">
        {flow.stages.map((stage, stageIndex) => {
          const usedCandidates = new Set(stage.traversals.map((traversal) => `${traversal.relationId}|${traversal.direction}`))
          const candidates = traversalCandidates(document.relations).filter((candidate) => !usedCandidates.has(candidateValue(candidate)))
          const moveUp = [...flow.stages]
          if (stageIndex > 0) [moveUp[stageIndex - 1], moveUp[stageIndex]] = [moveUp[stageIndex]!, moveUp[stageIndex - 1]!]
          const moveDown = [...flow.stages]
          if (stageIndex < flow.stages.length - 1) [moveDown[stageIndex], moveDown[stageIndex + 1]] = [moveDown[stageIndex + 1]!, moveDown[stageIndex]!]
          const withoutStage = flow.stages.filter((_, index) => index !== stageIndex)
          return <section className="scenario-stage" key={stage.id}>
            <header><strong>Step {String(stageIndex + 1).padStart(2, '0')}</strong><div><button type="button" disabled={stageIndex === 0} onClick={() => patch({ stages: moveUp })}>↑</button><button type="button" disabled={stageIndex === flow.stages.length - 1} onClick={() => patch({ stages: moveDown })}>↓</button><button type="button" onClick={() => patch({ stages: withoutStage })}>×</button></div></header>
            {stage.traversals.map((traversal) => {
              const relation = relationById.get(traversal.relationId)
              if (!relation) return <div className="scenario-branch is-missing" key={traversal.id}>Missing relation</div>
              const resolved = resolveTraversal(traversal, relation)
              const removed = flow.stages.map((item, index) => index === stageIndex ? { ...item, traversals: item.traversals.filter((candidate) => candidate.id !== traversal.id) } : item).filter((item) => item.traversals.length > 0)
              return <div className="scenario-branch" key={traversal.id}><span className="branch-code">{nodeById.get(resolved.sourceId)?.code}</span><span className="branch-name">{nodeById.get(resolved.sourceId)?.name}</span><button type="button" className="branch-direction" title="Reverse in this scenario" onClick={() => patch({ stages: flow.stages.map((item, index) => index === stageIndex ? { ...item, traversals: item.traversals.map((candidate) => candidate.id === traversal.id ? { ...candidate, direction: candidate.direction === 'forward' ? 'reverse' : 'forward' } : candidate) } : item) })}>→</button><span className="branch-code">{nodeById.get(resolved.targetId)?.code}</span><span className="branch-name">{nodeById.get(resolved.targetId)?.name}</span><button type="button" className="branch-remove" onClick={() => patch({ stages: removed })}>×</button><small>{relation.label}</small></div>
            })}
            <select className="add-branch-select" value="" onChange={(event) => { if (event.target.value) addBranch(stageIndex, event.target.value) }}><option value="">+ Add parallel branch</option>{candidates.map((candidate) => <option key={candidateValue(candidate)} value={candidateValue(candidate)}>{candidateLabel(candidate)}</option>)}</select>
          </section>
        })}
      </div>
      <select className="add-stage-select" value="" onChange={(event) => { if (event.target.value) appendStage(event.target.value) }}><option value="">+ Add next step</option>{nextStageCandidates.map((candidate) => <option key={candidateValue(candidate)} value={candidateValue(candidate)}>{candidateLabel(candidate)}</option>)}</select>
    </div>
  </>
}
