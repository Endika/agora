import { uuidv7 } from 'uuidv7'
import type { BoardRepository } from '@/domain/repositories/BoardRepository'
import { DeviceIdentity } from '@/infrastructure/identity/DeviceIdentity'
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
 */
export function buildBoardRepository(): BoardRepository {
  const remote = new SupabaseBoardRepository(createAgoraClient(), DeviceIdentity.token, agoraSlug)
  return new CachingBoardRepository(remote, new IdbBoardStore())
}
