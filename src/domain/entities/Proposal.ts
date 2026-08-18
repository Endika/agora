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
}
