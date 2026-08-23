import { McpServer, createMcpHandler } from '@modelcontextprotocol/server'
import * as z from 'zod'
import { store } from '../store.js'
import { cloneSample } from '../../src/domain/sample.js'
import { EXAMPLE_MAPS } from '../../src/domain/examples.js'
import { validateDocument } from '../../src/domain/validation.js'
import { migrateDocument } from '../../src/domain/migration.js'
import { makeId, codeFromName } from '../../src/domain/id.js'
import { nextFreePosition, visualiseNodes } from '../../src/map/core/layout.js'
import { footprintsOverlap } from '../../src/map/core/iso.js'
import { buildScene } from '../../src/map/core/scene.js'
import { addFloor, deleteFloorCascade, moveFloorContents, setFloorFlagPosition, deleteGroupCascade, deleteNodeCascade, deleteRelationsCascade, addFlowTraversal, moveFlowStage } from '../../src/domain/commands.js'
import { SCHEMA_VERSION, type Archetype, type BuildingSize, type OntologyDocument, type GridPoint } from '../../src/domain/types.js'

await store.initialize()

const DISTRICT_GAP = 3

function findFreePositionWithDistrictGap(
  doc: OntologyDocument,
  floorId: string,
  groupId: string,
  size: 'xs' | 's' | 'm' | 'l' | 'xl',
  archetype: Archetype | undefined,
  propCount: number,
  explicitPos?: GridPoint,
): { position: GridPoint; corrected: boolean } {
  const floor = doc.floors.find(f => f.id === floorId)
  if (!floor) return { position: explicitPos ?? { gx: 0, gy: 0 }, corrected: false }
  const nodesOnFloor = doc.nodes.filter(n => n.floorId === floorId)
  // If explicit position provided, check it first
  if (explicitPos) {
    const candidateNode: OntologyDocument['nodes'][number] = {
      id: 'candidate',
      code: 'CA',
      name: 'candidate',
      groupId,
      floorId,
      size,
      position: explicitPos,
      whatItDoes: '',
      howItsBuilt: '',
      faceTexture: 'auto',
      properties: Array.from({ length: propCount }, (_, i) => ({ id: `p-${i}`, key: 'k', value: 'v' })),
      ...(archetype ? { archetypeOverride: archetype } : {}),
    }
    const testNodes = [...nodesOnFloor, candidateNode]
    const testVisuals = visualiseNodes(testNodes)
    const testGroups = doc.groups
    // check node overlap
    const candidateVisual = testVisuals.find(v => v.id === 'candidate')!
    const nodeOverlap = testVisuals.some(v => v.id !== 'candidate' && footprintsOverlap(candidateVisual.footprint, v.footprint, 0.8))
    if (!nodeOverlap) {
      // check district overlap
      const scene = buildScene(testGroups, testVisuals, 'check', new Map(), floor.groupFlagPositions)
      const candDistrict = scene.districts.find(d => d.id === groupId)
      if (candDistrict) {
        const otherDistricts = scene.districts.filter(d => d.id !== groupId)
        const districtOverlap = otherDistricts.some(d => footprintsOverlap(candDistrict.rect, d.rect, DISTRICT_GAP))
        if (!districtOverlap) return { position: explicitPos, corrected: false }
      } else if (!nodeOverlap) {
        return { position: explicitPos, corrected: false }
      }
    }
    // explicit position would overlap -> fall through to auto search and mark corrected
  }

  // Auto search: try grid around group's existing members, otherwise rightmost + gap
  const visuals = visualiseNodes(nodesOnFloor)
  const members = visuals.filter(v => v.groupId === groupId)
  const baseX = members.length ? Math.min(...members.map(v => v.footprint.gx)) : undefined
  const baseY = members.length ? Math.min(...members.map(v => v.footprint.gy)) : undefined
  const candidates: GridPoint[] = []
  if (members.length === 0) {
    const rightmost = visuals.reduce((max, v) => Math.max(max, v.footprint.gx + v.footprint.w), -8)
    for (let row = 0; row < 10; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        candidates.push({ gx: rightmost + 8 + col * 5, gy: row * 5 })
      }
    }
  } else {
    for (let row = 0; row < 12; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        candidates.push({ gx: baseX! + col * 5, gy: baseY! + row * 5 })
      }
    }
  }
  // also try far fallback
  candidates.push({ gx: (baseX ?? 0) + 52, gy: (baseY ?? 0) })

  for (const cand of candidates) {
    const candidateNode: OntologyDocument['nodes'][number] = {
      id: 'candidate',
      code: 'CA',
      name: 'candidate',
      groupId,
      floorId,
      size,
      position: cand,
      whatItDoes: '',
      howItsBuilt: '',
      faceTexture: 'auto',
      properties: Array.from({ length: propCount }, (_, i) => ({ id: `p-${i}`, key: 'k', value: 'v' })),
      ...(archetype ? { archetypeOverride: archetype } : {}),
    }
    const testNodes = [...nodesOnFloor, candidateNode]
    const testVisuals = visualiseNodes(testNodes)
    const candidateVisual = testVisuals.find(v => v.id === 'candidate')!
    if (testVisuals.some(v => v.id !== 'candidate' && footprintsOverlap(candidateVisual.footprint, v.footprint, 0.8))) continue
    const scene = buildScene(doc.groups, testVisuals, 'check', new Map(), floor.groupFlagPositions)
    const candDistrict = scene.districts.find(d => d.id === groupId)
    if (!candDistrict) continue
    const otherDistricts = scene.districts.filter(d => d.id !== groupId)
    if (otherDistricts.some(d => footprintsOverlap(candDistrict.rect, d.rect, DISTRICT_GAP))) continue
    return { position: cand, corrected: !!explicitPos }
  }
  // fallback to original nextFreePosition
  const fallback = nextFreePosition(nodesOnFloor, groupId)
  return { position: fallback, corrected: !!explicitPos }
}

function notFound(id: string) {
  return {
    content: [{ type: 'text' as const, text: `Map ${id} not found` }],
    isError: true,
  }
}

function badRequest(message: string) {
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true,
  }
}

function okJson(data: unknown, summary?: string) {
  const text = summary ? `${summary}\n${JSON.stringify(data, null, 2)}` : JSON.stringify(data, null, 2)
  return {
    content: [{ type: 'text' as const, text }],
    structuredContent: data as Record<string, unknown>,
  }
}

export const handler = createMcpHandler(() => {
  const server = new McpServer({ name: 'needle-maps', version: '0.1.0' })

  // ---- MAPS ----
  server.registerTool('list_maps', {
    title: 'List maps',
    description: 'List all ontology maps (summaries). Use before get_map.',
    inputSchema: z.object({
      limit: z.number().int().min(1).max(100).optional().describe('Max results, default 20'),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ limit }) => {
    const maps = await store.list()
    const sliced = limit ? maps.slice(0, limit) : maps
    return okJson({ maps: sliced, total: maps.length })
  })

  server.registerTool('get_map', {
    title: 'Get map',
    description: 'Get a full ontology document by ID',
    inputSchema: z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]+$/).describe('Map ID') }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ id }) => {
    const doc = await store.read(id)
    if (!doc) return notFound(id)
    return okJson(doc)
  })

  server.registerTool('create_map', {
    title: 'Create map',
    description: 'Create a new blank map. Optionally clone from a template (signal-garden, atlas-tower, harbor-campus, aurora-liner, northwind-commerce).',
    inputSchema: z.object({
      id: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional().describe('Desired ID, auto-generated if omitted'),
      name: z.string().min(1).optional().describe('Map name, default Untitled ontology'),
      description: z.string().optional().describe('Purpose of the map'),
      structureType: z.enum(['tower','campus','cruise-ship']).optional().describe('Structure type, default tower'),
      template: z.enum(['blank','signal-garden','atlas-tower','harbor-campus','aurora-liner','northwind-commerce']).optional().describe('Template to clone, default blank'),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ id, name, description, structureType, template }) => {
    const newId = id ?? makeId('map')
    if (await store.read(newId)) return badRequest(`Map ${newId} already exists`)
    let doc: OntologyDocument
    if (template && template !== 'blank') {
      const source = template === 'signal-garden' ? cloneSample(newId) : (EXAMPLE_MAPS.find(m => m.id === template) as OntologyDocument | undefined)
      if (!source) return badRequest(`Template ${template} not found`)
      doc = structuredClone(source as OntologyDocument)
      doc.id = newId
      if (name) doc.name = name
      if (description) doc.description = description
      if (structureType) doc.structureType = structureType
      doc.createdAt = new Date().toISOString()
      doc.updatedAt = doc.createdAt
    } else {
      const now = new Date().toISOString()
      doc = {
        schemaVersion: SCHEMA_VERSION,
        id: newId,
        name: name ?? 'Untitled ontology',
        version: 'v0.1',
        description: description ?? 'Describe what this ontology helps people understand.',
        structureType: structureType ?? 'tower',
        createdAt: now,
        updatedAt: now,
        floors: [{ id: 'floor-1', name: 'Floor 1', groupFlagPositions: {} }],
        groups: [{ id: 'first-neighborhood', name: 'First neighborhood', description: 'A place for related concepts.' }],
        nodes: [],
        relations: [],
        flows: [],
      }
    }
    const saved = await store.save(doc)
    return okJson(saved, `Created map ${saved.id}`)
  })

  server.registerTool('delete_map', {
    title: 'Delete map',
    description: 'Delete a map by ID (permanent)',
    inputSchema: z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]+$/).describe('Map ID') }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, async ({ id }) => {
    const existing = await store.read(id)
    if (!existing) return notFound(id)
    const ok = await store.delete(id)
    if (!ok) return badRequest(`Failed to delete ${id}`)
    return okJson({ id, deleted: true }, `Deleted map ${id}`)
  })

  server.registerTool('clone_map', {
    title: 'Clone map',
    description: 'Clone an existing map to a new ID',
    inputSchema: z.object({
      sourceId: z.string().describe('Source map ID'),
      newId: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional().describe('New ID, auto-generated if omitted'),
      newName: z.string().optional().describe('New name'),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ sourceId, newId, newName }) => {
    const source = await store.read(sourceId)
    if (!source) return notFound(sourceId)
    const id = newId ?? makeId('map')
    if (await store.read(id)) return badRequest(`Map ${id} already exists`)
    const clone = structuredClone(source)
    clone.id = id
    if (newName) clone.name = newName
    clone.createdAt = new Date().toISOString()
    clone.updatedAt = clone.createdAt
    const saved = await store.save(clone)
    return okJson(saved, `Cloned ${sourceId} → ${id}`)
  })

  server.registerTool('validate_map', {
    title: 'Validate map',
    description: 'Validate an ontology document without saving. Returns diagnostics.',
    inputSchema: z.object({
      document: z.record(z.string(), z.any()).describe('Full OntologyDocument JSON'),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ document }) => {
    const migrated = migrateDocument(document)
    if (!migrated) return badRequest(`Document is not a valid OntologyDocument (schemaVersion must be ${SCHEMA_VERSION}, check structureType/floors/nodes)`)
    const diagnostics = validateDocument(migrated)
    return okJson({ valid: diagnostics.filter(d=>d.level==='error').length===0, diagnostics, document: migrated })
  })

  server.registerTool('upsert_map', {
    title: 'Upsert map',
    description: 'Replace a map with a full document (PUT semantics, idempotent). Validates before saving.',
    inputSchema: z.object({
      id: z.string().regex(/^[a-zA-Z0-9_-]+$/).describe('Map ID (must match document.id)'),
      document: z.record(z.string(), z.any()).describe('Full OntologyDocument'),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ id, document }) => {
    const toSave = { ...(document as Record<string, unknown>), id } as OntologyDocument
    const migrated = migrateDocument(toSave)
    if (!migrated) return badRequest('Invalid document')
    const diagnostics = validateDocument(migrated).filter(d=>d.level==='error')
    if (diagnostics.length) return badRequest(`Validation errors: ${diagnostics.map(d=>d.message).join('; ')}`)
    const saved = await store.save(migrated)
    return okJson(saved)
  })

  // ---- FLOORS ----
  server.registerTool('add_floor', {
    title: 'Add floor',
    description: 'Add a floor after a given floor (or at end if afterFloorId is null)',
    inputSchema: z.object({
      mapId: z.string().describe('Map ID'),
      afterFloorId: z.string().nullable().optional().describe('Insert after this floor ID, null for end'),
      name: z.string().min(1).optional().describe('Floor name, default New floor'),
      floorId: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional().describe('Custom floor ID'),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ mapId, afterFloorId, name, floorId }) => {
    const doc = await store.read(mapId)
    if (!doc) return notFound(mapId)
    const id = floorId ?? makeId('floor')
    if (doc.floors.some(f=>f.id===id)) return badRequest(`Floor ${id} already exists`)
    const result = addFloor(doc, afterFloorId ?? null, id)
    if (name) result.document.floors = result.document.floors.map(f=> f.id===id ? {...f, name} : f)
    const saved = await store.save(result.document)
    return okJson({ floorId: id, document: saved })
  })

  server.registerTool('rename_floor', {
    title: 'Rename floor',
    description: 'Rename a floor',
    inputSchema: z.object({ mapId: z.string(), floorId: z.string(), name: z.string().min(1) }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ mapId, floorId, name }) => {
    const doc = await store.read(mapId)
    if (!doc) return notFound(mapId)
    if (!doc.floors.some(f=>f.id===floorId)) return badRequest(`Floor ${floorId} not found`)
    const next = { ...doc, floors: doc.floors.map(f=> f.id===floorId ? {...f, name} : f)}
    const saved = await store.save(next)
    return okJson(saved)
  })

  server.registerTool('reorder_floors', {
    title: 'Reorder floors',
    description: 'Set explicit floor order by array of IDs',
    inputSchema: z.object({ mapId: z.string(), orderedIds: z.array(z.string()).min(1).describe('Floor IDs in desired order') }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ mapId, orderedIds }) => {
    const doc = await store.read(mapId)
    if (!doc) return notFound(mapId)
    if (orderedIds.length !== doc.floors.length || new Set(orderedIds).size !== orderedIds.length) return badRequest('orderedIds must contain exactly all floor IDs once')
    if (!orderedIds.every(id=> doc.floors.some(f=>f.id===id))) return badRequest('Unknown floor ID in orderedIds')
    const next = { ...doc, floors: orderedIds.map(id=> doc.floors.find(f=>f.id===id)!) }
    const saved = await store.save(next)
    return okJson(saved)
  })

  server.registerTool('delete_floor', {
    title: 'Delete floor',
    description: 'Delete a floor. cascade deletes its nodes/relations/flows; move merges nodes into target floor.',
    inputSchema: z.object({
      mapId: z.string(),
      floorId: z.string(),
      mode: z.enum(['cascade','move']).optional().describe('cascade or move, default cascade'),
      targetFloorId: z.string().optional().describe('Required if mode=move'),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, async ({ mapId, floorId, mode, targetFloorId }) => {
    const doc = await store.read(mapId)
    if (!doc) return notFound(mapId)
    let next: OntologyDocument
    if (mode === 'move') {
      if (!targetFloorId) return badRequest('targetFloorId required for move')
      next = moveFloorContents(doc, floorId, targetFloorId)
    } else {
      next = deleteFloorCascade(doc, floorId)
    }
    const saved = await store.save(next)
    return okJson(saved)
  })

  server.registerTool('set_flag_position', {
    title: 'Set flag position',
    description: 'Set per-floor group flag position (neighborhood pin)',
    inputSchema: z.object({ mapId: z.string(), floorId: z.string(), groupId: z.string(), gx: z.number(), gy: z.number() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ mapId, floorId, groupId, gx, gy }) => {
    const doc = await store.read(mapId)
    if (!doc) return notFound(mapId)
    const next = setFloorFlagPosition(doc, floorId, groupId, { gx, gy })
    const saved = await store.save(next)
    return okJson(saved)
  })

  // ---- GROUPS ----
  server.registerTool('add_group', {
    title: 'Add neighborhood',
    description: 'Add a neighborhood (group)',
    inputSchema: z.object({ mapId: z.string(), name: z.string().min(1), description: z.string().optional(), groupId: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ mapId, name, description, groupId }) => {
    const doc = await store.read(mapId)
    if (!doc) return notFound(mapId)
    const id = groupId ?? makeId('group')
    if (doc.groups.some(g=>g.id===id)) return badRequest(`Group ${id} exists`)
    const next = { ...doc, groups: [...doc.groups, { id, name, description: description ?? '' }] }
    const saved = await store.save(next)
    return okJson({ groupId: id, document: saved })
  })

  server.registerTool('update_group', {
    title: 'Update neighborhood',
    description: 'Patch a neighborhood name/description',
    inputSchema: z.object({ mapId: z.string(), groupId: z.string(), name: z.string().optional(), description: z.string().optional() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ mapId, groupId, name, description }) => {
    const doc = await store.read(mapId)
    if (!doc) return notFound(mapId)
    const next = { ...doc, groups: doc.groups.map(g=> g.id===groupId ? {...g, ...(name!==undefined?{name}:{}), ...(description!==undefined?{description}:{})} : g) }
    const saved = await store.save(next)
    return okJson(saved)
  })

  server.registerTool('delete_group', {
    title: 'Delete neighborhood',
    description: 'Delete a neighborhood and cascade its nodes/relations/flows',
    inputSchema: z.object({ mapId: z.string(), groupId: z.string() }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, async ({ mapId, groupId }) => {
    const doc = await store.read(mapId)
    if (!doc) return notFound(mapId)
    const next = deleteGroupCascade(doc, groupId)
    const saved = await store.save(next)
    return okJson(saved)
  })

  // ---- NODES ----
  server.registerTool('add_node', {
    title: 'Add concept',
    description: 'Add a concept (node) to a floor/neighborhood. Position auto-assigned if omitted. Guarantees gap 3 between neighborhoods and 0.8 between nodes; explicit positions are auto-corrected to the nearest free spot if they would cause overlap.',
    inputSchema: z.object({
      mapId: z.string(),
      name: z.string().min(1).describe('Concept name'),
      groupId: z.string().describe('Neighborhood ID'),
      floorId: z.string().describe('Floor ID'),
      size: z.enum(['xs','s','m','l','xl']).optional().describe('Size, default m'),
      position: z.object({ gx: z.number(), gy: z.number() }).optional().describe('Position, auto if omitted. If it would cause district overlap (gap <3) it will be auto-corrected.'),
      whatItDoes: z.string().optional(),
      howItsBuilt: z.string().optional(),
      code: z.string().max(3).optional().describe('Roof code 1-3 chars, auto from name if omitted'),
      archetype: z.enum(['cube','tower','low-slab','slab-stack','fin-row','podium-tower','twin-towers','courtyard','bridge','stepped-pyramid','server-rack','monitor','database']).optional(),
      faceTexture: z.enum(['auto','plain','hatched']).optional().describe('default auto'),
      properties: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ mapId, name, groupId, floorId, size, position, whatItDoes, howItsBuilt, code, archetype, faceTexture, properties }) => {
    const doc = await store.read(mapId)
    if (!doc) return notFound(mapId)
    if (!doc.floors.some(f=>f.id===floorId)) return badRequest(`Floor ${floorId} not found`)
    if (!doc.groups.some(g=>g.id===groupId)) return badRequest(`Group ${groupId} not found`)
    const id = makeId('node')
    const usedCodes = new Set(doc.nodes.map(n=>n.code))
    const finalCode = code ? code.toUpperCase().slice(0,3) : codeFromName(name, usedCodes)
    const propCount = properties?.length ?? 0
    const requestedSize: BuildingSize = size ?? 'm'
    const { position: pos, corrected } = findFreePositionWithDistrictGap(doc, floorId, groupId, requestedSize, archetype, propCount, position)
    const node: OntologyDocument['nodes'][number] = {
      id, code: finalCode, name, groupId, floorId,
      size: requestedSize,
      position: pos,
      whatItDoes: whatItDoes ?? 'Explain what this concept changes or makes possible.',
      howItsBuilt: howItsBuilt ?? 'Explain the decision that shapes it.',
      archetypeOverride: archetype,
      faceTexture: faceTexture ?? 'auto' as const,
      properties: (properties ?? []).map(p=> ({ id: makeId('property'), key: p.key, value: p.value })),
    }
    const next = { ...doc, nodes: [...doc.nodes, node] }
    const diag = validateDocument(next).filter(d=>d.level==='error')
    if (diag.length) return badRequest(`Validation: ${diag.map(d=>d.message).join('; ')}`)
    const saved = await store.save(next)
    if (corrected && position) {
      return okJson({ nodeId: id, node, document: saved, warning: `Position auto-corrected to ${pos.gx},${pos.gy} to keep gap 3 between neighborhoods` }, `Position corrected to keep gap 3 between neighborhoods`)
    }
    return okJson({ nodeId: id, node, document: saved })
  })

  server.registerTool('update_node', {
    title: 'Update concept',
    description: 'Patch a concept. Any field can be patched; position/group/floor/size/archetype supported.',
    inputSchema: z.object({
      mapId: z.string(),
      nodeId: z.string(),
      patch: z.object({
        name: z.string().optional(),
        code: z.string().optional(),
        groupId: z.string().optional(),
        floorId: z.string().optional(),
        size: z.enum(['xs','s','m','l','xl']).optional(),
        position: z.object({ gx: z.number(), gy: z.number() }).optional(),
        whatItDoes: z.string().optional(),
        howItsBuilt: z.string().optional(),
        archetype: z.enum(['cube','tower','low-slab','slab-stack','fin-row','podium-tower','twin-towers','courtyard','bridge','stepped-pyramid','server-rack','monitor','database']).nullable().optional().describe('null to clear override'),
        faceTexture: z.enum(['auto','plain','hatched']).optional(),
        properties: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
      }).describe('Fields to patch'),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ mapId, nodeId, patch }) => {
    const doc = await store.read(mapId)
    if (!doc) return notFound(mapId)
    if (!doc.nodes.some(n=>n.id===nodeId)) return badRequest(`Node ${nodeId} not found`)
    if (patch.groupId && !doc.groups.some(g=>g.id===patch.groupId)) return badRequest(`Group ${patch.groupId} not found`)
    if (patch.floorId && !doc.floors.some(f=>f.id===patch.floorId)) return badRequest(`Floor ${patch.floorId} not found`)
    let next = {
      ...doc,
      nodes: doc.nodes.map(n=> n.id!==nodeId ? n : {
        ...n,
        ...(patch.name!==undefined?{name: patch.name}:{}),
        ...(patch.code!==undefined?{code: patch.code.toUpperCase().slice(0,3)}:{}),
        ...(patch.groupId!==undefined?{groupId: patch.groupId}:{}),
        ...(patch.floorId!==undefined?{floorId: patch.floorId}:{}),
        ...(patch.size!==undefined?{size: patch.size}:{}),
        ...(patch.position!==undefined?{position: patch.position}:{}),
        ...(patch.whatItDoes!==undefined?{whatItDoes: patch.whatItDoes}:{}),
        ...(patch.howItsBuilt!==undefined?{howItsBuilt: patch.howItsBuilt}:{}),
        ...(patch.faceTexture!==undefined?{faceTexture: patch.faceTexture}:{}),
        ...(patch.properties!==undefined?{properties: patch.properties.map((property) => ({ id: makeId('property'), key: property.key, value: property.value }))}:{}),
        ...(patch.archetype!==undefined?{archetypeOverride: patch.archetype ?? undefined}:{}),
      }),
    }
    // If position/group/floor/size/archetype changed, ensure gap 3 between districts
    const needsCheck = patch.position !== undefined || patch.groupId !== undefined || patch.floorId !== undefined || patch.size !== undefined || patch.archetype !== undefined || patch.properties !== undefined
    if (needsCheck) {
      const updated = next.nodes.find(n=> n.id===nodeId)!
      const floorId = updated.floorId
      const floor = next.floors.find(f=> f.id===floorId)!
      const nodesOnFloor = next.nodes.filter(n=> n.floorId===floorId)
      const visuals = visualiseNodes(nodesOnFloor)
      const updatedVisual = visuals.find(v=> v.id===nodeId)!
      // check node overlap
      const nodeOverlap = visuals.some(v=> v.id!==nodeId && footprintsOverlap(updatedVisual.footprint, v.footprint, 0.8))
      // check district overlap
      const scene = buildScene(next.groups, visuals, 'check', new Map(), floor.groupFlagPositions)
      const updDistrict = scene.districts.find(d=> d.id===updated.groupId)
      const districtOverlap = updDistrict ? scene.districts.some(d=> d.id!==updated.groupId && footprintsOverlap(updDistrict.rect, d.rect, DISTRICT_GAP)) : false
      if (nodeOverlap || districtOverlap) {
        const propCount = updated.properties.length
        const { position: correctedPos } = findFreePositionWithDistrictGap(next, floorId, updated.groupId, updated.size, updated.archetypeOverride, propCount)
        next = { ...next, nodes: next.nodes.map(n=> n.id===nodeId ? { ...n, position: correctedPos } : n) }
        const saved = await store.save(next)
        return okJson(saved, `Position auto-corrected to ${correctedPos.gx},${correctedPos.gy} to keep gap 3 between neighborhoods`)
      }
    }
    const saved = await store.save(next)
    return okJson(saved)
  })

  server.registerTool('delete_node', {
    title: 'Delete concept',
    description: 'Delete a concept and cascade its relations/flows',
    inputSchema: z.object({ mapId: z.string(), nodeId: z.string() }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, async ({ mapId, nodeId }) => {
    const doc = await store.read(mapId)
    if (!doc) return notFound(mapId)
    const next = deleteNodeCascade(doc, nodeId)
    const saved = await store.save(next)
    return okJson(saved)
  })

  // ---- RELATIONS ----
  server.registerTool('add_relation', {
    title: 'Add relation',
    description: 'Add a relation between two concepts',
    inputSchema: z.object({
      mapId: z.string(),
      from: z.string().describe('Source node ID'),
      to: z.string().describe('Target node ID'),
      kind: z.enum(['full','dotted']).optional().describe('default full'),
      label: z.string().min(1).describe('Relation label'),
      relationId: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional().describe('Custom ID'),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ mapId, from, to, kind, label, relationId }) => {
    const doc = await store.read(mapId)
    if (!doc) return notFound(mapId)
    if (!doc.nodes.some(n=>n.id===from)) return badRequest(`from node ${from} not found`)
    if (!doc.nodes.some(n=>n.id===to)) return badRequest(`to node ${to} not found`)
    const id = relationId ?? makeId('relation')
    if (doc.relations.some(r=>r.id===id)) return badRequest(`Relation ${id} exists`)
    const next = { ...doc, relations: [...doc.relations, { id, from, to, kind: kind ?? 'full', label }] }
    const saved = await store.save(next)
    return okJson({ relationId: id, document: saved })
  })

  server.registerTool('update_relation', {
    title: 'Update relation',
    description: 'Patch a relation',
    inputSchema: z.object({
      mapId: z.string(),
      relationId: z.string(),
      patch: z.object({
        from: z.string().optional(),
        to: z.string().optional(),
        kind: z.enum(['full','dotted']).optional(),
        label: z.string().optional(),
      }),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ mapId, relationId, patch }) => {
    const doc = await store.read(mapId)
    if (!doc) return notFound(mapId)
    if (patch.from && !doc.nodes.some(n=>n.id===patch.from)) return badRequest(`from ${patch.from} not found`)
    if (patch.to && !doc.nodes.some(n=>n.id===patch.to)) return badRequest(`to ${patch.to} not found`)
    const next = { ...doc, relations: doc.relations.map(r=> r.id===relationId ? {...r, ...patch} : r)}
    const saved = await store.save(next)
    return okJson(saved)
  })

  server.registerTool('delete_relation', {
    title: 'Delete relation',
    description: 'Delete a relation and prune its flow traversals (empty stages removed)',
    inputSchema: z.object({ mapId: z.string(), relationId: z.string() }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, async ({ mapId, relationId }) => {
    const doc = await store.read(mapId)
    if (!doc) return notFound(mapId)
    const next = deleteRelationsCascade(doc, new Set([relationId]))
    const saved = await store.save(next)
    return okJson(saved)
  })

  // ---- FLOWS ----
  server.registerTool('add_flow', {
    title: 'Add scenario',
    description: 'Add a scenario (flow)',
    inputSchema: z.object({
      mapId: z.string(),
      name: z.string().min(1),
      payload: z.string().optional().describe('Payload name, default payload'),
      summary: z.string().optional(),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ mapId, name, payload, summary }) => {
    const doc = await store.read(mapId)
    if (!doc) return notFound(mapId)
    const id = makeId('flow')
    const next = { ...doc, flows: [...doc.flows, { id, name, payload: payload ?? 'payload', summary: summary ?? '', stages: [] }] }
    const saved = await store.save(next)
    return okJson({ flowId: id, document: saved })
  })

  server.registerTool('update_flow', {
    title: 'Update scenario',
    description: 'Patch a scenario meta',
    inputSchema: z.object({ mapId: z.string(), flowId: z.string(), patch: z.object({ name: z.string().optional(), payload: z.string().optional(), summary: z.string().optional() }) }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ mapId, flowId, patch }) => {
    const doc = await store.read(mapId)
    if (!doc) return notFound(mapId)
    const next = { ...doc, flows: doc.flows.map(f=> f.id===flowId ? {...f, ...patch} : f)}
    const saved = await store.save(next)
    return okJson(saved)
  })

  server.registerTool('delete_flow', {
    title: 'Delete scenario',
    description: 'Delete a scenario',
    inputSchema: z.object({ mapId: z.string(), flowId: z.string() }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, async ({ mapId, flowId }) => {
    const doc = await store.read(mapId)
    if (!doc) return notFound(mapId)
    const next = { ...doc, flows: doc.flows.filter(f=> f.id!==flowId) }
    const saved = await store.save(next)
    return okJson(saved)
  })

  server.registerTool('add_flow_stage', {
    title: 'Add flow stage',
    description: 'Add a stage with one or more traversals to a flow. If stageId is null a new stage is appended.',
    inputSchema: z.object({
      mapId: z.string(),
      flowId: z.string(),
      stageId: z.string().nullable().optional().describe('Existing stage to add traversal to, null to append new stage'),
      relationId: z.string().describe('Relation ID for the traversal'),
      direction: z.enum(['forward','reverse']).optional().describe('default forward'),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ mapId, flowId, stageId, relationId, direction }) => {
    const doc = await store.read(mapId)
    if (!doc) return notFound(mapId)
    const next = addFlowTraversal(doc, flowId, stageId ?? null, relationId, (direction ?? 'forward') as 'forward' | 'reverse')
    const saved = await store.save(next)
    return okJson(saved)
  })

  server.registerTool('move_flow_stage', {
    title: 'Move flow stage',
    description: 'Reorder a stage within a flow',
    inputSchema: z.object({ mapId: z.string(), flowId: z.string(), stageId: z.string(), beforeStageId: z.string().nullable().optional().describe('Insert before this ID, null for end') }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ mapId, flowId, stageId, beforeStageId }) => {
    const doc = await store.read(mapId)
    if (!doc) return notFound(mapId)
    const next = moveFlowStage(doc, flowId, stageId, beforeStageId ?? null)
    const saved = await store.save(next)
    return okJson(saved)
  })

  server.registerTool('get_templates', {
    title: 'Get templates',
    description: 'List available map templates',
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => {
    return okJson({ templates: ['blank','signal-garden','atlas-tower','harbor-campus','aurora-liner','northwind-commerce'] })
  })

  return server
}, { responseMode: 'json' })
