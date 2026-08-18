import { openDB, type IDBPDatabase } from 'idb'
import type { BoardSnapshot } from '@/domain/repositories/BoardRepository'
import { parseBoard } from './schemas'
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

  /**
   * A cached snapshot outlives deploys, so it is validated against the same schema as the wire and thrown
   * away when it no longer matches.
   *
   * This is the bug that made a deploy hand somebody a dark, empty screen: a board stored before payments
   * existed had no `payments` field, the new code read it, and the whole app came down. Anything that changes
   * the payload's shape now heals itself on the next read instead of crashing the app it reaches.
   */
  async load(slug: string): Promise<BoardSnapshot | null> {
    const entry = (await (await this.open()).get('boards', slug)) as Entry | undefined
    if (!entry) return null
    try {
      return parseBoard(entry.snapshot)
    } catch {
      await this.forget(slug)
      return null
    }
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
