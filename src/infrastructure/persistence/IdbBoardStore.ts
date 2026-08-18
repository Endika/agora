import { openDB, type IDBPDatabase } from 'idb'
import type { BoardSnapshot } from '@/domain/repositories/BoardRepository'
import type { BoardStore } from './BoardStore'

interface Entry {
  slug: string
  snapshot: BoardSnapshot
  touchedAt: number
}

/** The device's copy of the board. It is what renders on launch, before the network says anything. */
export class IdbBoardStore implements BoardStore {
  private db: Promise<IDBPDatabase> | null = null

  private open(): Promise<IDBPDatabase> {
    this.db ??= openDB('agora', 1, {
      upgrade(db) {
        const boards = db.createObjectStore('boards', { keyPath: 'slug' })
        boards.createIndex('touchedAt', 'touchedAt')
      },
    })
    return this.db
  }

  async load(slug: string): Promise<BoardSnapshot | null> {
    const entry = (await (await this.open()).get('boards', slug)) as Entry | undefined
    return entry?.snapshot ?? null
  }

  async save(slug: string, snapshot: BoardSnapshot): Promise<void> {
    await (await this.open()).put('boards', { slug, snapshot, touchedAt: Date.now() })
  }

  /** Least recently used first, so a caller can drop from the front. */
  async slugs(): Promise<string[]> {
    const entries = (await (await this.open()).getAllFromIndex('boards', 'touchedAt')) as Entry[]
    return entries.map((e) => e.slug)
  }

  async forget(slug: string): Promise<void> {
    await (await this.open()).delete('boards', slug)
  }
}
