import { uuidv7 } from 'uuidv7'
import type { Wiring } from '@/App'
import { DeviceIdentity } from '@/infrastructure/identity/DeviceIdentity'
import { VisitedAgoras } from '@/infrastructure/identity/VisitedAgoras'
import { SupabaseProposalImages } from '@/infrastructure/images/SupabaseProposalImages'
import { BrowserOnlineDetector } from '@/infrastructure/network/OnlineDetector'
import { IdbActionQueue } from '@/infrastructure/sync/IdbActionQueue'
import { QueueReplayer } from '@/infrastructure/sync/QueueReplayer'
import { QueuingBoardRepository } from '@/infrastructure/sync/QueuingBoardRepository'
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
export function buildApp(): Wiring | { error: string } {
  try {
    const client = createAgoraClient()
    const queue = new IdbActionQueue()
    const network = BrowserOnlineDetector

    // Caching(Queuing(Supabase)): reads come off the device, writes survive having no coverage, and the
    // cache is what the UI renders either way.
    const remote = new SupabaseBoardRepository(client, DeviceIdentity.token, agoraSlug)
    const queuing = new QueuingBoardRepository(remote, queue, network)
    const repo = new CachingBoardRepository(queuing, new IdbBoardStore())
    const replayer = new QueueReplayer(remote, queue)

    return {
      repo,
      visited: VisitedAgoras,
      images: new SupabaseProposalImages(client, repo),
      queue,
      network,
      replay: () => replayer.run(),
    }
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : String(cause) }
  }
}
