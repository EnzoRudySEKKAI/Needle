export const SCHEMA_VERSION = 9 as const
export const STRUCTURE_TYPES = ['tower', 'campus', 'cruise-ship'] as const

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
  | 'server-rack'
  | 'monitor'
  | 'camera'
  | 'database'
export type FaceTexture = 'auto' | 'plain' | 'hatched'
export type RelationKind = 'full' | 'dotted'
export type BuildingSize = 'xs' | 's' | 'm' | 'l' | 'xl'
export type StructureType = typeof STRUCTURE_TYPES[number]

export type OntologyGroup = {
  id: string
  name: string
  description: string
}

export type OntologyFloor = {
  id: string
  name: string
  groupFlagPositions: Record<string, GridPoint>
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
  floorId: string
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
}

export type FlowDirection = 'forward' | 'reverse'

export type FlowTraversal = {
  id: string
  relationId: string
  direction: FlowDirection
}

export type FlowStage = {
  id: string
  name?: string
  note?: string
  traversals: FlowTraversal[]
}

export type OntologyFlow = {
  id: string
  name: string
  payload: string
  summary: string
  stages: FlowStage[]
}

export type Selection =
  | { kind: 'floor'; id: string }
  | { kind: 'node'; id: string }
  | { kind: 'relation'; id: string }
  | { kind: 'group'; id: string }
  | { kind: 'flow'; id: string }

export type MapPresence = {
  mapId: string
  clientId: string
  selection: Selection | null
  activeFloorId: string | null
  activeFlowId: string | null
  activeFlowStageId: string | null
  flowPlaying: boolean
  flowSpeed: number
  presenter: boolean
  displayName: string
}

export type OntologyDocument = {
  schemaVersion: typeof SCHEMA_VERSION
  id: string
  name: string
  version: string
  description: string
  structureType: StructureType
  createdAt: string
  updatedAt: string
  floors: OntologyFloor[]
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
