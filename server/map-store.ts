import { mkdir, readdir, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { cloneSample } from '../src/domain/sample'
import { EXAMPLE_MAPS } from '../src/domain/examples'
import { migrateDocument } from '../src/domain/migration'
import type { OntologyDocument } from '../src/domain/types'

const MAP_ID = /^[a-zA-Z0-9_-]+$/
const SNAPSHOT_ID = /^[a-zA-Z0-9_-]+$/
const MAX_SNAPSHOTS = 50

export type SharedMapSummary = Pick<OntologyDocument, 'id' | 'name' | 'description' | 'updatedAt' | 'structureType'> & { floorCount: number }
export type HistorySummary = Pick<OntologyDocument, 'name' | 'updatedAt'> & { snapshot: string }
export type TrashSummary = SharedMapSummary & { deletedAt: string }

export class MapStore {
  readonly #directory: string
  readonly #historyDirectory: string
  readonly #trashDirectory: string
  #writes: Promise<unknown> = Promise.resolve()

  constructor(directory = resolve('.needle-data/maps')) {
    this.#directory = directory
    this.#historyDirectory = resolve(directory, '..', 'history')
    this.#trashDirectory = resolve(directory, '..', 'trash')
  }

  async initialize(): Promise<void> {
    await Promise.all([
      mkdir(this.#directory, { recursive: true }),
      mkdir(this.#historyDirectory, { recursive: true }),
      mkdir(this.#trashDirectory, { recursive: true }),
    ])
    if ((await this.list()).length === 0) await this.save(cloneSample())
    for (const example of EXAMPLE_MAPS) {
      const existing = await this.read(example.id)
      if (!existing || existing.updatedAt < (example as OntologyDocument).updatedAt) await this.save(example as OntologyDocument)
    }
    const signalGarden = await this.read('signal-garden')
    if (signalGarden && signalGarden.nodes.some((node) => node.id === 'intake' && node.position.gy === 2)) {
      await this.save({ ...cloneSample('signal-garden'), updatedAt: new Date().toISOString() })
    }
  }

  async list(): Promise<SharedMapSummary[]> {
    await mkdir(this.#directory, { recursive: true })
    const entries = await readdir(this.#directory, { withFileTypes: true })
    const documents = await Promise.all(entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json')).map((entry) => this.read(entry.name.slice(0, -5))))
    return documents.filter((document): document is OntologyDocument => document !== null)
      .map(({ id, name, description, updatedAt, structureType, floors }) => ({ id, name, description, updatedAt, structureType, floorCount: floors.length }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async read(id: string): Promise<OntologyDocument | null> {
    if (!MAP_ID.test(id)) return null
    return this.#readPath(this.#path(id))
  }

  save(document: OntologyDocument): Promise<OntologyDocument> {
    return this.#serialize(() => this.#save(document))
  }

  delete(id: string): Promise<boolean> {
    if (!MAP_ID.test(id)) return Promise.resolve(false)
    return this.#serialize(async () => {
      await mkdir(this.#trashDirectory, { recursive: true })
      try {
        await rename(this.#path(id), this.#trashPath(id))
        return true
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
        throw error
      }
    })
  }

  async listHistory(id: string): Promise<HistorySummary[]> {
    if (!MAP_ID.test(id)) return []
    const directory = this.#historyPath(id)
    try {
      const entries = await readdir(directory, { withFileTypes: true })
      const summaries = await Promise.all(entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json')).map(async (entry) => {
        const snapshot = entry.name.slice(0, -5)
        const document = await this.#readPath(resolve(directory, entry.name))
        return document ? { snapshot, name: document.name, updatedAt: document.updatedAt } : null
      }))
      return summaries.filter((summary): summary is HistorySummary => summary !== null).sort((a, b) => b.snapshot.localeCompare(a.snapshot))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
  }

  readHistory(id: string, snapshot: string): Promise<OntologyDocument | null> {
    if (!MAP_ID.test(id) || !SNAPSHOT_ID.test(snapshot)) return Promise.resolve(null)
    return this.#readPath(resolve(this.#historyPath(id), `${snapshot}.json`))
  }

  restoreHistory(id: string, snapshot: string): Promise<OntologyDocument | null> {
    if (!MAP_ID.test(id) || !SNAPSHOT_ID.test(snapshot)) return Promise.resolve(null)
    return this.#serialize(async () => {
      const historical = await this.#readPath(resolve(this.#historyPath(id), `${snapshot}.json`))
      if (!historical) return null
      return this.#save({ ...historical, id, updatedAt: new Date().toISOString() })
    })
  }

  async listTrash(): Promise<TrashSummary[]> {
    await mkdir(this.#trashDirectory, { recursive: true })
    const entries = await readdir(this.#trashDirectory, { withFileTypes: true })
    const summaries = await Promise.all(entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json')).map(async (entry) => {
      const path = resolve(this.#trashDirectory, entry.name)
      const [document, metadata] = await Promise.all([this.#readPath(path), stat(path)])
      if (!document) return null
      const { id, name, description, updatedAt, structureType, floors } = document
      return { id, name, description, updatedAt, structureType, floorCount: floors.length, deletedAt: metadata.mtime.toISOString() }
    }))
    return summaries.filter((summary): summary is TrashSummary => summary !== null).sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
  }

  restoreTrash(id: string): Promise<OntologyDocument | null> {
    if (!MAP_ID.test(id)) return Promise.resolve(null)
    return this.#serialize(async () => {
      if (await this.#readPath(this.#path(id))) throw new Error('A map with this id already exists.')
      const document = await this.#readPath(this.#trashPath(id))
      if (!document) return null
      await rename(this.#trashPath(id), this.#path(id))
      return document
    })
  }

  permanentlyDelete(id: string): Promise<boolean> {
    if (!MAP_ID.test(id)) return Promise.resolve(false)
    return this.#serialize(async () => {
      try {
        await unlink(this.#trashPath(id))
        await rm(this.#historyPath(id), { recursive: true, force: true })
        return true
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
        throw error
      }
    })
  }

  async #save(document: OntologyDocument): Promise<OntologyDocument> {
    const migrated = migrateDocument(document)
    if (!migrated || !MAP_ID.test(migrated.id)) throw new Error('Invalid ontology document.')
    const current = await this.#readPath(this.#path(migrated.id))
    if (current) {
      const comparable = { ...migrated, updatedAt: current.updatedAt }
      if (JSON.stringify(current) !== JSON.stringify(comparable)) await this.#writeSnapshot(current)
    }
    await this.#atomicWrite(this.#path(migrated.id), migrated)
    return migrated
  }

  async #writeSnapshot(document: OntologyDocument): Promise<void> {
    const directory = this.#historyPath(document.id)
    await mkdir(directory, { recursive: true })
    const snapshot = `${Date.now().toString(36)}-${document.updatedAt.replace(/[^a-zA-Z0-9]/g, '')}-${randomUUID()}`
    await this.#atomicWrite(resolve(directory, `${snapshot}.json`), document)
    const entries = await readdir(directory, { withFileTypes: true })
    const snapshots = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json')).map((entry) => entry.name).sort()
    await Promise.all(snapshots.slice(0, -MAX_SNAPSHOTS).map((entry) => unlink(resolve(directory, entry))))
  }

  async #atomicWrite(path: string, document: OntologyDocument): Promise<void> {
    const temporary = `${path}.${process.pid}.${Date.now()}.tmp`
    await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`, 'utf8')
    await rename(temporary, path)
  }

  async #readPath(path: string): Promise<OntologyDocument | null> {
    try {
      return migrateDocument(JSON.parse(await readFile(path, 'utf8')) as unknown)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  #path(id: string): string {
    return resolve(this.#directory, `${id}.json`)
  }

  #historyPath(id: string): string {
    return resolve(this.#historyDirectory, id)
  }

  #trashPath(id: string): string {
    return resolve(this.#trashDirectory, `${id}.json`)
  }

  #serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#writes.then(operation, operation)
    this.#writes = result.then(() => undefined, () => undefined)
    return result
  }
}
