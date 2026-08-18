import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import type { VisitedAgora, VisitedAgorasStore } from '@/domain/ports/VisitedAgorasStore'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'
import { BoardProvider } from '@/presentation/context/BoardProvider'

/** An in-memory stand-in for the device's own list, so tests never touch localStorage. */
export class InMemoryVisitedAgoras implements VisitedAgorasStore {
  private entries: VisitedAgora[] = []

  list(): VisitedAgora[] {
    return [...this.entries].sort((a, b) => b.visitedAt - a.visitedAt)
  }

  remember(slug: string, name: string): void {
    this.entries = [
      { slug, name, visitedAt: this.entries.length + 1 },
      ...this.entries.filter((entry) => entry.slug !== slug),
    ]
  }

  forget(slug: string): void {
    this.entries = this.entries.filter((entry) => entry.slug !== slug)
  }
}

/** Every UI test runs against the in-memory repository: real behaviour, no network, no mocks. */
export function renderWithBoard(
  ui: ReactNode,
  options: {
    repo?: InMemoryBoardRepository
    visited?: VisitedAgorasStore
    slug?: string | null
  } = {},
) {
  const repo = options.repo ?? new InMemoryBoardRepository()
  const visited = options.visited ?? new InMemoryVisitedAgoras()
  return {
    repo,
    visited,
    ...render(
      <BoardProvider repo={repo} visited={visited} slug={options.slug ?? null}>
        {ui}
      </BoardProvider>,
    ),
  }
}
