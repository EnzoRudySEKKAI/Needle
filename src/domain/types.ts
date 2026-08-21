export const SCHEMA_VERSION = 5 as const

export type GridPoint = { gx: number; gy: number }
export type Footprint = GridPoint & { w: number; d: number }
export type Archetype =
  | 'cube'
  | 'tower'
  | 'low-slab'
  | 'slab-stack'
  | 'fin-row'
  | 'podium-tower'
  | 'twin-towers'
  | 'courtyard'
  | 'bridge'
  | 'stepped-pyramid'
export type FaceTexture = 'auto' | 'plain' | 'hatched'
export type RelationKind = 'flow' | 'data' | 'support' | 'retry'
export type BuildingSize = 'xs' | 's' | 'm' | 'l' | 'xl'

export type OntologyGroup = {
  id: string
  name: string
  description: string
}

export type OntologyProperty = {
  id: string
  key: string
  value: string
}

export type OntologyNode = {
  id: string
  code: string
  name: string
  groupId: string
  whatItDoes: string
  howItsBuilt: string
  size: BuildingSize
  properties: OntologyProperty[]
  position: GridPoint
  archetypeOverride?: Archetype
  faceTexture: FaceTexture
}

export type OntologyRelation = {
  id: string
  from: string
  to: string
  kind: RelationKind
  label: string
  via?: GridPoint[]
}

export type FlowDirection = 'forward' | 'reverse'

export type FlowTraversal = {
  id: string
  relationId: string
  direction: FlowDirection
}

export type FlowStage = {
  id: string
  traversals: FlowTraversal[]
}

export type OntologyFlow = {
  id: string
  name: string
  payload: string
  summary: string
  stages: FlowStage[]
}

export type OntologyDocument = {
  schemaVersion: typeof SCHEMA_VERSION
  id: string
  name: string
  version: string
  description: string
  createdAt: string
  updatedAt: string
  groups: OntologyGroup[]
  nodes: OntologyNode[]
  relations: OntologyRelation[]
  flows: OntologyFlow[]
}

export type VisualNode = OntologyNode & {
  archetype: Archetype
  footprint: Footprint
  height: number
}

export type Selection =
  | { kind: 'node'; id: string }
  | { kind: 'relation'; id: string }
  | { kind: 'group'; id: string }
  | { kind: 'flow'; id: string }
