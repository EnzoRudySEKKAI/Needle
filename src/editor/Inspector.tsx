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
import { useI18n } from '../i18n/useI18n'

type Commit = ReturnType<typeof useDocumentStore>['commit']

function Field({ label, value, onChange, multiline = false, type = 'text', maxLength }: { label: string; value: string | number; onChange: (value: string) => void; multiline?: boolean; type?: string; maxLength?: number }) {
  return <label className="field"><span>{label}</span>{multiline ? <textarea value={value} rows={4} onChange={(event) => onChange(event.target.value)} /> : <input type={type} value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />}</label>
}

function DisplayNameField() {
  const { t } = useI18n()
  const [name, setName] = useState(() => localStorage.getItem('needle:displayName') ?? '')
  return <Field label={t('content.collaborationName')} value={name} onChange={(value) => { setName(value); localStorage.setItem('needle:displayName', value); window.dispatchEvent(new CustomEvent('needle:display-name', { detail: value })) }} />
}

function FloorNeighborhoods({ floorId }: { floorId: string }) {
  const { t } = useI18n()
  const { document, selection, setSelection } = useDocumentStore()
  const groups = document.groups.filter((group) => document.nodes.some((node) => node.groupId === group.id && node.floorId === floorId))
  if (groups.length === 0) return <p className="rail-empty">{t('content.noNeighborhoodOnFloor')}</p>
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

export function Inspector({ editable, activeFloorId, hoveredFloorId, isStructureView = false, onActiveFloor, onActiveFlow, relationPickTarget, onRelationPickTarget, onRelationPreview, onStagePreview, connectionDraft, onStartConnection, onUpdateConnection, onCancelConnection, onCommitConnection, onCollapse, scenarioFocusActive = false, onScenarioFocusChange }: { editable: boolean; activeFloorId: string; hoveredFloorId?: string | null; isStructureView?: boolean; onActiveFloor: (id: string) => void; onActiveFlow: (id: string | null) => void; relationPickTarget: RelationPickTarget | null; onRelationPickTarget: (target: RelationPickTarget | null) => void; onRelationPreview: (preview: RelationPreview | null) => void; onStagePreview: (target: StagePreviewTarget | null) => void; connectionDraft: ConnectionDraft | null; onStartConnection: (sourceId: string) => void; onUpdateConnection: (draft: ConnectionDraft | null) => void; onCancelConnection: () => void; onCommitConnection: () => void; onCollapse?: () => void; scenarioFocusActive?: boolean; onScenarioFocusChange?: (value: boolean) => void }) {
  const { t } = useI18n()
  const { document, selection, setSelection, commit } = useDocumentStore()
  const diagnostics = validateDocument(document)
  const node = selection?.kind === 'node' ? document.nodes.find((item) => item.id === selection.id) : null
  const relation = selection?.kind === 'relation' ? document.relations.find((item) => item.id === selection.id) : null
  const group = selection?.kind === 'group' ? document.groups.find((item) => item.id === selection.id) : null
  const flow = selection?.kind === 'flow' ? document.flows.find((item) => item.id === selection.id) : null
  const floor = selection?.kind === 'floor' ? document.floors.find((item) => item.id === selection.id) : null
  const hoveredFloor = hoveredFloorId ? document.floors.find((item) => item.id === hoveredFloorId) ?? null : null
  const [pendingGroupDelete, setPendingGroupDelete] = useState<OntologyGroup | null>(null)
  const [pendingFloorDelete, setPendingFloorDelete] = useState<OntologyFloor | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Selection | null>(null)
  const selectionType = selection ? t(selection.kind === 'node' ? 'content.typeNode' : selection.kind === 'relation' ? 'content.typeRelation' : selection.kind === 'flow' ? 'content.typeFlow' : selection.kind === 'floor' ? 'content.typeFloor' : 'content.typeGroup') : ''
  const diagnosticMessage = (message: string) => {
    const patterns: Array<[RegExp, 'content.diagnosticDuplicateNode' | 'content.diagnosticDuplicateCode' | 'content.diagnosticInvalidFloor' | 'content.diagnosticInvalidNeighborhood' | 'content.diagnosticInvalidSize' | 'content.diagnosticMissingConcept' | 'content.diagnosticEmptyStep' | 'content.diagnosticMissingRelation', string]> = [
      [/^Duplicate node id: (.+)$/, 'content.diagnosticDuplicateNode', 'value'],
      [/^Duplicate roof code: (.+)$/, 'content.diagnosticDuplicateCode', 'value'],
      [/^(.+) has no valid floor\.$/, 'content.diagnosticInvalidFloor', 'name'],
      [/^(.+) has no valid neighborhood\.$/, 'content.diagnosticInvalidNeighborhood', 'name'],
      [/^(.+) has an invalid size\.$/, 'content.diagnosticInvalidSize', 'name'],
      [/^(.+) points to a missing concept\.$/, 'content.diagnosticMissingConcept', 'name'],
      [/^(.+) contains an empty step\.$/, 'content.diagnosticEmptyStep', 'name'],
      [/^(.+) uses a missing relation\.$/, 'content.diagnosticMissingRelation', 'name'],
    ]
    for (const [pattern, key, valueKey] of patterns) {
      const match = message.match(pattern)
      if (match) return t(key, { [valueKey]: match[1]! })
    }
    return message
  }

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
    return <aside key="connection" className="inspector">{onCollapse ? <button type="button" className="rail-collapse-button rail-collapse-right" aria-label={t('content.hideDetailRail')} title={t('content.hideDetailRail')} onClick={onCollapse}><span aria-hidden="true">›</span></button> : null}<ConnectionInspector draft={connectionDraft} document={document} onUpdate={onUpdateConnection} onCancel={onCancelConnection} onCommit={onCommitConnection} /></aside>
  }

  if (hoveredFloor) {
    const index = document.floors.findIndex((candidate) => candidate.id === hoveredFloor.id)
    const count = document.nodes.filter((node) => node.floorId === hoveredFloor.id).length
    return (
      <aside className="inspector">
        {onCollapse ? <button type="button" className="rail-collapse-button rail-collapse-right" aria-label={t('content.hideDetailRail')} title={t('content.hideDetailRail')} onClick={onCollapse}><span aria-hidden="true">›</span></button> : null}
        <span className="eyebrow">{t('content.floorIndex', { index: String(index + 1).padStart(2, '0') })}</span>
        <h2>{hoveredFloor.name}</h2>
        <p className="lede">{t(count === 1 ? 'content.conceptCount' : 'content.conceptsCount', { count })}</p>
        <div className="inspector-preview">
          <FloorPreviewCard document={document} floorId={hoveredFloor.id} showHeader={false} />
        </div>
        <FloorNeighborhoods floorId={hoveredFloor.id} />
      </aside>
    )
  }

  if (!selection) {
    return (
      <aside className="inspector intro-panel">
        {onCollapse ? <button type="button" className="rail-collapse-button rail-collapse-right" aria-label={t('content.hideDetailRail')} title={t('content.hideDetailRail')} onClick={onCollapse}><span aria-hidden="true">›</span></button> : null}
        <span className="eyebrow">{t('content.ontologyMap')}</span>
        <h2>{document.name}</h2>
        <p className="lede">{document.description}</p>
        {editable ? <div className="form-stack map-settings"><DisplayNameField /><Field label={t('content.mapName')} value={document.name} onChange={(value) => commit((current) => ({ ...current, name: value }))} /><Field label={t('content.version')} value={document.version} onChange={(value) => commit((current) => ({ ...current, version: value }))} /><StructureTypePicker value={document.structureType} onChange={(structureType) => commit((current) => ({ ...current, structureType }))} /><Field label={t('content.purpose')} value={document.description} multiline onChange={(value) => commit((current) => ({ ...current, description: value }))} /></div> : null}
        {diagnostics.length ? <section className="diagnostics"><h3>{t('content.diagnostics')}</h3>{diagnostics.map((item, index) => item.target && targetExists(item.target) ? <button key={index} type="button" className={item.level} onClick={() => navigateTo(item.target!)}>{diagnosticMessage(item.message)}</button> : <p key={index} className={item.level}>{diagnosticMessage(item.message)}</p>)}</section> : null}
      </aside>
    )
  }

  return <>
    <aside key={`${selection.kind}:${selection.id}`} className="inspector">
      {onCollapse ? <button type="button" className="rail-collapse-button rail-collapse-right" aria-label={t('content.hideDetailRail')} title={t('content.hideDetailRail')} onClick={onCollapse}><span aria-hidden="true">›</span></button> : null}
      {node ? <NodeInspector node={node} editable={editable} commit={commit} document={document} onStartConnection={onStartConnection} /> : null}
      {relation ? <RelationInspector relation={relation} editable={editable} commit={commit} document={document} activeFloorId={activeFloorId} onActiveFloor={onActiveFloor} /> : null}
      {group ? <GroupInspector group={group} editable={editable} commit={commit} document={document} setSelection={setSelection} onActiveFloor={onActiveFloor} /> : null}
      {flow ? <ScenarioInspector flow={flow} editable={editable} commit={commit} document={document} relationPickTarget={relationPickTarget} onRelationPickTarget={onRelationPickTarget} onRelationPreview={onRelationPreview} onStagePreview={onStagePreview} focusActive={scenarioFocusActive} onFocusChange={onScenarioFocusChange} /> : null}
      {floor ? <FloorInspector floor={floor} editable={editable} commit={commit} document={document} activeFloorId={activeFloorId} isStructureView={isStructureView} onActiveFloor={onActiveFloor} /> : null}
      {editable ? <button type="button" className="danger-button" disabled={selection.kind === 'floor' && document.floors.length <= 1} onClick={() => selection.kind === 'group' && group ? setPendingGroupDelete(group) : selection.kind === 'floor' && floor ? setPendingFloorDelete(floor) : setPendingDelete(selection)}>{t('content.deleteType', { type: selectionType })}</button> : null}
    </aside>
    {pendingGroupDelete ? <GroupDeleteDialog group={pendingGroupDelete} document={document} onCancel={() => setPendingGroupDelete(null)} onConfirm={() => { remove({ kind: 'group', id: pendingGroupDelete.id }); setPendingGroupDelete(null) }} /> : null}
    {pendingFloorDelete ? <FloorDeleteDialog floor={pendingFloorDelete} document={document} onCancel={() => setPendingFloorDelete(null)} onDelete={() => { const fallback = document.floors.find((candidate) => candidate.id !== pendingFloorDelete.id)!; remove({ kind: 'floor', id: pendingFloorDelete.id }); onActiveFloor(fallback.id); setPendingFloorDelete(null) }} onMove={(targetFloorId) => { commit((current) => moveFloorContents(current, pendingFloorDelete.id, targetFloorId)); onActiveFloor(targetFloorId); setSelection({ kind: 'floor', id: targetFloorId }); setPendingFloorDelete(null) }} /> : null}
    {pendingDelete ? <SelectionDeleteDialog target={pendingDelete} document={document} onCancel={() => setPendingDelete(null)} onConfirm={() => { remove(pendingDelete); setPendingDelete(null) }} /> : null}
  </>
}

function SelectionDeleteDialog({ target, document, onCancel, onConfirm }: { target: Selection; document: OntologyDocument; onCancel: () => void; onConfirm: () => void }) {
  const { t } = useI18n()
  const node = target.kind === 'node' ? document.nodes.find((item) => item.id === target.id) : null
  const relation = target.kind === 'relation' ? document.relations.find((item) => item.id === target.id) : null
  const flow = target.kind === 'flow' ? document.flows.find((item) => item.id === target.id) : null
  const relationIds = new Set(node ? document.relations.filter((item) => item.from === node.id || item.to === node.id).map((item) => item.id) : relation ? [relation.id] : [])
  const stepCount = document.flows.reduce((count, item) => count + flowRelationIds(item).filter((id) => relationIds.has(id)).length, 0)
  const name = node?.name ?? relation?.label ?? flow?.name ?? target.id
  const impact = node ? t('content.nodeDeleteImpact', { relations: relationIds.size, traversals: stepCount })
    : relation ? t('content.relationDeleteImpact', { traversals: stepCount })
      : t('content.scenarioDeleteImpact', { stages: flow?.stages.length ?? 0, traversals: flow ? flowRelationIds(flow).length : 0 })
  const type = t(target.kind === 'node' ? 'content.typeNode' : target.kind === 'relation' ? 'content.typeRelation' : 'content.typeFlow')
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onCancel}><section className="delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-selection-title" onMouseDown={(event) => event.stopPropagation()}><span className="eyebrow">{t('content.destructiveAction')}</span><h2 id="delete-selection-title">{t('content.deleteQuestion', { name })}</h2><p>{t('content.undoSelection', { impact })}</p><div><button type="button" onClick={onCancel}>{t('common.cancel')}</button><button type="button" className="confirm-delete" onClick={onConfirm}>{t('content.deleteType', { type })}</button></div></section></div>
}

function FloorDeleteDialog({ floor, document, onCancel, onDelete, onMove }: { floor: OntologyFloor; document: OntologyDocument; onCancel: () => void; onDelete: () => void; onMove: (targetFloorId: string) => void }) {
  const { t } = useI18n()
  const targets = document.floors.filter((candidate) => candidate.id !== floor.id)
  const [targetFloorId, setTargetFloorId] = useState(targets[0]!.id)
  const count = document.nodes.filter((node) => node.floorId === floor.id).length
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onCancel}><section className="delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-floor-title" onMouseDown={(event) => event.stopPropagation()}><span className="eyebrow">{t('content.floorRemoval')}</span><h2 id="delete-floor-title">{t('content.removeFloorQuestion', { name: floor.name })}</h2><p>{t('content.floorDeleteImpact', { count })}</p><SelectField label={t('content.moveConceptsTo')} ariaLabel={t('content.moveConceptsTo')} value={targetFloorId} options={targets.map((target) => ({ value: target.id, label: target.name }))} onChange={setTargetFloorId} /><div><button type="button" onClick={onCancel}>{t('common.cancel')}</button><button type="button" onClick={() => onMove(targetFloorId)}>{t('content.moveAndRemove')}</button><button type="button" className="confirm-delete" onClick={onDelete}>{t('content.deleteContents')}</button></div></section></div>
}

function GroupDeleteDialog({ group, document, onCancel, onConfirm }: { group: OntologyGroup; document: OntologyDocument; onCancel: () => void; onConfirm: () => void }) {
  const { t } = useI18n()
  const nodeIds = new Set(document.nodes.filter((node) => node.groupId === group.id).map((node) => node.id))
  const relationIds = new Set(document.relations.filter((relation) => nodeIds.has(relation.from) || nodeIds.has(relation.to)).map((relation) => relation.id))
  const stepCount = document.flows.reduce((count, flow) => count + flowRelationIds(flow).filter((id) => relationIds.has(id)).length, 0)
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onCancel}><section className="delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-group-title" onMouseDown={(event) => event.stopPropagation()}><span className="eyebrow">{t('content.destructiveAction')}</span><h2 id="delete-group-title">{t('content.deleteQuestion', { name: group.name })}</h2><p>{t('content.groupDeleteImpact', { concepts: nodeIds.size, relations: relationIds.size, steps: stepCount })}</p><div><button type="button" onClick={onCancel}>{t('common.cancel')}</button><button type="button" className="confirm-delete" onClick={onConfirm}>{t('content.deleteNeighborhood')}</button></div></section></div>
}

function ConnectionInspector({ draft, document, onUpdate, onCancel, onCommit }: { draft: ConnectionDraft; document: OntologyDocument; onUpdate: (draft: ConnectionDraft | null) => void; onCancel: () => void; onCommit: () => void }) {
  const { t } = useI18n()
  const source = document.nodes.find((node) => node.id === draft.sourceId)
  const compatibleFlows = document.flows
  const count = draft.targets.length
  const toggleRemote = (nodeId: string) => {
    const exists = draft.targets.some((target) => target.nodeId === nodeId)
    onUpdate({ ...draft, targets: exists ? draft.targets.filter((target) => target.nodeId !== nodeId) : [...draft.targets, { nodeId, direction: 'outbound' }] })
  }
  return <>
    <span className="eyebrow">{t('content.connectionMode')}</span>
    <h2>{t('content.connectionFrom', { name: source?.name ?? t('common.unknown') })}</h2>
    <p className="lede">{t('content.connectionInstruction')}</p>
    <div className="connection-targets">
      {count === 0 ? <p>{t('content.nothingSelected')}</p> : draft.targets.map((target) => {
        const node = document.nodes.find((item) => item.id === target.nodeId)
        const outbound = target.direction === 'outbound'
        return <div key={target.nodeId}><span className="node-code">{outbound ? source?.code : node?.code}</span><strong>{outbound ? source?.name : node?.name}</strong><button type="button" title={t('content.reverseConnection')} onClick={() => onUpdate({ ...draft, targets: draft.targets.map((item) => item.nodeId === target.nodeId ? { ...item, direction: item.direction === 'outbound' ? 'inbound' : 'outbound' } : item) })}>→</button><span className="node-code">{outbound ? node?.code : source?.code}</span><strong>{outbound ? node?.name : source?.name}</strong><button type="button" aria-label={t('content.removeNamed', { name: node?.name ?? t('common.unknown') })} onClick={() => onUpdate({ ...draft, targets: draft.targets.filter((item) => item.nodeId !== target.nodeId) })}>×</button></div>
      })}
    </div>
    <div className="connection-remote">
      <p className="connection-remote-title">{t('content.otherFloors')}</p>
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
      <Field label={t('content.relationLabel')} value={draft.label} onChange={(label) => onUpdate({ ...draft, label })} />
      <SelectField label={t('content.relationKind')} ariaLabel={t('content.relationKind')} value={draft.kind} options={['full', 'dotted'].map((kind) => ({ value: kind, label: t(kind === 'full' ? 'content.kindFull' : 'content.kindDotted') }))} onChange={(kind) => onUpdate({ ...draft, kind: kind as ConnectionDraft['kind'] })} />
      <SelectField label={t('content.addParallelStep')} ariaLabel={t('content.connectionScenario')} value={draft.flowId ?? ''} options={[{ value: '', label: t('content.noScenario') }, ...compatibleFlows.map((flow) => ({ value: flow.id, label: flow.name }))]} onChange={(flowId) => onUpdate({ ...draft, flowId: flowId || null })} />
    </div>
    <div className="connection-actions"><button type="button" onClick={onCancel}>{t('common.cancel')}</button><button type="button" className="primary-action" disabled={count === 0} onClick={onCommit}>{t(count === 1 ? 'content.createConnection' : 'content.createConnections', { count })}</button></div>
  </>
}

function NodeInspector({ node, editable, commit, document, onStartConnection }: { node: OntologyNode; editable: boolean; commit: Commit; document: OntologyDocument; onStartConnection: (sourceId: string) => void }) {
  const { t } = useI18n()
  const patch = (value: Partial<OntologyNode>) => commit((current) => updateNode(current, node.id, value))
  return <>
    {!editable ? <><span className="eyebrow">{node.code}</span><h2>{node.name}</h2><p className="lede">{node.size.toUpperCase()}</p></> : null}
    {editable ? <div className="form-stack">
      <Field label={t('content.code')} value={node.code} maxLength={3} onChange={(value) => patch({ code: value.toUpperCase() })} />
      <Field label={t('content.name')} value={node.name} onChange={(value) => patch({ name: value })} />
      <SelectField label={t('content.size')} ariaLabel={t('content.conceptSize')} value={node.size} options={(['xs', 's', 'm', 'l', 'xl'] as const).map((size) => ({ value: size, label: size.toUpperCase() }))} onChange={(size) => patch({ size: size as BuildingSize })} />
      <SelectField label={t('content.neighborhood')} ariaLabel={t('content.conceptNeighborhood')} value={node.groupId} options={document.groups.map((group) => ({ value: group.id, label: group.name }))} onChange={(groupId) => patch({ groupId })} />
      <Field label={t('content.whatItDoes')} value={node.whatItDoes} multiline onChange={(value) => patch({ whatItDoes: value })} />
      <button type="button" className="secondary-button connect-button" onClick={() => onStartConnection(node.id)}>{t('content.connectFrom', { name: node.name })}</button>
      <BuildingAppearancePicker archetype={node.archetypeOverride} texture={node.faceTexture} onArchetype={(value) => patch({ archetypeOverride: value })} onTexture={(value) => patch({ faceTexture: value })} />
      <fieldset className="property-editor"><legend>{t('content.properties')}</legend>{node.properties.map((property) => <div key={property.id}><input aria-label={t('content.propertyName')} value={property.key} onChange={(event) => patch({ properties: node.properties.map((item) => item.id === property.id ? { ...item, key: event.target.value } : item) })} /><input aria-label={t('content.propertyValue')} value={property.value} onChange={(event) => patch({ properties: node.properties.map((item) => item.id === property.id ? { ...item, value: event.target.value } : item) })} /><button type="button" aria-label={t('content.removeProperty')} onClick={() => patch({ properties: node.properties.filter((item) => item.id !== property.id) })}>×</button></div>)}<button type="button" onClick={() => patch({ properties: [...node.properties, { id: makeId('property'), key: 'property', value: 'value' }] })}>{t('content.addProperty')}</button></fieldset>
    </div> : <><p>{node.whatItDoes}</p>{node.properties.length ? <dl className="property-readout">{node.properties.map((property) => <div key={property.id}><dt>{property.key}</dt><dd>{property.value}</dd></div>)}</dl> : null}</>}
  </>
}

function FloorInspector({ floor, editable, commit, document, activeFloorId, isStructureView = false, onActiveFloor }: { floor: OntologyFloor; editable: boolean; commit: Commit; document: OntologyDocument; activeFloorId: string; isStructureView?: boolean; onActiveFloor: (id: string) => void }) {
  const { t } = useI18n()
  const patch = (value: Partial<OntologyFloor>) => commit((current) => ({ ...current, floors: current.floors.map((candidate) => candidate.id === floor.id ? { ...candidate, ...value } : candidate) }))
  const index = document.floors.findIndex((candidate) => candidate.id === floor.id)
  const count = document.nodes.filter((node) => node.floorId === floor.id).length
  const isActive = floor.id === activeFloorId
  return <>
    <span className="eyebrow">{t('content.floorIndex', { index: String(index + 1).padStart(2, '0') })}</span>
    <h2>{floor.name}</h2>
    <p className="lede">{t(count === 1 ? 'content.conceptCount' : 'content.conceptsCount', { count })}</p>
    {editable ? <div className="form-stack" style={{ marginBottom: 16 }}><Field label={t('content.name')} value={floor.name} onChange={(name) => patch({ name })} /></div> : null}
    {!isStructureView ? (
      <div className="inspector-preview">
        <FloorPreviewCard document={document} floorId={floor.id} showHeader={false} />
      </div>
    ) : null}
    <FloorNeighborhoods floorId={floor.id} />
    {!isActive ? <button type="button" className="secondary-button" onClick={() => onActiveFloor(floor.id)}>{t('content.enterFloor', { name: floor.name })}</button> : null}
  </>
}

function RelationInspector({ relation, editable, commit, document, activeFloorId, onActiveFloor }: { relation: OntologyRelation; editable: boolean; commit: Commit; document: OntologyDocument; activeFloorId: string; onActiveFloor: (id: string) => void }) {
  const { t } = useI18n()
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
    return <button type="button" key={floor.id} onClick={() => onActiveFloor(floor.id)}>{t('content.goToFloor', { name: label, direction: up ? '↑' : '↓' })}</button>
  }
  const nodeOptions = document.floors.flatMap((floor) => document.nodes.filter((node) => node.floorId === floor.id).map((node) => ({ value: node.id, label: `${node.code} · ${node.name}`, group: floor.name })))
  const kind = t(relation.kind === 'full' ? 'content.kindFull' : 'content.kindDotted')
  return <><span className="eyebrow">{t('content.relationKindTitle', { kind })}</span><h2>{relation.label}</h2><div className="relation-direction"><div><strong>{from}</strong>{fromFloor ? <small>{fromFloor.name}</small> : null}</div><button type="button" title={t('content.reverseRelationGlobally')} disabled={!editable} onClick={() => patch({ from: relation.to, to: relation.from })}>⇄</button><div><strong>{to}</strong>{toFloor ? <small>{toFloor.name}</small> : null}</div></div>{crossesFloors ? <div className="relation-floor-jump">{[jumpFor(fromFloor), jumpFor(toFloor)]}</div> : null}{editable ? <div className="form-stack"><Field label={t('content.name')} value={relation.label} onChange={(value) => patch({ label: value })} /><SelectField label={t('content.from')} ariaLabel={t('content.relationSource')} value={relation.from} options={nodeOptions} onChange={(from) => patch({ from })} /><SelectField label={t('content.to')} ariaLabel={t('content.relationTarget')} value={relation.to} options={nodeOptions} onChange={(to) => patch({ to })} /><SelectField label={t('content.relationKind')} ariaLabel={t('content.relationKind')} value={relation.kind} options={['full', 'dotted'].map((value) => ({ value, label: t(value === 'full' ? 'content.kindFull' : 'content.kindDotted') }))} onChange={(value) => patch({ kind: value as OntologyRelation['kind'] })} /></div> : <p>{t('content.pathDescription', { label: relation.label, from: from ?? t('common.unknown'), to: to ?? t('common.unknown') })}</p>}</>
}

function GroupInspector({ group, editable, commit, document, setSelection, onActiveFloor }: { group: OntologyGroup; editable: boolean; commit: Commit; document: OntologyDocument; setSelection: (selection: Selection) => void; onActiveFloor: (id: string) => void }) {
  const { t } = useI18n()
  const patch = (value: Partial<OntologyGroup>) => commit((current) => updateGroup(current, group.id, value))
  const members = document.nodes.filter((node) => node.groupId === group.id)
  return <><span className="eyebrow">{t('content.neighborhood')}</span><h2>{group.name}</h2><p className="lede">{t(members.length === 1 ? 'content.conceptCount' : 'content.conceptsCount', { count: members.length })}</p>{editable ? <div className="form-stack"><Field label={t('content.name')} value={group.name} onChange={(value) => patch({ name: value })} /><Field label={t('content.purpose')} value={group.description} multiline onChange={(value) => patch({ description: value })} /></div> : <p>{group.description}</p>}<div className="inspector-neighborhoods">{document.floors.map((floor) => {
    const floorMembers = members.filter((node) => node.floorId === floor.id)
    if (!floorMembers.length) return null
    return <section className="rail-section" key={floor.id} style={{ paddingTop: 8 }}><span className="group-heading"><span>{floor.name}</span><span>{floorMembers.length}</span></span><div className="node-list">{floorMembers.map((node) => <button key={node.id} type="button" className="node-row" onClick={() => { onActiveFloor(floor.id); setSelection({ kind: 'node', id: node.id }) }}><span className="node-code">{node.code}</span><span>{node.name}</span><span className="node-size">{node.size.toUpperCase()}</span></button>)}</div></section>
  })}</div></>
}
