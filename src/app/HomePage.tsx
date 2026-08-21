import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createBlankMap, deleteMap, initializeSampleMap, listMaps, type MapSummary } from '../persistence/map-repository'

export function HomePage() {
  const navigate = useNavigate()
  const [maps, setMaps] = useState(() => {
    initializeSampleMap()
    return listMaps()
  })
  const [pendingDelete, setPendingDelete] = useState<MapSummary | null>(null)

  useEffect(() => {
    if (!pendingDelete) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setPendingDelete(null) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pendingDelete])

  const confirmDelete = () => {
    if (!pendingDelete) return
    deleteMap(pendingDelete.id)
    setMaps((current) => current.filter((map) => map.id !== pendingDelete.id))
    setPendingDelete(null)
  }

  return <main className="home-page">
    <header className="home-header"><div className="brand"><strong>Needle</strong><span>ONTOLOGY</span></div><span className="home-version">LOCAL STUDIO · V0.1</span></header>
    <section className="home-hero"><div className="hero-copy"><span className="eyebrow">A spatial language for systems</span><h1>Build ideas<br />you can <i>walk through.</i></h1><p>Turn concepts, relations and scenarios into an isometric city. Every building has a deliberate form and size. Every street means something. Every moving signal follows a path you authored.</p><button type="button" className="primary-button" onClick={() => navigate(`/builder/${createBlankMap().id}`)}>Start with empty ground <span>→</span></button></div><div className="hero-diagram" aria-hidden="true"><div className="diagram-grid" /><div className="mini-building b-one"><span>IDEA</span></div><div className="mini-building b-two"><span>RULE</span></div><div className="mini-building b-three"><span>ACT</span></div><svg viewBox="0 0 500 360"><path d="M128 126 L238 181 L340 130 L410 165" /><circle cx="280" cy="159" r="5" /></svg><div className="hero-note">STRUCTURE BECOMES SPACE<br />BEHAVIOR BECOMES MOTION</div></div></section>
    <section className="map-library"><div className="library-heading"><div><span className="eyebrow">Your maps</span><h2>Local atlas</h2></div><span>{maps.length} {maps.length === 1 ? 'map' : 'maps'} · saved in this browser</span></div><div className="map-cards">{maps.map((map, index) => <article className="map-card" key={map.id}><div className="card-index">{String(index + 1).padStart(2, '0')}</div><div><h3>{map.name}</h3><p>{map.description}</p></div><div className="card-actions"><button type="button" onClick={() => navigate(`/builder/${map.id}`)}>Build</button><button type="button" onClick={() => navigate(`/map/${map.id}`)}>Present</button><button type="button" className="delete-map-button" onClick={() => setPendingDelete(map)}>Delete</button></div></article>)}{maps.length === 0 ? <p className="library-empty">No maps saved yet. Start with empty ground to create one.</p> : null}</div></section>
    {pendingDelete ? <div className="dialog-backdrop" role="presentation" onMouseDown={() => setPendingDelete(null)}><section className="delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-map-title" onMouseDown={(event) => event.stopPropagation()}><span className="eyebrow">Permanent deletion</span><h2 id="delete-map-title">Delete “{pendingDelete.name}”?</h2><p>This map and all of its local concepts, relations and scenarios will be permanently removed. This action cannot be undone.</p><div><button type="button" autoFocus onClick={() => setPendingDelete(null)}>Cancel</button><button type="button" className="confirm-delete" onClick={confirmDelete}>Delete map</button></div></section></div> : null}
  </main>
}
