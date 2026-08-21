import { createServer } from 'node:http'
import { resolve } from 'node:path'
import express, { type NextFunction, type Request, type Response } from 'express'
import { WebSocket, WebSocketServer } from 'ws'
import { createServer as createViteServer, type ViteDevServer } from 'vite'
import { isOntologyDocument } from '../src/domain/validation'
import type { OntologyDocument } from '../src/domain/types'
import { MapStore } from './map-store'

type SyncMessage =
  | { type: 'map-updated'; document: OntologyDocument; revision: number; clientId: string | null }
  | { type: 'map-deleted'; id: string; revision: number; clientId: string | null }

const production = process.env.NODE_ENV === 'production'
const port = Number(process.env.PORT ?? (production ? 4173 : 5173))
const app = express()
const server = createServer(app)
const sockets = new WebSocketServer({ noServer: true })
const store = new MapStore()
let revision = Date.now()
let vite: ViteDevServer | null = null

await store.initialize()
app.disable('x-powered-by')
app.use('/api', express.json({ limit: '2mb' }))

const broadcast = (message: SyncMessage) => {
  const payload = JSON.stringify(message)
  sockets.clients.forEach((client) => { if (client.readyState === WebSocket.OPEN) client.send(payload) })
}

app.get('/api/maps', async (_request, response) => response.json(await store.list()))
app.get('/api/maps/:id', async (request, response) => {
  const document = await store.read(request.params.id)
  if (!document) return response.status(404).json({ error: 'Map not found.' })
  response.json(document)
})
app.put('/api/maps/:id', async (request, response) => {
  if (!isOntologyDocument(request.body) || request.body.id !== request.params.id) return response.status(400).json({ error: 'Invalid ontology document.' })
  const document = await store.save({ ...request.body, updatedAt: new Date().toISOString() })
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
sockets.on('connection', (socket) => socket.send(JSON.stringify({ type: 'ready', revision })))

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
