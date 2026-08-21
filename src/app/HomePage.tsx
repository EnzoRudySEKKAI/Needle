import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createBlankMap, deleteMap, listLegacyMaps, listMaps, publishLegacyMaps, subscribeToLibrary, type MapSummary } from '../persistence/map-repository'

export function HomePage() {
  const navigate = useNavigate()
  const [maps, setMaps] = useState<MapSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [legacyCount, setLegacyCount] = useState(() => listLegacyMaps().length)
  const [pendingDelete, setPendingDelete] = useState<MapSummary | null>(null)

  useEffect(() => {
    void listMaps().then(setMaps).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load shared maps.')).finally(() => setLoading(false))
    return subscribeToLibrary(() => { void listMaps().then(setMaps).catch(() => undefined) }, setError)
  }, [])

  useEffect(() => {
    if (!pendingDelete) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setPendingDelete(null) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pendingDelete])

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteMap(pendingDelete.id)
      setMaps((current) => current.filter((map) => map.id !== pendingDelete.id))
      setPendingDelete(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete the map.')
    }
  }

  const createMap = async () => {
    try {
      const document = await createBlankMap()
      navigate(`/builder/${document.id}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create a map.')
    }
  }

  const publishLocal = async () => {
    try {
      await publishLegacyMaps()
      setLegacyCount(0)
      setMaps(await listMaps())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to publish local maps.')
    }
  }

  return <main className="home-page">
    <header className="home-header"><div className="brand"><strong>Needle</strong><span>ONTOLOGY</span></div><span className="home-version">LOCAL STUDIO · V0.1</span></header>
    <section className="home-hero"><div className="hero-copy"><span className="eyebrow">A spatial language for systems</span><h1>Build ideas<br />you can <i>walk through.</i></h1><p>Turn concepts, relations and scenarios into an isometric city. Every building has a deliberate form and size. Every street means something. Every moving signal follows a path you authored.</p><button type="button" className="primary-button" onClick={() => void createMap()}>Start with empty ground <span>→</span></button></div><div className="hero-diagram" aria-hidden="true"><div className="diagram-grid" /><div className="mini-building b-one"><span>IDEA</span></div><div className="mini-building b-two"><span>RULE</span></div><div className="mini-building b-three"><span>ACT</span></div><svg viewBox="0 0 500 360"><path d="M128 126 L238 181 L340 130 L410 165" /><circle cx="280" cy="159" r="5" /></svg><div className="hero-note">STRUCTURE BECOMES SPACE<br />BEHAVIOR BECOMES MOTION</div></div></section>
    <section className="map-library"><div className="library-heading"><div><span className="eyebrow">Shared maps</span><h2>LAN atlas</h2></div><span>{maps.length} {maps.length === 1 ? 'map' : 'maps'} · synchronized live</span></div>{error ? <p className="library-error" role="alert">{error}</p> : null}{legacyCount > 0 ? <button type="button" className="publish-local-button" onClick={() => void publishLocal()}>Publish {legacyCount} local {legacyCount === 1 ? 'map' : 'maps'} to the LAN workspace</button> : null}<div className="map-cards">{maps.map((map, index) => <article className="map-card" key={map.id}><div className="card-index">{String(index + 1).padStart(2, '0')}</div><div><h3>{map.name}</h3><p>{map.description}</p></div><div className="card-actions"><button type="button" onClick={() => navigate(`/builder/${map.id}`)}>Build</button><button type="button" onClick={() => navigate(`/map/${map.id}`)}>Present</button><button type="button" className="delete-map-button" onClick={() => setPendingDelete(map)}>Delete</button></div></article>)}{loading ? <p className="library-empty">Loading shared maps…</p> : maps.length === 0 ? <p className="library-empty">No shared maps yet. Start with empty ground to create one.</p> : null}</div></section>
    {pendingDelete ? <div className="dialog-backdrop" role="presentation" onMouseDown={() => setPendingDelete(null)}><section className="delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-map-title" onMouseDown={(event) => event.stopPropagation()}><span className="eyebrow">Permanent deletion</span><h2 id="delete-map-title">Delete “{pendingDelete.name}”?</h2><p>This map and all of its local concepts, relations and scenarios will be permanently removed. This action cannot be undone.</p><div><button type="button" autoFocus onClick={() => setPendingDelete(null)}>Cancel</button><button type="button" className="confirm-delete" onClick={confirmDelete}>Delete map</button></div></section></div> : null}
  </main>
}
