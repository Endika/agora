import type { VoteValue } from '@/domain/entities/Proposal'
import type { ActionQueue, QueuedAction } from '@/domain/ports/ActionQueue'
import type {
  AgoraPreview,
  BoardRepository,
  BoardSnapshot,
  Comment,
  DeleteResult,
  Identity,
  NewProposal,
} from '@/domain/repositories/BoardRepository'
import type { OnlineDetector } from '@/domain/ports/OnlineDetector'

/** A refusal from the server (PT4xx) is final; anything else is treated as "the network was not there". */
function isRefusal(cause: unknown): boolean {
  const code = (cause as { code?: string }).code
  return typeof code === 'string' && /^PT4/.test(code)
}

/**
 * Voting and commenting with no coverage, which is most of a bus ride.
 *
 * Only the five actions people actually perform mid-conversation are queued. Creating a proposal, editing
 * one, uploading an image or deleting an agora are not: they need an id back or a Storage round trip, and
 * pretending they succeeded would be a lie the UI could not keep.
 */
export class QueuingBoardRepository implements BoardRepository {
  constructor(
    private readonly inner: BoardRepository,
    private readonly queue: ActionQueue,
    private readonly network: OnlineDetector,
  ) {}

  /** Try it; if the network is what failed, keep it for later instead of losing it. */
  private async attempt(action: QueuedAction, run: () => Promise<void>): Promise<void> {
    if (!this.network.isOnline()) {
      await this.queue.enqueue(action)
      return
    }
    try {
      await run()
    } catch (cause) {
      if (isRefusal(cause)) throw cause
      await this.queue.enqueue(action)
    }
  }

  async castVote(input: { proposalId: string; round: number; value: VoteValue }): Promise<void> {
    await this.attempt({ kind: 'castVote', ...input }, () => this.inner.castVote(input))
  }

  async addThread(input: {
    threadId: string
    proposalId: string
    commentId: string
    body: string
  }): Promise<void> {
    await this.attempt({ kind: 'addThread', ...input }, () => this.inner.addThread(input))
  }

  async addComment(input: { commentId: string; threadId: string; body: string }): Promise<void> {
    await this.attempt({ kind: 'addComment', ...input }, () => this.inner.addComment(input))
  }

  async setThreadResolved(input: { threadId: string; resolved: boolean }): Promise<void> {
    await this.attempt({ kind: 'setThreadResolved', ...input }, () =>
      this.inner.setThreadResolved(input),
    )
  }

  async setExpenseShare(input: { proposalId: string; optedIn: boolean }): Promise<void> {
    await this.attempt({ kind: 'setExpenseShare', ...input }, () =>
      this.inner.setExpenseShare(input),
    )
  }

  // Everything else goes straight through.
  createAgora(input: { name: string; creatorName: string }): Promise<Identity> {
    return this.inner.createAgora(input)
  }
  preview(slug: string): Promise<AgoraPreview> {
    return this.inner.preview(slug)
  }
  claim(input: { slug: string; participantId: string }): Promise<Identity> {
    return this.inner.claim(input)
  }
  addParticipant(input: { slug: string; name: string }): Promise<Identity> {
    return this.inner.addParticipant(input)
  }
  deleteAgora(input: { slug: string; confirmName: string }): Promise<DeleteResult> {
    return this.inner.deleteAgora(input)
  }
  getVersion(slug: string): Promise<string> {
    return this.inner.getVersion(slug)
  }
  getBoard(slug: string): Promise<BoardSnapshot> {
    return this.inner.getBoard(slug)
  }
  getBoardSince(slug: string, since: string): Promise<BoardSnapshot> {
    return this.inner.getBoardSince(slug, since)
  }
  createProposal(input: { slug: string } & NewProposal): Promise<string> {
    return this.inner.createProposal(input)
  }
  updateProposal(input: { proposalId: string } & Partial<NewProposal>): Promise<void> {
    return this.inner.updateProposal(input)
  }
  reopenProposal(proposalId: string): Promise<void> {
    return this.inner.reopenProposal(proposalId)
  }
  closeProposal(input: { proposalId: string; reason: string }): Promise<void> {
    return this.inner.closeProposal(input)
  }
  completeProposal(input: { proposalId: string; actualCents: number | null }): Promise<void> {
    return this.inner.completeProposal(input)
  }
  threadComments(input: { slug: string; threadId: string }): Promise<Comment[]> {
    return this.inner.threadComments(input)
  }
  addLiquidation(input: {
    id: string
    proposalId: string
    cents: number
    affects: string[]
  }): Promise<void> {
    return this.inner.addLiquidation(input)
  }
  setLiquidationSharePaid(input: {
    liquidationId: string
    participantId: string
    paid: boolean
  }): Promise<void> {
    return this.inner.setLiquidationSharePaid(input)
  }
  attachImage(input: {
    id: string
    proposalId: string
    path: string
    thumbPath: string
    width: number
    height: number
    bytes: number
  }): Promise<void> {
    return this.inner.attachImage(input)
  }
}
