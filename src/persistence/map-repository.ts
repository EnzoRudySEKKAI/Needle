import { makeId } from '../domain/id'
import { migrateDocument } from '../domain/migration'
import { SCHEMA_VERSION, type MapPresence, type OntologyDocument, type StructureType } from '../domain/types'
import type { Diagnostic } from '../domain/validation'

export { migrateDocument } from '../domain/migration'

export type MapSummary = Pick<OntologyDocument, 'id' | 'name' | 'description' | 'updatedAt' | 'structureType'> & { floorCount: number }
export type HistorySummary = Pick<OntologyDocument, 'name' | 'updatedAt'> & { snapshot: string }
export type TrashSummary = MapSummary & { deletedAt: string }
export type TemplateId = 'signal-garden' | 'atlas-tower' | 'harbor-campus' | 'aurora-liner' | 'northwind-commerce'
export type SaveMapResult = { status: 'saved'; document: OntologyDocument } | { status: 'conflict'; latest: OntologyDocument }
export type PresenceState = Omit<MapPresence, 'mapId' | 'clientId'>
export type MapSubscription = (() => void) & { sendPresence: (presence: PresenceState) => void }

export class MapValidationError extends Error {
  constructor(message: string, readonly diagnostics: Diagnostic[]) {
    super(message)
    this.name = 'MapValidationError'
  }
}

type MapUpdatedEvent = { type: 'map-updated'; document: OntologyDocument; revision: number; clientId: string | null }
type MapDeletedEvent = { type: 'map-deleted'; id: string; revision: number; clientId: string | null }
type PresenceEvent = { type: 'presence'; presence: MapPresence }
type PresenceRemovedEvent = { type: 'presence-removed'; mapId: string; clientId: string }
type SyncEvent = MapUpdatedEvent | MapDeletedEvent | PresenceEvent | PresenceRemovedEvent

function clientId(): string {
  const existing = sessionStorage.getItem('needle:client-id')
  if (existing) return existing
  const id = makeId('client')
  sessionStorage.setItem('needle:client-id', id)
  return id
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  const json = response.headers.get('content-type')?.includes('application/json')
  if (!response.ok) {
    const body = json ? await response.json().catch(() => null) as { error?: string } | null : null
    throw new Error(body?.error ?? `Request failed (${response.status}).`)
  }
  if (response.status === 204) return undefined as T
  if (!json) throw new Error('The Needle server is out of date. Restart it to enable this API.')
  return response.json() as Promise<T>
}

export function listMaps(): Promise<MapSummary[]> {
  return request('/api/maps')
}

export async function loadMap(id: string): Promise<OntologyDocument | null> {
  const response = await fetch(`/api/maps/${encodeURIComponent(id)}`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Unable to load the map (${response.status}).`)
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The Needle server is out of date. Restart it to load maps.')
  return migrateDocument(await response.json() as unknown)
}

export async function saveMap(document: OntologyDocument): Promise<OntologyDocument> {
  const result = await saveMapWithConflict(document)
  if (result.status === 'conflict') throw new MapConflictError(result.latest)
  return result.document
}

export class MapConflictError extends Error {
  constructor(readonly latest: OntologyDocument) {
    super('Map has changed since it was loaded.')
    this.name = 'MapConflictError'
  }
}

export async function saveMapWithConflict(document: OntologyDocument, baseUpdatedAt?: string): Promise<SaveMapResult> {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-needle-client-id': clientId() }
  if (baseUpdatedAt) headers['x-needle-base-updated-at'] = baseUpdatedAt
  const response = await fetch(`/api/maps/${encodeURIComponent(document.id)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(document),
  })
  const json = response.headers.get('content-type')?.includes('application/json')
  if (response.status === 409) {
    if (!json) throw new Error('The Needle server is out of date. Restart it before saving.')
    const body = await response.json() as { latest: OntologyDocument }
    return { status: 'conflict', latest: body.latest }
  }
  if (!response.ok) {
    const body = json ? await response.json().catch(() => null) as { error?: string; diagnostics?: Diagnostic[] } | null : null
    if (response.status === 400) throw new MapValidationError(body?.error ?? 'Invalid ontology document.', body?.diagnostics ?? [])
    throw new Error(body?.error ?? `Request failed (${response.status}).`)
  }
  if (!json) throw new Error('The Needle server is out of date. Restart it before saving.')
  const body = await response.json() as { document: OntologyDocument }
  return { status: 'saved', document: body.document }
}

export function deleteMap(id: string): Promise<void> {
  return request(`/api/maps/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'x-needle-client-id': clientId() } })
}

export async function cloneMap(sourceId: string, name?: string): Promise<OntologyDocument> {
  const source = await loadMap(sourceId)
  if (!source) throw new Error('Map not found.')
  const now = new Date().toISOString()
  return saveMap({ ...structuredClone(source), id: makeId('map'), name: name ?? `${source.name} copy`, createdAt: now, updatedAt: now })
}

export function createMapFromTemplate(template: TemplateId, name?: string): Promise<OntologyDocument> {
  return cloneMap(template, name)
}

export function listMapHistory(id: string): Promise<HistorySummary[]> {
  return request(`/api/maps/${encodeURIComponent(id)}/history`)
}

export async function loadMapSnapshot(id: string, snapshot: string): Promise<OntologyDocument> {
  const document = await request<unknown>(`/api/maps/${encodeURIComponent(id)}/history/${encodeURIComponent(snapshot)}`)
  const migrated = migrateDocument(document)
  if (!migrated) throw new Error('Snapshot is not a valid ontology document.')
  return migrated
}

export async function restoreMapSnapshot(id: string, snapshot: string): Promise<OntologyDocument> {
  const result = await request<{ document: OntologyDocument }>(`/api/maps/${encodeURIComponent(id)}/history/${encodeURIComponent(snapshot)}/restore`, { method: 'POST', headers: { 'x-needle-client-id': clientId() } })
  return result.document
}

export function listTrash(): Promise<TrashSummary[]> {
  return request('/api/trash')
}

export async function restoreTrashedMap(id: string): Promise<OntologyDocument> {
  const result = await request<{ document: OntologyDocument }>(`/api/trash/${encodeURIComponent(id)}/restore`, { method: 'POST', headers: { 'x-needle-client-id': clientId() } })
  return result.document
}

export function permanentlyDeleteTrashedMap(id: string): Promise<void> {
  return request(`/api/trash/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function createBlankMap(name = 'Untitled ontology', structureType: StructureType = 'tower'): Promise<OntologyDocument> {
  const id = makeId('map')
  const now = new Date().toISOString()
  const document: OntologyDocument = {
    schemaVersion: SCHEMA_VERSION,
    id,
    name,
    version: 'v0.1',
    description: 'Describe what this ontology helps people understand.',
    structureType,
    createdAt: now,
    updatedAt: now,
    floors: [{ id: 'floor-1', name: 'Floor 1', groupFlagPositions: {} }],
    groups: [{ id: 'first-neighborhood', name: 'First neighborhood', description: 'A place for related concepts.' }],
    nodes: [],
    relations: [],
    flows: [],
  }
  return saveMap(document)
}

export function subscribeToLibrary(onChange: () => void, onError: (message: string) => void): () => void {
  let active = true
  let reconnectTimer = 0
  let socket: WebSocket | null = null
  const connect = () => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    socket = new WebSocket(`${protocol}//${location.host}/sync`)
    socket.addEventListener('message', (message) => {
      if (!active) return
      try {
        const event = JSON.parse(String(message.data)) as { type?: string }
        if (event.type === 'map-updated' || event.type === 'map-deleted') onChange()
      } catch { /* Ignore non-Needle messages. */ }
    })
    socket.addEventListener('close', () => { if (active) reconnectTimer = window.setTimeout(connect, 1200) })
    socket.addEventListener('error', () => { if (active) onError('Live library updates are temporarily unavailable.') })
  }
  connect()
  return () => {
    active = false
    window.clearTimeout(reconnectTimer)
    if (socket?.readyState === WebSocket.OPEN) socket.close()
    else if (socket?.readyState === WebSocket.CONNECTING) socket.addEventListener('open', () => socket?.close(), { once: true })
  }
}

export function subscribeToMap(id: string, onUpdate: (document: OntologyDocument, source: 'snapshot' | 'live') => void, onReady: () => void, onError: (message: string) => void, presenceHandlers?: { onPresence: (presence: MapPresence) => void; onPresenceRemoved: (clientId: string) => void }): MapSubscription {
  let active = true
  let reconnectTimer = 0
  let readyTimer = 0
  let liveVersion = 0
  let socket: WebSocket | null = null
  let latestPresence: PresenceState | null = null
  const sendPresence = (presence: PresenceState) => {
    latestPresence = presence
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'presence', mapId: id, clientId: clientId(), ...presence }))
  }
  const connect = () => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    socket = new WebSocket(`${protocol}//${location.host}/sync`)
    socket.addEventListener('open', () => {
      socket?.send(JSON.stringify({ type: 'subscribe', mapId: id, clientId: clientId() }))
      if (latestPresence) sendPresence(latestPresence)
      const versionAtOpen = liveVersion
      if (active) void loadMap(id).then((document) => {
        if (!active) return
        if (document && liveVersion === versionAtOpen) onUpdate(document, 'snapshot')
        readyTimer = window.setTimeout(() => { if (active && socket?.readyState === WebSocket.OPEN) onReady() }, 100)
      }).catch((error: unknown) => onError(error instanceof Error ? error.message : 'Unable to resynchronize.'))
    })
    socket.addEventListener('message', (message) => {
      if (!active) return
      let event: SyncEvent
      try { event = JSON.parse(String(message.data)) as SyncEvent } catch { return }
      if (event.type === 'presence') {
        if (event.presence.mapId === id && event.presence.clientId !== clientId()) presenceHandlers?.onPresence(event.presence)
        return
      }
      if (event.type === 'presence-removed') {
        if (event.mapId === id && event.clientId !== clientId()) presenceHandlers?.onPresenceRemoved(event.clientId)
        return
      }
      if (event.clientId === clientId()) return
      if (event.type === 'map-updated' && event.document.id === id) { liveVersion += 1; onUpdate(event.document, 'live') }
      if (event.type === 'map-deleted' && event.id === id) window.location.assign('/')
    })
    socket.addEventListener('close', () => { if (active) reconnectTimer = window.setTimeout(connect, 1200) })
    socket.addEventListener('error', () => { if (active) onError('Live synchronization is temporarily unavailable.') })
  }
  connect()
  const unsubscribe = () => {
    active = false
    window.clearTimeout(reconnectTimer)
    window.clearTimeout(readyTimer)
    if (socket?.readyState === WebSocket.OPEN) socket.close()
    else if (socket?.readyState === WebSocket.CONNECTING) socket.addEventListener('open', () => socket?.close(), { once: true })
  }
  return Object.assign(unsubscribe, { sendPresence })
}
