import type { RelationKind } from '../domain/types'

export type ConnectionDirection = 'outbound' | 'inbound'

export type ConnectionTarget = {
  nodeId: string
  direction: ConnectionDirection
}

export type ConnectionDraft = {
  sourceId: string
  targets: ConnectionTarget[]
  label: string
  kind: RelationKind
  flowId: string | null
}
