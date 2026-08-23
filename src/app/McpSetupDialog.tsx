import { useEffect, useRef, useState } from 'react'

export function McpSetupDialog({ onClose }: { onClose: () => void }) {
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
      <div className="dialog-heading"><div><span className="eyebrow">Integration</span><h2 id="mcp-setup-title">Connect Needle MCP</h2></div><button type="button" onClick={onClose} aria-label="Close">×</button></div>
      <p>Add this block to your client’s MCP JSON configuration. Needle exposes a Streamable HTTP server at the current workspace address.</p>
      <div className="mcp-endpoint"><span>Endpoint</span><code>{endpoint}</code></div>
      <pre aria-label="Needle MCP JSON configuration"><code>{config}</code></pre>
      <button type="button" className="mcp-copy-button" onClick={() => void copyConfig()}>{copied ? 'Copied' : 'Copy JSON'}</button>
    </section>
  </div>
}
