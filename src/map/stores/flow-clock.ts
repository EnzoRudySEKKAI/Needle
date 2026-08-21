import { useSyncExternalStore } from 'react'
import { activeStageState, type FlowProgram } from '../core/program'

type ClockState = { program: FlowProgram | null; time: number; playing: boolean; speed: number }
let state: ClockState = { program: null, time: 0, playing: false, speed: 1 }
let frameId: number | null = null
let lastFrame = 0
const listeners = new Set<() => void>()

function notify() {
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
  state = { ...state, program, time: 0, playing: Boolean(program && autoplay && !matchMedia('(prefers-reduced-motion: reduce)').matches) }
  if (state.playing) start()
  notify()
}

export function toggleFlow() {
  if (!state.program) return
  state = { ...state, playing: !state.playing }
  if (state.playing) start()
  else stop()
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
  const next = program.stages.find((stage) => stage.start > state.time + 80)?.start ?? 0
  state = { ...state, time: next, playing: false }
  notify()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useClockState() {
  return useSyncExternalStore(subscribe, () => state, () => ({ program: null, time: 0, playing: false, speed: 1 }))
}

export function useClockActiveKey(): string {
  return useSyncExternalStore(subscribe, () => {
    if (!state.program) return 'none'
    const active = activeStageState(state.program, state.time)
    return `${state.program.id}:${active.index}:${active.phase}`
  }, () => 'none')
}
