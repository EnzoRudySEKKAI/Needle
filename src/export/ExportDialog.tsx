import { useEffect, useRef, useState } from 'react'
import type { OntologyDocument } from '../domain/types'
import { AppSelect } from '../editor/AppSelect'
import { useI18n } from '../i18n/useI18n'
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
  const { locale, t, formatNumber } = useI18n()
  const dialogRef = useRef<HTMLElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [quality, setQuality] = useState(3)
  const [theme, setTheme] = useState<ExportTheme>('current')
  const [background, setBackground] = useState<ExportBackground>('current')
  const safeFilename = filename.normalize('NFKC').trim().replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '') || 'needle-map'
  const scopeName = scope === 'floor' ? 'floor' : 'structure'
  const version = document?.version.toLowerCase().replace(/[^a-z0-9.-]+/g, '-')
  const scopedFilename = [safeFilename, version, scopeName].filter(Boolean).join('-')
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
    } catch {
      setError(format)
    } finally {
      setBusy(null)
    }
  }
  const withDocument = (action: (value: OntologyDocument) => void | Promise<void>) => {
    if (!document) throw new Error('Document required')
    return action(document)
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
    <section ref={dialogRef} className="export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="dialog-heading"><div><span className="eyebrow">{t('tools.export.eyebrow')}</span><h2 id="export-title">{t('tools.export.title')}</h2></div><button type="button" onClick={onClose} aria-label={t('common.close')}>×</button></div>
      <p>{t('tools.export.intro')}</p>
      <div className="export-scope"><button type="button" className={scope === 'floor' ? 'is-active' : ''} onClick={() => onScope('floor')}>{t('tools.export.activeFloor')}</button><button type="button" className={scope === 'structure' ? 'is-active' : ''} onClick={() => onScope('structure')}>{t('tools.export.wholeStructure')}</button></div>
      <div className="export-scope export-selects">
        <div><span>{t('tools.export.quality')}</span><AppSelect compact ariaLabel={t('tools.export.qualityAria')} value={String(quality)} options={[1, 2, 3, 4].map((value) => ({ value: String(value), label: `${value}x` }))} onChange={(value) => setQuality(Number(value))} /></div>
        <div><span>{t('tools.export.theme')}</span><AppSelect compact ariaLabel={t('tools.export.themeAria')} value={theme} options={[{ value: 'current', label: t('common.current') }, { value: 'light', label: t('tools.export.light') }, { value: 'dark', label: t('tools.export.dark') }]} onChange={(value) => setTheme(value as ExportTheme)} /></div>
        <div><span>{t('tools.export.background')}</span><AppSelect compact ariaLabel={t('tools.export.backgroundAria')} value={background} options={[{ value: 'current', label: t('tools.export.theme') }, { value: 'white', label: t('tools.export.white') }, { value: 'transparent', label: t('tools.export.transparent') }]} onChange={(value) => setBackground(value as ExportBackground)} /></div>
      </div>
      <div className="export-options">
        <button type="button" disabled={busy !== null} onClick={() => void run('SVG', () => exportSvg(scopedFilename, theme, background))}><strong>SVG</strong><span>{t('tools.export.vectorSnapshot')}</span></button>
        <button type="button" disabled={busy !== null} onClick={() => void run('PNG', () => exportPng(scopedFilename, quality, theme, background))}><strong>PNG</strong><span>{t('tools.export.rasterSnapshot', { quality })}</span></button>
        <button type="button" disabled={busy !== null} onClick={() => void run('PDF', () => exportPdf(scopedFilename, quality, theme, background))}><strong>PDF</strong><span>{t('tools.export.a4Snapshot')}</span></button>
        <button type="button" disabled={busy !== null || !document} onClick={() => void run('JSON', () => withDocument((value) => exportJson(value, scopedFilename, semanticFloorId)))}><strong>JSON</strong><span>{t('tools.export.ontologyData')}</span></button>
        <button type="button" disabled={busy !== null || !document} onClick={() => void run(t('tools.export.nodeCsv'), () => withDocument((value) => exportNodeCsv(value, scopedFilename, semanticFloorId)))}><strong>{t('tools.export.nodeCsv')}</strong><span>{t('tools.export.conceptSpreadsheet')}</span></button>
        <button type="button" disabled={busy !== null || !document} onClick={() => void run(t('tools.export.relationCsv'), () => withDocument((value) => exportRelationCsv(value, scopedFilename, semanticFloorId)))}><strong>{t('tools.export.relationCsv')}</strong><span>{t('tools.export.connectionSpreadsheet')}</span></button>
        <button type="button" disabled={busy !== null || !document} onClick={() => void run('Mermaid', () => withDocument((value) => exportMermaid(value, scopedFilename, semanticFloorId)))}><strong>Mermaid</strong><span>{t('tools.export.portableFlowchart')}</span></button>
        <button type="button" disabled={busy !== null || !document} onClick={() => void run(t('tools.export.allFloorsPdf'), () => withDocument((value) => exportAllFloorsPdf(value, `${safeFilename}-${version ?? 'current'}-all-floors`, {
          locale,
          conceptCount: (count) => t(count === 1 ? 'tools.export.reportConceptOne' : 'tools.export.reportConceptMany', { count: formatNumber(count) }),
          neighborhoods: t('tools.export.reportNeighborhoods'),
          noDescription: t('tools.export.reportNoDescription'),
          relations: t('tools.export.reportRelations'),
          noRelations: t('tools.export.reportNoRelations'),
          title: t('tools.export.reportAllFloors', { name: value.name }),
          structureTypes: { tower: t('structure.tower'), campus: t('structure.campus'), 'cruise-ship': t('structure.ship') },
          relationKinds: { full: t('tools.export.reportFullRelation'), dotted: t('tools.export.reportDottedRelation') },
        })))}><strong>{t('tools.export.allFloorsPdf')}</strong><span>{t('tools.export.floorReport')}</span></button>
      </div>
      {busy ? <p className="export-status" role="status">{t('tools.export.preparing', { format: busy })}</p> : null}
      {error ? <p className="library-error" role="alert">{t('tools.export.error', { format: error })}</p> : null}
      {!document ? <p className="export-status">{t('tools.export.documentRequired')}</p> : null}
    </section>
  </div>
}
