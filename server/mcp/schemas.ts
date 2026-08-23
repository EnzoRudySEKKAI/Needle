import * as z from 'zod'

export const MapId = z.string().regex(/^[a-zA-Z0-9_-]+$/).describe('Map ID (alphanumeric, dash, underscore)')

export const GridPoint = z.object({
  gx: z.number().describe('Grid X'),
  gy: z.number().describe('Grid Y'),
})

export const BuildingSize = z.enum(['xs', 's', 'm', 'l', 'xl'])
export const Archetype = z.enum([
  'cube','tower','low-slab','slab-stack','fin-row','podium-tower','twin-towers','courtyard','bridge','stepped-pyramid','server-rack','monitor','database',
])
export const FaceTexture = z.enum(['auto','plain','hatched'])
export const RelationKind = z.enum(['flow','data','support','retry'])
export const StructureType = z.enum(['tower','campus','cruise-ship'])
export const FlowDirection = z.enum(['forward','reverse'])
export const OntologyProperty = z.object({
  id: z.string(),
  key: z.string(),
  value: z.string(),
})

export const OntologyGroup = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
})

export const OntologyFloor = z.object({
  id: z.string(),
  name: z.string(),
  groupFlagPositions: z.record(z.string(), GridPoint),
})

export const OntologyNode = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  groupId: z.string(),
  floorId: z.string(),
  whatItDoes: z.string(),
  howItsBuilt: z.string(),
  size: BuildingSize,
  properties: z.array(OntologyProperty),
  position: GridPoint,
  archetypeOverride: Archetype.optional(),
  faceTexture: FaceTexture,
})

export const OntologyRelation = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  kind: RelationKind,
  label: z.string(),
})

export const FlowTraversal = z.object({
  id: z.string(),
  relationId: z.string(),
  direction: FlowDirection,
})

export const FlowStage = z.object({
  id: z.string(),
  name: z.string().optional(),
  note: z.string().optional(),
  traversals: z.array(FlowTraversal),
})

export const OntologyFlow = z.object({
  id: z.string(),
  name: z.string(),
  payload: z.string(),
  summary: z.string(),
  stages: z.array(FlowStage),
})

export const OntologyDocument = z.object({
  schemaVersion: z.literal(9),
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string(),
  structureType: StructureType,
  createdAt: z.string(),
  updatedAt: z.string(),
  floors: z.array(OntologyFloor).min(1),
  groups: z.array(OntologyGroup),
  nodes: z.array(OntologyNode),
  relations: z.array(OntologyRelation),
  flows: z.array(OntologyFlow),
})
