import { Link } from 'react-router-dom'
import { setFlowSpeed, stepFlow, toggleFlow, useClockState } from '../map/stores/flow-clock'
import { useDocumentStore } from './document-store'

function toggleTheme() {
  const dark = document.documentElement.dataset.theme === 'dark'
  if (dark) delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = 'dark'
  localStorage.setItem('needle:theme', dark ? 'light' : 'dark')
}

export function MapHeader({ activeFlowId, editable, fullscreen, fullscreenError, onFullscreen, onEditable, onExport }: { activeFlowId: string | null; editable: boolean; fullscreen: boolean; fullscreenError: string | null; onFullscreen: () => void; onEditable?: (editable: boolean) => void; onExport?: () => void }) {
  const { document, selection, undo, redo, canUndo, canRedo } = useDocumentStore()
  const clock = useClockState()
  const selected = selection?.kind === 'node' ? document.nodes.find((node) => node.id === selection.id)?.name : selection?.kind ?? 'none'
  return <header className="map-header">
    <Link to="/" className="brand"><strong>Needle</strong><span>ONTOLOGY</span></Link>
    <div className="header-cell repository-cell"><span>Map</span><strong>{document.name} · {document.version}</strong></div>
    <div className="header-cell"><span>Scenarios</span><strong>{document.flows.length}</strong></div>
    <div className="header-cell"><span>Concepts</span><strong>{document.nodes.length}</strong></div>
    <div className="header-cell"><span>Relations</span><strong>{document.relations.length}</strong></div>
    <div className="header-cell selected-cell"><span>Selected</span><strong>{selected}</strong></div>
    <div className="header-actions">
      {onEditable ? <div className="segmented"><button type="button" className={editable ? 'is-active' : ''} onClick={() => onEditable(true)}>Build</button><button type="button" className={!editable ? 'is-active' : ''} onClick={() => onEditable(false)}>Play</button></div> : null}
      {editable ? <><button type="button" disabled={!canUndo} onClick={undo} title="Undo">↶</button><button type="button" disabled={!canRedo} onClick={redo} title="Redo">↷</button></> : null}
      <button type="button" disabled={!activeFlowId} onClick={toggleFlow}>{clock.playing ? 'Pause' : 'Play'}</button>
      <button type="button" disabled={!activeFlowId} onClick={stepFlow}>Step</button>
      <div className="speed-control">{[0.5, 1, 2].map((speed) => <button type="button" key={speed} className={clock.speed === speed ? 'is-active' : ''} onClick={() => setFlowSpeed(speed)}>{speed}×</button>)}</div>
      <button type="button" onClick={toggleTheme} title="Toggle theme">◐</button>
      <button type="button" className="fullscreen-button" onClick={onFullscreen} title={fullscreenError ?? (fullscreen ? 'Exit fullscreen' : 'Enter fullscreen')}>{fullscreen ? 'Exit full' : 'Fullscreen'}</button>
      {onExport ? <button type="button" className="export-button" onClick={onExport}>Export</button> : null}
    </div>
  </header>
}
