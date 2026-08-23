import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { OntologyDocument, Selection } from '../domain/types'
import { FloorMiniPlan } from '../map/components/FloorMiniPlan'

export type CommandPaletteProps = {
  open: boolean
  document: OntologyDocument
  activeFloorId: string
  onClose: () => void
  onSelect: (selection: Selection, floorId?: string) => void
  onOpenFlow: (flowId: string) => void
}

type PaletteResult = {
  key: string
  label: string
  detail: string
  searchText: string
  selection: Selection
  floorId?: string
}

export function CommandPalette({ open, document: mapDocument, activeFloorId, onClose, onSelect, onOpenFlow }: CommandPaletteProps) {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dialogRef = useRef<HTMLElement | null>(null)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const nodeById = new Map(mapDocument.nodes.map((node) => [node.id, node]))
  const floorById = new Map(mapDocument.floors.map((floor) => [floor.id, floor]))
  const groupById = new Map(mapDocument.groups.map((group) => [group.id, group]))
  const relationById = new Map(mapDocument.relations.map((relation) => [relation.id, relation]))
  const results: PaletteResult[] = [
    ...mapDocument.floors.map((floor) => ({
      key: `floor:${floor.id}`,
      label: floor.name,
      detail: floor.id === activeFloorId ? 'Floor - current' : 'Floor',
      searchText: `${floor.name} ${floor.id} floor`,
      selection: { kind: 'floor' as const, id: floor.id },
      floorId: floor.id,
    })),
    ...mapDocument.groups.map((group) => {
      const groupNodes = mapDocument.nodes.filter((node) => node.groupId === group.id)
      return {
        key: `group:${group.id}`,
        label: group.name,
        detail: `Neighborhood - ${groupNodes.length} concept${groupNodes.length === 1 ? '' : 's'}`,
        searchText: `${group.name} ${group.description} ${group.id} neighborhood group ${groupNodes.map((node) => `${node.name} ${node.code}`).join(' ')}`,
        selection: { kind: 'group' as const, id: group.id },
        floorId: groupNodes.find((node) => node.floorId === activeFloorId)?.floorId ?? groupNodes[0]?.floorId,
      }
    }),
    ...mapDocument.nodes.map((node) => ({
      key: `node:${node.id}`,
      label: node.name,
      detail: `${node.code} - ${groupById.get(node.groupId)?.name ?? 'Unknown neighborhood'} - ${floorById.get(node.floorId)?.name ?? 'Unknown floor'}`,
      searchText: [node.id, node.code, node.name, node.whatItDoes, node.size, node.archetypeOverride, node.faceTexture, groupById.get(node.groupId)?.name, floorById.get(node.floorId)?.name, ...node.properties.flatMap((property) => [property.id, property.key, property.value])].filter(Boolean).join(' '),
      selection: { kind: 'node' as const, id: node.id },
      floorId: node.floorId,
    })),
    ...mapDocument.relations.map((relation) => {
      const from = nodeById.get(relation.from)
      const to = nodeById.get(relation.to)
      return {
        key: `relation:${relation.id}`,
        label: relation.label || `${from?.name ?? relation.from} to ${to?.name ?? relation.to}`,
        detail: `Relation - ${from?.name ?? relation.from} to ${to?.name ?? relation.to}`,
        searchText: `${relation.id} ${relation.label} ${relation.kind} relation ${from?.name ?? ''} ${from?.code ?? ''} ${to?.name ?? ''} ${to?.code ?? ''}`,
        selection: { kind: 'relation' as const, id: relation.id },
        floorId: from?.floorId ?? to?.floorId,
      }
    }),
    ...mapDocument.flows.map((flow) => {
      const traversedRelations = flow.stages.flatMap((stage) => stage.traversals.map((traversal) => relationById.get(traversal.relationId))).filter((relation) => relation !== undefined)
      const relatedText = traversedRelations.flatMap((relation) => {
        const from = nodeById.get(relation.from)
        const to = nodeById.get(relation.to)
        return [relation.label, relation.kind, from?.name, from?.code, to?.name, to?.code]
      }).filter(Boolean).join(' ')
      return {
        key: `flow:${flow.id}`,
        label: flow.name,
        detail: `Scenario - ${flow.stages.length} stage${flow.stages.length === 1 ? '' : 's'}`,
        searchText: `${flow.id} ${flow.name} ${flow.payload} ${flow.summary} scenario flow ${relatedText}`,
        selection: { kind: 'flow' as const, id: flow.id },
      }
    }),
  ]
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const filtered = terms.length === 0 ? results : results.filter((result) => {
    const text = result.searchText.toLocaleLowerCase()
    return terms.every((term) => text.includes(term))
  })

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    requestAnimationFrame(() => { setQuery(''); setActiveIndex(0); inputRef.current?.focus() })
    return () => previouslyFocused?.focus()
  }, [open])

  if (!open) return null
  const activeResult = filtered[activeIndex]

  const choose = (result: PaletteResult | undefined) => {
    if (!result) return
    if (result.selection.kind === 'flow') onOpenFlow(result.selection.id)
    else onSelect(result.selection, result.floorId)
    onClose()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (filtered.length > 0) setActiveIndex((current) => (current + (event.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(filtered[activeIndex])
    } else if (event.key === 'Tab') {
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('input, button:not([disabled])')
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
  }

  return <div className="dialog-backdrop command-palette-backdrop" role="presentation" onMouseDown={onClose}>
    <section ref={dialogRef} className="command-palette" role="dialog" aria-modal="true" aria-label="Search the map" onMouseDown={(event) => event.stopPropagation()} onKeyDown={onKeyDown}>
      <div className="command-palette-search">
        <input ref={inputRef} type="search" value={query} placeholder="Search concepts, neighborhoods, floors, relations, and scenarios" aria-label="Search the map" role="combobox" aria-autocomplete="list" aria-controls={listId} aria-expanded="true" aria-activedescendant={filtered[activeIndex] ? `${listId}-${filtered[activeIndex].key}` : undefined} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0) }} />
        <button type="button" onClick={onClose} aria-label="Close command palette">Esc</button>
      </div>
      <div className="command-palette-body">
        <div id={listId} className="command-palette-results" role="listbox" aria-label="Search results">
          {filtered.map((result, index) => <button id={`${listId}-${result.key}`} key={result.key} type="button" role="option" aria-selected={index === activeIndex} className={index === activeIndex ? 'is-active' : ''} onMouseEnter={() => setActiveIndex(index)} onFocus={() => setActiveIndex(index)} onClick={() => choose(result)}><span>{result.label}</span><small>{result.detail}</small></button>)}
          {filtered.length === 0 ? <p className="command-palette-empty" role="status">No matching items.</p> : null}
        </div>
        <PalettePreview result={activeResult} document={mapDocument} />
      </div>
      <p className="command-palette-hint"><kbd>Up</kbd><kbd>Down</kbd> navigate <kbd>Enter</kbd> open <kbd>Esc</kbd> close</p>
    </section>
  </div>
}

function PalettePreview({ result, document }: { result?: PaletteResult; document: OntologyDocument }) {
  if (!result) return <aside className="command-palette-preview is-empty"><span>No preview</span></aside>
  const relation = result.selection.kind === 'relation' ? document.relations.find((candidate) => candidate.id === result.selection.id) : null
  const from = relation ? document.nodes.find((node) => node.id === relation.from) : null
  const to = relation ? document.nodes.find((node) => node.id === relation.to) : null
  const floorIds = relation
    ? [...new Set([from?.floorId, to?.floorId].filter((id): id is string => Boolean(id)))]
    : result.floorId ? [result.floorId] : []
  return <aside className="command-palette-preview" aria-live="polite">
    <div className="command-palette-preview-heading"><span>{result.selection.kind}</span><strong>{result.label}</strong><small>{result.detail}</small></div>
    {relation && from && to ? <div className="command-palette-preview-relation"><span><b>{from.code}</b>{from.name}</span><i aria-hidden="true">→</i><span><b>{to.code}</b>{to.name}</span></div> : null}
    <div className={`command-palette-preview-maps ${floorIds.length > 1 ? 'has-two-floors' : ''}`}>
      {floorIds.map((floorId) => <div className="command-palette-preview-map" key={floorId}><span>{document.floors.find((floor) => floor.id === floorId)?.name}</span><FloorMiniPlan document={document} floorId={floorId} selection={result.selection} width={420} height={floorIds.length > 1 ? 145 : 300} /></div>)}
      {floorIds.length === 0 ? <p>{result.selection.kind === 'flow' ? document.flows.find((flow) => flow.id === result.selection.id)?.summary : 'No floor context.'}</p> : null}
    </div>
  </aside>
}
