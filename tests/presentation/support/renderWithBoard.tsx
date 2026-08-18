import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import type { ActionQueue } from '@/domain/ports/ActionQueue'
import type { PreparedUpload, ProposalImages } from '@/domain/ports/ProposalImages'
import type { VisitedAgora, VisitedAgorasStore } from '@/domain/ports/VisitedAgorasStore'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'
import { InMemoryActionQueue } from '@/infrastructure/sync/IdbActionQueue'
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

/**
 * An in-memory image pipeline: it "compresses" by recording what it was given, so a test can assert what
 * the UI does with a picked file without needing a canvas.
 */
export class InMemoryProposalImages implements ProposalImages {
  readonly attached: { slug: string; proposalId: string }[] = []
  rejectWith: string | null = null

  async prepare(file: Blob): Promise<PreparedUpload> {
    if (this.rejectWith) throw Object.assign(new Error('nope'), { code: this.rejectWith })
    return {
      full: file,
      thumb: file,
      width: 1600,
      height: 1200,
      bytes: file.size,
      previewUrl: `preview:${this.attached.length}:${file.size}:${Math.round(file.size)}`,
    }
  }

  async attach(input: { slug: string; proposalId: string }): Promise<void> {
    this.attached.push({ slug: input.slug, proposalId: input.proposalId })
  }

  urlFor(path: string): string {
    return `https://images.test/${path}`
  }
}

/** Every UI test runs against the in-memory repository: real behaviour, no network, no mocks. */
export function renderWithBoard(
  ui: ReactNode,
  options: {
    repo?: InMemoryBoardRepository
    visited?: VisitedAgorasStore
    images?: InMemoryProposalImages
    queue?: ActionQueue
    slug?: string | null
  } = {},
) {
  const repo = options.repo ?? new InMemoryBoardRepository()
  const visited = options.visited ?? new InMemoryVisitedAgoras()
  const images = options.images ?? new InMemoryProposalImages()
  const queue = options.queue ?? new InMemoryActionQueue()
  return {
    repo,
    visited,
    images,
    queue,
    ...render(
      <BoardProvider
        repo={repo}
        visited={visited}
        images={images}
        queue={queue}
        replay={() => Promise.resolve()}
        slug={options.slug ?? null}
      >
        {ui}
      </BoardProvider>,
    ),
  }
}
