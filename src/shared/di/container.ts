import { uuidv7 } from 'uuidv7'
import type { VisitedAgorasStore } from '@/domain/ports/VisitedAgorasStore'
import type { BoardRepository } from '@/domain/repositories/BoardRepository'
import { DeviceIdentity } from '@/infrastructure/identity/DeviceIdentity'
import { VisitedAgoras } from '@/infrastructure/identity/VisitedAgoras'
import { CachingBoardRepository } from '@/infrastructure/persistence/CachingBoardRepository'
import { IdbBoardStore } from '@/infrastructure/persistence/IdbBoardStore'
import { SupabaseBoardRepository } from '@/infrastructure/persistence/SupabaseBoardRepository'
import { createAgoraClient } from '@/infrastructure/persistence/SupabaseClient'

/** Eight URL-friendly characters. Not a UUID: this one ends up in the link people share. */
export function agoraSlug(): string {
  return uuidv7().replace(/-/g, '').slice(-8)
}

/**
 * The composition root: the only place that knows which adapters exist. Components receive a
 * BoardRepository and cannot import an adapter — ESLint enforces it.
 *
 * A missing configuration is returned, not thrown: the app has to be able to render a message about
 * it rather than dying with a blank page.
 */
export function buildApp():
  { repo: BoardRepository; visited: VisitedAgorasStore } | { error: string } {
  try {
    const remote = new SupabaseBoardRepository(createAgoraClient(), DeviceIdentity.token, agoraSlug)
    return {
      repo: new CachingBoardRepository(remote, new IdbBoardStore()),
      visited: VisitedAgoras,
    }
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : String(cause) }
  }
}
