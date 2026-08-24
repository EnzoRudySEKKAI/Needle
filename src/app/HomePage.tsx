import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EXAMPLE_MAPS } from '../domain/examples'
import { makeId } from '../domain/id'
import { STRUCTURE_TYPES, type OntologyDocument, type StructureType } from '../domain/types'
import { LanguageSwitch } from '../i18n/LanguageSwitch'
import { useI18n } from '../i18n/useI18n'
import { StructureSilhouette } from '../map/components/StructureSilhouette'
import { structureGeometry } from '../map/core/structure-geometry'
import * as repository from '../persistence/map-repository'
import type { MapSummary } from '../persistence/map-repository'
import { HeroMiniMap } from './HeroMiniMap'
import { McpSetupDialog } from './McpSetupDialog'

type TrashSummary = MapSummary & { deletedAt?: string }
type RepositoryCapabilities = Pick<typeof repository, 'createBlankMap' | 'deleteMap' | 'listMaps' | 'subscribeToLibrary'> & {
  createMapFromTemplate?: (templateId: string) => Promise<OntologyDocument>
  cloneMap?: (id: string) => Promise<OntologyDocument>
  listTrash?: () => Promise<TrashSummary[]>
  restoreTrashedMap?: (id: string) => Promise<OntologyDocument>
  permanentlyDeleteTrashedMap?: (id: string) => Promise<void>
}

const library = repository as RepositoryCapabilities
function StructurePreview({ structureType, floorCount, className = '' }: { structureType: StructureType; floorCount: number; className?: string }) {
  const { t } = useI18n()
  const geometry = structureGeometry(structureType, floorCount)
  const bounds = geometry.structureBounds
  const structure = t(structureType === 'tower' ? 'structure.tower' : structureType === 'campus' ? 'structure.campus' : 'structure.ship')
  return <span className={`map-card-structure ${className}`}><svg viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`} preserveAspectRatio="xMidYMid meet" aria-label={t('home.structure.aria', { structure })}><StructureSilhouette geometry={geometry} /></svg><span>{t(floorCount === 1 ? 'home.structure.summaryOne' : 'home.structure.summaryMany', { structure, count: floorCount })}</span></span>
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
  const { t, formatDate } = useI18n()
  const dialogRef = useRef<HTMLElement>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const [maps, setMaps] = useState<MapSummary[]>([])
  const [trash, setTrash] = useState<TrashSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<MapSummary | null>(null)
  const [pendingPermanentId, setPendingPermanentId] = useState<string | null>(null)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [creationMode, setCreationMode] = useState<'blank' | 'templates' | null>(null)
  const [trashOpen, setTrashOpen] = useState(false)
  const [mcpOpen, setMcpOpen] = useState(false)
  const [mapName, setMapName] = useState('')
  const [blankStructureType, setBlankStructureType] = useState<StructureType>('tower')
  const [working, setWorking] = useState<string | null>(null)
  const trashAvailable = Boolean(library.listTrash && library.restoreTrashedMap && library.permanentlyDeleteTrashedMap)
  const dialogOpen = templateOpen || trashOpen || pendingDelete !== null
  const reportLoadError = useEffectEvent(() => setError(t('home.error.loadMaps')))
  const reportLibraryError = useEffectEvent(() => setError(t('home.error.liveUpdates')))

  useEffect(() => {
    void library.listMaps().then(setMaps).catch(reportLoadError).finally(() => setLoading(false))
    return library.subscribeToLibrary(() => { void library.listMaps().then(setMaps).catch(() => undefined) }, reportLibraryError)
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

  const reportError = (_reason: unknown, fallback: string) => setError(fallback)

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setWorking(`delete:${pendingDelete.id}`)
    try {
      await library.deleteMap(pendingDelete.id)
      setMaps((current) => current.filter((map) => map.id !== pendingDelete.id))
      setPendingDelete(null)
    } catch (reason) {
      reportError(reason, t('home.error.moveToTrash'))
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
        if (!library.createMapFromTemplate) throw new Error(t('home.error.templateUnavailable'))
        created = await library.createMapFromTemplate(templateId)
      } else {
        created = await library.createBlankMap(mapName.trim() || undefined, blankStructureType)
      }
      setTemplateOpen(false)
      navigate(`/builder/${created.id}`)
    } catch (reason) {
      reportError(reason, t('home.error.createMap'))
    } finally {
      setWorking(null)
    }
  }

  const duplicateMap = async (map: MapSummary) => {
    setWorking(`clone:${map.id}`)
    setError(null)
    try {
      if (!library.cloneMap) throw new Error(t('home.error.duplicateUnavailable'))
      const clone = await library.cloneMap(map.id)
      navigate(`/builder/${clone.id}`)
    } catch (reason) {
      reportError(reason, t('home.error.duplicateMap'))
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
      if (!migrated) throw new Error(t('home.error.invalidImport'))
      const now = new Date().toISOString()
      const imported = await repository.saveMap({ ...migrated, id: makeId('map'), name: `${migrated.name} import`, createdAt: now, updatedAt: now })
      navigate(`/builder/${imported.id}`)
    } catch (reason) {
      reportError(reason, t('home.error.importMap'))
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
      reportError(reason, t('home.error.loadTrash'))
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
      reportError(reason, t('home.error.restoreMap'))
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
      reportError(reason, t('home.error.deleteMap'))
    } finally {
      setWorking(null)
    }
  }

  return <main className="home-page">
    <header className="home-header"><div className="brand"><strong>Needle</strong><span>{t('shell.brand.ontology')}</span></div><div className="home-header-actions"><button type="button" onClick={() => setMcpOpen(true)}>{t('home.header.connectMcp')}</button><LanguageSwitch /><span className="home-version">DMA STUDIO · V1.0</span></div></header>
    <section className="home-hero"><div className="hero-copy"><h1>{t('home.hero.titleLineOne')}<br /><i>{t('home.hero.titleLineTwo')}</i></h1><p>{t('home.hero.description')}</p><button type="button" className="primary-button" onClick={() => { setCreationMode(null); setTemplateOpen(true) }}>{t('home.hero.createMap')} <span>→</span></button></div><div className="hero-diagram"><div className="diagram-grid" /><HeroMiniMap /></div></section>
    <section className="map-library">
      <div className="library-heading">
        <div><span className="eyebrow">{t('home.library.eyebrow')}</span><h2>{t('home.library.title')}</h2></div>
        <span><i aria-hidden="true" />{t(maps.length === 1 ? 'home.library.statusOne' : 'home.library.statusMany', { count: maps.length })}</span>
      </div>
      <div className="library-toolbar">
        <div><strong>{t('home.library.workspace')}</strong><span>{t('home.library.description')}</span></div>
        <div>
          <button type="button" className="library-create-button" onClick={() => { setCreationMode(null); setTemplateOpen(true) }}>{t('home.library.newMap')}</button>
          <button type="button" disabled={working !== null} onClick={() => importRef.current?.click()}>{t(working === 'import' ? 'home.library.importing' : 'home.library.importJson')}</button>
          <input ref={importRef} hidden type="file" accept="application/json,.json" onChange={(event) => void importMap(event.target.files?.[0])} />
          {trashAvailable ? <button type="button" onClick={() => void openTrash()}>{t('home.library.trash')}</button> : null}
        </div>
      </div>
      {error ? <p className="library-error" role="alert">{error}</p> : null}
      <div className="map-cards">
        {maps.map((map, index) => <article className="map-card" key={map.id}>
          <div className="map-card-heading"><span className="card-index">{String(index + 1).padStart(2, '0')}</span><span className="map-card-live"><i aria-hidden="true" />{t('home.card.live')}</span></div>
          <MapStructurePreview map={map} />
          <div className="map-card-copy"><h3>{map.name}</h3><p>{map.description}</p></div>
          <div className="map-card-meta"><span>{t('home.card.updated', { date: formatDate(map.updatedAt, { day: 'numeric', month: 'short', year: 'numeric' }) })}</span></div>
          <div className="card-actions"><button type="button" onClick={() => navigate(`/builder/${map.id}`)}>{t('home.card.build')}</button><button type="button" onClick={() => navigate(`/map/${map.id}`)}>{t('home.card.present')}</button><button type="button" disabled={working === `clone:${map.id}`} onClick={() => void duplicateMap(map)}>{t('home.card.duplicate')}</button><button type="button" className="delete-map-button" onClick={() => setPendingDelete(map)}>{t('home.card.trash')}</button></div>
        </article>)}
        {loading ? <p className="library-empty">{t('home.library.loading')}</p> : maps.length === 0 ? <p className="library-empty">{t('home.library.empty')}</p> : null}
      </div>
    </section>
    {templateOpen ? <div className="dialog-backdrop" role="presentation" onMouseDown={() => { setTemplateOpen(false); setCreationMode(null) }}><section ref={dialogRef} className={`export-dialog template-dialog${creationMode === null ? ' is-choice' : ''}`} role="dialog" aria-modal="true" aria-labelledby="template-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="dialog-heading"><div><span className="eyebrow">{t('home.creation.eyebrow')}</span><h2 id="template-title">{t(creationMode === 'blank' ? 'home.creation.titleBlank' : creationMode === 'templates' ? 'home.creation.titleTemplates' : 'home.creation.titleChoice')}</h2></div><button type="button" onClick={() => { setTemplateOpen(false); setCreationMode(null) }} aria-label={t('common.close')}>×</button></div>
      <p>{t(creationMode === 'blank' ? 'home.creation.descriptionBlank' : creationMode === 'templates' ? 'home.creation.descriptionTemplates' : 'home.creation.descriptionChoice')}</p>
      {creationMode === null ? <div className="creation-split">
        <article className="creation-choice creation-choice-blank">
          <button type="button" aria-label={t('home.creation.blankAria')} onClick={() => setCreationMode('blank')} />
          <div className="creation-choice-copy"><span>{t('home.creation.blankLabel')}</span><strong>{t('home.creation.blankTitle')}</strong><p>{t('home.creation.blankDescription')}</p></div>
          <EmptyNeighborhoodPreview />
        </article>
        <article className="creation-choice creation-choice-templates">
          <button type="button" aria-label={t('home.creation.templatesAria')} onClick={() => setCreationMode('templates')} />
          <div className="creation-choice-copy"><span>{t('home.creation.templatesLabel')}</span><strong>{t('home.creation.templatesTitle')}</strong><p>{t('home.creation.templatesDescription')}</p></div>
          <StructurePreview structureType="cruise-ship" floorCount={4} className="creation-choice-structure" />
        </article>
      </div> : null}
      {creationMode === 'blank' ? <div className="blank-setup">
        <button type="button" className="creation-back" onClick={() => setCreationMode(null)}>{t('home.creation.back')}</button>
        <div className="blank-setup-body">
          <div className="blank-setup-preview"><StructurePreview structureType={blankStructureType} floorCount={1} className="template-card-structure" /></div>
          <div className="blank-setup-form">
            <label><span>{t('home.creation.mapName')}</span><input autoFocus value={mapName} onChange={(event) => setMapName(event.target.value)} placeholder={t('home.creation.mapNamePlaceholder')} /></label>
            <fieldset><legend>{t('home.creation.structureType')}</legend><div>{STRUCTURE_TYPES.map((structureType) => <button key={structureType} type="button" className={blankStructureType === structureType ? 'is-selected' : ''} aria-pressed={blankStructureType === structureType} onClick={() => setBlankStructureType(structureType)}><StructurePreview structureType={structureType} floorCount={1} className="blank-type-preview" /><span>{t(structureType === 'tower' ? 'structure.tower' : structureType === 'campus' ? 'structure.campus' : 'structure.ship')}</span></button>)}</div></fieldset>
            <button type="button" className="blank-create-button" disabled={working !== null || !mapName.trim()} onClick={() => void createMap()}>{t(working === 'blank' ? 'home.creation.creating' : 'home.creation.create')}</button>
          </div>
        </div>
      </div> : null}
      {creationMode === 'templates' ? <div className="template-selection">
        <button type="button" className="creation-back" onClick={() => setCreationMode(null)}>{t('home.creation.back')}</button>
        <div className="template-grid">{EXAMPLE_MAPS.map((template, index) => <article className="template-card" key={template.id}>
          <div className="template-card-heading"><span className="card-index">{String(index + 1).padStart(2, '0')}</span><span>{t(template.structureType === 'tower' ? 'structure.tower' : template.structureType === 'campus' ? 'structure.campus' : 'structure.ship')}</span></div>
          <StructurePreview structureType={template.structureType} floorCount={template.floors.length} className="template-card-structure" />
          <div className="template-card-copy"><h3>{template.name}</h3><p>{template.description}</p></div>
          <div className="template-card-footer"><span>{t(template.floors.length === 1 ? template.nodes.length === 1 ? 'home.creation.metadataOneOne' : 'home.creation.metadataOneMany' : template.nodes.length === 1 ? 'home.creation.metadataManyOne' : 'home.creation.metadataManyMany', { floors: template.floors.length, concepts: template.nodes.length })}</span><button type="button" disabled={working !== null} onClick={() => void createMap(template.id)}>{t('home.creation.useTemplate')}</button></div>
        </article>)}</div>
      </div> : null}
      {error ? <p className="library-error" role="alert">{error}</p> : null}
    </section></div> : null}
    {trashOpen ? <div className="dialog-backdrop" role="presentation" onMouseDown={() => setTrashOpen(false)}><section ref={dialogRef} className="export-dialog" role="dialog" aria-modal="true" aria-labelledby="trash-title" onMouseDown={(event) => event.stopPropagation()}><div className="dialog-heading"><div><span className="eyebrow">{t('home.trash.library')}</span><h2 id="trash-title">{t('home.trash.title')}</h2></div><button type="button" onClick={() => setTrashOpen(false)} aria-label={t('common.close')}>×</button></div><p>{t('home.trash.description')}</p><div className="map-cards">{trash.map((map, index) => <article className="map-card" key={map.id}><div className="card-index">{String(index + 1).padStart(2, '0')}</div><div><h3>{map.name}</h3><p>{map.description}</p></div><div className="card-actions"><button type="button" disabled={working !== null} onClick={() => void restoreMap(map.id)}>{t('home.trash.restore')}</button><button type="button" className="delete-map-button" disabled={working !== null} onClick={() => void permanentlyDelete(map.id)}>{t(pendingPermanentId === map.id ? 'home.trash.confirmDelete' : 'home.trash.deleteForever')}</button></div></article>)}{working === 'trash' ? <p className="library-empty">{t('home.trash.loading')}</p> : trash.length === 0 ? <p className="library-empty">{t('home.trash.empty')}</p> : null}</div></section></div> : null}
    {pendingDelete ? <div className="dialog-backdrop" role="presentation" onMouseDown={() => setPendingDelete(null)}><section ref={dialogRef} className="delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-map-title" onMouseDown={(event) => event.stopPropagation()}><span className="eyebrow">{t('home.delete.eyebrow')}</span><h2 id="delete-map-title">{t('home.delete.title', { name: pendingDelete.name })}</h2><p>{t('home.delete.description')}</p><div><button type="button" onClick={() => setPendingDelete(null)}>{t('common.cancel')}</button><button type="button" className="confirm-delete" disabled={working !== null} onClick={() => void confirmDelete()}>{t('home.delete.move')}</button></div></section></div> : null}
    {mcpOpen ? <McpSetupDialog onClose={() => setMcpOpen(false)} /> : null}
  </main>
}
