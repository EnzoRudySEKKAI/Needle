import * as z from 'zod'

export const MapId = z.string().regex(/^[a-zA-Z0-9_-]+$/).describe('Map ID (alphanumeric, dash, underscore)')

export const GridPoint = z.object({
  gx: z.number().describe('Grid X'),
  gy: z.number().describe('Grid Y'),
})

export const BuildingSize = z.enum(['xs', 's', 'm', 'l', 'xl'])
export const Archetype = z.enum([
  'cube','tower','low-slab','slab-stack','fin-row','podium-tower','twin-towers','courtyard','bridge','stepped-pyramid','server-rack','monitor','camera','database',
])
export const FaceTexture = z.enum(['auto','plain','hatched'])
export const RelationKind = z.enum(['full','dotted'])
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
  layout: z.enum(['auto', 'single', 'split']).optional(),
  advance: z.union([z.object({ kind: z.literal('auto'), afterMs: z.number().min(1200) }), z.object({ kind: z.literal('continue') })]).optional(),
  transition: z.object({ kind: z.enum(['cut', 'fade', 'travel']), durationMs: z.number().min(0) }).optional(),
  callouts: z.array(z.object({
    id: z.string(),
    anchor: z.union([z.object({ kind: z.literal('node'), nodeId: z.string() }), z.object({ kind: z.literal('point'), floorId: z.string(), gx: z.number(), gy: z.number() })]),
    text: z.string(),
    tone: z.enum(['information', 'attention', 'alert']),
    side: z.enum(['left', 'right']).optional(),
  })).optional(),
})

export const OntologyFlow = z.object({
  id: z.string(),
  name: z.string(),
  payload: z.string(),
  summary: z.string(),
  stages: z.array(FlowStage),
  endBehavior: z.enum(['stop', 'loop']).optional(),
  showGrid: z.boolean().optional(),
})

export const OntologyDocument = z.object({
  schemaVersion: z.literal(10),
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
