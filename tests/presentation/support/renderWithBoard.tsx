import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'
import { BoardProvider } from '@/presentation/context/BoardProvider'

/** Every UI test runs against the in-memory repository: real behaviour, no network, no mocks. */
export function renderWithBoard(
  ui: ReactNode,
  options: { repo?: InMemoryBoardRepository; slug?: string | null } = {},
) {
  const repo = options.repo ?? new InMemoryBoardRepository()
  return {
    repo,
    ...render(
      <BoardProvider repo={repo} slug={options.slug ?? null}>
        {ui}
      </BoardProvider>,
    ),
  }
}
