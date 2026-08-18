import type { ActionQueue, QueuedAction } from '@/domain/ports/ActionQueue'
import type { BoardRepository } from '@/domain/repositories/BoardRepository'

function isRefusal(cause: unknown): boolean {
  const code = (cause as { code?: string }).code
  return typeof code === 'string' && /^PT4/.test(code)
}

/**
 * Drains the queue in order, oldest first.
 *
 * Replaying is safe by construction — a vote is an upsert and comments carry client ids — so running this
 * twice cannot double anything. A refusal from the server (a closed vote, a stale round) is set aside as
 * failed and shown, because retrying it for ever would be a silent lie; a network error stops the run and
 * leaves the rest queued.
 */
export class QueueReplayer {
  constructor(
    private readonly repo: BoardRepository,
    private readonly queue: ActionQueue,
  ) {}

  async run(): Promise<{ sent: number; failed: number }> {
    let sent = 0
    let failed = 0

    for (const entry of await this.queue.pending()) {
      try {
        await this.apply(entry.action)
        await this.queue.remove(entry.id)
        sent += 1
      } catch (cause) {
        if (!isRefusal(cause)) return { sent, failed }
        const reason = cause instanceof Error ? cause.message : String(cause)
        await this.queue.fail(entry.id, reason)
        failed += 1
      }
    }

    return { sent, failed }
  }

  private apply(action: QueuedAction): Promise<void> {
    switch (action.kind) {
      case 'castVote':
        return this.repo.castVote(action)
      case 'addThread':
        return this.repo.addThread(action)
      case 'addComment':
        return this.repo.addComment(action)
      case 'setThreadResolved':
        return this.repo.setThreadResolved(action)
      case 'setExpenseShare':
        return this.repo.setExpenseShare(action)
    }
  }
}
