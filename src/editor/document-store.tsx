/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useEffectEvent, useReducer, useRef, useState, type ReactNode } from 'react'
import type { MapPresence, OntologyDocument, Selection } from '../domain/types'
import { saveMapWithConflict, subscribeToMap, type PresenceState } from '../persistence/map-repository'

type History = { past: OntologyDocument[]; present: OntologyDocument; future: OntologyDocument[]; source: 'clean' | 'local' | 'remote' }
type Action =
  | { type: 'commit'; document: OntologyDocument }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'replace'; document: OntologyDocument }
  | { type: 'restore'; document: OntologyDocument }
  | { type: 'saved'; updatedAt: string }

function historyReducer(state: History, action: Action): History {
  if (action.type === 'commit') return { past: [...state.past.slice(-39), state.present], present: action.document, future: [], source: 'local' }
  if (action.type === 'replace') return { past: [], present: action.document, future: [], source: 'remote' }
  if (action.type === 'restore') return { past: [...state.past.slice(-39), state.present], present: action.document, future: [], source: 'local' }
  if (action.type === 'saved') return state.source === 'local' && state.present.updatedAt === action.updatedAt ? { ...state, source: 'clean' } : state
  if (action.type === 'undo') {
    const previous = state.past[state.past.length - 1]
    return previous ? { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future], source: 'local' } : state
  }
  const next = state.future[0]
  return next ? { past: [...state.past, state.present], present: next, future: state.future.slice(1), source: 'local' } : state
}

type DocumentContextValue = {
  document: OntologyDocument
  selection: Selection | null
  setSelection: (selection: Selection | null) => void
  commit: (transform: (document: OntologyDocument) => OntologyDocument) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  persistenceError: string | null
  syncReady: boolean
  presences: MapPresence[]
  sendPresence: (presence: PresenceState) => void
  conflict: OntologyDocument | null
  resolveConflict: (resolution: 'remote' | 'local') => void
  restoreDocument: (document: OntologyDocument) => void
}

const DocumentContext = createContext<DocumentContextValue | null>(null)

export function DocumentProvider({ initial, children }: { initial: OntologyDocument; children: ReactNode }) {
  const [history, dispatch] = useReducer(historyReducer, { past: [], present: initial, future: [], source: 'clean' })
  const [selection, setSelection] = useReducer((_previous: Selection | null, next: Selection | null) => next, null)
  const [persistenceError, setPersistenceError] = useReducer((_previous: string | null, next: string | null) => next, null)
  const [syncReady, setSyncReady] = useReducer(() => true, false)
  const [presences, setPresences] = useState<MapPresence[]>([])
  const [conflict, setConflict] = useState<OntologyDocument | null>(null)
  const subscriptionRef = useRef<ReturnType<typeof subscribeToMap> | null>(null)
  const serverUpdatedAt = useRef(initial.updatedAt)
  const persist = useEffectEvent(async (document: OntologyDocument) => {
    try {
      const result = await saveMapWithConflict(document, serverUpdatedAt.current)
      if (result.status === 'conflict') { setConflict(result.latest); return }
      serverUpdatedAt.current = result.document.updatedAt
      dispatch({ type: 'saved', updatedAt: document.updatedAt })
      setConflict(null)
      setPersistenceError(null)
    }
    catch (error) { setPersistenceError(error instanceof Error ? error.message : 'Unable to save the shared map.') }
  })
  const replaceRemote = useEffectEvent((document: OntologyDocument, source: 'snapshot' | 'live') => {
    if (source === 'snapshot' && history.source === 'local') return
    if (source === 'live' && history.source === 'local') { setConflict(document); return }
    serverUpdatedAt.current = document.updatedAt
    dispatch({ type: 'replace', document })
  })

  useEffect(() => {
    if (history.source !== 'local') return
    const timeout = window.setTimeout(() => persist(history.present), 250)
    return () => window.clearTimeout(timeout)
  }, [history.present, history.source])

  useEffect(() => {
    const subscription = subscribeToMap(initial.id, replaceRemote, setSyncReady, setPersistenceError, {
      onPresence: (presence) => setPresences((current) => [...current.filter((item) => item.clientId !== presence.clientId), presence]),
      onPresenceRemoved: (clientId) => setPresences((current) => current.filter((item) => item.clientId !== clientId)),
    })
    subscriptionRef.current = subscription
    return () => { subscriptionRef.current = null; subscription() }
  }, [initial.id])

  const commit = (transform: (document: OntologyDocument) => OntologyDocument) => {
    const next = transform(history.present)
    dispatch({ type: 'commit', document: { ...next, updatedAt: new Date().toISOString() } })
  }
  const resolveConflict = (resolution: 'remote' | 'local') => {
    if (!conflict) return
    if (resolution === 'remote') {
      serverUpdatedAt.current = conflict.updatedAt
      dispatch({ type: 'replace', document: conflict })
    } else {
      serverUpdatedAt.current = conflict.updatedAt
      dispatch({ type: 'commit', document: { ...history.present, updatedAt: new Date().toISOString() } })
    }
    setConflict(null)
  }

  return (
    <DocumentContext value={{
      document: history.present,
      selection,
      setSelection,
      commit,
      undo: () => dispatch({ type: 'undo' }),
      redo: () => dispatch({ type: 'redo' }),
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      persistenceError,
      syncReady,
      presences,
      sendPresence: (presence) => subscriptionRef.current?.sendPresence(presence),
      conflict,
      resolveConflict,
      restoreDocument: (document) => {
        serverUpdatedAt.current = document.updatedAt
        dispatch({ type: 'restore', document: { ...document, updatedAt: new Date().toISOString() } })
      },
    }}>
      {children}
    </DocumentContext>
  )
}

export function useDocumentStore(): DocumentContextValue {
  const value = useContext(DocumentContext)
  if (!value) throw new Error('useDocumentStore must be used inside DocumentProvider')
  return value
}
