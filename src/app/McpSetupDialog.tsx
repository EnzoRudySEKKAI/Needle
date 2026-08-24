import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/useI18n'

export function McpSetupDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLElement>(null)
  const [copied, setCopied] = useState(false)
  const endpoint = `${window.location.origin}/mcp`
  const config = JSON.stringify({ mcpServers: { needle: { type: 'http', url: endpoint } } }, null, 2)

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown); previouslyFocused?.focus() }
  }, [onClose])

  const copyConfig = async () => {
    try {
      await navigator.clipboard.writeText(config)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
    <section ref={dialogRef} className="export-dialog mcp-setup-dialog" role="dialog" aria-modal="true" aria-labelledby="mcp-setup-title" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
      <div className="dialog-heading"><div><span className="eyebrow">{t('home.mcp.eyebrow')}</span><h2 id="mcp-setup-title">{t('home.mcp.title')}</h2></div><button type="button" onClick={onClose} aria-label={t('common.close')}>×</button></div>
      <p>{t('home.mcp.description')}</p>
      <div className="mcp-endpoint"><span>{t('home.mcp.endpoint')}</span><code>{endpoint}</code></div>
      <pre aria-label={t('home.mcp.configAria')}><code>{config}</code></pre>
      <button type="button" className="mcp-copy-button" onClick={() => void copyConfig()}>{t(copied ? 'home.mcp.copied' : 'home.mcp.copyJson')}</button>
    </section>
  </div>
}
