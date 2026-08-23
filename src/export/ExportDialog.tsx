import { useEffect, useRef, useState } from 'react'
import type { OntologyDocument } from '../domain/types'
import { AppSelect } from '../editor/AppSelect'
import { exportAllFloorsPdf, exportJson, exportMermaid, exportNodeCsv, exportPdf, exportPng, exportRelationCsv, exportSvg, type ExportBackground, type ExportTheme } from './map-export'

type ExportDialogProps = {
  filename: string
  scope: 'floor' | 'structure'
  onScope: (scope: 'floor' | 'structure') => void
  onClose: () => void
  document?: OntologyDocument
  activeFloorId?: string
}

export function ExportDialog({ filename, scope, onScope, onClose, document, activeFloorId }: ExportDialogProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [quality, setQuality] = useState(3)
  const [theme, setTheme] = useState<ExportTheme>('current')
  const [background, setBackground] = useState<ExportBackground>('current')
  const scopeName = scope === 'floor' ? 'floor' : 'structure'
  const version = document?.version.toLowerCase().replace(/[^a-z0-9.-]+/g, '-')
  const scopedFilename = [filename, version, scopeName].filter(Boolean).join('-')
  const semanticFloorId = scope === 'floor' ? activeFloorId : undefined

  useEffect(() => {
    const previouslyFocused = globalThis.document.activeElement instanceof HTMLElement ? globalThis.document.activeElement : null
    const dialog = dialogRef.current
    const focusable = () => dialog ? [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex]:not([tabindex="-1"])')] : []
    focusable()[0]?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
      if (event.key === 'Tab') {
        const elements = focusable()
        if (elements.length === 0) return
        const first = elements[0]
        const last = elements[elements.length - 1]
        if (!first || !last) return
        if (event.shiftKey && globalThis.document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && globalThis.document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown); previouslyFocused?.focus() }
  }, [onClose])

  const run = async (format: string, action: () => void | Promise<void>) => {
    setBusy(format)
    setError(null)
    try {
      await action()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Unable to export ${format.toUpperCase()}.`)
    } finally {
      setBusy(null)
    }
  }
  const withDocument = (action: (value: OntologyDocument) => void | Promise<void>) => {
    if (!document) throw new Error('Semantic exports need the current ontology document.')
    return action(document)
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
    <section ref={dialogRef} className="export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="dialog-heading"><div><span className="eyebrow">Snapshot and data</span><h2 id="export-title">Export this map</h2></div><button type="button" onClick={onClose} aria-label="Close">×</button></div>
      <p>Choose a visual snapshot or a portable semantic format.</p>
      <div className="export-scope"><button type="button" className={scope === 'floor' ? 'is-active' : ''} onClick={() => onScope('floor')}>Active floor</button><button type="button" className={scope === 'structure' ? 'is-active' : ''} onClick={() => onScope('structure')}>Whole structure</button></div>
      <div className="export-scope export-selects">
        <div><span>Quality</span><AppSelect compact ariaLabel="Export quality" value={String(quality)} options={[1, 2, 3, 4].map((value) => ({ value: String(value), label: `${value}x` }))} onChange={(value) => setQuality(Number(value))} /></div>
        <div><span>Theme</span><AppSelect compact ariaLabel="Export theme" value={theme} options={[{ value: 'current', label: 'Current' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} onChange={(value) => setTheme(value as ExportTheme)} /></div>
        <div><span>Background</span><AppSelect compact ariaLabel="Export background" value={background} options={[{ value: 'current', label: 'Theme' }, { value: 'white', label: 'White' }, { value: 'transparent', label: 'Transparent' }]} onChange={(value) => setBackground(value as ExportBackground)} /></div>
      </div>
      <div className="export-options">
        <button type="button" disabled={busy !== null} onClick={() => void run('svg', () => exportSvg(scopedFilename, theme, background))}><strong>SVG</strong><span>Vector snapshot</span></button>
        <button type="button" disabled={busy !== null} onClick={() => void run('png', () => exportPng(scopedFilename, quality, theme, background))}><strong>PNG</strong><span>{quality}x raster snapshot</span></button>
        <button type="button" disabled={busy !== null} onClick={() => void run('pdf', () => exportPdf(scopedFilename, quality, theme, background))}><strong>PDF</strong><span>A4 fitted snapshot</span></button>
        <button type="button" disabled={busy !== null || !document} onClick={() => void run('json', () => withDocument((value) => exportJson(value, scopedFilename, semanticFloorId)))}><strong>JSON</strong><span>Native ontology data</span></button>
        <button type="button" disabled={busy !== null || !document} onClick={() => void run('node csv', () => withDocument((value) => exportNodeCsv(value, scopedFilename, semanticFloorId)))}><strong>Node CSV</strong><span>Concept spreadsheet</span></button>
        <button type="button" disabled={busy !== null || !document} onClick={() => void run('relation csv', () => withDocument((value) => exportRelationCsv(value, scopedFilename, semanticFloorId)))}><strong>Relation CSV</strong><span>Connection spreadsheet</span></button>
        <button type="button" disabled={busy !== null || !document} onClick={() => void run('mermaid', () => withDocument((value) => exportMermaid(value, scopedFilename, semanticFloorId)))}><strong>Mermaid</strong><span>Portable flowchart</span></button>
        <button type="button" disabled={busy !== null || !document} onClick={() => void run('all floors pdf', () => withDocument((value) => exportAllFloorsPdf(value, `${filename}-${version ?? 'current'}-all-floors`)))}><strong>All floors PDF</strong><span>Semantic floor report</span></button>
      </div>
      {busy ? <p className="export-status" role="status">Preparing {busy.toUpperCase()}...</p> : null}
      {error ? <p className="library-error" role="alert">{error}</p> : null}
      {!document ? <p className="export-status">Semantic exports become available when the caller supplies the ontology document.</p> : null}
    </section>
  </div>
}
