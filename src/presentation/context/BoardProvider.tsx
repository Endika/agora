import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { BoardRepository, BoardSnapshot } from '@/domain/repositories/BoardRepository'
import type { ProposalImages } from '@/domain/ports/ProposalImages'
import type { VisitedAgorasStore } from '@/domain/ports/VisitedAgorasStore'
import { BoardContext, type BoardState } from './boardContext'

interface Result {
  slug: string
  phase: 'ready' | 'joining' | 'error'
  board: BoardSnapshot | null
  error: string | null
}

/**
 * The UI's single dependency. The repository arrives from the composition root, so no component ever
 * imports an adapter — ESLint stops it, and tests hand the fake in here.
 *
 * State is only ever written from an async continuation and the visible status is derived, so a
 * slug change reads as loading without an extra render pass.
 */
export function BoardProvider({
  repo,
  visited,
  images,
  slug,
  children,
}: {
  repo: BoardRepository
  visited: VisitedAgorasStore
  images: ProposalImages
  slug: string | null
  children: ReactNode
}) {
  const [result, setResult] = useState<Result | null>(null)
  const [nonce, setNonce] = useState(0)
  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    if (!slug) return
    let live = true

    void (async () => {
      try {
        const board = await repo.getBoard(slug)
        if (!live) return
        // The device's own list of agoras: no account, so this is the only place it can live.
        visited.remember(slug, board.group.name)
        setResult({ slug, phase: 'ready', board, error: null })
      } catch (cause) {
        if (!live) return
        // An unknown device token is not a failure: it means this phone has not joined yet.
        const code = (cause as { code?: string }).code
        const message = cause instanceof Error ? cause.message : String(cause)
        const joining = code === 'PT403' || /unknown participant/i.test(message)
        setResult({
          slug,
          phase: joining ? 'joining' : 'error',
          board: null,
          error: joining ? null : message,
        })
      }
    })()

    return () => {
      live = false
    }
  }, [repo, visited, slug, nonce])

  // Revalidating when the tab comes back is the whole sync strategy: one tiny version call through
  // the caching repository, and no subscriptions to pay for.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])

  const value = useMemo<BoardState>(() => {
    const fresh = result?.slug === slug ? result : null
    return {
      repo,
      visited,
      images,
      slug,
      board: fresh?.board ?? null,
      status: !slug ? 'idle' : (fresh?.phase ?? 'loading'),
      error: fresh?.error ?? null,
      reload,
    }
  }, [repo, visited, images, slug, result, reload])

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>
}
