export type ProposalStatus = 'open' | 'approved' | 'rejected' | 'debating' | 'completed' | 'closed'

export type VoteValue = 'up' | 'down' | 'abstain'

export interface VoteTally {
  up: number
  down: number
  abstain: number
  /** Votes emitted, abstentions included: this is what quorum counts. */
  cast: number
  /** up − down. Abstentions never move it. */
  net: number
}

export interface ProposalImage {
  id: string
  path: string
  thumbPath: string
  width: number
  height: number
  position: number
}

export interface ExpenseShare {
  participantId: string
  optedIn: boolean
}

export interface LiquidationSnapshot {
  id: string
  cents: number
  paidBy: string | null
  affects: string[]
  paidShares: string[]
  createdAt: string
}

export interface ProposalLink {
  toId: string
  kind: 'related' | 'supersedes'
}

export interface CastVote {
  participantId: string
  value: VoteValue
}

export interface Proposal {
  id: string
  groupId: string
  createdBy: string
  title: string
  description: string
  tags: string[]
  status: ProposalStatus
  round: number
  deadline: string | null
  closedReason: string | null
  estimatedCents: number | null
  actualCents: number | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  tally: VoteTally
  myVote: VoteValue | null
  /** False while voting: the server sends counts but no sentiment until quorum. */
  votesRevealed: boolean
  /** Null until quorum — the server omits it, the UI does not filter it. */
  votes: CastVote[] | null
  /** Participants who have not voted this round. A name, never a leaning. */
  pending: string[]
  images: ProposalImage[]
  shares: ExpenseShare[]
  liquidations: LiquidationSnapshot[]
  links: ProposalLink[]
}
