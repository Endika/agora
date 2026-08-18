import type { Proposal, VoteValue } from '@/domain/entities/Proposal'

export interface Participant {
  id: string
  name: string
}

export interface Comment {
  id: string
  authorId: string
  body: string
  createdAt: string
}

export interface Thread {
  id: string
  proposalId: string
  authorId: string
  resolvedAt: string | null
  resolvedBy: string | null
  createdAt: string
  commentCount: number
  /** Capped at three by the server; the rest arrives when someone opens the thread. */
  comments: Comment[]
}

export interface HistoryEntry {
  id: string
  proposalId: string | null
  participantId: string | null
  type: string
  description: string
  createdAt: string
}

export interface BoardSnapshot {
  /** Server-side watermark. The client compares it before asking for anything bigger. */
  version: string
  group: { id: string; slug: string; name: string }
  me: Participant
  participants: Participant[]
  proposals: Proposal[]
  threads: Thread[]
  history: HistoryEntry[]
}

export interface NewProposal {
  title: string
  description?: string
  deadline?: string | null
  estimatedCents?: number | null
  tags?: string[]
  links?: { toId: string; kind: 'related' | 'supersedes' }[]
}

export interface Identity {
  slug: string
  participantId: string
}

/** What someone opening the link sees before we know who they are: names, and nothing else. */
export interface AgoraPreview {
  slug: string
  name: string
  participants: Participant[]
}

/** Deleting is confirmed by typing the agora's name, so a mismatch is an outcome, not a crash. */
export type DeleteResult = { ok: true } | { ok: false; error: 'name_mismatch' }

export interface BoardRepository {
  createAgora(input: { name: string; creatorName: string }): Promise<Identity>
  preview(slug: string): Promise<AgoraPreview>
  /** "That one is me": points an existing name at this device. */
  claim(input: { slug: string; participantId: string }): Promise<Identity>
  /** "I am not on the list": adds a name to the agora. */
  addParticipant(input: { slug: string; name: string }): Promise<Identity>
  deleteAgora(input: { slug: string; confirmName: string }): Promise<DeleteResult>

  getVersion(slug: string): Promise<string>
  getBoard(slug: string): Promise<BoardSnapshot>
  getBoardSince(slug: string, since: string): Promise<BoardSnapshot>

  createProposal(input: { slug: string } & NewProposal): Promise<string>
  updateProposal(input: { proposalId: string } & Partial<NewProposal>): Promise<void>
  castVote(input: { proposalId: string; round: number; value: VoteValue }): Promise<void>
  reopenProposal(proposalId: string): Promise<void>
  closeProposal(input: { proposalId: string; reason: string }): Promise<void>
  completeProposal(input: { proposalId: string; actualCents: number | null }): Promise<void>

  addThread(input: {
    threadId: string
    proposalId: string
    commentId: string
    body: string
  }): Promise<void>
  addComment(input: { commentId: string; threadId: string; body: string }): Promise<void>
  setThreadResolved(input: { threadId: string; resolved: boolean }): Promise<void>

  setExpenseShare(input: { proposalId: string; optedIn: boolean }): Promise<void>
  addLiquidation(input: {
    id: string
    proposalId: string
    cents: number
    affects: string[]
  }): Promise<void>
  setLiquidationSharePaid(input: {
    liquidationId: string
    participantId: string
    paid: boolean
  }): Promise<void>
  attachImage(input: {
    id: string
    proposalId: string
    path: string
    thumbPath: string
    width: number
    height: number
    bytes: number
  }): Promise<void>
}
