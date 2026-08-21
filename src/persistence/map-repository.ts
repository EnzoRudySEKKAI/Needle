import { makeId } from '../domain/id'
import { migrateDocument } from '../domain/migration'
import { SCHEMA_VERSION, type OntologyDocument } from '../domain/types'

export { migrateDocument } from '../domain/migration'

const PREFIX = 'needle:map:'
const INDEX_KEY = 'needle:map-index'
export type MapSummary = Pick<OntologyDocument, 'id' | 'name' | 'description' | 'updatedAt'>

function readIndex(): MapSummary[] {
  try {
    const value = JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]') as unknown
    return Array.isArray(value) ? value as MapSummary[] : []
  } catch {
    return []
  }
}

type MapUpdatedEvent = { type: 'map-updated'; document: OntologyDocument; revision: number; clientId: string | null }
type MapDeletedEvent = { type: 'map-deleted'; id: string; revision: number; clientId: string | null }
type SyncEvent = MapUpdatedEvent | MapDeletedEvent

function clientId(): string {
  const existing = sessionStorage.getItem('needle:client-id')
  if (existing) return existing
  const id = makeId('client')
  sessionStorage.setItem('needle:client-id', id)
  return id
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(body?.error ?? `Request failed (${response.status}).`)
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

export function listMaps(): Promise<MapSummary[]> {
  return request('/api/maps')
}

export async function loadMap(id: string): Promise<OntologyDocument | null> {
  const response = await fetch(`/api/maps/${encodeURIComponent(id)}`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Unable to load the map (${response.status}).`)
  return migrateDocument(await response.json() as unknown)
}

export async function saveMap(document: OntologyDocument): Promise<OntologyDocument> {
  const result = await request<{ document: OntologyDocument }>(`/api/maps/${encodeURIComponent(document.id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-needle-client-id': clientId() },
    body: JSON.stringify(document),
  })
  return result.document
}

export function deleteMap(id: string): Promise<void> {
  return request(`/api/maps/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'x-needle-client-id': clientId() } })
}

export function listLegacyMaps(): MapSummary[] {
  return [...readIndex()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function loadLegacyMap(id: string): OntologyDocument | null {
  try {
    return migrateDocument(JSON.parse(localStorage.getItem(`${PREFIX}${id}`) ?? 'null') as unknown)
  } catch {
    return null
  }
}

export async function publishLegacyMaps(): Promise<number> {
  const documents = listLegacyMaps().map((summary) => loadLegacyMap(summary.id)).filter((document): document is OntologyDocument => document !== null)
  await Promise.all(documents.map((document) => saveMap(document)))
  return documents.length
}

export async function createBlankMap(name = 'Untitled ontology'): Promise<OntologyDocument> {
  const id = makeId('map')
  const now = new Date().toISOString()
  const document: OntologyDocument = {
    schemaVersion: SCHEMA_VERSION,
    id,
    name,
    version: 'v0.1',
    description: 'Describe what this ontology helps people understand.',
    structureType: 'tower',
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

export function subscribeToMap(id: string, onUpdate: (document: OntologyDocument, source: 'snapshot' | 'live') => void, onReady: () => void, onError: (message: string) => void): () => void {
  let active = true
  let reconnectTimer = 0
  let readyTimer = 0
  let liveVersion = 0
  let socket: WebSocket | null = null
  const connect = () => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    socket = new WebSocket(`${protocol}//${location.host}/sync`)
    socket.addEventListener('open', () => {
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
      if (event.clientId === clientId()) return
      if (event.type === 'map-updated' && event.document.id === id) { liveVersion += 1; onUpdate(event.document, 'live') }
      if (event.type === 'map-deleted' && event.id === id) window.location.assign('/')
    })
    socket.addEventListener('close', () => { if (active) reconnectTimer = window.setTimeout(connect, 1200) })
    socket.addEventListener('error', () => { if (active) onError('Live synchronization is temporarily unavailable.') })
  }
  connect()
  return () => {
    active = false
    window.clearTimeout(reconnectTimer)
    window.clearTimeout(readyTimer)
    if (socket?.readyState === WebSocket.OPEN) socket.close()
    else if (socket?.readyState === WebSocket.CONNECTING) socket.addEventListener('open', () => socket?.close(), { once: true })
  }
}
