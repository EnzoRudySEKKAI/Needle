import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { BuilderShell } from '../editor/BuilderShell'
import { DocumentProvider } from '../editor/document-store'
import { loadMap } from '../persistence/map-repository'

export function MapPage({ presentation = false }: { presentation?: boolean }) {
  const { id } = useParams()
  if (!id) return <Navigate to="/" replace />
  return <LoadedMapPage key={`${id}:${presentation}`} id={id} presentation={presentation} />
}

function LoadedMapPage({ id, presentation }: { id: string; presentation: boolean }) {
  const [document, setDocument] = useState<Awaited<ReturnType<typeof loadMap>> | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    void loadMap(id).then((value) => { if (active) setDocument(value) }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load the map.') })
    return () => { active = false }
  }, [id])
  if (error) return <main className="map-load-state"><strong>Shared map unavailable</strong><span>{error}</span></main>
  if (document === undefined) return <main className="map-load-state"><span>Loading shared map…</span></main>
  if (!document) return <Navigate to="/" replace />
  return <DocumentProvider initial={document}><BuilderShell presentation={presentation} /></DocumentProvider>
}
