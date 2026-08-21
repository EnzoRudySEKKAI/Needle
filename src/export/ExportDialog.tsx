import { useState } from 'react'
import { exportPdf, exportPng, exportSvg } from './map-export'

export function ExportDialog({ filename, onClose }: { filename: string; onClose: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const run = async (format: string, action: () => void | Promise<void>) => {
    setBusy(format)
    try { await action() } finally { setBusy(null) }
  }
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}><section className="export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title" onMouseDown={(event) => event.stopPropagation()}><div className="dialog-heading"><div><span className="eyebrow">Snapshot</span><h2 id="export-title">Export this view</h2></div><button type="button" onClick={onClose} aria-label="Close">×</button></div><p>The exported file uses the current camera and theme. Editing handles and side panels stay behind.</p><div className="export-options"><button type="button" onClick={() => run('svg', () => exportSvg(filename))}><strong>SVG</strong><span>Vector · best for editing</span></button><button type="button" onClick={() => run('png', () => exportPng(filename, 3))}><strong>PNG</strong><span>3× · presentation ready</span></button><button type="button" onClick={() => run('pdf', () => exportPdf(filename))}><strong>PDF</strong><span>A4 · landscape fitted</span></button></div>{busy ? <p className="export-status">Preparing {busy.toUpperCase()}…</p> : null}</section></div>
}
