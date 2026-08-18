import type { ActionQueue } from '@/domain/ports/ActionQueue'
import type { ProposalImages } from '@/domain/ports/ProposalImages'
import type { VisitedAgorasStore } from '@/domain/ports/VisitedAgorasStore'
import type { BoardRepository } from '@/domain/repositories/BoardRepository'
import type { OnlineDetector } from '@/domain/ports/OnlineDetector'
import { AgoraApp } from '@/presentation/AgoraApp'
import { BoardProvider } from '@/presentation/context/BoardProvider'
import { useHashSlug } from '@/presentation/routing'

export interface Wiring {
  repo: BoardRepository
  visited: VisitedAgorasStore
  images: ProposalImages
  queue: ActionQueue
  network: OnlineDetector
  replay: () => Promise<unknown>
}

/** Every adapter is injected: this component knows nothing about Supabase, IndexedDB or the network. */
export function App({ repo, visited, images, queue, network, replay }: Wiring) {
  const slug = useHashSlug()
  return (
    <BoardProvider
      repo={repo}
      visited={visited}
      images={images}
      queue={queue}
      replay={replay}
      slug={slug}
    >
      <AgoraApp network={network} />
    </BoardProvider>
  )
}
