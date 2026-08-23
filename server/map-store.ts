import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { cloneSample } from '../src/domain/sample'
import { EXAMPLE_MAPS } from '../src/domain/examples'
import { migrateDocument } from '../src/domain/migration'
import type { OntologyDocument } from '../src/domain/types'

const MAP_ID = /^[a-zA-Z0-9_-]+$/

export type SharedMapSummary = Pick<OntologyDocument, 'id' | 'name' | 'description' | 'updatedAt'>

export class MapStore {
  readonly #directory: string
  #writes: Promise<unknown> = Promise.resolve()

  constructor(directory = resolve('.needle-data/maps')) {
    this.#directory = directory
  }

  async initialize(): Promise<void> {
    await mkdir(this.#directory, { recursive: true })
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
      .map(({ id, name, description, updatedAt }) => ({ id, name, description, updatedAt }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async read(id: string): Promise<OntologyDocument | null> {
    if (!MAP_ID.test(id)) return null
    try {
      const value = JSON.parse(await readFile(this.#path(id), 'utf8')) as unknown
      return migrateDocument(value)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  save(document: OntologyDocument): Promise<OntologyDocument> {
    return this.#serialize(async () => {
      const migrated = migrateDocument(document)
      if (!migrated || !MAP_ID.test(migrated.id)) throw new Error('Invalid ontology document.')
      const temporary = `${this.#path(migrated.id)}.${process.pid}.${Date.now()}.tmp`
      await writeFile(temporary, `${JSON.stringify(migrated, null, 2)}\n`, 'utf8')
      await rename(temporary, this.#path(migrated.id))
      return migrated
    })
  }

  delete(id: string): Promise<boolean> {
    if (!MAP_ID.test(id)) return Promise.resolve(false)
    return this.#serialize(async () => {
      try {
        await unlink(this.#path(id))
        return true
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
        throw error
      }
    })
  }

  #path(id: string): string {
    return resolve(this.#directory, `${id}.json`)
  }

  #serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#writes.then(operation, operation)
    this.#writes = result.then(() => undefined, () => undefined)
    return result
  }
}
