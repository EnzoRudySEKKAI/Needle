import { useEffect, useId, useState } from 'react'
import type { OntologyDocument } from '../domain/types'
import { useI18n } from '../i18n/useI18n'
import type { MessageKey } from '../i18n/messages'
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
  const { t, formatDate } = useI18n()
  const headingId = useId()
  const [entries, setEntries] = useState<PersistedHistoryEntry[]>([])
  const [preview, setPreview] = useState<{ entry: PersistedHistoryEntry; document: OntologyDocument } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<MessageKey | null>(null)
  const displayDate = (value: string) => {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : formatDate(date, { dateStyle: 'medium', timeStyle: 'short' })
  }

  useEffect(() => {
    let active = true
    void (repository ?? persistedRepository).listMapHistory(documentId).then((history) => { if (active) setEntries(history) }).catch(() => { if (active) setError('tools.history.loadError') })
    return () => { active = false }
  }, [documentId, repository])

  const source = () => repository ?? persistedRepository
  const openPreview = async (entry: PersistedHistoryEntry) => {
    setBusyId(entry.snapshot)
    setError(null)
    try {
      const snapshot = await source().loadMapSnapshot(documentId, entry.snapshot)
      if (!snapshot) { setError('tools.history.snapshotUnavailable'); return }
      setPreview({ entry, document: snapshot })
    } catch {
      setError('tools.history.previewError')
    } finally { setBusyId(null) }
  }
  const restore = async () => {
    if (!preview || !window.confirm(t('tools.history.restoreConfirm', { name: preview.document.name, date: displayDate(preview.entry.updatedAt) }))) return
    setBusyId(preview.entry.snapshot)
    setError(null)
    try {
      const restored = await source().restoreMapSnapshot(documentId, preview.entry.snapshot)
      onRestored?.(restored)
      setPreview(null)
    } catch {
      setError('tools.history.restoreError')
    } finally { setBusyId(null) }
  }

  return <section className="history-panel" aria-labelledby={headingId}>
    <div className="history-panel-heading"><div><span className="eyebrow">{t('tools.history.changes')}</span><h2 id={headingId}>{t('tools.history.title')}</h2></div><div><button type="button" onClick={onUndo} disabled={!canUndo}>{t('tools.history.undo')}</button><button type="button" onClick={onRedo} disabled={!canRedo}>{t('tools.history.redo')}</button></div></div>
    {localEntries.length > 0 ? <div className="history-local"><h3>{t('tools.history.currentSession')}</h3><ol>{localEntries.map((entry) => <li key={entry.id} className={entry.current ? 'is-current' : ''}><span>{entry.label}</span>{entry.createdAt ? <time dateTime={entry.createdAt}>{displayDate(entry.createdAt)}</time> : null}</li>)}</ol></div> : null}
    <div className="history-persisted"><h3>{t('tools.history.savedSnapshots')}</h3>{entries.length > 0 ? <ol>{entries.map((entry) => <li key={entry.snapshot}><button type="button" disabled={busyId !== null} onClick={() => void openPreview(entry)}><span>{entry.label ?? displayDate(entry.updatedAt)}</span><small>{entry.author ? `${entry.author} - ` : ''}{displayDate(entry.updatedAt)}</small></button></li>)}</ol> : !error ? <p>{t('tools.history.noSavedSnapshots')}</p> : null}</div>
    {error ? <p className="history-error" role="alert">{t(error)}</p> : null}
    {preview ? <div className="history-preview"><div><h3>{preview.document.name}</h3><button type="button" onClick={() => setPreview(null)} aria-label={t('tools.history.closePreviewAria')}>x</button></div><p>{preview.document.description}</p><dl><div><dt>{t('tools.history.version')}</dt><dd>{preview.document.version}</dd></div><div><dt>{t('common.floors')}</dt><dd>{preview.document.floors.length}</dd></div><div><dt>{t('tools.history.neighborhoods')}</dt><dd>{preview.document.groups.length}</dd></div><div><dt>{t('common.concepts')}</dt><dd>{preview.document.nodes.length}</dd></div></dl><button type="button" disabled={busyId !== null} onClick={() => void restore()}>{busyId ? t('tools.history.restoring') : t('tools.history.restoreSnapshot')}</button></div> : null}
  </section>
}
