import type { BoardSnapshot } from '@/domain/repositories/BoardRepository'

/** Where a board snapshot lives on the device. Reads come from here first, always. */
export interface BoardStore {
  load(slug: string): Promise<BoardSnapshot | null>
  save(slug: string, snapshot: BoardSnapshot): Promise<void>
  slugs(): Promise<string[]>
  forget(slug: string): Promise<void>
}

/** The three most recently visited agoras are worth keeping; older ones are not. */
export const KEPT_AGORAS = 3

export class InMemoryBoardStore implements BoardStore {
  private readonly entries = new Map<string, BoardSnapshot>()

  async load(slug: string): Promise<BoardSnapshot | null> {
    return this.entries.get(slug) ?? null
  }

  async save(slug: string, snapshot: BoardSnapshot): Promise<void> {
    // Re-inserting moves the key to the end, which is what makes eviction least-recently-used.
    this.entries.delete(slug)
    this.entries.set(slug, snapshot)
  }

  async slugs(): Promise<string[]> {
    return [...this.entries.keys()]
  }

  async forget(slug: string): Promise<void> {
    this.entries.delete(slug)
  }
}
