/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useEffectEvent, useReducer, type ReactNode } from 'react'
import type { OntologyDocument, Selection } from '../domain/types'
import { saveMap } from '../persistence/map-repository'

type History = { past: OntologyDocument[]; present: OntologyDocument; future: OntologyDocument[] }
type Action =
  | { type: 'commit'; document: OntologyDocument }
  | { type: 'undo' }
  | { type: 'redo' }

function historyReducer(state: History, action: Action): History {
  if (action.type === 'commit') return { past: [...state.past.slice(-39), state.present], present: action.document, future: [] }
  if (action.type === 'undo') {
    const previous = state.past[state.past.length - 1]
    return previous ? { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future] } : state
  }
  const next = state.future[0]
  return next ? { past: [...state.past, state.present], present: next, future: state.future.slice(1) } : state
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
}

const DocumentContext = createContext<DocumentContextValue | null>(null)

export function DocumentProvider({ initial, children }: { initial: OntologyDocument; children: ReactNode }) {
  const [history, dispatch] = useReducer(historyReducer, { past: [], present: initial, future: [] })
  const [selection, setSelection] = useReducer((_previous: Selection | null, next: Selection | null) => next, null)
  const persist = useEffectEvent((document: OntologyDocument) => saveMap(document))

  useEffect(() => {
    const timeout = window.setTimeout(() => persist(history.present), 250)
    return () => window.clearTimeout(timeout)
  }, [history.present])

  const commit = (transform: (document: OntologyDocument) => OntologyDocument) => {
    const next = transform(history.present)
    dispatch({ type: 'commit', document: { ...next, updatedAt: new Date().toISOString() } })
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
