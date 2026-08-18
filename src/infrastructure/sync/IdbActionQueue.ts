import { openDB, type IDBPDatabase } from 'idb'
import { uuidv7 } from 'uuidv7'
import type {
  ActionQueue,
  FailedEntry,
  QueuedAction,
  QueuedEntry,
} from '@/domain/ports/ActionQueue'

const PENDING = 'pending'
const FAILED = 'failed'

/** IndexedDB, because a queued vote has to survive the tab being closed on the bus. */
export class IdbActionQueue implements ActionQueue {
  private db: Promise<IDBPDatabase> | null = null

  private open(): Promise<IDBPDatabase> {
    this.db ??= openDB('agora-queue', 1, {
      upgrade(db) {
        db.createObjectStore(PENDING, { keyPath: 'id' })
        db.createObjectStore(FAILED, { keyPath: 'id' })
      },
    })
    return this.db
  }

  async enqueue(action: QueuedAction): Promise<void> {
    const entry: QueuedEntry = { id: uuidv7(), action, queuedAt: new Date().toISOString() }
    await (await this.open()).put(PENDING, entry)
  }

  async pending(): Promise<QueuedEntry[]> {
    // uuidv7 keys sort in creation order, so getAll is already FIFO.
    return (await (await this.open()).getAll(PENDING)) as QueuedEntry[]
  }

  async remove(id: string): Promise<void> {
    await (await this.open()).delete(PENDING, id)
  }

  async fail(id: string, reason: string): Promise<void> {
    const db = await this.open()
    const entry = (await db.get(PENDING, id)) as QueuedEntry | undefined
    if (!entry) return
    await db.put(FAILED, { ...entry, reason } satisfies FailedEntry)
    await db.delete(PENDING, id)
  }

  async failed(): Promise<FailedEntry[]> {
    return (await (await this.open()).getAll(FAILED)) as FailedEntry[]
  }

  async forgetFailed(id: string): Promise<void> {
    await (await this.open()).delete(FAILED, id)
  }
}

export class InMemoryActionQueue implements ActionQueue {
  private entries: QueuedEntry[] = []
  private broken: FailedEntry[] = []
  private sequence = 0

  async enqueue(action: QueuedAction): Promise<void> {
    this.sequence += 1
    this.entries.push({
      id: String(this.sequence).padStart(4, '0'),
      action,
      queuedAt: new Date(Date.UTC(2026, 0, 1) + this.sequence * 1000).toISOString(),
    })
  }

  async pending(): Promise<QueuedEntry[]> {
    return [...this.entries]
  }

  async remove(id: string): Promise<void> {
    this.entries = this.entries.filter((entry) => entry.id !== id)
  }

  async fail(id: string, reason: string): Promise<void> {
    const entry = this.entries.find((candidate) => candidate.id === id)
    if (entry) this.broken.push({ ...entry, reason })
    await this.remove(id)
  }

  async failed(): Promise<FailedEntry[]> {
    return [...this.broken]
  }

  async forgetFailed(id: string): Promise<void> {
    this.broken = this.broken.filter((entry) => entry.id !== id)
  }
}
