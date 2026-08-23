import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentStore } from './document-store'

type IconName = 'undo' | 'redo' | 'search' | 'left-panel' | 'right-panel' | 'header' | 'fullscreen' | 'fullscreen-exit' | 'settings'

function HeaderIcon({ name }: { name: IconName }) {
  if (name === 'undo' || name === 'redo') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d={name === 'undo' ? 'M8 5H4v-4M4 5c1.7-2.1 4.1-3.1 6.6-2.7 3.7.5 6.3 3.8 5.8 7.5s-3.8 6.3-7.5 5.8A6.7 6.7 0 0 1 4 12.4' : 'M12 5h4v-4m0 4c-1.7-2.1-4.1-3.1-6.6-2.7-3.7.5-6.3 3.8-5.8 7.5s3.8 6.3 7.5 5.8a6.7 6.7 0 0 0 4.9-3.2'} /></svg>
  if (name === 'search') return <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.2" /><path d="m12.4 12.4 4 4" /></svg>
  if (name === 'left-panel' || name === 'right-panel') return <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="3" width="15" height="14" rx="2" /><path d={name === 'left-panel' ? 'M7 3v14' : 'M13 3v14'} /></svg>
  if (name === 'header') return <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="3" width="15" height="14" rx="2" /><path d="M2.5 7.5h15" /></svg>
  if (name === 'fullscreen') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 3H3v4M3 3l5 5m5-5h4v4m0-4-5 5M7 17H3v-4m0 4 5-5m5 5h4v-4m0 4-5-5" /></svg>
  if (name === 'fullscreen-exit') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 8H4V4m0 4 4-4m4 4h4V4m0 4-4-4M8 12H4v4m0-4 4 4m4-4h4v4m0-4-4 4" /></svg>
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8.3 1.8h3.4l.5 2.1c.5.2 1 .4 1.4.8l1.9-1.1 1.7 3-1.7 1.4c.1.5.1 1.1 0 1.6l1.7 1.4-1.7 3-1.9-1.1c-.4.3-.9.6-1.4.8l-.5 2.1H8.3l-.5-2.1c-.5-.2-1-.4-1.4-.8L4.5 16l-1.7-3 1.7-1.4a6 6 0 0 1 0-1.6L2.8 6.6l1.7-3 1.9 1.1c.4-.3.9-.6 1.4-.8z" /><circle cx="10" cy="9.8" r="2.6" /></svg>
}

function setTheme(dark: boolean) {
  if (dark) window.document.documentElement.dataset.theme = 'dark'
  else delete window.document.documentElement.dataset.theme
  try { localStorage.setItem('needle:theme', dark ? 'dark' : 'light') } catch { /* Storage can be disabled. */ }
}

export function MapHeader({ editable, fullscreen, fullscreenError, historyOpen = false, onFullscreen, onEditable, onExport, onSearch, onHistory, onShortcuts, leftCollapsed = false, rightCollapsed = false, headerCollapsed = false, onToggleLeft, onToggleRight, onToggleHeader }: { editable: boolean; fullscreen: boolean; fullscreenError: string | null; historyOpen?: boolean; onFullscreen: () => void; onEditable?: (editable: boolean) => void; onExport?: () => void; onSearch?: () => void; onHistory?: () => void; onShortcuts?: () => void; leftCollapsed?: boolean; rightCollapsed?: boolean; headerCollapsed?: boolean; onToggleLeft?: () => void; onToggleRight?: () => void; onToggleHeader?: () => void }) {
  const { document: map, undo, redo, canUndo, canRedo } = useDocumentStore()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dark, setDark] = useState(() => window.document.documentElement.dataset.theme === 'dark')
  const settingsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!settingsOpen) return
    const close = (event: PointerEvent) => { if (!settingsRef.current?.contains(event.target as Node)) setSettingsOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setSettingsOpen(false) }
    window.document.addEventListener('pointerdown', close)
    window.addEventListener('keydown', escape)
    return () => { window.document.removeEventListener('pointerdown', close); window.removeEventListener('keydown', escape) }
  }, [settingsOpen])

  return <header className="map-header">
    <Link to="/" className="brand"><strong>Needle</strong><span>ONTOLOGY</span></Link>
    <div className="header-cell repository-cell"><span>Map</span><strong>{map.name} · {map.version}</strong></div>
    <div className="header-spacer" />
    {onEditable ? <div className="segmented header-mode-control"><button type="button" className={editable ? 'is-active' : ''} onClick={() => onEditable(true)}>Build</button><button type="button" className={!editable ? 'is-active' : ''} onClick={() => onEditable(false)}>Play</button></div> : <Link className="header-mode-link" to={`/builder/${map.id}`}>Build</Link>}
    <div className="header-actions">
      {editable ? <><button type="button" className="header-icon-button" disabled={!canUndo} onClick={undo} aria-label="Undo" title="Undo"><HeaderIcon name="undo" /></button><button type="button" className="header-icon-button" disabled={!canRedo} onClick={redo} aria-label="Redo" title="Redo"><HeaderIcon name="redo" /></button></> : null}
      {onSearch ? <button type="button" className="header-icon-button" onClick={onSearch} aria-label="Find" title="Find (Command K)"><HeaderIcon name="search" /></button> : null}
      {onShortcuts ? <button type="button" className="header-icon-button header-help-button" onClick={onShortcuts} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">?</button> : null}
      {onToggleLeft ? <button type="button" className={`header-icon-button rail-toggle-button ${leftCollapsed ? 'is-collapsed' : ''}`} aria-label={leftCollapsed ? 'Show concepts rail' : 'Hide concepts rail'} aria-pressed={!leftCollapsed} title={leftCollapsed ? 'Show left rail [' : 'Hide left rail ['} onClick={onToggleLeft}><HeaderIcon name="left-panel" /></button> : null}
      {onToggleRight ? <button type="button" className={`header-icon-button rail-toggle-button ${rightCollapsed ? 'is-collapsed' : ''}`} aria-label={rightCollapsed ? 'Show detail rail' : 'Hide detail rail'} aria-pressed={!rightCollapsed} title={rightCollapsed ? 'Show detail rail ]' : 'Hide detail rail ]'} onClick={onToggleRight}><HeaderIcon name="right-panel" /></button> : null}
      {onToggleHeader ? <button type="button" className={`header-icon-button rail-toggle-button ${headerCollapsed ? 'is-collapsed' : ''}`} aria-label={headerCollapsed ? 'Show header' : 'Hide header'} aria-pressed={!headerCollapsed} title={headerCollapsed ? 'Show header (H)' : 'Hide header (H)'} onClick={onToggleHeader}><HeaderIcon name="header" /></button> : null}
      <button type="button" className="header-icon-button" onClick={onFullscreen} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title={fullscreenError ?? (fullscreen ? 'Exit fullscreen' : 'Enter fullscreen')}><HeaderIcon name={fullscreen ? 'fullscreen-exit' : 'fullscreen'} /></button>
      <div className="settings-menu-wrap" ref={settingsRef}>
        <button type="button" className={`header-icon-button ${settingsOpen ? 'is-active' : ''}`} aria-label="Settings" aria-haspopup="menu" aria-expanded={settingsOpen} title="Settings" onClick={() => setSettingsOpen((open) => !open)}><HeaderIcon name="settings" /></button>
        {settingsOpen ? <div className="settings-menu" role="menu">
          {onExport ? <button type="button" role="menuitem" onClick={() => { setSettingsOpen(false); onExport() }}><span>Export</span><small>Files and images</small></button> : null}
          <button type="button" role="menuitemcheckbox" aria-checked={dark} onClick={() => { const next = !dark; setDark(next); setTheme(next) }}><span>{dark ? 'Dark appearance' : 'Light appearance'}</span><i className={dark ? 'is-on' : ''} aria-hidden="true"><b /></i></button>
          {onHistory ? <button type="button" role="menuitem" className={historyOpen ? 'is-active' : ''} onClick={() => { setSettingsOpen(false); onHistory() }}><span>History</span><small>{historyOpen ? 'Close versions' : 'Saved versions'}</small></button> : null}
        </div> : null}
      </div>
    </div>
  </header>
}
