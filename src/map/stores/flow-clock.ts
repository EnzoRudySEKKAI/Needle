import { useSyncExternalStore } from 'react'
import { activeStageState, type FlowProgram } from '../core/program'

type ClockState = { program: FlowProgram | null; time: number; playing: boolean; started: boolean; speed: number; waiting: boolean; ended: boolean; loop: boolean }
export type ClockPresenceState = { programId: string | null; stageId: string | null; playing: boolean; speed: number; time: number; epoch: number }
let state: ClockState = { program: null, time: 0, playing: false, started: false, speed: 1, waiting: false, ended: false, loop: false }
const emptyPresenceState: ClockPresenceState = { programId: null, stageId: null, playing: false, speed: 1, time: 0, epoch: 0 }
let presenceState = emptyPresenceState
let frameId: number | null = null
let lastFrame = 0
const listeners = new Set<() => void>()

function notify() {
  const active = state.program && state.started ? activeStageState(state.program, state.time) : null
  const identity = { programId: state.program?.id ?? null, stageId: active && state.program ? state.program.stages[active.index]?.id ?? null : null, playing: state.playing, speed: state.speed }
  if (identity.programId !== presenceState.programId || identity.stageId !== presenceState.stageId || identity.playing !== presenceState.playing || identity.speed !== presenceState.speed) presenceState = { ...identity, time: state.time, epoch: Date.now() }
  for (const listener of listeners) listener()
}

function frame(now: number) {
  if (!state.program) return
  const nextTime = state.time + Math.min(now - lastFrame, 100) * state.speed
  const active = activeStageState(state.program, state.time)
  const stage = state.program.stages[active.index]!
  if (stage.advance === 'continue' && nextTime >= stage.end && active.index < state.program.stages.length - 1) {
    state = { ...state, time: stage.end, playing: false, waiting: true }
    stop()
    notify()
    return
  }
  if (nextTime >= state.program.total) {
    if (state.loop) state = { ...state, time: 0, started: true }
    else {
      state = { ...state, time: state.program.total, playing: false, ended: true }
      stop()
      notify()
      return
    }
  } else state = { ...state, time: nextTime }
  lastFrame = now
  notify()
  frameId = requestAnimationFrame(frame)
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

export function configureFlow(program: FlowProgram | null, autoplay = true, loop = false) {
  stop()
  const playing = Boolean(program && autoplay && !matchMedia('(prefers-reduced-motion: reduce)').matches)
  state = { ...state, program, time: 0, playing, started: playing, waiting: false, ended: false, loop }
  if (state.playing) start()
  notify()
}

export function toggleFlow() {
  if (!state.program) return
  if (state.waiting) { continueFlow(); return }
  if (!state.playing && matchMedia('(prefers-reduced-motion: reduce)').matches) { stepFlow(); return }
  const restart = state.ended
  state = { ...state, time: restart ? 0 : state.time, playing: !state.playing || restart, started: true, waiting: false, ended: false }
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
  state = { ...state, time: next, playing: false, started: true, waiting: false, ended: false }
  notify()
}

export function seekFlowStage(programId: string, stageId: string) {
  const program = state.program
  if (!program || program.id !== programId) return
  const stage = program.stages.find((candidate) => candidate.id === stageId)
  if (!stage) return
  stop()
  state = { ...state, time: stage.start + 1, playing: false, started: true, waiting: false, ended: false }
  notify()
}

export function continueFlow() {
  const program = state.program
  if (!program || !state.waiting) return
  const active = activeStageState(program, state.time)
  const next = program.stages[active.index + 1]
  if (!next) return
  state = { ...state, time: next.start + 1, playing: !matchMedia('(prefers-reduced-motion: reduce)').matches, started: true, waiting: false, ended: false }
  if (state.playing) start()
  notify()
}

export function syncFlowPlayback(programId: string, stageId: string | null, playing: boolean, speed: number, position?: number, epoch?: number) {
  const program = state.program
  if (!program || program.id !== programId) return
  const stage = stageId ? program.stages.find((candidate) => candidate.id === stageId) : null
  const currentStageId = state.started ? program.stages[activeStageState(program, state.time).index]?.id ?? null : null
  const nextStarted = Boolean(stage)
  const nextPlaying = Boolean(stage && playing && !matchMedia('(prefers-reduced-motion: reduce)').matches)
  const compensatedPosition = position === undefined ? undefined : position + (playing && epoch ? Math.max(0, Date.now() - epoch) * speed : 0)
  const nextTime = stage ? Math.max(stage.start, Math.min(stage.end, compensatedPosition ?? (currentStageId !== stage.id ? stage.start + 1 : state.time))) : 0
  if (state.started === nextStarted && state.playing === nextPlaying && state.time === nextTime && state.speed === speed) return
  stop()
  state = { ...state, time: nextTime, playing: nextPlaying, started: nextStarted, speed, waiting: false, ended: false }
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
  return useSyncExternalStore(subscribe, () => state, () => ({ program: null, time: 0, playing: false, started: false, speed: 1, waiting: false, ended: false, loop: false }))
}

export function useClockPresenceState(): ClockPresenceState {
  return useSyncExternalStore(subscribe, () => presenceState, () => emptyPresenceState)
}

export function useClockActiveKey(): string {
  return useSyncExternalStore(subscribe, () => {
    if (!state.program || !state.started) return 'none'
    const active = activeStageState(state.program, state.time)
    return `${state.program.id}:${active.index}:${active.phase}`
  }, () => 'none')
}
