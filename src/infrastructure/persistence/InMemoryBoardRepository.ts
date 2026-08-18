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
}

interface Agora {
  id: string
  slug: string
  name: string
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

  private id(prefix: string): string {
    this.seq += 1
    return `${prefix}-${this.seq}`
  }

  private agora(slug: string): Agora {
    const found = this.agoras.get(slug)
    if (!found) throw new Error('unknown agora')
    return found
  }

  private byProposal(proposalId: string): Agora {
    for (const agora of this.agoras.values()) {
      if (agora.proposals.some((p) => p.id === proposalId)) return agora
    }
    throw new Error('unknown proposal')
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

  async createAgora(input: { name: string; creatorName: string }): Promise<Identity> {
    this.calls.push('createAgora')
    const slug = this.id('slug')
    const meId = this.id('participant')
    this.agoras.set(slug, {
      id: this.id('agora'),
      slug,
      name: input.name,
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
      throw new Error('unknown participant')
    }
    this.me = input.participantId
    return { slug: input.slug, participantId: input.participantId }
  }

  async addParticipant(input: { slug: string; name: string }): Promise<Identity> {
    this.calls.push('addParticipant')
    const agora = this.agora(input.slug)
    const name = input.name.trim()
    if (name.length === 0) throw new Error('a participant needs a name')
    if (agora.participants.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('name taken')
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
      createdAt: stamp,
      updatedAt: stamp,
      completedAt: null,
    })
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
    if (row.status !== 'open') throw new Error('the vote is closed')
    if (row.round !== input.round) throw new Error('stale round')

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
    if (row.status !== 'debating') throw new Error('not in debate')
    if (row.createdBy !== this.me) throw new Error('only the creator may reopen')
    row.round += 1
    row.status = 'open'
    row.updatedAt = this.now()
    this.log(agora, row.id, 'reopened', '')
  }

  async closeProposal(input: { proposalId: string; reason: string }): Promise<void> {
    this.calls.push('closeProposal')
    const agora = this.byProposal(input.proposalId)
    const row = this.row(input.proposalId)
    if (row.status !== 'debating') throw new Error('not in debate')
    if (row.createdBy !== this.me) throw new Error('only the creator may close')
    if (input.reason.trim().length < 10)
      throw new Error('a closing reason needs at least 10 characters')
    row.status = 'closed'
    row.closedReason = input.reason
    row.updatedAt = this.now()
    this.log(agora, row.id, 'closed', input.reason)
  }

  async completeProposal(input: { proposalId: string; actualCents: number | null }): Promise<void> {
    this.calls.push('completeProposal')
    const agora = this.byProposal(input.proposalId)
    const row = this.row(input.proposalId)
    if (row.status !== 'approved') throw new Error('only an approved proposal can be marked done')
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

  async setThreadResolved(input: { threadId: string; resolved: boolean }): Promise<void> {
    this.calls.push('setThreadResolved')
    const agora = this.threadAgora(input.threadId)
    const thread = agora.threads.find((t) => t.id === input.threadId)
    if (!thread) throw new Error('unknown thread')
    const owner = this.row(thread.proposalId).createdBy
    if (this.me !== thread.authorId && this.me !== owner) {
      throw new Error('only the thread author or the proposal author may resolve it')
    }
    thread.resolvedAt = input.resolved ? this.now() : null
    thread.resolvedBy = input.resolved ? this.me : null
  }

  async setExpenseShare(input: { proposalId: string; optedIn: boolean }): Promise<void> {
    this.calls.push('setExpenseShare')
    const row = this.row(input.proposalId)
    if (row.status === 'completed')
      throw new Error('the expense is frozen once the proposal is done')
    const shares = (this.shares[row.id] ??= new Map())
    shares.set(this.me, input.optedIn)
    row.updatedAt = this.now()
  }

  async addLiquidation(input: {
    id: string
    proposalId: string
    cents: number
    affects: string[]
  }): Promise<void> {
    this.calls.push('addLiquidation')
    const row = this.row(input.proposalId)
    const list = (this.liquidations[row.id] ??= [])
    if (list.some((l) => l.id === input.id)) return
    list.push({
      id: input.id,
      cents: input.cents,
      paidBy: this.me,
      affects: [...input.affects],
      paidShares: [],
      createdAt: this.now(),
    })
    row.updatedAt = this.now()
  }

  async setLiquidationSharePaid(input: {
    liquidationId: string
    participantId: string
    paid: boolean
  }): Promise<void> {
    this.calls.push('setLiquidationSharePaid')
    for (const list of Object.values(this.liquidations)) {
      const found = list.find((l) => l.id === input.liquidationId)
      if (!found) continue
      const set = new Set(found.paidShares)
      if (input.paid) set.add(input.participantId)
      else set.delete(input.participantId)
      found.paidShares = [...set]
      return
    }
    throw new Error('unknown liquidation')
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
    if (list.length >= 10) throw new Error('at most 10 images per proposal')
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
  private readonly liquidations: Record<string, Proposal['liquidations']> = {}
  private readonly images: Record<string, Proposal['images']> = {}

  private row(proposalId: string): Row {
    const agora = this.byProposal(proposalId)
    const found = agora.proposals.find((p) => p.id === proposalId)
    if (!found) throw new Error('unknown proposal')
    return found
  }

  private threadAgora(threadId: string): Agora {
    for (const agora of this.agoras.values()) {
      if (agora.threads.some((t) => t.id === threadId)) return agora
    }
    throw new Error('unknown thread')
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
    const next = resolve({
      status: row.status,
      tally: tally(agora.votes.filter((v) => v.proposalId === row.id && v.round === row.round)),
      participants: agora.participants.length,
      deadline: row.deadline,
      now: this.now(),
    })
    if (next !== row.status) {
      row.status = next
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
        const revealed = row.status !== 'open'
        return {
          ...row,
          tally: tally(roundVotes),
          myVote: roundVotes.find((v) => v.participantId === this.me)?.value ?? null,
          votesRevealed: revealed,
          // Before quorum the sentiment is simply absent, not filtered later on.
          votes: revealed
            ? roundVotes.map((v) => ({ participantId: v.participantId, value: v.value }))
            : null,
          pending: agora.participants
            .filter((p) => !roundVotes.some((v) => v.participantId === p.id))
            .map((p) => p.id),
          images: this.images[row.id] ?? [],
          shares: [...(this.shares[row.id]?.entries() ?? [])].map(([participantId, optedIn]) => ({
            participantId,
            optedIn,
          })),
          liquidations: this.liquidations[row.id] ?? [],
        }
      })

    const me = agora.participants.find((p) => p.id === this.me) ?? agora.participants[0]
    return {
      version: this.version(agora),
      group: { id: agora.id, slug: agora.slug, name: agora.name },
      me: me ?? { id: '', name: '' },
      participants: agora.participants,
      proposals: sortProposals(proposals),
      threads: agora.threads
        .filter((t) => since === null || t.createdAt > since)
        .map((t) => {
          const comments = agora.comments.filter((c) => c.threadId === t.id)
          return { ...t, commentCount: comments.length, comments: comments.slice(0, 3) }
        }),
      history: agora.history.filter((h) => since === null || h.createdAt > since).slice(-50),
    }
  }
}
