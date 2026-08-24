import { useSyncExternalStore } from 'react'
import { activeStageState, type FlowProgram } from '../core/program'

type ClockState = { program: FlowProgram | null; time: number; playing: boolean; started: boolean; speed: number }
export type ClockPresenceState = { programId: string | null; stageId: string | null; playing: boolean; speed: number }
let state: ClockState = { program: null, time: 0, playing: false, started: false, speed: 1 }
const emptyPresenceState: ClockPresenceState = { programId: null, stageId: null, playing: false, speed: 1 }
let presenceState = emptyPresenceState
let frameId: number | null = null
let lastFrame = 0
const listeners = new Set<() => void>()

function notify() {
  const active = state.program && state.started ? activeStageState(state.program, state.time) : null
  const nextPresence = { programId: state.program?.id ?? null, stageId: active && state.program ? state.program.stages[active.index]?.id ?? null : null, playing: state.playing, speed: state.speed }
  if (nextPresence.programId !== presenceState.programId || nextPresence.stageId !== presenceState.stageId || nextPresence.playing !== presenceState.playing || nextPresence.speed !== presenceState.speed) presenceState = nextPresence
  for (const listener of listeners) listener()
}

function frame(now: number) {
  frameId = requestAnimationFrame(frame)
  if (!state.program) return
  state = { ...state, time: (state.time + Math.min(now - lastFrame, 100) * state.speed) % state.program.total }
  lastFrame = now
  notify()
}

function start() {
  if (frameId !== null || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  lastFrame = performance.now()
  frameId = requestAnimationFrame(frame)
}

function stop() {
  if (frameId !== null) cancelAnimationFrame(frameId)
  frameId = null
}

export function configureFlow(program: FlowProgram | null, autoplay = true) {
  stop()
  const playing = Boolean(program && autoplay && !matchMedia('(prefers-reduced-motion: reduce)').matches)
  state = { ...state, program, time: 0, playing, started: playing }
  if (state.playing) start()
  notify()
}

export function toggleFlow() {
  if (!state.program) return
  state = { ...state, playing: !state.playing, started: true }
  if (state.playing) start()
  else stop()
  notify()
}

export function pauseFlow() {
  if (!state.playing) return
  stop()
  state = { ...state, playing: false }
  notify()
}

export function setFlowSpeed(speed: number) {
  state = { ...state, speed }
  notify()
}

export function stepFlow() {
  const program = state.program
  if (!program) return
  stop()
  const next = state.started ? program.stages.find((stage) => stage.start > state.time + 80)?.start ?? 0 : 0
  state = { ...state, time: next, playing: false, started: true }
  notify()
}

export function seekFlowStage(programId: string, stageId: string) {
  const program = state.program
  if (!program || program.id !== programId) return
  const stage = program.stages.find((candidate) => candidate.id === stageId)
  if (!stage) return
  stop()
  state = { ...state, time: stage.start + 1, playing: false, started: true }
  notify()
}

export function syncFlowPlayback(programId: string, stageId: string | null, playing: boolean, speed: number) {
  const program = state.program
  if (!program || program.id !== programId) return
  const stage = stageId ? program.stages.find((candidate) => candidate.id === stageId) : null
  const currentStageId = state.started ? program.stages[activeStageState(program, state.time).index]?.id ?? null : null
  const nextStarted = Boolean(stage)
  const nextPlaying = Boolean(stage && playing && !matchMedia('(prefers-reduced-motion: reduce)').matches)
  const nextTime = stage && currentStageId !== stage.id ? stage.start + 1 : stage ? state.time : 0
  if (state.started === nextStarted && state.playing === nextPlaying && state.time === nextTime && state.speed === speed) return
  stop()
  state = { ...state, time: nextTime, playing: nextPlaying, started: nextStarted, speed }
  if (nextPlaying) start()
  notify()
}

export function getClockState(): ClockState {
  return state
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useClockState() {
  return useSyncExternalStore(subscribe, () => state, () => ({ program: null, time: 0, playing: false, started: false, speed: 1 }))
}

export function useClockPresenceState(): ClockPresenceState {
  return useSyncExternalStore(subscribe, () => presenceState, () => emptyPresenceState)
}

export function useClockActiveKey(): string {
  return useSyncExternalStore(subscribe, () => {
    if (!state.program || !state.playing) return 'none'
    const active = activeStageState(state.program, state.time)
    return `${state.program.id}:${active.index}:${active.phase}`
  }, () => 'none')
}
