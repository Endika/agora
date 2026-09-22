import type { Proposal, VoteValue } from '@/domain/entities/Proposal'
import { resolve, tally } from '@/domain/services/QuorumResolver'
import { sortProposals } from '@/domain/services/ProposalSorter'
import type {
  AgoraPreview,
  BoardRepository,
  BoardSnapshot,
  Comment,
  DeleteResult,
  HistoryEntry,
  Identity,
  NewProposal,
  Participant,
  Thread,
} from '@/domain/repositories/BoardRepository'

/**
 * The fake refuses the way the database refuses: with the same PT4xx codes, because the offline queue
 * decides between "retry later" and "set aside" by reading them.
 */
function refuse(code: 'PT400' | 'PT403' | 'PT404' | 'PT409', message: string): Error {
  return Object.assign(new Error(message), { code })
}

interface Vote {
  proposalId: string
  participantId: string
  round: number
  value: VoteValue
}

interface Row {
  id: string
  groupId: string
  createdBy: string
  title: string
  description: string
  tags: string[]
  links: Proposal['links']
  status: Proposal['status']
  round: number
  deadline: string | null
  closedReason: string | null
  estimatedCents: number | null
  actualCents: number | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  /**
   * How many people were entitled to vote at the moment this proposal left 'open'. The SQL recovers
   * the same number from `created_at <= resolved_at`; here it is simply recorded when it happens.
   * Null while the proposal is open, which is also the only time nothing consults it.
   */
  resolvedRoster: number | null
}

interface Agora {
  id: string
  slug: string
  name: string
  ballotOpen: boolean
  participants: Participant[]
  proposals: Row[]
  votes: Vote[]
  threads: Omit<Thread, 'comments' | 'commentCount'>[]
  comments: (Comment & { threadId: string })[]
  history: HistoryEntry[]
}

/**
 * The fake every test above the data layer runs against. It enforces the same invariants the
 * database does — one vote per participant and round, resolution on quorum, no sentiment before
 * quorum — so a divergence shows up as a failing test rather than as a bug in the browser.
 *
 * Its clock is a counter, not the wall clock: versions stay comparable and tests stay stable.
 */
export class InMemoryBoardRepository implements BoardRepository {
  readonly calls: string[] = []
  private readonly agoras = new Map<string, Agora>()
  private ticks = 0
  private me = ''
  private seq = 0

  private now(): string {
    this.ticks += 1
    return new Date(Date.UTC(2026, 0, 1) + this.ticks * 1000).toISOString()
  }

  /**
   * Shaped like what the database hands out: a uuid, and an eight-character slug. Ids that could
   * never appear in the address bar are how a broken link gets to look fine in a test — the router
   * would refuse `slug-1`, so nothing above this class could be tested through a real one.
   */
  private id(prefix: string): string {
    this.seq += 1
    const n = String(this.seq).padStart(4, '0')
    return prefix === 'slug' ? `ag00${n}` : `018f4b2c-0000-7000-8000-00000000${n}`
  }

  private agora(slug: string): Agora {
    const found = this.agoras.get(slug)
    if (!found) throw refuse('PT404', 'unknown agora')
    return found
  }

  private byProposal(proposalId: string): Agora {
    for (const agora of this.agoras.values()) {
      if (agora.proposals.some((p) => p.id === proposalId)) return agora
    }
    throw refuse('PT404', 'unknown proposal')
  }

  /** Test seam: history entries a real run would have produced over weeks. */
  seedHistory(slug: string, entries: HistoryEntry[]): this {
    this.agora(slug).history.push(...entries)
    return this
  }

  /** Test seam: keep acting as this participant, the way a device token would. */
  actAs(participantId: string): this {
    this.me = participantId
    return this
  }

  participantId(slug: string, name: string): string {
    const found = this.agora(slug).participants.find((p) => p.name === name)
    if (!found) throw new Error(`no participant named ${name}`)
    return found.id
  }

  async createAgora(input: {
    name: string
    creatorName: string
    ballotOpen: boolean
  }): Promise<Identity> {
    this.calls.push('createAgora')
    const slug = this.id('slug')
    const meId = this.id('participant')
    this.agoras.set(slug, {
      id: this.id('agora'),
      slug,
      name: input.name,
      ballotOpen: input.ballotOpen,
      participants: [{ id: meId, name: input.creatorName }],
      proposals: [],
      votes: [],
      threads: [],
      comments: [],
      history: [],
    })
    this.me = meId
    return { slug, participantId: meId }
  }

  async preview(slug: string): Promise<AgoraPreview> {
    this.calls.push('preview')
    const agora = this.agora(slug)
    return { slug, name: agora.name, participants: agora.participants }
  }

  async claim(input: { slug: string; participantId: string }): Promise<Identity> {
    this.calls.push('claim')
    const agora = this.agora(input.slug)
    if (!agora.participants.some((p) => p.id === input.participantId)) {
      throw refuse('PT404', 'unknown participant')
    }
    this.me = input.participantId
    return { slug: input.slug, participantId: input.participantId }
  }

  async addParticipant(input: { slug: string; name: string }): Promise<Identity> {
    this.calls.push('addParticipant')
    const agora = this.agora(input.slug)
    const name = input.name.trim()
    if (name.length === 0) throw refuse('PT400', 'a participant needs a name')
    if (agora.participants.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      throw refuse('PT409', 'name taken')
    }
    const id = this.id('participant')
    agora.participants.push({ id, name })
    this.me = id
    return { slug: input.slug, participantId: id }
  }

  async deleteAgora(input: { slug: string; confirmName: string }): Promise<DeleteResult> {
    this.calls.push('deleteAgora')
    const agora = this.agora(input.slug)
    if (input.confirmName.trim().toLowerCase() !== agora.name.toLowerCase()) {
      return { ok: false, error: 'name_mismatch' }
    }
    this.agoras.delete(input.slug)
    return { ok: true }
  }

  async getVersion(slug: string): Promise<string> {
    this.calls.push('getVersion')
    return this.version(this.agora(slug))
  }

  async getBoard(slug: string): Promise<BoardSnapshot> {
    this.calls.push('getBoard')
    return this.snapshot(this.agora(slug), null)
  }

  async getBoardSince(slug: string, since: string): Promise<BoardSnapshot> {
    this.calls.push('getBoardSince')
    return this.snapshot(this.agora(slug), since)
  }

  async createProposal(input: { slug: string } & NewProposal): Promise<string> {
    this.calls.push('createProposal')
    const agora = this.agora(input.slug)
    const stamp = this.now()
    const id = this.id('proposal')
    agora.proposals.push({
      id,
      groupId: agora.id,
      createdBy: this.me,
      title: input.title,
      description: input.description ?? '',
      tags: input.tags ?? [],
      links: input.links ?? [],
      status: 'open',
      round: 1,
      deadline: input.deadline ?? null,
      closedReason: null,
      estimatedCents: input.estimatedCents ?? null,
      actualCents: null,
      resolvedRoster: null,
      createdAt: stamp,
      updatedAt: stamp,
      completedAt: null,
    })
    // Same rule as create_proposal: an amount without anyone in it would show no split at all.
    if (input.estimatedCents != null) {
      const shares = (this.shares[id] ??= new Map())
      shares.set(this.me, true)
    }

    this.log(agora, id, 'proposal_created', input.title)
    return id
  }

  async updateProposal(input: { proposalId: string } & Partial<NewProposal>): Promise<void> {
    this.calls.push('updateProposal')
    const row = this.row(input.proposalId)
    if (input.title !== undefined) row.title = input.title
    if (input.description !== undefined) row.description = input.description
    if (input.deadline !== undefined) row.deadline = input.deadline
    if (input.estimatedCents !== undefined) row.estimatedCents = input.estimatedCents
    if (input.tags !== undefined) row.tags = input.tags
    if (input.links !== undefined) row.links = input.links
    row.updatedAt = this.now()
  }

  async castVote(input: { proposalId: string; round: number; value: VoteValue }): Promise<void> {
    this.calls.push('castVote')
    const agora = this.byProposal(input.proposalId)
    const row = this.row(input.proposalId)
    if (row.status !== 'open') throw refuse('PT409', 'the vote is closed')
    if (row.round !== input.round) throw refuse('PT409', 'stale round')

    const existing = agora.votes.find(
      (v) => v.proposalId === row.id && v.participantId === this.me && v.round === row.round,
    )
    if (existing) existing.value = input.value
    else
      agora.votes.push({
        proposalId: row.id,
        participantId: this.me,
        round: row.round,
        value: input.value,
      })

    row.updatedAt = this.now()
    this.resolveRow(agora, row)
  }

  async reopenProposal(proposalId: string): Promise<void> {
    this.calls.push('reopenProposal')
    const agora = this.byProposal(proposalId)
    const row = this.row(proposalId)
    if (row.status !== 'debating') throw refuse('PT409', 'not in debate')
    if (row.createdBy !== this.me) throw refuse('PT403', 'only the creator may reopen')
    row.round += 1
    row.status = 'open'
    row.resolvedRoster = null
    row.updatedAt = this.now()
    this.log(agora, row.id, 'reopened', '')
  }

  async closeProposal(input: { proposalId: string; reason: string }): Promise<void> {
    this.calls.push('closeProposal')
    const agora = this.byProposal(input.proposalId)
    const row = this.row(input.proposalId)
    if (row.status !== 'debating') throw refuse('PT409', 'not in debate')
    if (row.createdBy !== this.me) throw refuse('PT403', 'only the creator may close')
    if (input.reason.trim().length < 10)
      throw refuse('PT400', 'a closing reason needs at least 10 characters')
    row.status = 'closed'
    row.closedReason = input.reason
    row.updatedAt = this.now()
    this.log(agora, row.id, 'closed', input.reason)
  }

  async completeProposal(input: { proposalId: string; actualCents: number | null }): Promise<void> {
    this.calls.push('completeProposal')
    const agora = this.byProposal(input.proposalId)
    const row = this.row(input.proposalId)
    if (row.status !== 'approved')
      throw refuse('PT409', 'only an approved proposal can be marked done')
    row.status = 'completed'
    row.actualCents = input.actualCents
    row.completedAt = this.now()
    row.updatedAt = row.completedAt
    this.log(agora, row.id, 'completed', '')
  }

  async addThread(input: {
    threadId: string
    proposalId: string
    commentId: string
    body: string
  }): Promise<void> {
    this.calls.push('addThread')
    const agora = this.byProposal(input.proposalId)
    if (!agora.threads.some((t) => t.id === input.threadId)) {
      agora.threads.push({
        id: input.threadId,
        proposalId: input.proposalId,
        authorId: this.me,
        resolvedAt: null,
        resolvedBy: null,
        createdAt: this.now(),
      })
    }
    await this.addComment({
      commentId: input.commentId,
      threadId: input.threadId,
      body: input.body,
    })
  }

  async addComment(input: { commentId: string; threadId: string; body: string }): Promise<void> {
    this.calls.push('addComment')
    const agora = this.threadAgora(input.threadId)
    if (agora.comments.some((c) => c.id === input.commentId)) return
    agora.comments.push({
      id: input.commentId,
      threadId: input.threadId,
      authorId: this.me,
      body: input.body,
      createdAt: this.now(),
    })
    const thread = agora.threads.find((t) => t.id === input.threadId)
    if (thread) this.row(thread.proposalId).updatedAt = this.now()
  }

  async threadComments(input: { slug: string; threadId: string }): Promise<Comment[]> {
    this.calls.push('threadComments')
    const agora = this.agora(input.slug)
    return agora.comments
      .filter((comment) => comment.threadId === input.threadId)
      .map(({ threadId: _threadId, ...comment }) => comment)
  }

  async setThreadResolved(input: { threadId: string; resolved: boolean }): Promise<void> {
    this.calls.push('setThreadResolved')
    const agora = this.threadAgora(input.threadId)
    const thread = agora.threads.find((t) => t.id === input.threadId)
    if (!thread) throw refuse('PT404', 'unknown thread')
    const owner = this.row(thread.proposalId).createdBy
    if (this.me !== thread.authorId && this.me !== owner) {
      throw refuse('PT403', 'only the thread author or the proposal author may resolve it')
    }
    thread.resolvedAt = input.resolved ? this.now() : null
    thread.resolvedBy = input.resolved ? this.me : null
  }

  async setExpenseShare(input: { proposalId: string; optedIn: boolean }): Promise<void> {
    this.calls.push('setExpenseShare')
    const row = this.row(input.proposalId)
    if (row.status === 'completed')
      throw refuse('PT409', 'the expense is frozen once the proposal is done')
    const shares = (this.shares[row.id] ??= new Map())
    shares.set(this.me, input.optedIn)
    row.updatedAt = this.now()
  }

  async addPayment(input: { id: string; proposalId: string; cents: number }): Promise<void> {
    this.calls.push('addPayment')
    const row = this.row(input.proposalId)
    if (input.cents <= 0) throw refuse('PT400', 'a payment needs an amount')
    const list = (this.payments[row.id] ??= [])
    if (list.some((payment) => payment.id === input.id)) return
    list.push({
      id: input.id,
      participantId: this.me,
      cents: input.cents,
      createdAt: this.now(),
    })
    row.updatedAt = this.now()
  }

  async removePayment(paymentId: string): Promise<void> {
    this.calls.push('removePayment')
    for (const [proposalId, list] of Object.entries(this.payments)) {
      const found = list.find((payment) => payment.id === paymentId)
      if (!found) continue
      if (found.participantId !== this.me) throw refuse('PT403', 'only your own payments')
      this.payments[proposalId] = list.filter((payment) => payment.id !== paymentId)
      return
    }
    throw refuse('PT404', 'unknown payment')
  }

  async history(input: { slug: string; limit?: number }): Promise<HistoryEntry[]> {
    this.calls.push('history')
    return this.agora(input.slug)
      .history.slice(-(input.limit ?? 50))
      .reverse()
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
    this.calls.push('attachImage')
    const row = this.row(input.proposalId)
    const list = (this.images[row.id] ??= [])
    if (list.length >= 10) throw refuse('PT400', 'at most 10 images per proposal')
    if (list.some((i) => i.id === input.id)) return
    list.push({
      id: input.id,
      path: input.path,
      thumbPath: input.thumbPath,
      width: input.width,
      height: input.height,
      position: list.length,
    })
    row.updatedAt = this.now()
  }

  private readonly shares: Record<string, Map<string, boolean>> = {}
  private readonly payments: Record<string, Proposal['payments']> = {}
  private readonly images: Record<string, Proposal['images']> = {}

  private row(proposalId: string): Row {
    const agora = this.byProposal(proposalId)
    const found = agora.proposals.find((p) => p.id === proposalId)
    if (!found) throw refuse('PT404', 'unknown proposal')
    return found
  }

  private threadAgora(threadId: string): Agora {
    for (const agora of this.agoras.values()) {
      if (agora.threads.some((t) => t.id === threadId)) return agora
    }
    throw refuse('PT404', 'unknown thread')
  }

  private log(agora: Agora, proposalId: string | null, type: string, description: string): void {
    agora.history.push({
      id: this.id('history'),
      proposalId,
      participantId: this.me,
      type,
      description,
      createdAt: this.now(),
    })
  }

  private resolveRow(agora: Agora, row: Row): void {
    const roundVotes = agora.votes.filter((v) => v.proposalId === row.id && v.round === row.round)
    const decided = resolve({
      status: row.status,
      tally: tally(roundVotes),
      participants: agora.participants.length,
      deadline: row.deadline,
      now: this.now(),
    })
    // In a secret agora an incomplete ballot yields no verdict, because the verdict *is* the
    // ballot: `resolve` decides from `net` alone, so with one vote cast the outcome is that one
    // person's vote, and the board named them through `pending` all through the round. A deadline
    // that arrives before everybody has voted therefore closes the proposal undecided. Mirrors the
    // branch in `agora.resolve_proposal`; the open mode keeps deciding on a partial ballot.
    //
    // `row.status === 'open'` is the guard `resolve_proposal` writes as `if v_status is distinct
    // from 'open' then return`. Without it this branch re-judges rows that are already finished:
    // `resolve` hands back a closed row's own status untouched, the branch overwrites it with
    // 'debating', and a creator-closed proposal loses its reason and gains a bogus history row on
    // every single read — and a 'completed' one falls back to 'debating' the moment somebody joins.
    const next =
      row.status === 'open' &&
      decided !== 'open' &&
      !agora.ballotOpen &&
      roundVotes.length < agora.participants.length
        ? 'debating'
        : decided
    if (next !== row.status) {
      row.status = next
      // Recorded here, at the transition, because this is when the roster is the one being judged
      // against. Read later it would be today's, which retracts a reveal every time somebody joins.
      row.resolvedRoster = agora.participants.length
      row.updatedAt = this.now()
      this.log(agora, row.id, 'resolved', next)
    }
  }

  private version(agora: Agora): string {
    const stamps = [
      ...agora.proposals.map((p) => p.updatedAt),
      ...agora.history.map((h) => h.createdAt),
      new Date(Date.UTC(2026, 0, 1)).toISOString(),
    ]
    return stamps.sort().at(-1) as string
  }

  private snapshot(agora: Agora, since: string | null): BoardSnapshot {
    // Lazy resolution, exactly like get_board: a passed deadline resolves on read.
    for (const row of agora.proposals) this.resolveRow(agora, row)

    const proposals: Proposal[] = agora.proposals
      .filter((row) => since === null || row.updatedAt > since)
      .map((row) => {
        const roundVotes = agora.votes.filter(
          (v) => v.proposalId === row.id && v.round === row.round,
        )
        // Revealed means revealed. A secret agora publishes nothing unless the ballot is
        // complete: `pending` names the non-voters all through the round, so anybody who opened the
        // board once before a deadline holds that list, and a partial reveal afterwards is exactly
        // their votes. Two reads pair names with values. Quorum is the state where that subtraction
        // has nothing to find, because everybody voted.
        // The roster as it was when the proposal closed, not as it is now. Against today's, an
        // `addParticipant` retracts a reveal that already happened — the exact bug this round's SQL
        // fix removes, and one a client-level test of the late-joiner case would otherwise encode.
        const complete = roundVotes.length >= (row.resolvedRoster ?? agora.participants.length)
        const revealed = row.status !== 'open' && (agora.ballotOpen || complete)
        // The count is public, the breakdown is not — while a secret round is open. `pending` names
        // who has not voted yet, so a breakdown that moves between two reads names the voter and
        // the sense together. `board_json` zeroes the three senses and `net` there, and the fake
        // exists to enforce what the database enforces: a client test that passed on a breakdown
        // the server never sends would be worth nothing. `resolveRow` above still uses the real
        // tally, because resolution is the server's own arithmetic, not something it publishes.
        // `resolveRow` above ran on the *unredacted* tally, and it has to: `QuorumResolver.resolve`
        // branches on `tally.net`, so handed the redacted one it would answer 'debating' for
        // everything. Anybody wiring that resolver into the client for optimistic resolution is
        // reaching for a tally that no longer carries a net — read the votes, not the payload.
        const published = tally(roundVotes)
        return {
          ...row,
          tally:
            agora.ballotOpen || revealed
              ? published
              : { up: 0, down: 0, abstain: 0, cast: published.cast, net: 0 },
          myVote: roundVotes.find((v) => v.participantId === this.me)?.value ?? null,
          votesRevealed: revealed,
          // Before quorum the sentiment is simply absent, not filtered later on — and a secret
          // agora drops the voter here, the shape `get_board` sends, so no test above this class
          // can pass on attribution the real server never publishes.
          //
          // The order is deliberately *not* mirrored. The server sorts a secret reveal by `v.id`,
          // a v4 uuid, so that reading the board twice during the round and crossing the reveal
          // with the public `pending` list cannot reconstruct who voted what; this returns them in
          // cast order. Making it shuffle would only invite a client test to assert a reveal
          // order, and no screen up here has any business having an opinion about one. The
          // invariant is tested where it lives, in `tests/sql/0003_ballot_mode.sql:124-155`, with
          // a guard that fails if the fixture's two orders happen to agree and prove nothing.
          votes: revealed
            ? roundVotes.map((v) =>
                agora.ballotOpen
                  ? { participantId: v.participantId, value: v.value }
                  : { value: v.value },
              )
            : null,
          // Who still has to vote, and empty once a secret proposal is over. A deadline resolves a
          // partial ballot, and then `participants` minus `pending` is exactly the set of people who
          // voted, sitting in the same payload as the reveal: one missing name and one revealed
          // value publish each other. Both readers are already behind a `status === 'open'` guard.
          // Keyed to the proposal's own state, never to `revealed`: a partial secret ballot is
          // unrevealed *and* over, and that is precisely the case where naming the non-voters hands
          // back the voter set. The SQL says `pr.ballot_open or pr.status = 'open'` for the same reason.
          pending:
            agora.ballotOpen || row.status === 'open'
              ? agora.participants
                  .filter((p) => !roundVotes.some((v) => v.participantId === p.id))
                  .map((p) => p.id)
              : [],
          images: this.images[row.id] ?? [],
          shares: [...(this.shares[row.id]?.entries() ?? [])].map(([participantId, optedIn]) => ({
            participantId,
            optedIn,
          })),
          payments: this.payments[row.id] ?? [],
        }
      })

    const me = agora.participants.find((p) => p.id === this.me) ?? agora.participants[0]
    return {
      version: this.version(agora),
      group: { id: agora.id, slug: agora.slug, name: agora.name, ballotOpen: agora.ballotOpen },
      me: me ?? { id: '', name: '' },
      participants: agora.participants,
      proposals: sortProposals(proposals),
      threads: agora.threads
        .filter((t) => since === null || t.createdAt > since)
        .map((t) => {
          const comments = agora.comments.filter((c) => c.threadId === t.id)
          return { ...t, commentCount: comments.length, comments: comments.slice(0, 3) }
        }),
      // Empty on purpose, exactly like the RPC: history is fetched, not shipped.
      history: [],
    }
  }
}
