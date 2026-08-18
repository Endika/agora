import type { VoteValue } from '@/domain/entities/Proposal'
import type {
  BoardRepository,
  BoardSnapshot,
  Identity,
  NewProposal,
  PinResult,
} from '@/domain/repositories/BoardRepository'
import { sortProposals } from '@/domain/services/ProposalSorter'
import { KEPT_AGORAS, type BoardStore } from '@/infrastructure/persistence/BoardStore'

/**
 * The egress lever, as a decorator.
 *
 * A read serves the cached snapshot and asks the server only for its version — tens of bytes. When
 * the version moved it fetches the delta, never the whole board again. A write applies its own
 * result locally, so nobody refetches a board to see something they just did.
 */
export class CachingBoardRepository implements BoardRepository {
  constructor(
    private readonly remote: BoardRepository,
    private readonly store: BoardStore,
  ) {}

  async getBoard(slug: string): Promise<BoardSnapshot> {
    const cached = await this.store.load(slug)
    if (!cached) return this.fetchFull(slug)

    const version = await this.remote.getVersion(slug)
    if (version === cached.version) return cached

    const delta = await this.remote.getBoardSince(slug, cached.version)
    const merged = merge(cached, delta)
    await this.keep(slug, merged)
    return merged
  }

  async getBoardSince(slug: string, since: string): Promise<BoardSnapshot> {
    return this.remote.getBoardSince(slug, since)
  }

  async getVersion(slug: string): Promise<string> {
    return this.remote.getVersion(slug)
  }

  private async fetchFull(slug: string): Promise<BoardSnapshot> {
    const snapshot = await this.remote.getBoard(slug)
    await this.keep(slug, snapshot)
    return snapshot
  }

  private async keep(slug: string, snapshot: BoardSnapshot): Promise<void> {
    await this.store.save(slug, snapshot)
    const slugs = await this.store.slugs()
    for (const old of slugs.slice(0, Math.max(0, slugs.length - KEPT_AGORAS))) {
      await this.store.forget(old)
    }
  }

  /**
   * After a write, refresh the cache from the delta the server already owes us. This is one call,
   * not a board fetch, and it is what makes the UI show your own action without a round trip.
   */
  private async refresh(slug: string): Promise<void> {
    const cached = await this.store.load(slug)
    if (!cached) return
    const delta = await this.remote.getBoardSince(slug, cached.version)
    await this.keep(slug, merge(cached, delta))
  }

  private async slugOf(proposalId: string): Promise<string | null> {
    for (const slug of await this.store.slugs()) {
      const snapshot = await this.store.load(slug)
      if (snapshot?.proposals.some((p) => p.id === proposalId)) return slug
    }
    return null
  }

  private async afterProposalWrite(proposalId: string): Promise<void> {
    const slug = await this.slugOf(proposalId)
    if (slug) await this.refresh(slug)
  }

  async createAgora(input: { name: string; creatorName: string; pin: string }): Promise<Identity> {
    return this.remote.createAgora(input)
  }

  async joinAgora(input: { slug: string; name: string; pin: string }): Promise<Identity> {
    return this.remote.joinAgora(input)
  }

  async recover(input: { slug: string; name: string; pin: string }): Promise<PinResult> {
    const result = await this.remote.recover(input)
    // A recovered identity sees a different board (its own vote, its own permissions).
    if (result.ok) await this.store.forget(input.slug)
    return result
  }

  async createProposal(input: { slug: string } & NewProposal): Promise<string> {
    const id = await this.remote.createProposal(input)
    await this.refresh(input.slug)
    return id
  }

  async updateProposal(input: { proposalId: string } & Partial<NewProposal>): Promise<void> {
    await this.remote.updateProposal(input)
    await this.afterProposalWrite(input.proposalId)
  }

  async castVote(input: { proposalId: string; round: number; value: VoteValue }): Promise<void> {
    await this.remote.castVote(input)
    await this.afterProposalWrite(input.proposalId)
  }

  async reopenProposal(proposalId: string): Promise<void> {
    await this.remote.reopenProposal(proposalId)
    await this.afterProposalWrite(proposalId)
  }

  async closeProposal(input: { proposalId: string; reason: string }): Promise<void> {
    await this.remote.closeProposal(input)
    await this.afterProposalWrite(input.proposalId)
  }

  async completeProposal(input: { proposalId: string; actualCents: number | null }): Promise<void> {
    await this.remote.completeProposal(input)
    await this.afterProposalWrite(input.proposalId)
  }

  async addThread(input: {
    threadId: string
    proposalId: string
    commentId: string
    body: string
  }): Promise<void> {
    await this.remote.addThread(input)
    await this.afterProposalWrite(input.proposalId)
  }

  async addComment(input: { commentId: string; threadId: string; body: string }): Promise<void> {
    await this.remote.addComment(input)
  }

  async setThreadResolved(input: { threadId: string; resolved: boolean }): Promise<void> {
    await this.remote.setThreadResolved(input)
  }

  async setExpenseShare(input: { proposalId: string; optedIn: boolean }): Promise<void> {
    await this.remote.setExpenseShare(input)
    await this.afterProposalWrite(input.proposalId)
  }

  async addLiquidation(input: {
    id: string
    proposalId: string
    cents: number
    affects: string[]
  }): Promise<void> {
    await this.remote.addLiquidation(input)
    await this.afterProposalWrite(input.proposalId)
  }

  async setLiquidationSharePaid(input: {
    liquidationId: string
    participantId: string
    paid: boolean
  }): Promise<void> {
    await this.remote.setLiquidationSharePaid(input)
  }

  async attachImage(input: {
    id: string
    proposalId: string
    path: string
    thumbPath: string
    width: number
    height: number
    bytes: number
  }): Promise<void> {
    await this.remote.attachImage(input)
    await this.afterProposalWrite(input.proposalId)
  }
}

/** Nothing is ever hard-deleted except a whole agora, so a delta needs no tombstones. */
function merge(cached: BoardSnapshot, delta: BoardSnapshot): BoardSnapshot {
  const proposals = [...cached.proposals]
  for (const fresh of delta.proposals) {
    const at = proposals.findIndex((p) => p.id === fresh.id)
    if (at === -1) proposals.push(fresh)
    else proposals[at] = fresh
  }

  const threads = [...cached.threads]
  for (const fresh of delta.threads) {
    const at = threads.findIndex((t) => t.id === fresh.id)
    if (at === -1) threads.push(fresh)
    else threads[at] = fresh
  }

  const seen = new Set(cached.history.map((h) => h.id))
  const history = [...cached.history, ...delta.history.filter((h) => !seen.has(h.id))]

  return {
    version: delta.version,
    group: delta.group,
    me: delta.me,
    participants: delta.participants.length > 0 ? delta.participants : cached.participants,
    // Sorted here too: a merged snapshot is what the UI renders, and the order is part of the spec.
    proposals: sortProposals(proposals),
    threads,
    history: history.slice(-50),
  }
}
