import { useEffect, useRef, type CSSProperties } from 'react'
import type { OntologyFlow } from '../domain/types'
import { activeStageState, type FlowProgram } from '../map/core/program'
import type { StepDisplayMode } from '../map/core/step-display'
import { seekFlowStage, setFlowSpeed, stepFlow, toggleFlow, useClockState } from '../map/stores/flow-clock'

function StepNavigator({ flow, program, started, time, onOpenStage }: { flow: OntologyFlow; program: FlowProgram | null; started: boolean; time: number; onOpenStage: (stageId: string) => void }) {
  const currentIndex = program && started ? activeStageState(program, time).index : -1
  const currentStageId = currentIndex >= 0 ? program?.stages[currentIndex]?.id ?? '' : ''
  const currentButton = useRef<HTMLButtonElement | null>(null)
  useEffect(() => { currentButton.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }) }, [currentStageId])
  if (flow.stages.length === 0) return <div className="step-navigator is-empty"><span>Steps</span><strong>No steps</strong></div>
  return <nav className="step-navigator" aria-label={`Steps in ${flow.name}`}>
    <span className="step-navigator-title">Steps</span>
    <ol className="step-navigator-track">{flow.stages.map((stage, index) => {
      const current = stage.id === currentStageId
      const label = stage.name || `Step ${index + 1}`
      return <li key={stage.id}><button ref={current ? currentButton : undefined} type="button" disabled={!program} aria-current={current ? 'step' : undefined} aria-label={`${label}, ${index + 1} of ${flow.stages.length}`} title={stage.note || label} onClick={() => { if (program) { seekFlowStage(program.id, stage.id); onOpenStage(stage.id) } }}>{String(index + 1).padStart(2, '0')}</button></li>
    })}</ol>
    <select className="step-navigator-select" aria-label={`Choose a step in ${flow.name}`} value={currentStageId} disabled={!program} onChange={(event) => { if (program && event.target.value) { seekFlowStage(program.id, event.target.value); onOpenStage(event.target.value) } }}>
      <option value="">Steps</option>
      {flow.stages.map((stage, index) => <option key={stage.id} value={stage.id}>{stage.name || `Step ${String(index + 1).padStart(2, '0')}`}</option>)}
    </select>
  </nav>
}

export function ScenarioControls({ flow, program, stepDisplayMode, onStepDisplayMode, onOpenStage }: { flow: OntologyFlow; program: FlowProgram | null; stepDisplayMode: StepDisplayMode; onStepDisplayMode: (mode: StepDisplayMode) => void; onOpenStage: (stageId: string) => void }) {
  const clock = useClockState()
  const activeProgram = clock.program?.id === flow.id ? program : null
  return <section className="scenario-controls" style={{ '--scenario-player-width': `${500 + flow.stages.length * 28}px` } as CSSProperties} aria-label={`Scenario controls for ${flow.name}`}>
    <div className="scenario-controls-title"><span>Scenario</span><strong>{flow.name}</strong></div>
    <button type="button" className="scenario-play" disabled={!activeProgram} onClick={toggleFlow}><svg viewBox="0 0 12 12" aria-hidden="true">{clock.playing ? <><rect x="2.2" y="1.5" width="2.5" height="9" rx=".7" /><rect x="7.3" y="1.5" width="2.5" height="9" rx=".7" /></> : <path d="M3 1.5 10 6 3 10.5Z" />}</svg>{clock.playing ? 'Pause' : 'Play'}</button>
    <button type="button" disabled={!activeProgram} onClick={stepFlow}>Step</button>
    <StepNavigator flow={flow} program={activeProgram} started={clock.started} time={clock.time} onOpenStage={onOpenStage} />
    <label className="step-display-control"><span>Labels</span><select aria-label="Step labels" value={stepDisplayMode} onChange={(event) => onStepDisplayMode(event.target.value as StepDisplayMode)}><option value="all">All</option><option value="current">Current</option><option value="none">None</option></select></label>
    <label className="scenario-speed-control"><span>Speed</span><input type="range" min="0.25" max="2" step="0.25" value={clock.speed} aria-label="Playback speed" onChange={(event) => setFlowSpeed(Number(event.target.value))} /><output>{clock.speed.toFixed(clock.speed % 1 === 0 ? 0 : 2).replace(/0$/, '')}x</output></label>
  </section>
}
