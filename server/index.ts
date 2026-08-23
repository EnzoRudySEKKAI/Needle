import { createServer } from 'node:http'
import { resolve } from 'node:path'
import express, { type NextFunction, type Request, type Response } from 'express'
import { WebSocket, WebSocketServer } from 'ws'
import { createServer as createViteServer, type ViteDevServer } from 'vite'
import { isOntologyDocument, validateDocument } from '../src/domain/validation'
import type { MapPresence, OntologyDocument, Selection } from '../src/domain/types'
import { store } from './store.js'
import { handler as mcpHandler } from './mcp/handler.js'
import { toNodeHandler } from '@modelcontextprotocol/node'

type SyncMessage =
  | { type: 'map-updated'; document: OntologyDocument; revision: number; clientId: string | null }
  | { type: 'map-deleted'; id: string; revision: number; clientId: string | null }
  | { type: 'presence'; presence: MapPresence }
  | { type: 'presence-removed'; mapId: string; clientId: string }

type SocketState = { mapId: string | null; clientId: string | null }

const production = process.env.NODE_ENV === 'production'
const port = Number(process.env.PORT ?? (production ? 4173 : 5173))
const app = express()
const server = createServer(app)
const sockets = new WebSocketServer({ noServer: true })
let revision = Date.now()
let vite: ViteDevServer | null = null
const socketState = new Map<WebSocket, SocketState>()
const presenceByMap = new Map<string, Map<string, MapPresence>>()

await store.initialize()
app.disable('x-powered-by')
app.use('/api', express.json({ limit: '2mb' }))
app.use('/mcp', express.json({ limit: '2mb' }))
const mcpNodeHandler = toNodeHandler(mcpHandler)
app.all('/mcp', (req, res) => mcpNodeHandler(req, res, req.body))

const broadcast = (message: SyncMessage) => {
  const payload = JSON.stringify(message)
  sockets.clients.forEach((client) => { if (client.readyState === WebSocket.OPEN) client.send(payload) })
}

const broadcastToMap = (mapId: string, message: SyncMessage) => {
  const payload = JSON.stringify(message)
  sockets.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && socketState.get(client)?.mapId === mapId) client.send(payload)
  })
}

const isSelection = (value: unknown): value is Selection => {
  if (!value || typeof value !== 'object') return false
  const selection = value as Record<string, unknown>
  return typeof selection.id === 'string' && ['floor', 'node', 'relation', 'group', 'flow'].includes(String(selection.kind))
}

app.get('/api/maps', async (_request, response) => response.json(await store.list()))
app.get('/api/maps/:id', async (request, response) => {
  const document = await store.read(request.params.id)
  if (!document) return response.status(404).json({ error: 'Map not found.' })
  response.json(document)
})
app.put('/api/maps/:id', async (request, response) => {
  if (!isOntologyDocument(request.body) || request.body.id !== request.params.id) return response.status(400).json({ error: 'Invalid ontology document.', diagnostics: [{ level: 'error', message: 'Document does not match Needle schema v9.' }] })
  const diagnostics = validateDocument(request.body)
  if (diagnostics.some((diagnostic) => diagnostic.level === 'error')) return response.status(400).json({ error: 'Ontology document has validation errors.', diagnostics })
  const current = await store.read(request.params.id)
  const baseUpdatedAt = request.get('x-needle-base-updated-at')
  if (baseUpdatedAt && current && baseUpdatedAt !== current.updatedAt) return response.status(409).json({ error: 'Map has changed since it was loaded.', latest: current })
  const document = await store.save({ ...request.body, updatedAt: new Date().toISOString() })
  const message: SyncMessage = { type: 'map-updated', document, revision: ++revision, clientId: request.get('x-needle-client-id') ?? null }
  broadcast(message)
  response.json({ document, revision: message.revision })
})
app.get('/api/maps/:id/history', async (request, response) => {
  if (!await store.read(request.params.id)) return response.status(404).json({ error: 'Map not found.' })
  response.json(await store.listHistory(request.params.id))
})
app.get('/api/maps/:id/history/:snapshot', async (request, response) => {
  const document = await store.readHistory(request.params.id, request.params.snapshot)
  if (!document) return response.status(404).json({ error: 'Snapshot not found.' })
  response.json(document)
})
app.post('/api/maps/:id/history/:snapshot/restore', async (request, response) => {
  const document = await store.restoreHistory(request.params.id, request.params.snapshot)
  if (!document) return response.status(404).json({ error: 'Snapshot not found.' })
  const message: SyncMessage = { type: 'map-updated', document, revision: ++revision, clientId: request.get('x-needle-client-id') ?? null }
  broadcast(message)
  response.json({ document, revision: message.revision })
})
app.delete('/api/maps/:id', async (request, response) => {
  if (!await store.delete(request.params.id)) return response.status(404).json({ error: 'Map not found.' })
  const message: SyncMessage = { type: 'map-deleted', id: request.params.id, revision: ++revision, clientId: request.get('x-needle-client-id') ?? null }
  broadcast(message)
  response.status(204).end()
})
app.get('/api/trash', async (_request, response) => response.json(await store.listTrash()))
app.post('/api/trash/:id/restore', async (request, response) => {
  if (await store.read(request.params.id)) return response.status(409).json({ error: 'A map with this id already exists.' })
  const document = await store.restoreTrash(request.params.id)
  if (!document) return response.status(404).json({ error: 'Trashed map not found.' })
  const message: SyncMessage = { type: 'map-updated', document, revision: ++revision, clientId: request.get('x-needle-client-id') ?? null }
  broadcast(message)
  response.json({ document, revision: message.revision })
})
app.delete('/api/trash/:id', async (request, response) => {
  if (!await store.permanentlyDelete(request.params.id)) return response.status(404).json({ error: 'Trashed map not found.' })
  response.status(204).end()
})

if (production) {
  const dist = resolve('dist')
  app.use(express.static(dist))
  app.use((_request, response) => response.sendFile(resolve(dist, 'index.html')))
} else {
  vite = await createViteServer({
    appType: 'spa',
    server: { middlewareMode: { server } },
  })
  app.use(vite.middlewares)
}

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  void _next
  console.error(error)
  response.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error.' })
})

server.on('upgrade', (request, socket, head) => {
  if (new URL(request.url ?? '/', 'http://needle.local').pathname !== '/sync') return
  sockets.handleUpgrade(request, socket, head, (client) => sockets.emit('connection', client, request))
})
sockets.on('connection', (socket) => {
  socketState.set(socket, { mapId: null, clientId: null })
  socket.send(JSON.stringify({ type: 'ready', revision }))
  socket.on('message', (payload) => {
    let message: Record<string, unknown>
    try { message = JSON.parse(String(payload)) as Record<string, unknown> } catch { return }
    const state = socketState.get(socket)
    if (!state) return
    if (message.type === 'subscribe' && typeof message.mapId === 'string') {
      state.mapId = message.mapId
      if (typeof message.clientId === 'string') state.clientId = message.clientId
      for (const presence of presenceByMap.get(message.mapId)?.values() ?? []) socket.send(JSON.stringify({ type: 'presence', presence }))
      return
    }
    if (message.type !== 'presence' || typeof message.mapId !== 'string' || typeof message.clientId !== 'string' || (message.selection !== null && !isSelection(message.selection)) || (message.activeFloorId !== null && typeof message.activeFloorId !== 'string') || (message.activeFlowId !== null && typeof message.activeFlowId !== 'string') || typeof message.presenter !== 'boolean' || typeof message.displayName !== 'string') return
    state.mapId = message.mapId
    state.clientId = message.clientId
    const presence: MapPresence = {
      mapId: message.mapId,
      clientId: message.clientId,
      selection: message.selection,
      activeFloorId: message.activeFloorId,
      activeFlowId: message.activeFlowId,
      presenter: message.presenter,
      displayName: message.displayName,
    }
    const mapPresence = presenceByMap.get(presence.mapId) ?? new Map<string, MapPresence>()
    mapPresence.set(presence.clientId, presence)
    presenceByMap.set(presence.mapId, mapPresence)
    broadcastToMap(presence.mapId, { type: 'presence', presence })
  })
  socket.on('close', () => {
    const state = socketState.get(socket)
    socketState.delete(socket)
    if (!state?.mapId || !state.clientId) return
    const mapPresence = presenceByMap.get(state.mapId)
    if (!mapPresence?.delete(state.clientId)) return
    if (mapPresence?.size === 0) presenceByMap.delete(state.mapId)
    broadcastToMap(state.mapId, { type: 'presence-removed', mapId: state.mapId, clientId: state.clientId })
  })
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Needle shared workspace: http://localhost:${port}`)
})

const shutdown = async () => {
  sockets.close()
  await vite?.close()
  server.close(() => process.exit(0))
}
process.once('SIGINT', () => { void shutdown() })
process.once('SIGTERM', () => { void shutdown() })
