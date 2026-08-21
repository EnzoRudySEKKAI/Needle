import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { BuilderShell } from '../editor/BuilderShell'
import { DocumentProvider } from '../editor/document-store'
import { ExportDialog } from '../export/ExportDialog'
import { ensureSampleMap, loadMap } from '../persistence/map-repository'

export function MapPage({ presentation = false }: { presentation?: boolean }) {
  const { id } = useParams()
  const [exporting, setExporting] = useState(false)
  if (!id) return <Navigate to={`/builder/${ensureSampleMap().id}`} replace />
  const document = loadMap(id)
  if (!document) return <Navigate to="/" replace />
  return <DocumentProvider initial={document}><BuilderShell presentation={presentation} onExport={() => setExporting(true)} />{exporting ? <ExportDialog filename={document.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')} onClose={() => setExporting(false)} /> : null}</DocumentProvider>
}
