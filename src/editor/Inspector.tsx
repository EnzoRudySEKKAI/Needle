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
import { StructureTypePicker } from './StructureTypePicker'
import { FloorPreviewCard } from '../map/components/FloorPreviewCard'
import { SelectField } from './AppSelect'

type Commit = ReturnType<typeof useDocumentStore>['commit']

function Field({ label, value, onChange, multiline = false, type = 'text', maxLength }: { label: string; value: string | number; onChange: (value: string) => void; multiline?: boolean; type?: string; maxLength?: number }) {
  return <label className="field"><span>{label}</span>{multiline ? <textarea value={value} rows={4} onChange={(event) => onChange(event.target.value)} /> : <input type={type} value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />}</label>
}

function DisplayNameField() {
  const [name, setName] = useState(() => localStorage.getItem('needle:displayName') ?? '')
  return <Field label="Your collaboration name" value={name} onChange={(value) => { setName(value); localStorage.setItem('needle:displayName', value); window.dispatchEvent(new CustomEvent('needle:display-name', { detail: value })) }} />
}

function FloorNeighborhoods({ floorId }: { floorId: string }) {
  const { document, selection, setSelection } = useDocumentStore()
  const groups = document.groups.filter((group) => document.nodes.some((node) => node.groupId === group.id && node.floorId === floorId))
  if (groups.length === 0) return <p className="rail-empty">No neighborhood on this floor.</p>
  return (
    <div className="inspector-neighborhoods">
      {groups.map((group) => {
        const nodes = document.nodes.filter((node) => node.groupId === group.id && node.floorId === floorId)
        return (
          <section className="rail-section" key={group.id} style={{ paddingTop: 8 }}>
            <button type="button" className={`group-heading ${selection?.kind === 'group' && selection.id === group.id ? 'is-active' : ''}`} onClick={() => setSelection({ kind: 'group', id: group.id })}><span>{group.name}</span><span>{nodes.length}</span></button>
            <div className="node-list">
              {nodes.map((node) => (
                <button key={node.id} type="button" className={`node-row ${selection?.kind === 'node' && selection.id === node.id ? 'is-active' : ''}`} onClick={() => setSelection({ kind: 'node', id: node.id })}><span className="node-code">{node.code}</span><span>{node.name}</span><span className="node-size">{node.size.toUpperCase()}</span></button>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
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

export function Inspector({ editable, activeFloorId, hoveredFloorId, isStructureView = false, onActiveFloor, onActiveFlow, relationPickTarget, onRelationPickTarget, onRelationPreview, onStagePreview, connectionDraft, onStartConnection, onUpdateConnection, onCancelConnection, onCommitConnection, onCollapse }: { editable: boolean; activeFloorId: string; hoveredFloorId?: string | null; isStructureView?: boolean; onActiveFloor: (id: string) => void; onActiveFlow: (id: string | null) => void; relationPickTarget: RelationPickTarget | null; onRelationPickTarget: (target: RelationPickTarget | null) => void; onRelationPreview: (preview: RelationPreview | null) => void; onStagePreview: (target: StagePreviewTarget | null) => void; connectionDraft: ConnectionDraft | null; onStartConnection: (sourceId: string) => void; onUpdateConnection: (draft: ConnectionDraft | null) => void; onCancelConnection: () => void; onCommitConnection: () => void; onCollapse?: () => void }) {
  const { document, selection, setSelection, commit } = useDocumentStore()
  const diagnostics = validateDocument(document)
  const node = selection?.kind === 'node' ? document.nodes.find((item) => item.id === selection.id) : null
  const relation = selection?.kind === 'relation' ? document.relations.find((item) => item.id === selection.id) : null
  const group = selection?.kind === 'group' ? document.groups.find((item) => item.id === selection.id) : null
  const flow = selection?.kind === 'flow' ? document.flows.find((item) => item.id === selection.id) : null
  const floor = selection?.kind === 'floor' ? document.floors.find((item) => item.id === selection.id) : null
  const [pendingGroupDelete, setPendingGroupDelete] = useState<OntologyGroup | null>(null)
  const [pendingFloorDelete, setPendingFloorDelete] = useState<OntologyFloor | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Selection | null>(null)

  const targetExists = (target: Selection) => target.kind === 'node' ? document.nodes.some((item) => item.id === target.id)
    : target.kind === 'relation' ? document.relations.some((item) => item.id === target.id)
      : target.kind === 'group' ? document.groups.some((item) => item.id === target.id)
        : target.kind === 'flow' ? document.flows.some((item) => item.id === target.id)
          : document.floors.some((item) => item.id === target.id)
  const navigateTo = (target: Selection) => {
    if (!targetExists(target)) return
    setSelection(target)
    if (target.kind === 'flow') onActiveFlow(target.id)
    const floorId = target.kind === 'floor' ? target.id
      : target.kind === 'node' ? document.nodes.find((item) => item.id === target.id)?.floorId
        : target.kind === 'relation' ? (() => {
          const targetRelation = document.relations.find((item) => item.id === target.id)
          return document.nodes.find((item) => item.id === targetRelation?.from)?.floorId ?? document.nodes.find((item) => item.id === targetRelation?.to)?.floorId
        })()
          : undefined
    if (floorId && document.floors.some((item) => item.id === floorId)) onActiveFloor(floorId)
  }

  const remove = (target: Selection) => {
    commit((current) => target.kind === 'node' ? deleteNodeCascade(current, target.id)
        : target.kind === 'relation' ? deleteRelationsCascade(current, new Set([target.id]))
          : target.kind === 'flow' ? { ...current, flows: current.flows.filter((item) => item.id !== target.id) }
            : target.kind === 'floor' ? deleteFloorCascade(current, target.id)
              : deleteGroupCascade(current, target.id))
    setSelection(null)
    onActiveFlow(null)
  }

  if (connectionDraft) {
    return <aside key="connection" className="inspector">{onCollapse ? <button type="button" className="rail-collapse-button rail-collapse-right" aria-label="Hide detail rail" title="Hide detail rail" onClick={onCollapse}><span aria-hidden="true">›</span></button> : null}<ConnectionInspector draft={connectionDraft} document={document} onUpdate={onUpdateConnection} onCancel={onCancelConnection} onCommit={onCommitConnection} /></aside>
  }

  if (!selection) {
    const hoveredFloor = isStructureView && hoveredFloorId ? document.floors.find((floor) => floor.id === hoveredFloorId) ?? null : null
    if (hoveredFloor) {
      const index = document.floors.findIndex((candidate) => candidate.id === hoveredFloor.id)
      const count = document.nodes.filter((node) => node.floorId === hoveredFloor.id).length
      return (
        <aside className="inspector">
          {onCollapse ? <button type="button" className="rail-collapse-button rail-collapse-right" aria-label="Hide detail rail" title="Hide detail rail" onClick={onCollapse}><span aria-hidden="true">›</span></button> : null}
          <span className="eyebrow">Floor {String(index + 1).padStart(2, '0')}</span>
          <h2>{hoveredFloor.name}</h2>
          <p className="lede">{count} concept{count === 1 ? '' : 's'}</p>
          <FloorNeighborhoods floorId={hoveredFloor.id} />
        </aside>
      )
    }
    return (
      <aside className="inspector intro-panel">
        {onCollapse ? <button type="button" className="rail-collapse-button rail-collapse-right" aria-label="Hide detail rail" title="Hide detail rail" onClick={onCollapse}><span aria-hidden="true">›</span></button> : null}
        <span className="eyebrow">Ontology map</span>
        <h2>{document.name}</h2>
        <p className="lede">{document.description}</p>
        {editable ? <div className="form-stack map-settings"><DisplayNameField /><Field label="Map name" value={document.name} onChange={(value) => commit((current) => ({ ...current, name: value }))} /><Field label="Version" value={document.version} onChange={(value) => commit((current) => ({ ...current, version: value }))} /><StructureTypePicker value={document.structureType} onChange={(structureType) => commit((current) => ({ ...current, structureType }))} /><Field label="Purpose" value={document.description} multiline onChange={(value) => commit((current) => ({ ...current, description: value }))} /></div> : null}
        <div className="divider" />
        <h3>Read the structure</h3>
        <p>Volumes are concepts. Their form and size make the ontology visible. Paths are declared relations; moving dots are payloads following complete scenarios.</p>
        {diagnostics.length ? <section className="diagnostics"><h3>Diagnostics</h3>{diagnostics.map((item, index) => item.target && targetExists(item.target) ? <button key={index} type="button" className={item.level} onClick={() => navigateTo(item.target!)}>{item.message}</button> : <p key={index} className={item.level}>{item.message}</p>)}</section> : null}
      </aside>
    )
  }

  return <>
    <aside key={`${selection.kind}:${selection.id}`} className="inspector">
      {onCollapse ? <button type="button" className="rail-collapse-button rail-collapse-right" aria-label="Hide detail rail" title="Hide detail rail" onClick={onCollapse}><span aria-hidden="true">›</span></button> : null}
      {node ? <NodeInspector node={node} editable={editable} commit={commit} document={document} onStartConnection={onStartConnection} /> : null}
      {relation ? <RelationInspector relation={relation} editable={editable} commit={commit} document={document} activeFloorId={activeFloorId} onActiveFloor={onActiveFloor} /> : null}
      {group ? <GroupInspector group={group} editable={editable} commit={commit} document={document} setSelection={setSelection} onActiveFloor={onActiveFloor} /> : null}
      {flow ? <ScenarioInspector flow={flow} editable={editable} commit={commit} document={document} relationPickTarget={relationPickTarget} onRelationPickTarget={onRelationPickTarget} onRelationPreview={onRelationPreview} onStagePreview={onStagePreview} /> : null}
      {floor ? <FloorInspector floor={floor} editable={editable} commit={commit} document={document} activeFloorId={activeFloorId} isStructureView={isStructureView} onActiveFloor={onActiveFloor} /> : null}
      {editable ? <button type="button" className="danger-button" disabled={selection.kind === 'floor' && document.floors.length <= 1} onClick={() => selection.kind === 'group' && group ? setPendingGroupDelete(group) : selection.kind === 'floor' && floor ? setPendingFloorDelete(floor) : setPendingDelete(selection)}>Delete {selection.kind}</button> : null}
    </aside>
    {pendingGroupDelete ? <GroupDeleteDialog group={pendingGroupDelete} document={document} onCancel={() => setPendingGroupDelete(null)} onConfirm={() => { remove({ kind: 'group', id: pendingGroupDelete.id }); setPendingGroupDelete(null) }} /> : null}
    {pendingFloorDelete ? <FloorDeleteDialog floor={pendingFloorDelete} document={document} onCancel={() => setPendingFloorDelete(null)} onDelete={() => { const fallback = document.floors.find((candidate) => candidate.id !== pendingFloorDelete.id)!; remove({ kind: 'floor', id: pendingFloorDelete.id }); onActiveFloor(fallback.id); setPendingFloorDelete(null) }} onMove={(targetFloorId) => { commit((current) => moveFloorContents(current, pendingFloorDelete.id, targetFloorId)); onActiveFloor(targetFloorId); setSelection({ kind: 'floor', id: targetFloorId }); setPendingFloorDelete(null) }} /> : null}
    {pendingDelete ? <SelectionDeleteDialog target={pendingDelete} document={document} onCancel={() => setPendingDelete(null)} onConfirm={() => { remove(pendingDelete); setPendingDelete(null) }} /> : null}
  </>
}

function SelectionDeleteDialog({ target, document, onCancel, onConfirm }: { target: Selection; document: OntologyDocument; onCancel: () => void; onConfirm: () => void }) {
  const node = target.kind === 'node' ? document.nodes.find((item) => item.id === target.id) : null
  const relation = target.kind === 'relation' ? document.relations.find((item) => item.id === target.id) : null
  const flow = target.kind === 'flow' ? document.flows.find((item) => item.id === target.id) : null
  const relationIds = new Set(node ? document.relations.filter((item) => item.from === node.id || item.to === node.id).map((item) => item.id) : relation ? [relation.id] : [])
  const stepCount = document.flows.reduce((count, item) => count + flowRelationIds(item).filter((id) => relationIds.has(id)).length, 0)
  const name = node?.name ?? relation?.label ?? flow?.name ?? target.id
  const impact = node ? `${relationIds.size} relation${relationIds.size === 1 ? '' : 's'} and ${stepCount} scenario traversal${stepCount === 1 ? '' : 's'} will also be removed.`
    : relation ? `${stepCount} scenario traversal${stepCount === 1 ? '' : 's'} will also be removed.`
      : `${flow?.stages.length ?? 0} stage${flow?.stages.length === 1 ? '' : 's'} and ${flow ? flowRelationIds(flow).length : 0} traversal${flow && flowRelationIds(flow).length === 1 ? '' : 's'} will be removed.`
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onCancel}><section className="delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-selection-title" onMouseDown={(event) => event.stopPropagation()}><span className="eyebrow">Destructive action</span><h2 id="delete-selection-title">Delete “{name}”?</h2><p>{impact} Undo can restore the complete selection during this session.</p><div><button type="button" onClick={onCancel}>Cancel</button><button type="button" className="confirm-delete" onClick={onConfirm}>Delete {target.kind === 'flow' ? 'scenario' : target.kind}</button></div></section></div>
}

function FloorDeleteDialog({ floor, document, onCancel, onDelete, onMove }: { floor: OntologyFloor; document: OntologyDocument; onCancel: () => void; onDelete: () => void; onMove: (targetFloorId: string) => void }) {
  const targets = document.floors.filter((candidate) => candidate.id !== floor.id)
  const [targetFloorId, setTargetFloorId] = useState(targets[0]!.id)
  const count = document.nodes.filter((node) => node.floorId === floor.id).length
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onCancel}><section className="delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-floor-title" onMouseDown={(event) => event.stopPropagation()}><span className="eyebrow">Floor removal</span><h2 id="delete-floor-title">Remove “{floor.name}”?</h2><p>{count} concept{count === 1 ? '' : 's'} currently belong to this floor. Move them together or delete the floor and every dependent path.</p><SelectField label="Move concepts to" ariaLabel="Move concepts to" value={targetFloorId} options={targets.map((target) => ({ value: target.id, label: target.name }))} onChange={setTargetFloorId} /><div><button type="button" onClick={onCancel}>Cancel</button><button type="button" onClick={() => onMove(targetFloorId)}>Move and remove</button><button type="button" className="confirm-delete" onClick={onDelete}>Delete contents</button></div></section></div>
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
  const toggleRemote = (nodeId: string) => {
    const exists = draft.targets.some((target) => target.nodeId === nodeId)
    onUpdate({ ...draft, targets: exists ? draft.targets.filter((target) => target.nodeId !== nodeId) : [...draft.targets, { nodeId, direction: 'outbound' }] })
  }
  return <>
    <span className="eyebrow">Connection mode</span>
    <h2>From {source?.name}</h2>
    <p className="lede">Choose one or more concepts on the map, or pick targets on another floor below.</p>
    <div className="connection-targets">
      {count === 0 ? <p>Nothing selected yet.</p> : draft.targets.map((target) => {
        const node = document.nodes.find((item) => item.id === target.nodeId)
        const outbound = target.direction === 'outbound'
        return <div key={target.nodeId}><span className="node-code">{outbound ? source?.code : node?.code}</span><strong>{outbound ? source?.name : node?.name}</strong><button type="button" title="Reverse connection" onClick={() => onUpdate({ ...draft, targets: draft.targets.map((item) => item.nodeId === target.nodeId ? { ...item, direction: item.direction === 'outbound' ? 'inbound' : 'outbound' } : item) })}>→</button><span className="node-code">{outbound ? node?.code : source?.code}</span><strong>{outbound ? node?.name : source?.name}</strong><button type="button" aria-label={`Remove ${node?.name}`} onClick={() => onUpdate({ ...draft, targets: draft.targets.filter((item) => item.nodeId !== target.nodeId) })}>×</button></div>
      })}
    </div>
    <div className="connection-remote">
      <p className="connection-remote-title">Other floors</p>
      {document.floors.filter((floor) => floor.id !== source?.floorId).map((floor) => {
        const members = document.nodes.filter((node) => node.floorId === floor.id)
        if (members.length === 0) return null
        return <div key={floor.id} className="connection-remote-floor">
          <span>{floor.name}</span>
          <div>{members.map((node) => {
            const active = draft.targets.some((target) => target.nodeId === node.id)
            return <button key={node.id} type="button" className={active ? 'is-target' : ''} aria-pressed={active} onClick={() => toggleRemote(node.id)}><b>{node.code}</b>{node.name}</button>
          })}</div>
        </div>
      })}
    </div>
    <div className="form-stack">
      <Field label="Relation label" value={draft.label} onChange={(label) => onUpdate({ ...draft, label })} />
      <SelectField label="Relation kind" ariaLabel="Relation kind" value={draft.kind} options={['full', 'dotted'].map((kind) => ({ value: kind, label: `${kind[0]!.toUpperCase()}${kind.slice(1)}` }))} onChange={(kind) => onUpdate({ ...draft, kind: kind as ConnectionDraft['kind'] })} />
      <SelectField label="Add as one parallel step" ariaLabel="Scenario for this connection" value={draft.flowId ?? ''} options={[{ value: '', label: 'No scenario' }, ...compatibleFlows.map((flow) => ({ value: flow.id, label: flow.name }))]} onChange={(flowId) => onUpdate({ ...draft, flowId: flowId || null })} />
    </div>
    <div className="connection-actions"><button type="button" onClick={onCancel}>Cancel</button><button type="button" className="primary-action" disabled={count === 0} onClick={onCommit}>Create {count} connection{count === 1 ? '' : 's'}</button></div>
  </>
}

function NodeInspector({ node, editable, commit, document, onStartConnection }: { node: OntologyNode; editable: boolean; commit: Commit; document: OntologyDocument; onStartConnection: (sourceId: string) => void }) {
  const patch = (value: Partial<OntologyNode>) => commit((current) => updateNode(current, node.id, value))
  return <>
    {!editable ? <><span className="eyebrow">{node.code}</span><h2>{node.name}</h2><p className="lede">{node.size.toUpperCase()}</p></> : null}
    {editable ? <div className="form-stack">
      <Field label="Code" value={node.code} maxLength={3} onChange={(value) => patch({ code: value.toUpperCase() })} />
      <Field label="Name" value={node.name} onChange={(value) => patch({ name: value })} />
      <SelectField label="Size" ariaLabel="Concept size" value={node.size} options={(['xs', 's', 'm', 'l', 'xl'] as const).map((size) => ({ value: size, label: size.toUpperCase() }))} onChange={(size) => patch({ size: size as BuildingSize })} />
      <SelectField label="Neighborhood" ariaLabel="Concept neighborhood" value={node.groupId} options={document.groups.map((group) => ({ value: group.id, label: group.name }))} onChange={(groupId) => patch({ groupId })} />
      <Field label="What it does" value={node.whatItDoes} multiline onChange={(value) => patch({ whatItDoes: value })} />
      <button type="button" className="secondary-button connect-button" onClick={() => onStartConnection(node.id)}>Connect from {node.name}</button>
      <BuildingAppearancePicker archetype={node.archetypeOverride} texture={node.faceTexture} onArchetype={(value) => patch({ archetypeOverride: value })} onTexture={(value) => patch({ faceTexture: value })} />
      <fieldset className="property-editor"><legend>Properties</legend>{node.properties.map((property) => <div key={property.id}><input aria-label="Property name" value={property.key} onChange={(event) => patch({ properties: node.properties.map((item) => item.id === property.id ? { ...item, key: event.target.value } : item) })} /><input aria-label="Property value" value={property.value} onChange={(event) => patch({ properties: node.properties.map((item) => item.id === property.id ? { ...item, value: event.target.value } : item) })} /><button type="button" aria-label="Remove property" onClick={() => patch({ properties: node.properties.filter((item) => item.id !== property.id) })}>×</button></div>)}<button type="button" onClick={() => patch({ properties: [...node.properties, { id: makeId('property'), key: 'property', value: 'value' }] })}>+ Add property</button></fieldset>
    </div> : <><p>{node.whatItDoes}</p>{node.properties.length ? <dl className="property-readout">{node.properties.map((property) => <div key={property.id}><dt>{property.key}</dt><dd>{property.value}</dd></div>)}</dl> : null}</>}
  </>
}

function FloorInspector({ floor, editable, commit, document, activeFloorId, isStructureView = false, onActiveFloor }: { floor: OntologyFloor; editable: boolean; commit: Commit; document: OntologyDocument; activeFloorId: string; isStructureView?: boolean; onActiveFloor: (id: string) => void }) {
  const patch = (value: Partial<OntologyFloor>) => commit((current) => ({ ...current, floors: current.floors.map((candidate) => candidate.id === floor.id ? { ...candidate, ...value } : candidate) }))
  const index = document.floors.findIndex((candidate) => candidate.id === floor.id)
  const count = document.nodes.filter((node) => node.floorId === floor.id).length
  const isActive = floor.id === activeFloorId
  return <>
    <span className="eyebrow">Floor {String(index + 1).padStart(2, '0')}</span>
    <h2>{floor.name}</h2>
    <p className="lede">{count} concept{count === 1 ? '' : 's'}</p>
    {editable ? <div className="form-stack" style={{ marginBottom: 16 }}><Field label="Name" value={floor.name} onChange={(name) => patch({ name })} /></div> : null}
    {!isStructureView ? (
      <div className="inspector-preview">
        <FloorPreviewCard document={document} floorId={floor.id} showHeader={false} />
      </div>
    ) : null}
    <FloorNeighborhoods floorId={floor.id} />
    {!isActive ? <button type="button" className="secondary-button" onClick={() => onActiveFloor(floor.id)}>Enter {floor.name}</button> : null}
  </>
}

function RelationInspector({ relation, editable, commit, document, activeFloorId, onActiveFloor }: { relation: OntologyRelation; editable: boolean; commit: Commit; document: OntologyDocument; activeFloorId: string; onActiveFloor: (id: string) => void }) {
  const patch = (value: Partial<OntologyRelation>) => commit((current) => updateRelation(current, relation.id, value))
  const from = document.nodes.find((node) => node.id === relation.from)?.name
  const to = document.nodes.find((node) => node.id === relation.to)?.name
  const fromFloor = document.floors.find((floor) => floor.id === document.nodes.find((node) => node.id === relation.from)?.floorId) ?? null
  const toFloor = document.floors.find((floor) => floor.id === document.nodes.find((node) => node.id === relation.to)?.floorId) ?? null
  const crossesFloors = Boolean(fromFloor && toFloor && fromFloor.id !== toFloor.id)
  const currentIndex = document.floors.findIndex((floor) => floor.id === activeFloorId)
  const jumpFor = (floor: OntologyFloor | null) => {
    if (!floor || floor.id === activeFloorId) return null
    const label = floor.name
    const up = document.floors.indexOf(floor) > currentIndex
    return <button type="button" key={floor.id} onClick={() => onActiveFloor(floor.id)}>Go to {label} {up ? '↑' : '↓'}</button>
  }
  const nodeOptions = document.floors.flatMap((floor) => document.nodes.filter((node) => node.floorId === floor.id).map((node) => ({ value: node.id, label: `${node.code} · ${node.name}`, group: floor.name })))
  return <><span className="eyebrow">{relation.kind} relation</span><h2>{relation.label}</h2><div className="relation-direction"><div><strong>{from}</strong>{fromFloor ? <small>{fromFloor.name}</small> : null}</div><button type="button" title="Reverse relation globally" disabled={!editable} onClick={() => patch({ from: relation.to, to: relation.from })}>⇄</button><div><strong>{to}</strong>{toFloor ? <small>{toFloor.name}</small> : null}</div></div>{crossesFloors ? <div className="relation-floor-jump">{[jumpFor(fromFloor), jumpFor(toFloor)]}</div> : null}{editable ? <div className="form-stack"><Field label="Name" value={relation.label} onChange={(value) => patch({ label: value })} /><SelectField label="From" ariaLabel="Relation source" value={relation.from} options={nodeOptions} onChange={(from) => patch({ from })} /><SelectField label="To" ariaLabel="Relation target" value={relation.to} options={nodeOptions} onChange={(to) => patch({ to })} /><SelectField label="Relation kind" ariaLabel="Relation kind" value={relation.kind} options={['full', 'dotted'].map((kind) => ({ value: kind, label: `${kind[0]!.toUpperCase()}${kind.slice(1)}` }))} onChange={(kind) => patch({ kind: kind as OntologyRelation['kind'] })} /></div> : <p>This path carries {relation.label} from {from} to {to}.</p>}</>
}

function GroupInspector({ group, editable, commit, document, setSelection, onActiveFloor }: { group: OntologyGroup; editable: boolean; commit: Commit; document: OntologyDocument; setSelection: (selection: Selection) => void; onActiveFloor: (id: string) => void }) {
  const patch = (value: Partial<OntologyGroup>) => commit((current) => updateGroup(current, group.id, value))
  const members = document.nodes.filter((node) => node.groupId === group.id)
  return <><span className="eyebrow">Neighborhood</span><h2>{group.name}</h2><p className="lede">{members.length} concepts</p>{editable ? <div className="form-stack"><Field label="Name" value={group.name} onChange={(value) => patch({ name: value })} /><Field label="Purpose" value={group.description} multiline onChange={(value) => patch({ description: value })} /></div> : <p>{group.description}</p>}<div className="inspector-neighborhoods">{document.floors.map((floor) => {
    const floorMembers = members.filter((node) => node.floorId === floor.id)
    if (!floorMembers.length) return null
    return <section className="rail-section" key={floor.id} style={{ paddingTop: 8 }}><span className="group-heading"><span>{floor.name}</span><span>{floorMembers.length}</span></span><div className="node-list">{floorMembers.map((node) => <button key={node.id} type="button" className="node-row" onClick={() => { onActiveFloor(floor.id); setSelection({ kind: 'node', id: node.id }) }}><span className="node-code">{node.code}</span><span>{node.name}</span><span className="node-size">{node.size.toUpperCase()}</span></button>)}</div></section>
  })}</div></>
}
