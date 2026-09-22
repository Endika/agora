import type { ActionQueue } from '@/domain/ports/ActionQueue'
import type { OnlineDetector } from '@/domain/ports/OnlineDetector'
import type { ProposalImages } from '@/domain/ports/ProposalImages'
import type { VisitedAgorasStore } from '@/domain/ports/VisitedAgorasStore'
import type { BoardRepository } from '@/domain/repositories/BoardRepository'
import { AgoraApp } from '@/presentation/AgoraApp'
import { PrivacyNotice } from '@/presentation/components/legal/PrivacyNotice'
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
  const route = useRoute()
  return (
    <BoardProvider
      repo={repo}
      visited={visited}
      images={images}
      queue={queue}
      replay={replay}
      slug={'slug' in route ? route.slug : null}
    >
      {/* The notice is inside the provider so that, read from inside an agora, it can say which of
          the two ballot modes the reader is under instead of describing both and naming neither.
          Read from the home screen the slug is null, the provider stays idle, and it describes both.
          Walking to it from a board costs nothing — the provider is the same element across the
          route change, so it neither remounts nor refetches. Landing on the address cold does fetch
          that board, and remembers the agora on this device, which is the price of the notice
          answering the reader's actual question instead of listing both answers. */}
      {route.kind === 'privacy' ? (
        <PrivacyNotice slug={route.slug} />
      ) : (
        <AgoraApp network={network} route={route} />
      )}
    </BoardProvider>
  )
}
