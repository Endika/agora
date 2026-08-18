import type { BoardRepository } from '@/domain/repositories/BoardRepository'
import { AgoraApp } from '@/presentation/AgoraApp'
import { BoardProvider } from '@/presentation/context/BoardProvider'
import { useHashSlug } from '@/presentation/routing'

/** The repository is injected: this component knows nothing about Supabase or IndexedDB. */
export function App({ repo }: { repo: BoardRepository }) {
  const slug = useHashSlug()
  return (
    <BoardProvider repo={repo} slug={slug}>
      <AgoraApp />
    </BoardProvider>
  )
}
