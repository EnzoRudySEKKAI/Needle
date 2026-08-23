import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EXAMPLE_MAPS } from '../domain/examples'
import { makeId } from '../domain/id'
import { STRUCTURE_TYPES, type OntologyDocument, type StructureType } from '../domain/types'
import { StructureSilhouette } from '../map/components/StructureSilhouette'
import { structureGeometry } from '../map/core/structure-geometry'
import * as repository from '../persistence/map-repository'
import type { MapSummary } from '../persistence/map-repository'
import { HeroMiniMap } from './HeroMiniMap'

type TrashSummary = MapSummary & { deletedAt?: string }
type RepositoryCapabilities = Pick<typeof repository, 'createBlankMap' | 'deleteMap' | 'listLegacyMaps' | 'listMaps' | 'publishLegacyMaps' | 'subscribeToLibrary'> & {
  createMapFromTemplate?: (templateId: string) => Promise<OntologyDocument>
  cloneMap?: (id: string) => Promise<OntologyDocument>
  listTrash?: () => Promise<TrashSummary[]>
  restoreTrashedMap?: (id: string) => Promise<OntologyDocument>
  permanentlyDeleteTrashedMap?: (id: string) => Promise<void>
}

const library = repository as RepositoryCapabilities
const updatedAtFormatter = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const structureNames: Record<StructureType, string> = { tower: 'Tower', campus: 'Campus', 'cruise-ship': 'Cruise ship' }

function StructurePreview({ structureType, floorCount, className = '' }: { structureType: StructureType; floorCount: number; className?: string }) {
  const geometry = structureGeometry(structureType, floorCount)
  const bounds = geometry.structureBounds
  return <span className={`map-card-structure ${className}`}><svg viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`} preserveAspectRatio="xMidYMid meet" aria-label={`${structureNames[structureType]} structure`}><StructureSilhouette geometry={geometry} /></svg><span>{structureNames[structureType]} · {floorCount} floor{floorCount === 1 ? '' : 's'}</span></span>
}

function EmptyNeighborhoodPreview() {
  return <svg className="creation-empty-neighborhood" viewBox="0 0 420 230" aria-hidden="true">
    <defs><clipPath id="empty-neighborhood-clip"><polygon points="38,144 187,64 382,126 226,211" /></clipPath></defs>
    <polygon className="empty-neighborhood-shadow" points="45,151 187,76 373,135 225,217" />
    <polygon className="empty-neighborhood-ground" points="38,144 187,64 382,126 226,211" />
    <g className="empty-neighborhood-grid" clipPath="url(#empty-neighborhood-clip)">
      <line x1="84" y1="119" x2="270" y2="179" /><line x1="121" y1="99" x2="307" y2="159" /><line x1="158" y1="79" x2="344" y2="139" />
      <line x1="79" y1="166" x2="229" y2="84" /><line x1="128" y1="182" x2="279" y2="100" /><line x1="177" y1="198" x2="329" y2="116" /><line x1="226" y1="214" x2="378" y2="132" />
    </g>
    <polygon className="empty-neighborhood-edge" points="38,144 187,64 382,126 226,211" />
  </svg>
}

function MapStructurePreview({ map }: { map: MapSummary }) {
  return <StructurePreview structureType={map.structureType} floorCount={map.floorCount} />
}

export function HomePage() {
  const navigate = useNavigate()
  const dialogRef = useRef<HTMLElement>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const [maps, setMaps] = useState<MapSummary[]>([])
  const [trash, setTrash] = useState<TrashSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [legacyCount, setLegacyCount] = useState(() => library.listLegacyMaps().length)
  const [pendingDelete, setPendingDelete] = useState<MapSummary | null>(null)
  const [pendingPermanentId, setPendingPermanentId] = useState<string | null>(null)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [creationMode, setCreationMode] = useState<'blank' | 'templates' | null>(null)
  const [trashOpen, setTrashOpen] = useState(false)
  const [mapName, setMapName] = useState('')
  const [blankStructureType, setBlankStructureType] = useState<StructureType>('tower')
  const [working, setWorking] = useState<string | null>(null)
  const trashAvailable = Boolean(library.listTrash && library.restoreTrashedMap && library.permanentlyDeleteTrashedMap)
  const dialogOpen = templateOpen || trashOpen || pendingDelete !== null

  useEffect(() => {
    void library.listMaps().then(setMaps).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load shared maps.')).finally(() => setLoading(false))
    return library.subscribeToLibrary(() => { void library.listMaps().then(setMaps).catch(() => undefined) }, setError)
  }, [])

  useEffect(() => {
    if (!dialogOpen) return
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    const focusable = () => dialog ? [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])')] : []
    focusable()[0]?.focus()
    const close = () => { setTemplateOpen(false); setCreationMode(null); setTrashOpen(false); setPendingDelete(null); setPendingPermanentId(null) }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close() }
      if (event.key === 'Tab') {
        const elements = focusable()
        if (elements.length === 0) return
        const first = elements[0]
        const last = elements[elements.length - 1]
        if (!first || !last) return
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown); previouslyFocused?.focus() }
  }, [dialogOpen])

  const reportError = (reason: unknown, fallback: string) => setError(reason instanceof Error ? reason.message : fallback)

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setWorking(`delete:${pendingDelete.id}`)
    try {
      await library.deleteMap(pendingDelete.id)
      setMaps((current) => current.filter((map) => map.id !== pendingDelete.id))
      setPendingDelete(null)
    } catch (reason) {
      reportError(reason, 'Unable to move the map to Trash.')
    } finally {
      setWorking(null)
    }
  }

  const createMap = async (templateId?: string) => {
    setWorking(templateId ?? 'blank')
    setError(null)
    try {
      let created: OntologyDocument
      if (templateId) {
        if (!library.createMapFromTemplate) throw new Error('Template creation is waiting for repository integration.')
        created = await library.createMapFromTemplate(templateId)
      } else {
        created = await library.createBlankMap(mapName.trim() || undefined, blankStructureType)
      }
      setTemplateOpen(false)
      navigate(`/builder/${created.id}`)
    } catch (reason) {
      reportError(reason, 'Unable to create a map.')
    } finally {
      setWorking(null)
    }
  }

  const duplicateMap = async (map: MapSummary) => {
    setWorking(`clone:${map.id}`)
    setError(null)
    try {
      if (!library.cloneMap) throw new Error('Duplication is waiting for repository integration.')
      const clone = await library.cloneMap(map.id)
      navigate(`/builder/${clone.id}`)
    } catch (reason) {
      reportError(reason, 'Unable to duplicate the map.')
    } finally {
      setWorking(null)
    }
  }

  const importMap = async (file: File | undefined) => {
    if (!file) return
    setWorking('import')
    setError(null)
    try {
      const migrated = repository.migrateDocument(JSON.parse(await file.text()) as unknown)
      if (!migrated) throw new Error('This file is not a valid Needle ontology map.')
      const now = new Date().toISOString()
      const imported = await repository.saveMap({ ...migrated, id: makeId('map'), name: `${migrated.name} import`, createdAt: now, updatedAt: now })
      navigate(`/builder/${imported.id}`)
    } catch (reason) {
      reportError(reason, 'Unable to import this map.')
    } finally {
      setWorking(null)
      if (importRef.current) importRef.current.value = ''
    }
  }

  const openTrash = async () => {
    if (!library.listTrash) return
    setTrashOpen(true)
    setWorking('trash')
    try {
      setTrash(await library.listTrash())
    } catch (reason) {
      reportError(reason, 'Unable to load Trash.')
    } finally {
      setWorking(null)
    }
  }

  const restoreMap = async (id: string) => {
    if (!library.restoreTrashedMap) return
    setWorking(`restore:${id}`)
    try {
      await library.restoreTrashedMap(id)
      setTrash((current) => current.filter((map) => map.id !== id))
      setMaps(await library.listMaps())
    } catch (reason) {
      reportError(reason, 'Unable to restore the map.')
    } finally {
      setWorking(null)
    }
  }

  const permanentlyDelete = async (id: string) => {
    if (!library.permanentlyDeleteTrashedMap) return
    if (pendingPermanentId !== id) { setPendingPermanentId(id); return }
    setWorking(`permanent:${id}`)
    try {
      await library.permanentlyDeleteTrashedMap(id)
      setTrash((current) => current.filter((map) => map.id !== id))
      setPendingPermanentId(null)
    } catch (reason) {
      reportError(reason, 'Unable to permanently delete the map.')
    } finally {
      setWorking(null)
    }
  }

  const publishLocal = async () => {
    try {
      await library.publishLegacyMaps()
      setLegacyCount(0)
      setMaps(await library.listMaps())
    } catch (reason) {
      reportError(reason, 'Unable to publish local maps.')
    }
  }

  return <main className="home-page">
    <header className="home-header"><div className="brand"><strong>Needle</strong><span>ONTOLOGY</span></div><span className="home-version">DMA STUDIO · V1.0</span></header>
    <section className="home-hero"><div className="hero-copy"><h1>Build ideas<br />you can <i>walk through.</i></h1><p>Turn complex ideas into something people can understand and act on. Connect concepts, build scenarios, map decisions and actions, and present the whole picture clearly.</p><button type="button" className="primary-button" onClick={() => { setCreationMode(null); setTemplateOpen(true) }}>Create a map <span>→</span></button></div><div className="hero-diagram"><div className="diagram-grid" /><HeroMiniMap /></div></section>
    <section className="map-library">
      <div className="library-heading">
        <div><span className="eyebrow">Shared workspace</span><h2>LAN atlas</h2></div>
        <span><i aria-hidden="true" />{maps.length} {maps.length === 1 ? 'map' : 'maps'} · synchronized live</span>
      </div>
      <div className="library-toolbar">
        <div><strong>Workspace</strong><span>Create, import, and recover ontology maps.</span></div>
        <div>
          <button type="button" className="library-create-button" onClick={() => { setCreationMode(null); setTemplateOpen(true) }}>New map</button>
          <button type="button" disabled={working !== null} onClick={() => importRef.current?.click()}>{working === 'import' ? 'Importing…' : 'Import JSON'}</button>
          <input ref={importRef} hidden type="file" accept="application/json,.json" onChange={(event) => void importMap(event.target.files?.[0])} />
          {trashAvailable ? <button type="button" onClick={() => void openTrash()}>Trash</button> : null}
        </div>
      </div>
      {error ? <p className="library-error" role="alert">{error}</p> : null}
      {legacyCount > 0 ? <button type="button" className="publish-local-button" onClick={() => void publishLocal()}>Publish {legacyCount} local {legacyCount === 1 ? 'map' : 'maps'} to the LAN workspace</button> : null}
      <div className="map-cards">
        {maps.map((map, index) => <article className="map-card" key={map.id}>
          <div className="map-card-heading"><span className="card-index">{String(index + 1).padStart(2, '0')}</span><span className="map-card-live"><i aria-hidden="true" />Live</span></div>
          <MapStructurePreview map={map} />
          <div className="map-card-copy"><h3>{map.name}</h3><p>{map.description}</p></div>
          <div className="map-card-meta"><span>Updated {updatedAtFormatter.format(new Date(map.updatedAt))}</span></div>
          <div className="card-actions"><button type="button" onClick={() => navigate(`/builder/${map.id}`)}>Build</button><button type="button" onClick={() => navigate(`/map/${map.id}`)}>Present</button><button type="button" disabled={working === `clone:${map.id}`} onClick={() => void duplicateMap(map)}>Duplicate</button><button type="button" className="delete-map-button" onClick={() => setPendingDelete(map)}>Trash</button></div>
        </article>)}
        {loading ? <p className="library-empty">Loading shared maps…</p> : maps.length === 0 ? <p className="library-empty">No shared maps yet. Create one from blank ground or a template.</p> : null}
      </div>
    </section>
    {templateOpen ? <div className="dialog-backdrop" role="presentation" onMouseDown={() => { setTemplateOpen(false); setCreationMode(null) }}><section ref={dialogRef} className={`export-dialog template-dialog${creationMode === null ? ' is-choice' : ''}`} role="dialog" aria-modal="true" aria-labelledby="template-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="dialog-heading"><div><span className="eyebrow">New map</span><h2 id="template-title">{creationMode === 'blank' ? 'Start from blank ground' : creationMode === 'templates' ? 'Choose a template' : 'Choose how to begin'}</h2></div><button type="button" onClick={() => { setTemplateOpen(false); setCreationMode(null) }} aria-label="Close">×</button></div>
      <p>{creationMode === 'blank' ? 'Name the map and choose the architecture that will hold it.' : creationMode === 'templates' ? 'Adapt a complete example with concepts, relations, and scenarios.' : 'Begin with a clean structure or adapt a complete example.'}</p>
      {creationMode === null ? <div className="creation-split">
        <article className="creation-choice creation-choice-blank">
          <button type="button" aria-label="Start with a blank map" onClick={() => setCreationMode('blank')} />
          <div className="creation-choice-copy"><span>Blank</span><strong>Shape it yourself</strong><p>Name the map, choose a structure, and begin on open ground.</p></div>
          <EmptyNeighborhoodPreview />
        </article>
        <article className="creation-choice creation-choice-templates">
          <button type="button" aria-label="Choose a map template" onClick={() => setCreationMode('templates')} />
          <div className="creation-choice-copy"><span>Templates</span><strong>Begin with a template</strong><p>Explore complete examples and replace their content with your own.</p></div>
          <StructurePreview structureType="cruise-ship" floorCount={4} className="creation-choice-structure" />
        </article>
      </div> : null}
      {creationMode === 'blank' ? <div className="blank-setup">
        <button type="button" className="creation-back" onClick={() => setCreationMode(null)}>← Back to choices</button>
        <div className="blank-setup-body">
          <div className="blank-setup-preview"><StructurePreview structureType={blankStructureType} floorCount={1} className="template-card-structure" /></div>
          <div className="blank-setup-form">
            <label><span>Map name</span><input autoFocus value={mapName} onChange={(event) => setMapName(event.target.value)} placeholder="Untitled ontology" /></label>
            <fieldset><legend>Structure type</legend><div>{STRUCTURE_TYPES.map((structureType) => <button key={structureType} type="button" className={blankStructureType === structureType ? 'is-selected' : ''} aria-pressed={blankStructureType === structureType} onClick={() => setBlankStructureType(structureType)}><StructurePreview structureType={structureType} floorCount={1} className="blank-type-preview" /><span>{structureNames[structureType]}</span></button>)}</div></fieldset>
            <button type="button" className="blank-create-button" disabled={working !== null || !mapName.trim()} onClick={() => void createMap()}>{working === 'blank' ? 'Creating…' : 'Create map'}</button>
          </div>
        </div>
      </div> : null}
      {creationMode === 'templates' ? <div className="template-selection">
        <button type="button" className="creation-back" onClick={() => setCreationMode(null)}>← Back to choices</button>
        <div className="template-grid">{EXAMPLE_MAPS.map((template, index) => <article className="template-card" key={template.id}>
          <div className="template-card-heading"><span className="card-index">{String(index + 1).padStart(2, '0')}</span><span>{structureNames[template.structureType]}</span></div>
          <StructurePreview structureType={template.structureType} floorCount={template.floors.length} className="template-card-structure" />
          <div className="template-card-copy"><h3>{template.name}</h3><p>{template.description}</p></div>
          <div className="template-card-footer"><span>{template.floors.length} floors · {template.nodes.length} concepts</span><button type="button" disabled={working !== null} onClick={() => void createMap(template.id)}>Use template</button></div>
        </article>)}</div>
      </div> : null}
      {error ? <p className="library-error" role="alert">{error}</p> : null}
    </section></div> : null}
    {trashOpen ? <div className="dialog-backdrop" role="presentation" onMouseDown={() => setTrashOpen(false)}><section ref={dialogRef} className="export-dialog" role="dialog" aria-modal="true" aria-labelledby="trash-title" onMouseDown={(event) => event.stopPropagation()}><div className="dialog-heading"><div><span className="eyebrow">Library</span><h2 id="trash-title">Trash</h2></div><button type="button" onClick={() => setTrashOpen(false)} aria-label="Close">×</button></div><p>Restore maps to the atlas or permanently delete them.</p><div className="map-cards">{trash.map((map, index) => <article className="map-card" key={map.id}><div className="card-index">{String(index + 1).padStart(2, '0')}</div><div><h3>{map.name}</h3><p>{map.description}</p></div><div className="card-actions"><button type="button" disabled={working !== null} onClick={() => void restoreMap(map.id)}>Restore</button><button type="button" className="delete-map-button" disabled={working !== null} onClick={() => void permanentlyDelete(map.id)}>{pendingPermanentId === map.id ? 'Confirm delete' : 'Delete forever'}</button></div></article>)}{working === 'trash' ? <p className="library-empty">Loading Trash…</p> : trash.length === 0 ? <p className="library-empty">Trash is empty.</p> : null}</div></section></div> : null}
    {pendingDelete ? <div className="dialog-backdrop" role="presentation" onMouseDown={() => setPendingDelete(null)}><section ref={dialogRef} className="delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-map-title" onMouseDown={(event) => event.stopPropagation()}><span className="eyebrow">Move to Trash</span><h2 id="delete-map-title">Trash “{pendingDelete.name}”?</h2><p>The map will be moved to Trash. You can restore it later until it is permanently deleted from Trash.</p><div><button type="button" onClick={() => setPendingDelete(null)}>Cancel</button><button type="button" className="confirm-delete" disabled={working !== null} onClick={() => void confirmDelete()}>Move to Trash</button></div></section></div> : null}
  </main>
}
