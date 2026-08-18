import type { ProposalImages } from '@/domain/ports/ProposalImages'
import type { VisitedAgorasStore } from '@/domain/ports/VisitedAgorasStore'
import type { BoardRepository } from '@/domain/repositories/BoardRepository'
import { AgoraApp } from '@/presentation/AgoraApp'
import { BoardProvider } from '@/presentation/context/BoardProvider'
import { useHashSlug } from '@/presentation/routing'

/** Both adapters are injected: this component knows nothing about Supabase or localStorage. */
export function App({
  repo,
  visited,
  images,
}: {
  repo: BoardRepository
  visited: VisitedAgorasStore
  images: ProposalImages
}) {
  const slug = useHashSlug()
  return (
    <BoardProvider repo={repo} visited={visited} images={images} slug={slug}>
      <AgoraApp />
    </BoardProvider>
  )
}
