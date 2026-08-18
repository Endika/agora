import type { ActionQueue } from '@/domain/ports/ActionQueue'
import type { OnlineDetector } from '@/domain/ports/OnlineDetector'
import type { ProposalImages } from '@/domain/ports/ProposalImages'
import type { VisitedAgorasStore } from '@/domain/ports/VisitedAgorasStore'
import type { BoardRepository } from '@/domain/repositories/BoardRepository'
import { AgoraApp } from '@/presentation/AgoraApp'
import { BoardProvider } from '@/presentation/context/BoardProvider'
import { useRoute } from '@/presentation/routing'

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
  const { slug, proposalId } = useRoute()
  return (
    <BoardProvider
      repo={repo}
      visited={visited}
      images={images}
      queue={queue}
      replay={replay}
      slug={slug}
    >
      <AgoraApp network={network} openId={proposalId} />
    </BoardProvider>
  )
}
