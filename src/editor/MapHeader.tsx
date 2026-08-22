import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { OntologyFlow } from '../domain/types'
import { activeStageState, type FlowProgram } from '../map/core/program'
import { seekFlowStage, setFlowSpeed, stepFlow, toggleFlow, useClockState } from '../map/stores/flow-clock'
import type { StepDisplayMode } from '../map/core/step-display'
import { useDocumentStore } from './document-store'

function toggleTheme() {
  const dark = document.documentElement.dataset.theme === 'dark'
  if (dark) delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = 'dark'
  localStorage.setItem('needle:theme', dark ? 'light' : 'dark')
}

function StepNavigator({ flow, program, started, time }: { flow: OntologyFlow; program: FlowProgram | null; started: boolean; time: number }) {
  const currentIndex = program && started ? activeStageState(program, time).index : -1
  const currentStageId = currentIndex >= 0 ? program?.stages[currentIndex]?.id ?? '' : ''
  const currentButton = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    currentButton.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [currentStageId])
  if (flow.stages.length === 0) return <div className="step-navigator is-empty"><span>Steps</span><strong>No steps</strong></div>
  return <nav className="step-navigator" aria-label={`Steps in ${flow.name}`}>
    <span className="step-navigator-title">Steps</span>
    <ol className="step-navigator-track">
      {flow.stages.map((stage, index) => {
        const current = stage.id === currentStageId
        return <li key={stage.id}><button ref={current ? currentButton : undefined} type="button" disabled={!program} aria-current={current ? 'step' : undefined} aria-label={`Step ${index + 1} of ${flow.stages.length}`} title={`Step ${index + 1} of ${flow.stages.length}`} onClick={() => { if (program) seekFlowStage(program.id, stage.id) }}>{String(index + 1).padStart(2, '0')}</button></li>
      })}
    </ol>
    <select className="step-navigator-select" aria-label={`Choose a step in ${flow.name}`} value={currentStageId} disabled={!program} onChange={(event) => { if (program && event.target.value) seekFlowStage(program.id, event.target.value) }}>
      <option value="">Steps</option>
      {flow.stages.map((stage, index) => <option key={stage.id} value={stage.id}>Step {String(index + 1).padStart(2, '0')}</option>)}
    </select>
  </nav>
}

export function MapHeader({ activeFlowId, editable, stepDisplayMode, fullscreen, fullscreenError, onStepDisplayMode, onFullscreen, onEditable, onExport, leftCollapsed = false, rightCollapsed = false, onToggleLeft, onToggleRight }: { activeFlowId: string | null; editable: boolean; stepDisplayMode: StepDisplayMode; fullscreen: boolean; fullscreenError: string | null; onStepDisplayMode: (mode: StepDisplayMode) => void; onFullscreen: () => void; onEditable?: (editable: boolean) => void; onExport?: () => void; leftCollapsed?: boolean; rightCollapsed?: boolean; onToggleLeft?: () => void; onToggleRight?: () => void }) {
  const { document, undo, redo, canUndo, canRedo } = useDocumentStore()
  const clock = useClockState()
  const activeFlow = document.flows.find((flow) => flow.id === activeFlowId) ?? null
  const activeProgram = activeFlow && clock.program?.id === activeFlow.id ? clock.program : null
  return <header className="map-header">
    <Link to="/" className="brand"><strong>Needle</strong><span>ONTOLOGY</span></Link>
    <div className="header-cell repository-cell"><span>Map</span><strong>{document.name} · {document.version}</strong></div>
    {activeFlow ? <StepNavigator flow={activeFlow} program={activeProgram} started={clock.started} time={clock.time} /> : null}
    <div className="header-actions">
      {onEditable ? <div className="segmented"><button type="button" className={editable ? 'is-active' : ''} onClick={() => onEditable(true)}>Build</button><button type="button" className={!editable ? 'is-active' : ''} onClick={() => onEditable(false)}>Play</button></div> : null}
      {editable ? <><button type="button" disabled={!canUndo} onClick={undo} title="Undo">↶</button><button type="button" disabled={!canRedo} onClick={redo} title="Redo">↷</button></> : null}
      <button type="button" disabled={!activeProgram} onClick={toggleFlow}>{clock.playing ? 'Pause' : 'Play'}</button>
      <button type="button" disabled={!activeProgram} onClick={stepFlow}>Step</button>
      <label className="step-display-control"><span>Steps</span><select aria-label="Step labels" value={stepDisplayMode} disabled={!activeFlowId} onChange={(event) => onStepDisplayMode(event.target.value as StepDisplayMode)}><option value="all">All</option><option value="current">Current</option><option value="none">None</option></select></label>
      <div className="speed-control">{[0.5, 1, 2].map((speed) => <button type="button" key={speed} className={clock.speed === speed ? 'is-active' : ''} onClick={() => setFlowSpeed(speed)}>{speed}×</button>)}</div>
      {onToggleLeft ? <button type="button" className={`rail-toggle-button ${leftCollapsed ? 'is-collapsed' : ''}`} aria-label={leftCollapsed ? 'Show concepts rail' : 'Hide concepts rail'} aria-pressed={!leftCollapsed} title={leftCollapsed ? 'Show left rail [  —  ⌘[' : 'Hide left rail [  —  ⌘['} onClick={onToggleLeft}><span aria-hidden="true">{leftCollapsed ? '◧' : '◧'}</span></button> : null}
      {onToggleRight ? <button type="button" className={`rail-toggle-button ${rightCollapsed ? 'is-collapsed' : ''}`} aria-label={rightCollapsed ? 'Show detail rail' : 'Hide detail rail'} aria-pressed={!rightCollapsed} title={rightCollapsed ? 'Show detail rail ]  —  ⌘]' : 'Hide detail rail ]  —  ⌘]'} onClick={onToggleRight}><span aria-hidden="true">{rightCollapsed ? '◨' : '◨'}</span></button> : null}
      <button type="button" onClick={toggleTheme} title="Toggle theme">◐</button>
      <button type="button" className="fullscreen-button" onClick={onFullscreen} title={fullscreenError ?? (fullscreen ? 'Exit fullscreen' : 'Enter fullscreen')}>{fullscreen ? 'Exit full' : 'Fullscreen'}</button>
      {onExport ? <button type="button" className="export-button" onClick={onExport}>Export</button> : null}
    </div>
  </header>
}
