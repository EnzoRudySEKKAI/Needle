import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { codeFromName, makeId } from '../domain/id'
import { deleteRelationsCascade } from '../domain/commands'
import type { Selection } from '../domain/types'
import { nextFreePosition } from '../map/core/layout'
import { useI18n } from '../i18n/useI18n'
import { AppSelect, SelectField } from './AppSelect'
import { useDocumentStore } from './document-store'

type RailTab = 'concepts' | 'relations' | 'scenarios'
type RelationScope = 'floor' | 'all' | 'cross-floor'

type LeftRailProps = {
  activeFlowId: string | null
  onActiveFlow: (id: string | null) => void
  activeFloorId: string
  onActiveFloor: (id: string) => void
  editable: boolean
  onCollapse?: () => void
  onStartConnection?: (sourceId: string) => void
  scenarioFilter?: { relationIds: Set<string>; nodeIds: Set<string> } | null
}

const tabs: RailTab[] = ['concepts', 'relations', 'scenarios']

export function LeftRail({ activeFlowId, onActiveFlow, activeFloorId, onActiveFloor, editable, onCollapse, onStartConnection, scenarioFilter = null }: LeftRailProps) {
  void onActiveFloor
  const { t } = useI18n()
  const { document, selection, setSelection, commit } = useDocumentStore()
  const [activeTab, setActiveTab] = useState<RailTab>('concepts')
  const [search, setSearch] = useState('')
  const [relationScope, setRelationScope] = useState<RelationScope>('floor')
  const [hiddenGroupId, setHiddenGroupId] = useState('')
  const [isChoosingRelationSource, setIsChoosingRelationSource] = useState(false)
  const [relationSourceId, setRelationSourceId] = useState('')
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const nodeById = new Map(document.nodes.map((node) => [node.id, node]))

  const addGroup = () => {
    const id = makeId('group')
    commit((current) => ({ ...current, groups: [...current.groups, { id, name: 'New neighborhood', description: 'Describe what belongs here.' }] }))
    setSelection({ kind: 'group', id })
  }

  const addNode = (groupId: string) => {
    const id = makeId('node')
    const name = 'New concept'
    const code = codeFromName(name, new Set(document.nodes.map((node) => node.code)))
    const position = nextFreePosition(document.nodes.filter((node) => node.floorId === activeFloorId), groupId)
    commit((current) => ({ ...current, nodes: [...current.nodes, { id, code, name, groupId, floorId: activeFloorId, whatItDoes: 'Explain what this concept changes or makes possible.', howItsBuilt: '', size: 'm', properties: [], position, faceTexture: 'auto' }] }))
    setSelection({ kind: 'node', id })
  }

  const addFlow = () => {
    const id = makeId('flow')
    commit((current) => ({ ...current, flows: [...current.flows, { id, name: 'New scenario', payload: 'payload', summary: 'Explain what this journey accomplishes.', stages: [] }] }))
    setSelection({ kind: 'flow', id })
    onActiveFlow(id)
  }

  const select = (next: Selection) => {
    setSelection(next)
    if (next.kind !== 'flow') onActiveFlow(null)
  }

  const deleteRelation = (id: string) => {
    commit((current) => deleteRelationsCascade(current, new Set([id])))
    if (selection?.kind === 'relation' && selection.id === id) setSelection(null)
    onActiveFlow(null)
  }

  const chooseTab = (tab: RailTab) => {
    setActiveTab(tab)
    setSearch('')
  }

  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = tabs.length - 1
    if (nextIndex === null) return
    event.preventDefault()
    chooseTab(tabs[nextIndex]!)
    tabRefs.current[nextIndex]?.focus()
  }

  const beginRelation = () => {
    const preferredSource = selection?.kind === 'node' ? selection.id : document.nodes.find((node) => node.floorId === activeFloorId)?.id ?? document.nodes[0]?.id ?? ''
    setRelationSourceId(preferredSource)
    setIsChoosingRelationSource(true)
    chooseTab('concepts')
  }

  const sourceNodes = document.nodes.filter((node) => node.floorId === activeFloorId)
  const selectedSourceId = sourceNodes.some((node) => node.id === relationSourceId) ? relationSourceId : sourceNodes[0]?.id ?? ''
  const filteredFlows = document.flows.filter((flow) => !normalizedSearch || [flow.name, flow.payload, flow.summary].some((value) => value.toLocaleLowerCase().includes(normalizedSearch)))
  const filteredRelations = document.relations.filter((relation) => {
    const from = nodeById.get(relation.from)
    const to = nodeById.get(relation.to)
    const isOnFloor = from?.floorId === activeFloorId || to?.floorId === activeFloorId
    const isCrossFloor = Boolean(from && to && from.floorId !== to.floorId)
    const isInScope = relationScope === 'all' || (relationScope === 'floor' ? isOnFloor : isCrossFloor)
    const matchesSearch = !normalizedSearch || [relation.label, from?.name ?? '', to?.name ?? ''].some((value) => value.toLocaleLowerCase().includes(normalizedSearch))
    const matchesScenario = !scenarioFilter || scenarioFilter.relationIds.has(relation.id)
    return isInScope && matchesSearch && matchesScenario
  })

  return (
    <aside className="left-rail">
      <div className="rail-tabs-wrap">
        <div className="rail-tabs" role="tablist" aria-label={t('content.mapContent')}>
          {tabs.map((tab, index) => (
            <button
              key={tab}
              ref={(element) => { tabRefs.current[index] = element }}
              id={`left-rail-tab-${tab}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`left-rail-panel-${tab}`}
              tabIndex={activeTab === tab ? 0 : -1}
              className={activeTab === tab ? 'is-active' : ''}
              onClick={() => chooseTab(tab)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              {t(tab === 'concepts' ? 'content.concepts' : tab === 'relations' ? 'content.relations' : 'content.scenarios')}
            </button>
          ))}
        </div>
        {onCollapse ? <button type="button" className="rail-collapse-button" aria-label={t('content.hideLeftRail')} title={t('content.hideLeftRailShortcut')} onClick={onCollapse}><span aria-hidden="true">‹</span></button> : null}
      </div>

      <div className="rail-section rail-search-section">
        <label className="field">
          <span>{t('content.searchTab', { tab: t(activeTab === 'concepts' ? 'content.concepts' : activeTab === 'relations' ? 'content.relations' : 'content.scenarios') })}</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('content.searchTab', { tab: t(activeTab === 'concepts' ? 'content.concepts' : activeTab === 'relations' ? 'content.relations' : 'content.scenarios') })} aria-label={t('content.searchTab', { tab: t(activeTab === 'concepts' ? 'content.concepts' : activeTab === 'relations' ? 'content.relations' : 'content.scenarios') })} />
        </label>
      </div>

      {activeTab === 'scenarios' ? <section id="left-rail-panel-scenarios" aria-labelledby="left-rail-tab-scenarios" className="rail-section rail-flows" role="tabpanel">
        <div className="rail-panel-heading"><div><span>{t('content.scenarios')}</span><small>{filteredFlows.length}</small></div>{editable ? <button type="button" className="rail-create-action" onClick={addFlow}><i aria-hidden="true">+</i><span>{t('content.scenario')}</span></button> : null}</div>
        <div className="flow-list">
          {filteredFlows.map((flow) => {
            const index = document.flows.findIndex((candidate) => candidate.id === flow.id)
            return (
              <button key={flow.id} type="button" className={`flow-row ${activeFlowId === flow.id ? 'is-active' : ''}`} title={t('content.flowTitle', { name: flow.name, summary: flow.summary })} onClick={() => { const next = activeFlowId === flow.id ? null : flow.id; onActiveFlow(next); setSelection(next ? { kind: 'flow', id: flow.id } : null) }}>
                <span className="flow-index">{String(index + 1).padStart(2, '0')}</span><span className="flow-name" title={flow.name}>{flow.name}</span><span className="flow-meta">{t(flow.stages.length === 1 ? 'content.stepCount' : 'content.stepsCount', { count: flow.stages.length })}</span>
              </button>
            )
          })}
          {filteredFlows.length === 0 ? <div><p className="rail-empty">{t(normalizedSearch ? 'content.noMatchingScenarios' : 'content.noScenarios')}</p>{normalizedSearch ? <button type="button" className="add-row" onClick={() => setSearch('')}>{t('content.clearSearch')}</button> : editable ? <button type="button" className="add-row" onClick={addFlow}>{t('content.createScenario')}</button> : null}</div> : null}
        </div>
      </section> : null}

      {activeTab === 'relations' ? <section id="left-rail-panel-relations" aria-labelledby="left-rail-tab-relations" className="rail-section rail-relations" role="tabpanel">
        <div className="rail-panel-heading"><div><span>{t('content.relations')}</span><small>{filteredRelations.length}</small></div>{editable && document.nodes.length > 0 ? <button type="button" className="rail-create-action" onClick={beginRelation}><i aria-hidden="true">+</i><span>{t('content.relation')}</span></button> : null}</div>
        <div className="segmented rail-scope-filter" aria-label={t('content.relationScope')}>
          {(['all', 'floor', 'cross-floor'] as const).map((scope) => <button key={scope} type="button" className={relationScope === scope ? 'is-active' : ''} aria-pressed={relationScope === scope} onClick={() => setRelationScope(scope)}>{t(scope === 'all' ? 'common.all' : scope === 'floor' ? 'content.scopeFloor' : 'content.scopeCrossFloor')}</button>)}
        </div>
        <div className="relation-list">
          {filteredRelations.map((relation) => {
            const from = nodeById.get(relation.from)
            const to = nodeById.get(relation.to)
            const direction = t('content.relationDirection', { from: from?.name ?? t('common.unknown'), to: to?.name ?? t('common.unknown') })
            const kind = t(relation.kind === 'full' ? 'content.kindFull' : 'content.kindDotted')
            return <div className={`relation-row ${selection?.kind === 'relation' && selection.id === relation.id ? 'is-active' : ''}`} key={relation.id}><button type="button" title={`${direction} · ${kind} · ${relation.label}`} onClick={() => select({ kind: 'relation', id: relation.id })}><span title={from?.name ?? t('content.unknownSource')}>{from?.code ?? '?'}</span><strong title={`${direction} · ${relation.label}`}>{direction} · {relation.label}</strong><span title={t('content.relationKindTitle', { kind })}>{kind}</span></button>{editable ? <button type="button" className="relation-row-delete" aria-label={t('content.deleteNamed', { name: relation.label })} title={t('content.deleteNamed', { name: relation.label })} onClick={() => deleteRelation(relation.id)}>×</button> : null}</div>
          })}
          {filteredRelations.length === 0 ? <div><p className="rail-empty">{t(scenarioFilter ? 'content.noScenarioRelations' : document.relations.length === 0 ? 'content.noRelations' : 'content.noMatchingRelations')}</p>{document.relations.length > 0 ? <button type="button" className="add-row" onClick={() => { setSearch(''); setRelationScope('all') }}>{t('content.resetFilters')}</button> : null}{editable && document.nodes.length > 0 ? <button type="button" className="rail-empty-action" onClick={beginRelation}>{t('content.createRelation')}</button> : null}</div> : null}
          {editable && document.nodes.length === 0 ? <div><p className="rail-empty">{t('content.addConceptBeforeRelation')}</p><button type="button" className="add-row" onClick={() => chooseTab('concepts')}>{t('content.goToConcepts')}</button></div> : null}
        </div>
      </section> : null}

      {activeTab === 'concepts' ? <div id="left-rail-panel-concepts" aria-labelledby="left-rail-tab-concepts" className="rail-neighborhoods" role="tabpanel">
        <section className="rail-section rail-concepts-heading"><div className="rail-panel-heading"><div><span>{t('content.concepts')}</span><small>{document.nodes.filter((node) => node.floorId === activeFloorId).length}</small></div>{editable ? <button type="button" className="rail-create-action" onClick={addGroup}><i aria-hidden="true">+</i><span>{t('content.neighborhood')}</span></button> : null}</div></section>
        {isChoosingRelationSource ? <section className="rail-section" aria-live="polite">
          <div className="rail-heading"><span>{t('content.chooseRelationSource')}</span><button type="button" aria-label={t('content.cancelRelationCreation')} title={t('common.cancel')} onClick={() => setIsChoosingRelationSource(false)}>×</button></div>
          {sourceNodes.length > 0 ? <div style={{ marginTop: 8 }}>
            <SelectField label={t('content.sourceConceptOnFloor')} ariaLabel={t('content.sourceConceptOnFloor')} value={selectedSourceId} options={sourceNodes.map((node) => ({ value: node.id, label: `${node.code} · ${node.name}` }))} onChange={(value) => { setRelationSourceId(value); select({ kind: 'node', id: value }) }} />
            {onStartConnection ? <button type="button" className="secondary-button" style={{ marginTop: 8 }} onClick={() => { onStartConnection(selectedSourceId); setIsChoosingRelationSource(false) }}>{t('content.startFromSelectedConcept')}</button> : <><p className="rail-empty">{t('content.connectFromInstruction')}</p><button type="button" className="add-row" onClick={() => select({ kind: 'node', id: selectedSourceId })}>{t('content.selectSourceConcept')}</button></>}
          </div> : <p className="rail-empty">{t('content.addConceptOnFloorBeforeRelation')}</p>}
        </section> : null}
        {(() => {
          const nodesOnFloor = document.nodes.filter((node) => node.floorId === activeFloorId && (!scenarioFilter || scenarioFilter.nodeIds.has(node.id)))
          const matchingNodes = nodesOnFloor.filter((node) => !normalizedSearch || [node.code, node.name, node.whatItDoes, ...node.properties.map((property) => property.value)].some((value) => value.toLocaleLowerCase().includes(normalizedSearch)))
          const groupsWithNodes = document.groups.filter((group) => nodesOnFloor.some((node) => node.groupId === group.id))
          const selectedGroupId = selection?.kind === 'group' ? selection.id : null
          const selectedGroup = selectedGroupId ? document.groups.find((group) => group.id === selectedGroupId) : null
          const shouldShowSelected = selectedGroup && nodesOnFloor.length > 0 && !groupsWithNodes.some((group) => group.id === selectedGroup.id)
          const baseGroups = nodesOnFloor.length === 0 ? document.groups : shouldShowSelected ? [...groupsWithNodes, selectedGroup!] : groupsWithNodes
          const displayGroups = normalizedSearch ? baseGroups.filter((group) => matchingNodes.some((node) => node.groupId === group.id)) : baseGroups
           if (document.groups.length === 0) return <section className="rail-section"><p className="rail-empty">{t('content.noNeighborhoods')}</p>{editable ? <button type="button" className="add-row" onClick={addGroup}>{t('content.createNeighborhood')}</button> : null}</section>
           if (normalizedSearch && displayGroups.length === 0) return <section className="rail-section"><p className="rail-empty">{t('content.noMatchingConceptsOnFloor')}</p><button type="button" className="add-row" onClick={() => setSearch('')}>{t('content.clearSearch')}</button></section>
           if (displayGroups.length === 0) return <section className="rail-section"><p className="rail-empty">{t(scenarioFilter ? 'content.noScenarioConceptsOnFloor' : 'content.noConceptsOnFloor')}</p>{!scenarioFilter && editable ? <button type="button" className="add-row" onClick={() => addNode(document.groups[0]!.id)}>{t('content.addFirstConcept')}</button> : null}</section>
          const hiddenGroups = document.groups.filter((group) => !baseGroups.some((visibleGroup) => visibleGroup.id === group.id))
          const selectedHiddenGroupId = hiddenGroups.some((group) => group.id === hiddenGroupId) ? hiddenGroupId : hiddenGroups[0]?.id ?? ''
          return (
            <>
              {displayGroups.map((group) => {
                const nodesForGroup = matchingNodes.filter((node) => node.groupId === group.id)
                return (
                  <section className="rail-section" key={group.id}>
                    <button type="button" className={`group-heading ${selection?.kind === 'group' && selection.id === group.id ? 'is-active' : ''}`} title={group.name} onClick={() => select({ kind: 'group', id: group.id })}><span title={group.name}>{group.name}</span><span>{nodesForGroup.length}</span></button>
                    <div className="node-list">
                      {nodesForGroup.map((node) => (
                        <button key={node.id} id={`rail-node-${node.id}`} type="button" className={`node-row ${selection?.kind === 'node' && selection.id === node.id ? 'is-active' : ''}`} title={`${node.code} · ${node.name}`} onClick={() => select({ kind: 'node', id: node.id })}><span className="node-code" title={node.code}>{node.code}</span><span title={node.name}>{node.name}</span><span className="node-size" title={t('content.sizeTitle', { size: node.size.toUpperCase() })}>{node.size.toUpperCase()}</span></button>
                      ))}
                      {editable && !normalizedSearch ? <button type="button" className="rail-add-concept" onClick={() => addNode(group.id)}><i aria-hidden="true">+</i><span>{t('content.addConcept')}</span></button> : null}
                    </div>
                  </section>
                )
              })}
              {editable && hiddenGroups.length > 0 && !normalizedSearch ? (
                <section className="rail-section" style={{ marginTop: 12, paddingTop: 12 }}>
                  <p className="rail-empty" style={{ fontSize: 10, marginBottom: 6 }}>{t('content.addConceptToNeighborhood')}</p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <AppSelect compact className="rail-inline-select" ariaLabel={t('content.neighborhoodForNewConcept')} value={selectedHiddenGroupId} options={hiddenGroups.map((group) => ({ value: group.id, label: group.name }))} onChange={setHiddenGroupId} />
                    <button type="button" className="rail-inline-add" onClick={() => addNode(selectedHiddenGroupId)}>{t('content.add')}</button>
                  </div>
                </section>
              ) : null}
            </>
          )
        })()}
      </div> : null}
    </aside>
  )
}
