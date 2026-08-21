import { useState } from 'react'
import { deleteFloorCascade, deleteGroupCascade, deleteNodeCascade, deleteRelationsCascade, moveFloorContents } from '../domain/commands'
import { flowRelationIds } from '../domain/flows'
import { makeId } from '../domain/id'
import type { BuildingSize, OntologyDocument, OntologyFloor, OntologyGroup, OntologyNode, OntologyRelation, Selection } from '../domain/types'
import { validateDocument } from '../domain/validation'
import { BuildingAppearancePicker } from './BuildingAppearancePicker'
import type { ConnectionDraft } from './connection'
import { useDocumentStore } from './document-store'
import { ScenarioInspector, type RelationPickTarget, type StagePreviewTarget } from './ScenarioInspector'
import type { RelationPreview } from './RelationCandidatePicker'

type Commit = ReturnType<typeof useDocumentStore>['commit']

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

export function Inspector({ editable, onActiveFloor, onActiveFlow, relationPickTarget, onRelationPickTarget, onRelationPreview, onStagePreview, connectionDraft, onStartConnection, onUpdateConnection, onCancelConnection, onCommitConnection }: { editable: boolean; onActiveFloor: (id: string) => void; onActiveFlow: (id: string | null) => void; relationPickTarget: RelationPickTarget | null; onRelationPickTarget: (target: RelationPickTarget | null) => void; onRelationPreview: (preview: RelationPreview | null) => void; onStagePreview: (target: StagePreviewTarget | null) => void; connectionDraft: ConnectionDraft | null; onStartConnection: (sourceId: string) => void; onUpdateConnection: (draft: ConnectionDraft | null) => void; onCancelConnection: () => void; onCommitConnection: () => void }) {
  const { document, selection, setSelection, commit } = useDocumentStore()
  const diagnostics = validateDocument(document)
  const node = selection?.kind === 'node' ? document.nodes.find((item) => item.id === selection.id) : null
  const relation = selection?.kind === 'relation' ? document.relations.find((item) => item.id === selection.id) : null
  const group = selection?.kind === 'group' ? document.groups.find((item) => item.id === selection.id) : null
  const flow = selection?.kind === 'flow' ? document.flows.find((item) => item.id === selection.id) : null
  const floor = selection?.kind === 'floor' ? document.floors.find((item) => item.id === selection.id) : null
  const [pendingGroupDelete, setPendingGroupDelete] = useState<OntologyGroup | null>(null)
  const [pendingFloorDelete, setPendingFloorDelete] = useState<OntologyFloor | null>(null)

  const remove = (target: Selection) => {
    commit((current) => {
      if (target.kind === 'node') return deleteNodeCascade(current, target.id)
      if (target.kind === 'relation') return deleteRelationsCascade(current, new Set([target.id]))
      if (target.kind === 'flow') return { ...current, flows: current.flows.filter((item) => item.id !== target.id) }
      if (target.kind === 'floor') return deleteFloorCascade(current, target.id)
      return deleteGroupCascade(current, target.id)
    })
    setSelection(null)
    onActiveFlow(null)
  }

  if (connectionDraft) {
    return <aside key="connection" className="inspector"><ConnectionInspector draft={connectionDraft} document={document} onUpdate={onUpdateConnection} onCancel={onCancelConnection} onCommit={onCommitConnection} /></aside>
  }

  if (!selection) {
    return (
      <aside className="inspector intro-panel">
        <span className="eyebrow">Ontology map</span>
        <h2>{document.name}</h2>
        <p className="lede">{document.description}</p>
        {editable ? <div className="form-stack map-settings"><Field label="Map name" value={document.name} onChange={(value) => commit((current) => ({ ...current, name: value }))} /><Field label="Version" value={document.version} onChange={(value) => commit((current) => ({ ...current, version: value }))} /><Field label="Purpose" value={document.description} multiline onChange={(value) => commit((current) => ({ ...current, description: value }))} /></div> : null}
        <div className="divider" />
        <h3>Read the city</h3>
        <p>Buildings are concepts. Their form and size make structure visible. Streets are declared relations; moving dots are payloads following complete scenarios.</p>
        {diagnostics.length ? <section className="diagnostics"><h3>Diagnostics</h3>{diagnostics.map((item, index) => <p key={index} className={item.level}>{item.message}</p>)}</section> : null}
      </aside>
    )
  }

  return <>
    <aside key={`${selection.kind}:${selection.id}`} className="inspector">
      {node ? <NodeInspector node={node} editable={editable} commit={commit} document={document} onMoveFloor={(floorId) => { commit((current) => updateNode(current, node.id, { floorId })); onActiveFloor(floorId); setSelection({ kind: 'node', id: node.id }) }} onStartConnection={onStartConnection} /> : null}
      {relation ? <RelationInspector relation={relation} editable={editable} commit={commit} document={document} /> : null}
      {group ? <GroupInspector group={group} editable={editable} commit={commit} document={document} /> : null}
      {flow ? <ScenarioInspector flow={flow} editable={editable} commit={commit} document={document} relationPickTarget={relationPickTarget} onRelationPickTarget={onRelationPickTarget} onRelationPreview={onRelationPreview} onStagePreview={onStagePreview} /> : null}
      {floor ? <FloorInspector floor={floor} editable={editable} commit={commit} document={document} /> : null}
      {editable ? <button type="button" className="danger-button" disabled={selection.kind === 'floor' && document.floors.length <= 1} onClick={() => selection.kind === 'group' && group ? setPendingGroupDelete(group) : selection.kind === 'floor' && floor ? setPendingFloorDelete(floor) : remove(selection)}>Delete {selection.kind}</button> : null}
    </aside>
    {pendingGroupDelete ? <GroupDeleteDialog group={pendingGroupDelete} document={document} onCancel={() => setPendingGroupDelete(null)} onConfirm={() => { remove({ kind: 'group', id: pendingGroupDelete.id }); setPendingGroupDelete(null) }} /> : null}
    {pendingFloorDelete ? <FloorDeleteDialog floor={pendingFloorDelete} document={document} onCancel={() => setPendingFloorDelete(null)} onDelete={() => { const fallback = document.floors.find((candidate) => candidate.id !== pendingFloorDelete.id)!; remove({ kind: 'floor', id: pendingFloorDelete.id }); onActiveFloor(fallback.id); setPendingFloorDelete(null) }} onMove={(targetFloorId) => { commit((current) => moveFloorContents(current, pendingFloorDelete.id, targetFloorId)); onActiveFloor(targetFloorId); setSelection({ kind: 'floor', id: targetFloorId }); setPendingFloorDelete(null) }} /> : null}
  </>
}

function FloorDeleteDialog({ floor, document, onCancel, onDelete, onMove }: { floor: OntologyFloor; document: OntologyDocument; onCancel: () => void; onDelete: () => void; onMove: (targetFloorId: string) => void }) {
  const targets = document.floors.filter((candidate) => candidate.id !== floor.id)
  const [targetFloorId, setTargetFloorId] = useState(targets[0]!.id)
  const count = document.nodes.filter((node) => node.floorId === floor.id).length
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onCancel}><section className="delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-floor-title" onMouseDown={(event) => event.stopPropagation()}><span className="eyebrow">Floor removal</span><h2 id="delete-floor-title">Remove “{floor.name}”?</h2><p>{count} concept{count === 1 ? '' : 's'} currently belong to this floor. Move them together or delete the floor and every dependent path.</p><label className="field"><span>Move concepts to</span><select value={targetFloorId} onChange={(event) => setTargetFloorId(event.target.value)}>{targets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label><div><button type="button" onClick={onCancel}>Cancel</button><button type="button" onClick={() => onMove(targetFloorId)}>Move and remove</button><button type="button" className="confirm-delete" onClick={onDelete}>Delete contents</button></div></section></div>
}

function GroupDeleteDialog({ group, document, onCancel, onConfirm }: { group: OntologyGroup; document: OntologyDocument; onCancel: () => void; onConfirm: () => void }) {
  const nodeIds = new Set(document.nodes.filter((node) => node.groupId === group.id).map((node) => node.id))
  const relationIds = new Set(document.relations.filter((relation) => nodeIds.has(relation.from) || nodeIds.has(relation.to)).map((relation) => relation.id))
  const stepCount = document.flows.reduce((count, flow) => count + flowRelationIds(flow).filter((id) => relationIds.has(id)).length, 0)
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onCancel}><section className="delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-group-title" onMouseDown={(event) => event.stopPropagation()}><span className="eyebrow">Destructive action</span><h2 id="delete-group-title">Delete “{group.name}”?</h2><p>{nodeIds.size} concepts, {relationIds.size} relations and {stepCount} scenario steps will be removed. Undo can restore the complete neighborhood during this session.</p><div><button type="button" onClick={onCancel}>Cancel</button><button type="button" className="confirm-delete" onClick={onConfirm}>Delete neighborhood</button></div></section></div>
}

function ConnectionInspector({ draft, document, onUpdate, onCancel, onCommit }: { draft: ConnectionDraft; document: OntologyDocument; onUpdate: (draft: ConnectionDraft | null) => void; onCancel: () => void; onCommit: () => void }) {
  const source = document.nodes.find((node) => node.id === draft.sourceId)
  const compatibleFlows = document.flows
  const count = draft.targets.length
  return <>
    <span className="eyebrow">Connection mode</span>
    <h2>From {source?.name}</h2>
    <p className="lede">Choose one or more concepts on the map. Use the floor navigator to connect concepts on another floor.</p>
    <div className="connection-targets">
      {count === 0 ? <p>Nothing selected yet.</p> : draft.targets.map((target) => {
        const node = document.nodes.find((item) => item.id === target.nodeId)
        const outbound = target.direction === 'outbound'
        return <div key={target.nodeId}><span className="node-code">{outbound ? source?.code : node?.code}</span><strong>{outbound ? source?.name : node?.name}</strong><button type="button" title="Reverse connection" onClick={() => onUpdate({ ...draft, targets: draft.targets.map((item) => item.nodeId === target.nodeId ? { ...item, direction: item.direction === 'outbound' ? 'inbound' : 'outbound' } : item) })}>→</button><span className="node-code">{outbound ? node?.code : source?.code}</span><strong>{outbound ? node?.name : source?.name}</strong><button type="button" aria-label={`Remove ${node?.name}`} onClick={() => onUpdate({ ...draft, targets: draft.targets.filter((item) => item.nodeId !== target.nodeId) })}>×</button></div>
      })}
    </div>
    <div className="form-stack">
      <Field label="Relation label" value={draft.label} onChange={(label) => onUpdate({ ...draft, label })} />
      <label className="field"><span>Relation kind</span><select value={draft.kind} onChange={(event) => onUpdate({ ...draft, kind: event.target.value as ConnectionDraft['kind'] })}><option value="flow">Flow</option><option value="data">Data</option><option value="support">Support</option><option value="retry">Retry</option></select></label>
      <label className="field"><span>Add as one parallel step</span><select value={draft.flowId ?? ''} onChange={(event) => onUpdate({ ...draft, flowId: event.target.value || null })}><option value="">No scenario</option>{compatibleFlows.map((flow) => <option key={flow.id} value={flow.id}>{flow.name}</option>)}</select></label>
    </div>
    <div className="connection-actions"><button type="button" onClick={onCancel}>Cancel</button><button type="button" className="primary-action" disabled={count === 0} onClick={onCommit}>Create {count} connection{count === 1 ? '' : 's'}</button></div>
  </>
}

function NodeInspector({ node, editable, commit, document, onMoveFloor, onStartConnection }: { node: OntologyNode; editable: boolean; commit: Commit; document: OntologyDocument; onMoveFloor: (id: string) => void; onStartConnection: (sourceId: string) => void }) {
  const patch = (value: Partial<OntologyNode>) => commit((current) => updateNode(current, node.id, value))
  return <>
    {!editable ? <><span className="eyebrow">{node.code}</span><h2>{node.name}</h2><p className="lede">{node.size.toUpperCase()}</p></> : null}
    {editable ? <div className="form-stack">
      <Field label="Code" value={node.code} onChange={(value) => patch({ code: value.toUpperCase().slice(0, 3) })} />
      <Field label="Name" value={node.name} onChange={(value) => patch({ name: value })} />
      <label className="field"><span>Size</span><select value={node.size} onChange={(event) => patch({ size: event.target.value as BuildingSize })}>{(['xs', 's', 'm', 'l', 'xl'] as const).map((size) => <option key={size} value={size}>{size.toUpperCase()}</option>)}</select></label>
      <label className="field"><span>Neighborhood</span><select value={node.groupId} onChange={(event) => patch({ groupId: event.target.value })}>{document.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
      <label className="field"><span>Floor</span><select value={node.floorId} onChange={(event) => onMoveFloor(event.target.value)}>{document.floors.map((floor) => <option key={floor.id} value={floor.id}>{floor.name}</option>)}</select></label>
      <Field label="What it does" value={node.whatItDoes} multiline onChange={(value) => patch({ whatItDoes: value })} />
      <Field label="Why it is shaped this way" value={node.howItsBuilt} multiline onChange={(value) => patch({ howItsBuilt: value })} />
      <button type="button" className="secondary-button connect-button" onClick={() => onStartConnection(node.id)}>Connect from {node.name}</button>
      <BuildingAppearancePicker archetype={node.archetypeOverride} texture={node.faceTexture} onArchetype={(value) => patch({ archetypeOverride: value })} onTexture={(value) => patch({ faceTexture: value })} />
      <fieldset className="property-editor"><legend>Properties</legend>{node.properties.map((property) => <div key={property.id}><input aria-label="Property name" value={property.key} onChange={(event) => patch({ properties: node.properties.map((item) => item.id === property.id ? { ...item, key: event.target.value } : item) })} /><input aria-label="Property value" value={property.value} onChange={(event) => patch({ properties: node.properties.map((item) => item.id === property.id ? { ...item, value: event.target.value } : item) })} /><button type="button" aria-label="Remove property" onClick={() => patch({ properties: node.properties.filter((item) => item.id !== property.id) })}>×</button></div>)}<button type="button" onClick={() => patch({ properties: [...node.properties, { id: makeId('property'), key: 'property', value: 'value' }] })}>+ Add property</button></fieldset>
    </div> : <><p>{node.whatItDoes}</p><p className="lede">{node.howItsBuilt}</p>{node.properties.length ? <dl className="property-readout">{node.properties.map((property) => <div key={property.id}><dt>{property.key}</dt><dd>{property.value}</dd></div>)}</dl> : null}</>}
  </>
}

function FloorInspector({ floor, editable, commit, document }: { floor: OntologyFloor; editable: boolean; commit: Commit; document: OntologyDocument }) {
  const patch = (value: Partial<OntologyFloor>) => commit((current) => ({ ...current, floors: current.floors.map((candidate) => candidate.id === floor.id ? { ...candidate, ...value } : candidate) }))
  const index = document.floors.findIndex((candidate) => candidate.id === floor.id)
  const count = document.nodes.filter((node) => node.floorId === floor.id).length
  return <><span className="eyebrow">Floor {String(index + 1).padStart(2, '0')}</span><h2>{floor.name}</h2><p className="lede">{count} concept{count === 1 ? '' : 's'}</p>{editable ? <div className="form-stack"><Field label="Name" value={floor.name} onChange={(name) => patch({ name })} /></div> : null}</>
}

function RelationInspector({ relation, editable, commit, document }: { relation: OntologyRelation; editable: boolean; commit: Commit; document: OntologyDocument }) {
  const patch = (value: Partial<OntologyRelation>) => commit((current) => updateRelation(current, relation.id, value))
  const from = document.nodes.find((node) => node.id === relation.from)?.name
  const to = document.nodes.find((node) => node.id === relation.to)?.name
  return <><span className="eyebrow">{relation.kind} relation</span><h2>{relation.label}</h2><div className="relation-direction"><strong>{from}</strong><button type="button" title="Reverse relation globally" disabled={!editable} onClick={() => patch({ from: relation.to, to: relation.from })}>⇄</button><strong>{to}</strong></div>{editable ? <div className="form-stack"><Field label="Name" value={relation.label} onChange={(value) => patch({ label: value })} /><label className="field"><span>From</span><select value={relation.from} onChange={(event) => patch({ from: event.target.value })}>{document.nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</select></label><label className="field"><span>To</span><select value={relation.to} onChange={(event) => patch({ to: event.target.value })}>{document.nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</select></label><label className="field"><span>Relation kind</span><select value={relation.kind} onChange={(event) => patch({ kind: event.target.value as OntologyRelation['kind'] })}><option value="flow">Flow</option><option value="data">Data</option><option value="support">Support</option><option value="retry">Retry</option></select></label></div> : <p>This path carries {relation.label} from {from} to {to}.</p>}</>
}

function GroupInspector({ group, editable, commit, document }: { group: OntologyGroup; editable: boolean; commit: Commit; document: OntologyDocument }) {
  const patch = (value: Partial<OntologyGroup>) => commit((current) => updateGroup(current, group.id, value))
  return <><span className="eyebrow">Neighborhood</span><h2>{group.name}</h2><p className="lede">{document.nodes.filter((node) => node.groupId === group.id).length} concepts</p>{editable ? <div className="form-stack"><Field label="Name" value={group.name} onChange={(value) => patch({ name: value })} /><Field label="Purpose" value={group.description} multiline onChange={(value) => patch({ description: value })} /></div> : <p>{group.description}</p>}</>
}
