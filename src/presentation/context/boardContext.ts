import { createContext, useContext } from 'react'
import type { ProposalImages } from '@/domain/ports/ProposalImages'
import type { VisitedAgorasStore } from '@/domain/ports/VisitedAgorasStore'
import type { BoardRepository, BoardSnapshot } from '@/domain/repositories/BoardRepository'

export interface BoardState {
  repo: BoardRepository
  visited: VisitedAgorasStore
  images: ProposalImages
  slug: string | null
  board: BoardSnapshot | null
  /** 'joining' means the agora exists but this device is not a participant yet. */
  status: 'idle' | 'loading' | 'ready' | 'joining' | 'error'
  error: string | null
  reload: () => void
}

export const BoardContext = createContext<BoardState | null>(null)

export function useBoard(): BoardState {
  const found = useContext(BoardContext)
  if (!found) throw new Error('useBoard must be used inside a BoardProvider')
  return found
}
