import { resolveTraversal } from '../domain/flows'
import { makeId } from '../domain/id'
import type { FlowDirection, FlowStage, OntologyDocument, OntologyFlow, OntologyRelation } from '../domain/types'

type Commit = (transform: (document: OntologyDocument) => OntologyDocument) => void

function directionFor(relation: OntologyRelation, sources: ReadonlySet<string> | null): FlowDirection | null {
  if (sources === null) return 'forward'
  if (sources.has(relation.from)) return 'forward'
  if (sources.has(relation.to)) return 'reverse'
  return null
}

function endpoints(stage: FlowStage, relations: readonly OntologyRelation[]): { sources: Set<string>; targets: Set<string> } {
  const relationById = new Map(relations.map((relation) => [relation.id, relation]))
  const sources = new Set<string>()
  const targets = new Set<string>()
  for (const traversal of stage.traversals) {
    const relation = relationById.get(traversal.relationId)
    if (!relation) continue
    const resolved = resolveTraversal(traversal, relation)
    sources.add(resolved.sourceId)
    targets.add(resolved.targetId)
  }
  return { sources, targets }
}

export function ScenarioInspector({ flow, document, commit, editable }: { flow: OntologyFlow; document: OntologyDocument; commit: Commit; editable: boolean }) {
  const patch = (value: Partial<OntologyFlow>) => commit((current) => ({ ...current, flows: current.flows.map((item) => item.id === flow.id ? { ...item, ...value } : item) }))
  const nodeById = new Map(document.nodes.map((node) => [node.id, node]))
  const relationById = new Map(document.relations.map((relation) => [relation.id, relation]))

  const addStage = (relationId: string) => {
    const relation = relationById.get(relationId)
    if (!relation) return
    const frontier = flow.stages.length ? endpoints(flow.stages[flow.stages.length - 1]!, document.relations).targets : null
    const direction = directionFor(relation, frontier)
    if (!direction) return
    patch({ stages: [...flow.stages, { id: makeId('stage'), traversals: [{ id: makeId('traversal'), relationId, direction }] }] })
  }

  const addBranch = (stageIndex: number, relationId: string) => {
    const relation = relationById.get(relationId)
    const stage = flow.stages[stageIndex]
    if (!relation || !stage) return
    const direction = directionFor(relation, endpoints(stage, document.relations).sources)
    if (!direction) return
    patch({ stages: flow.stages.map((item, index) => index === stageIndex ? { ...item, traversals: [...item.traversals, { id: makeId('traversal'), relationId, direction }] } : item) })
  }

  if (!editable) return <><span className="eyebrow">Animated scenario</span><h2>{flow.name}</h2><p className="lede">{flow.stages.length} steps · {flow.payload}</p><p>{flow.summary}</p></>

  return <><span className="eyebrow">Animated scenario</span><h2>{flow.name}</h2><p className="lede">{flow.stages.length} steps · {flow.payload}</p><div className="form-stack"><label className="field"><span>Name</span><input value={flow.name} onChange={(event) => patch({ name: event.target.value })} /></label><label className="field"><span>Payload</span><input value={flow.payload} onChange={(event) => patch({ payload: event.target.value })} /></label><label className="field"><span>Outcome</span><textarea rows={3} value={flow.summary} onChange={(event) => patch({ summary: event.target.value })} /></label><div className="scenario-stages">{flow.stages.map((stage, stageIndex) => {
    const stageEndpoints = endpoints(stage, document.relations)
    const candidates = document.relations.filter((relation) => !stage.traversals.some((traversal) => traversal.relationId === relation.id) && directionFor(relation, stageEndpoints.sources) !== null)
    return <section className="scenario-stage" key={stage.id}><header><strong>Step {String(stageIndex + 1).padStart(2, '0')}</strong><div><button type="button" disabled={stageIndex === 0} onClick={() => { const stages = [...flow.stages]; [stages[stageIndex - 1], stages[stageIndex]] = [stages[stageIndex]!, stages[stageIndex - 1]!]; patch({ stages }) }}>↑</button><button type="button" disabled={stageIndex === flow.stages.length - 1} onClick={() => { const stages = [...flow.stages]; [stages[stageIndex], stages[stageIndex + 1]] = [stages[stageIndex + 1]!, stages[stageIndex]!]; patch({ stages }) }}>↓</button><button type="button" onClick={() => patch({ stages: flow.stages.filter((_, index) => index !== stageIndex) })}>×</button></div></header>{stage.traversals.map((traversal) => {
      const relation = relationById.get(traversal.relationId)
      if (!relation) return <div className="scenario-branch is-missing" key={traversal.id}>Missing relation</div>
      const resolved = resolveTraversal(traversal, relation)
      return <div className="scenario-branch" key={traversal.id}><span className="branch-code">{nodeById.get(resolved.sourceId)?.code}</span><span className="branch-name">{nodeById.get(resolved.sourceId)?.name}</span><button type="button" className="branch-direction" title="Reverse in this scenario" onClick={() => patch({ stages: flow.stages.map((item, index) => index === stageIndex ? { ...item, traversals: item.traversals.map((candidate) => candidate.id === traversal.id ? { ...candidate, direction: candidate.direction === 'forward' ? 'reverse' : 'forward' } : candidate) } : item) })}>→</button><span className="branch-code">{nodeById.get(resolved.targetId)?.code}</span><span className="branch-name">{nodeById.get(resolved.targetId)?.name}</span><button type="button" className="branch-remove" onClick={() => patch({ stages: flow.stages.map((item, index) => index === stageIndex ? { ...item, traversals: item.traversals.filter((candidate) => candidate.id !== traversal.id) } : item).filter((item) => item.traversals.length > 0) })}>×</button><small>{relation.label}</small></div>
    })}<select className="add-branch-select" value="" onChange={(event) => { if (event.target.value) addBranch(stageIndex, event.target.value) }}><option value="">+ Add parallel branch</option>{candidates.map((relation) => { const direction = directionFor(relation, stageEndpoints.sources)!; const source = direction === 'forward' ? relation.from : relation.to; const target = direction === 'forward' ? relation.to : relation.from; return <option key={relation.id} value={relation.id}>{nodeById.get(source)?.name} → {nodeById.get(target)?.name} · {relation.label}</option> })}</select></section>
  })}</div><select className="add-stage-select" value="" onChange={(event) => { if (event.target.value) addStage(event.target.value) }}><option value="">+ Add next step</option>{document.relations.filter((relation) => directionFor(relation, flow.stages.length ? endpoints(flow.stages[flow.stages.length - 1]!, document.relations).targets : null) !== null).map((relation) => { const direction = directionFor(relation, flow.stages.length ? endpoints(flow.stages[flow.stages.length - 1]!, document.relations).targets : null)!; const source = direction === 'forward' ? relation.from : relation.to; const target = direction === 'forward' ? relation.to : relation.from; return <option key={relation.id} value={relation.id}>{nodeById.get(source)?.name} → {nodeById.get(target)?.name} · {relation.label}</option> })}</select></div></>
}
