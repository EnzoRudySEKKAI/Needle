import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { BuilderShell } from '../editor/BuilderShell'
import { DocumentProvider } from '../editor/document-store'
import { useI18n } from '../i18n/useI18n'
import { loadMap } from '../persistence/map-repository'

export function MapPage({ presentation = false }: { presentation?: boolean }) {
  const { id } = useParams()
  if (!id) return <Navigate to="/" replace />
  return <LoadedMapPage key={`${id}:${presentation}`} id={id} presentation={presentation} />
}

function LoadedMapPage({ id, presentation }: { id: string; presentation: boolean }) {
  const { t } = useI18n()
  const [document, setDocument] = useState<Awaited<ReturnType<typeof loadMap>> | undefined>(undefined)
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    void loadMap(id).then((value) => { if (active) setDocument(value) }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [id])
  if (error) return <main className="map-load-state"><strong>{t('shell.load.unavailable')}</strong><span>{t('shell.load.failed')}</span></main>
  if (document === undefined) return <main className="map-load-state"><span>{t('shell.load.loading')}</span></main>
  if (!document) return <Navigate to="/" replace />
  return <DocumentProvider initial={document}><BuilderShell presentation={presentation} /></DocumentProvider>
}
