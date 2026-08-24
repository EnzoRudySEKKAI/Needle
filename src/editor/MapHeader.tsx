import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { McpSetupDialog } from '../app/McpSetupDialog'
import { LanguageSwitch } from '../i18n/LanguageSwitch'
import { useI18n } from '../i18n/useI18n'
import { useDocumentStore } from './document-store'

type IconName = 'undo' | 'redo' | 'search' | 'left-panel' | 'right-panel' | 'header' | 'fullscreen' | 'fullscreen-exit' | 'settings'

function HeaderIcon({ name }: { name: IconName }) {
  if (name === 'undo' || name === 'redo') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d={name === 'undo' ? 'M8 5H4v-4M4 5c1.7-2.1 4.1-3.1 6.6-2.7 3.7.5 6.3 3.8 5.8 7.5s-3.8 6.3-7.5 5.8A6.7 6.7 0 0 1 4 12.4' : 'M12 5h4v-4m0 4c-1.7-2.1-4.1-3.1-6.6-2.7-3.7.5-6.3 3.8-5.8 7.5s3.8 6.3 7.5 5.8a6.7 6.7 0 0 0 4.9-3.2'} /></svg>
  if (name === 'search') return <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.2" /><path d="m12.4 12.4 4 4" /></svg>
  if (name === 'left-panel' || name === 'right-panel') return <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="3" width="15" height="14" rx="2" /><path d={name === 'left-panel' ? 'M7 3v14' : 'M13 3v14'} /></svg>
  if (name === 'header') return <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="3" width="15" height="14" rx="2" /><path d="M2.5 7.5h15" /></svg>
  if (name === 'fullscreen') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 3H3v4M3 3l5 5m5-5h4v4m0-4-5 5M7 17H3v-4m0 4 5-5m5 5h4v-4m0 4-5-5" /></svg>
  if (name === 'fullscreen-exit') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 8H4V4m0 4 4-4m4 4h4V4m0 4-4-4M8 12H4v4m0-4 4 4m4-4h4v4m0-4-4 4" /></svg>
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.09a2 2 0 0 1 1 1.74v.5a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" /><circle cx="12" cy="12" r="3" /></svg>
}

function setTheme(dark: boolean) {
  if (dark) window.document.documentElement.dataset.theme = 'dark'
  else delete window.document.documentElement.dataset.theme
  try { localStorage.setItem('needle:theme', dark ? 'dark' : 'light') } catch { /* Storage can be disabled. */ }
}

export function MapHeader({ editable, fullscreen, fullscreenError, historyOpen = false, onFullscreen, onEditable, onExport, onSearch, onHistory, onShortcuts, leftCollapsed = false, rightCollapsed = false, headerCollapsed = false, onToggleLeft, onToggleRight, onToggleHeader }: { editable: boolean; fullscreen: boolean; fullscreenError: string | null; historyOpen?: boolean; onFullscreen: () => void; onEditable?: (editable: boolean) => void; onExport?: () => void; onSearch?: () => void; onHistory?: () => void; onShortcuts?: () => void; leftCollapsed?: boolean; rightCollapsed?: boolean; headerCollapsed?: boolean; onToggleLeft?: () => void; onToggleRight?: () => void; onToggleHeader?: () => void }) {
  const { t } = useI18n()
  const { document: map, undo, redo, canUndo, canRedo } = useDocumentStore()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mcpOpen, setMcpOpen] = useState(false)
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

  return <><header className="map-header">
    <Link to="/" className="brand"><strong>Needle</strong><span>{t('shell.brand.ontology')}</span></Link>
    <div className="header-cell repository-cell"><span>{t('common.map')}</span><strong>{map.name} · {map.version}</strong></div>
    <div className="header-spacer" />
    {onEditable ? <div className="segmented header-mode-control"><button type="button" className={editable ? 'is-active' : ''} onClick={() => onEditable(true)}>{t('shell.header.build')}</button><button type="button" className={!editable ? 'is-active' : ''} onClick={() => onEditable(false)}>{t('shell.header.play')}</button></div> : <Link className="header-mode-link" to={`/builder/${map.id}`}>{t('shell.header.build')}</Link>}
    <div className="header-actions">
      {editable ? <><button type="button" className="header-icon-button" disabled={!canUndo} onClick={undo} aria-label={t('shell.header.undo')} title={t('shell.header.undo')}><HeaderIcon name="undo" /></button><button type="button" className="header-icon-button" disabled={!canRedo} onClick={redo} aria-label={t('shell.header.redo')} title={t('shell.header.redo')}><HeaderIcon name="redo" /></button></> : null}
      {onSearch ? <button type="button" className="header-icon-button" onClick={onSearch} aria-label={t('shell.header.find')} title={t('shell.header.findTitle')}><HeaderIcon name="search" /></button> : null}
      {onShortcuts ? <button type="button" className="header-icon-button header-help-button" onClick={onShortcuts} aria-label={t('shell.header.shortcuts')} title={t('shell.header.shortcutsTitle')}>?</button> : null}
      {onToggleLeft ? <button type="button" className={`header-icon-button rail-toggle-button ${leftCollapsed ? 'is-collapsed' : ''}`} aria-label={t(leftCollapsed ? 'shell.header.showConcepts' : 'shell.header.hideConcepts')} aria-pressed={!leftCollapsed} title={t(leftCollapsed ? 'shell.header.showLeft' : 'shell.header.hideLeft')} onClick={onToggleLeft}><HeaderIcon name="left-panel" /></button> : null}
      {onToggleRight ? <button type="button" className={`header-icon-button rail-toggle-button ${rightCollapsed ? 'is-collapsed' : ''}`} aria-label={t(rightCollapsed ? 'shell.header.showDetails' : 'shell.header.hideDetails')} aria-pressed={!rightCollapsed} title={t(rightCollapsed ? 'shell.header.showRight' : 'shell.header.hideRight')} onClick={onToggleRight}><HeaderIcon name="right-panel" /></button> : null}
      {onToggleHeader ? <button type="button" className={`header-icon-button rail-toggle-button ${headerCollapsed ? 'is-collapsed' : ''}`} aria-label={t(headerCollapsed ? 'shell.header.showHeader' : 'shell.header.hideHeader')} aria-pressed={!headerCollapsed} title={t(headerCollapsed ? 'shell.header.showHeaderTitle' : 'shell.header.hideHeaderTitle')} onClick={onToggleHeader}><HeaderIcon name="header" /></button> : null}
      <button type="button" className="header-icon-button" onClick={onFullscreen} aria-label={t(fullscreen ? 'shell.header.exitFullscreen' : 'shell.header.enterFullscreen')} title={fullscreenError ?? t(fullscreen ? 'shell.header.exitFullscreen' : 'shell.header.enterFullscreen')}><HeaderIcon name={fullscreen ? 'fullscreen-exit' : 'fullscreen'} /></button>
      <div className="settings-menu-wrap" ref={settingsRef}>
        <button type="button" className={`header-icon-button ${settingsOpen ? 'is-active' : ''}`} aria-label={t('shell.header.settings')} aria-haspopup="menu" aria-expanded={settingsOpen} title={t('shell.header.settings')} onClick={() => setSettingsOpen((open) => !open)}><HeaderIcon name="settings" /></button>
        {settingsOpen ? <div className="settings-menu" aria-label={t('shell.header.settings')}>
          {onExport ? <button type="button" onClick={() => { setSettingsOpen(false); onExport() }}><span>{t('shell.settings.export')}</span><small>{t('shell.settings.exportHint')}</small></button> : null}
          <button type="button" role="switch" aria-checked={dark} onClick={() => { const next = !dark; setDark(next); setTheme(next) }}><span>{t(dark ? 'shell.settings.dark' : 'shell.settings.light')}</span><i className={dark ? 'is-on' : ''} aria-hidden="true"><b /></i></button>
          <div className="settings-language-row"><span>{t('language.label')}</span><LanguageSwitch /></div>
          {onHistory ? <button type="button" className={historyOpen ? 'is-active' : ''} onClick={() => { setSettingsOpen(false); onHistory() }}><span>{t('shell.settings.history')}</span><small>{t(historyOpen ? 'shell.settings.closeVersions' : 'shell.settings.savedVersions')}</small></button> : null}
          <button type="button" onClick={() => { setSettingsOpen(false); setMcpOpen(true) }}><span>{t('shell.settings.connectMcp')}</span><small>{t('shell.settings.copyClientJson')}</small></button>
        </div> : null}
      </div>
    </div>
  </header>{mcpOpen ? <McpSetupDialog onClose={() => setMcpOpen(false)} /> : null}</>
}
