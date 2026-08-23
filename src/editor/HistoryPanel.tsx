import { useEffect, useId, useState } from 'react'
import type { OntologyDocument } from '../domain/types'
import { listMapHistory, loadMapSnapshot, restoreMapSnapshot } from '../persistence/map-repository'

export type LocalHistoryEntry = {
  id: string
  label: string
  createdAt?: string
  current?: boolean
}

export type PersistedHistoryEntry = {
  snapshot: string
  updatedAt: string
  label?: string
  author?: string
}

export type MapHistoryRepository = {
  listMapHistory: (documentId: string) => Promise<PersistedHistoryEntry[]>
  loadMapSnapshot: (documentId: string, snapshotId: string) => Promise<OntologyDocument | null>
  restoreMapSnapshot: (documentId: string, snapshotId: string) => Promise<OntologyDocument>
}

export type HistoryPanelProps = {
  documentId: string
  localEntries?: LocalHistoryEntry[]
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  repository?: MapHistoryRepository
  onRestored?: (document: OntologyDocument) => void
}

const persistedRepository: MapHistoryRepository = { listMapHistory, loadMapSnapshot, restoreMapSnapshot }

export function HistoryPanel({ documentId, localEntries = [], onUndo, onRedo, canUndo, canRedo, repository, onRestored }: HistoryPanelProps) {
  const headingId = useId()
  const [entries, setEntries] = useState<PersistedHistoryEntry[]>([])
  const [preview, setPreview] = useState<{ entry: PersistedHistoryEntry; document: OntologyDocument } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void (repository ?? persistedRepository).listMapHistory(documentId).then((history) => { if (active) setEntries(history) }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load history.') })
    return () => { active = false }
  }, [documentId, repository])

  const source = () => repository ?? persistedRepository
  const openPreview = async (entry: PersistedHistoryEntry) => {
    setBusyId(entry.snapshot)
    setError(null)
    try {
      const snapshot = await source().loadMapSnapshot(documentId, entry.snapshot)
      if (!snapshot) throw new Error('This snapshot is no longer available.')
      setPreview({ entry, document: snapshot })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to preview this snapshot.')
    } finally { setBusyId(null) }
  }
  const restore = async () => {
    if (!preview || !window.confirm(`Restore "${preview.document.name}" from ${formatDate(preview.entry.updatedAt)}? Current unsaved changes may be replaced.`)) return
    setBusyId(preview.entry.snapshot)
    setError(null)
    try {
      const restored = await source().restoreMapSnapshot(documentId, preview.entry.snapshot)
      onRestored?.(restored)
      setPreview(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to restore this snapshot.')
    } finally { setBusyId(null) }
  }

  return <section className="history-panel" aria-labelledby={headingId}>
    <div className="history-panel-heading"><div><span className="eyebrow">Changes</span><h2 id={headingId}>History</h2></div><div><button type="button" onClick={onUndo} disabled={!canUndo}>Undo</button><button type="button" onClick={onRedo} disabled={!canRedo}>Redo</button></div></div>
    {localEntries.length > 0 ? <div className="history-local"><h3>Current session</h3><ol>{localEntries.map((entry) => <li key={entry.id} className={entry.current ? 'is-current' : ''}><span>{entry.label}</span>{entry.createdAt ? <time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time> : null}</li>)}</ol></div> : null}
    <div className="history-persisted"><h3>Saved snapshots</h3>{entries.length > 0 ? <ol>{entries.map((entry) => <li key={entry.snapshot}><button type="button" disabled={busyId !== null} onClick={() => void openPreview(entry)}><span>{entry.label ?? formatDate(entry.updatedAt)}</span><small>{entry.author ? `${entry.author} - ` : ''}{formatDate(entry.updatedAt)}</small></button></li>)}</ol> : !error ? <p>No saved snapshots.</p> : null}</div>
    {error ? <p className="history-error" role="alert">{error}</p> : null}
    {preview ? <div className="history-preview"><div><h3>{preview.document.name}</h3><button type="button" onClick={() => setPreview(null)} aria-label="Close snapshot preview">x</button></div><p>{preview.document.description}</p><dl><div><dt>Version</dt><dd>{preview.document.version}</dd></div><div><dt>Floors</dt><dd>{preview.document.floors.length}</dd></div><div><dt>Neighborhoods</dt><dd>{preview.document.groups.length}</dd></div><div><dt>Concepts</dt><dd>{preview.document.nodes.length}</dd></div></dl><button type="button" disabled={busyId !== null} onClick={() => void restore()}>{busyId ? 'Restoring...' : 'Restore this snapshot'}</button></div> : null}
  </section>
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
