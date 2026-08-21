import { useState } from 'react'
import { deleteGroupCascade } from '../domain/commands'
import { makeId } from '../domain/id'
import type { OntologyDocument, OntologyFlow, OntologyGroup, OntologyNode, OntologyRelation, Selection } from '../domain/types'
import { validateDocument } from '../domain/validation'
import { useDocumentStore } from './document-store'
import { BuildingAppearancePicker } from './BuildingAppearancePicker'

function Field({ label, value, onChange, multiline = false, type = 'text' }: { label: string; value: string | number; onChange: (value: string) => void; multiline?: boolean; type?: string }) {
  return <label className="field"><span>{label}</span>{multiline ? <textarea value={value} rows={4} onChange={(event) => onChange(event.target.value)} /> : <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />}</label>
}

function updateNode(document: OntologyDocument, id: string, patch: Partial<OntologyNode>): OntologyDocument {
  return { ...document, nodes: document.nodes.map((node) => node.id === id ? { ...node, ...patch } : node) }
}

function updateGroup(document: OntologyDocument, id: string, patch: Partial<OntologyGroup>): OntologyDocument {
  return { ...document, groups: document.groups.map((group) => group.id === id ? { ...group, ...patch } : group) }
}

function updateRelation(document: OntologyDocument, id: string, patch: Partial<OntologyRelation>): OntologyDocument {
  return { ...document, relations: document.relations.map((relation) => relation.id === id ? { ...relation, ...patch } : relation) }
}

function updateFlow(document: OntologyDocument, id: string, patch: Partial<OntologyFlow>): OntologyDocument {
  return { ...document, flows: document.flows.map((flow) => flow.id === id ? { ...flow, ...patch } : flow) }
}

export function Inspector({ editable, onActiveFlow }: { editable: boolean; onActiveFlow: (id: string | null) => void }) {
  const { document, selection, setSelection, commit } = useDocumentStore()
  const diagnostics = validateDocument(document)
  const node = selection?.kind === 'node' ? document.nodes.find((item) => item.id === selection.id) : null
  const relation = selection?.kind === 'relation' ? document.relations.find((item) => item.id === selection.id) : null
  const group = selection?.kind === 'group' ? document.groups.find((item) => item.id === selection.id) : null
  const flow = selection?.kind === 'flow' ? document.flows.find((item) => item.id === selection.id) : null
  const [pendingGroupDelete, setPendingGroupDelete] = useState<OntologyGroup | null>(null)
  const remove = (selection: Selection) => {
    commit((current) => {
      if (selection.kind === 'node') return { ...current, nodes: current.nodes.filter((item) => item.id !== selection.id), relations: current.relations.filter((item) => item.from !== selection.id && item.to !== selection.id), flows: current.flows.map((item) => ({ ...item, relationIds: item.relationIds.filter((id) => current.relations.some((relation) => relation.id === id && relation.from !== selection.id && relation.to !== selection.id)) })) }
      if (selection.kind === 'relation') return { ...current, relations: current.relations.filter((item) => item.id !== selection.id), flows: current.flows.map((item) => ({ ...item, relationIds: item.relationIds.filter((id) => id !== selection.id) })) }
      if (selection.kind === 'flow') return { ...current, flows: current.flows.filter((item) => item.id !== selection.id) }
      return deleteGroupCascade(current, selection.id)
    })
    setSelection(null)
    onActiveFlow(null)
  }

  if (!selection) return (
    <aside className="inspector intro-panel">
      <span className="eyebrow">Ontology map</span>
      <h2>{document.name}</h2>
      <p className="lede">{document.description}</p>
      {editable ? <div className="form-stack map-settings"><Field label="Map name" value={document.name} onChange={(value) => commit((current) => ({ ...current, name: value }))} /><Field label="Version" value={document.version} onChange={(value) => commit((current) => ({ ...current, version: value }))} /><Field label="Purpose" value={document.description} multiline onChange={(value) => commit((current) => ({ ...current, description: value }))} /><Field label="Geometry metric" value={document.metricLabel} onChange={(value) => commit((current) => ({ ...current, metricLabel: value }))} /></div> : null}
      <div className="divider" />
      <h3>Read the city</h3>
      <p>Buildings are concepts. Their mass follows <mark>{document.metricLabel}</mark>, not a hand-tuned size. Streets are declared relations; moving dots are payloads following complete scenarios.</p>
      <dl className="map-facts"><div><dt>Neighborhoods</dt><dd>{document.groups.length}</dd></div><div><dt>Concepts</dt><dd>{document.nodes.length}</dd></div><div><dt>Relations</dt><dd>{document.relations.length}</dd></div></dl>
      {diagnostics.length ? <section className="diagnostics"><h3>Diagnostics</h3>{diagnostics.map((item, index) => <p key={index} className={item.level}>{item.message}</p>)}</section> : <p className="clean-state">Structure valid · no broken paths</p>}
    </aside>
  )

  return <>
    <aside className="inspector">
      {node ? <NodeInspector node={node} editable={editable} commit={commit} setSelection={setSelection} document={document} /> : null}
      {relation ? <RelationInspector relation={relation} editable={editable} commit={commit} document={document} /> : null}
      {group ? <GroupInspector group={group} editable={editable} commit={commit} document={document} /> : null}
      {flow ? <FlowInspector flow={flow} editable={editable} commit={commit} document={document} /> : null}
      {editable ? <button type="button" className="danger-button" onClick={() => selection.kind === 'group' && group ? setPendingGroupDelete(group) : remove(selection)}>Delete {selection.kind}</button> : null}
    </aside>
    {pendingGroupDelete ? <GroupDeleteDialog group={pendingGroupDelete} document={document} onCancel={() => setPendingGroupDelete(null)} onConfirm={() => { remove({ kind: 'group', id: pendingGroupDelete.id }); setPendingGroupDelete(null) }} /> : null}
  </>
}

function GroupDeleteDialog({ group, document, onCancel, onConfirm }: { group: OntologyGroup; document: OntologyDocument; onCancel: () => void; onConfirm: () => void }) {
  const nodeIds = new Set(document.nodes.filter((node) => node.groupId === group.id).map((node) => node.id))
  const relationIds = new Set(document.relations.filter((relation) => nodeIds.has(relation.from) || nodeIds.has(relation.to)).map((relation) => relation.id))
  const stepCount = document.flows.reduce((count, flow) => count + flow.relationIds.filter((id) => relationIds.has(id)).length, 0)
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onCancel}><section className="delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-group-title" onMouseDown={(event) => event.stopPropagation()}><span className="eyebrow">Destructive action</span><h2 id="delete-group-title">Delete “{group.name}”?</h2><p>{nodeIds.size} concepts, {relationIds.size} relations and {stepCount} scenario steps will be removed. Undo can restore the complete neighborhood during this session.</p><div><button type="button" onClick={onCancel}>Cancel</button><button type="button" className="confirm-delete" onClick={onConfirm}>Delete neighborhood</button></div></section></div>
}

function NodeInspector({ node, editable, commit, setSelection, document }: { node: OntologyNode; editable: boolean; commit: ReturnType<typeof useDocumentStore>['commit']; setSelection: (selection: Selection | null) => void; document: OntologyDocument }) {
  const patch = (value: Partial<OntologyNode>) => commit((current) => updateNode(current, node.id, value))
  const [firstTarget] = document.nodes.filter((item) => item.id !== node.id)
  const addRelation = () => {
    if (!firstTarget) return
    const id = makeId('relation')
    commit((current) => ({ ...current, relations: [...current.relations, { id, from: node.id, to: firstTarget.id, kind: 'flow', label: 'new relation' }] }))
    setSelection({ kind: 'relation', id })
  }
  return <>
    <span className="eyebrow">{node.code} · {node.kind}</span><h2>{node.name}</h2><p className="lede">{node.metric} {node.unit} · {node.role}</p>
    {editable ? <div className="form-stack"><div className="field-pair"><Field label="Code" value={node.code} onChange={(value) => patch({ code: value.toUpperCase().slice(0, 3) })} /><Field label="Kind" value={node.kind} onChange={(value) => patch({ kind: value })} /></div><Field label="Name" value={node.name} onChange={(value) => patch({ name: value })} /><Field label="Role in a flow" value={node.role} onChange={(value) => patch({ role: value })} /><div className="field-pair"><Field label="Weight" type="number" value={node.metric} onChange={(value) => patch({ metric: Math.max(0, Number(value)) })} /><Field label="Unit" value={node.unit} onChange={(value) => patch({ unit: value })} /></div><label className="field"><span>Neighborhood</span><select value={node.groupId} onChange={(event) => patch({ groupId: event.target.value })}>{document.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><BuildingAppearancePicker archetype={node.archetypeOverride} texture={node.faceTexture} onArchetype={(value) => patch({ archetypeOverride: value })} onTexture={(value) => patch({ faceTexture: value })} /><Field label="What it does" value={node.whatItDoes} multiline onChange={(value) => patch({ whatItDoes: value })} /><Field label="Why it is shaped this way" value={node.howItsBuilt} multiline onChange={(value) => patch({ howItsBuilt: value })} /><fieldset className="property-editor"><legend>Properties</legend>{node.properties.map((property) => <div key={property.id}><input aria-label="Property name" value={property.key} onChange={(event) => patch({ properties: node.properties.map((item) => item.id === property.id ? { ...item, key: event.target.value } : item) })} /><input aria-label="Property value" value={property.value} onChange={(event) => patch({ properties: node.properties.map((item) => item.id === property.id ? { ...item, value: event.target.value } : item) })} /><button type="button" aria-label="Remove property" onClick={() => patch({ properties: node.properties.filter((item) => item.id !== property.id) })}>×</button></div>)}<button type="button" onClick={() => patch({ properties: [...node.properties, { id: makeId('property'), key: 'attribute', value: 'value' }] })}>+ Add property</button></fieldset><button type="button" className="secondary-button" onClick={addRelation} disabled={!firstTarget}>Connect from this concept</button></div> : <><p>{node.whatItDoes}</p><p>{node.howItsBuilt}</p>{node.properties.length ? <dl className="node-properties">{node.properties.map((property) => <div key={property.id}><dt>{property.key}</dt><dd>{property.value}</dd></div>)}</dl> : null}</>}
  </>
}

function RelationInspector({ relation, editable, commit, document }: { relation: OntologyRelation; editable: boolean; commit: ReturnType<typeof useDocumentStore>['commit']; document: OntologyDocument }) {
  const patch = (value: Partial<OntologyRelation>) => commit((current) => updateRelation(current, relation.id, value))
  const from = document.nodes.find((node) => node.id === relation.from)?.name
  const to = document.nodes.find((node) => node.id === relation.to)?.name
  return <><span className="eyebrow">{relation.kind} relation</span><h2>{relation.label}</h2><p className="lede">{from} → {to}</p>{editable ? <div className="form-stack"><Field label="Label" value={relation.label} onChange={(value) => patch({ label: value })} /><label className="field"><span>From</span><select value={relation.from} onChange={(event) => patch({ from: event.target.value })}>{document.nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</select></label><label className="field"><span>To</span><select value={relation.to} onChange={(event) => patch({ to: event.target.value })}>{document.nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</select></label><label className="field"><span>Relation kind</span><select value={relation.kind} onChange={(event) => patch({ kind: event.target.value as OntologyRelation['kind'] })}><option value="flow">Flow</option><option value="data">Data</option><option value="support">Support</option><option value="retry">Retry</option></select></label></div> : <p>This path carries {relation.label} from {from} to {to}.</p>}</>
}

function GroupInspector({ group, editable, commit, document }: { group: OntologyGroup; editable: boolean; commit: ReturnType<typeof useDocumentStore>['commit']; document: OntologyDocument }) {
  const patch = (value: Partial<OntologyGroup>) => commit((current) => updateGroup(current, group.id, value))
  return <><span className="eyebrow">Neighborhood</span><h2>{group.name}</h2><p className="lede">{document.nodes.filter((node) => node.groupId === group.id).length} concepts</p>{editable ? <div className="form-stack"><Field label="Name" value={group.name} onChange={(value) => patch({ name: value })} /><Field label="Purpose" value={group.description} multiline onChange={(value) => patch({ description: value })} /></div> : <p>{group.description}</p>}</>
}

function FlowInspector({ flow, editable, commit, document }: { flow: OntologyFlow; editable: boolean; commit: ReturnType<typeof useDocumentStore>['commit']; document: OntologyDocument }) {
  const patch = (value: Partial<OntologyFlow>) => commit((current) => updateFlow(current, flow.id, value))
  return <><span className="eyebrow">Animated scenario</span><h2>{flow.name}</h2><p className="lede">{flow.relationIds.length} steps · {flow.payload}</p>{editable ? <div className="form-stack"><Field label="Name" value={flow.name} onChange={(value) => patch({ name: value })} /><Field label="Payload" value={flow.payload} onChange={(value) => patch({ payload: value })} /><Field label="Outcome" value={flow.summary} multiline onChange={(value) => patch({ summary: value })} /><fieldset className="route-builder"><legend>Route · choose in order</legend>{document.relations.map((relation) => { const selected = flow.relationIds.includes(relation.id); return <button type="button" key={relation.id} className={selected ? 'is-selected' : ''} onClick={() => patch({ relationIds: selected ? flow.relationIds.filter((id) => id !== relation.id) : [...flow.relationIds, relation.id] })}><span>{selected ? flow.relationIds.indexOf(relation.id) + 1 : '+'}</span>{relation.label}</button> })}</fieldset></div> : <><p>{flow.summary}</p><ol className="flow-steps">{flow.relationIds.map((id) => <li key={id}>{document.relations.find((relation) => relation.id === id)?.label ?? 'Missing relation'}</li>)}</ol></>}</>
}
