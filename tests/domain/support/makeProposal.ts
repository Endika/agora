import type { Proposal, ProposalStatus, VoteTally } from '@/domain/entities/Proposal'
import { tally } from '@/domain/services/QuorumResolver'

export const votes = (up: number, down: number, abstain = 0): VoteTally =>
  tally([
    ...Array.from({ length: up }, () => ({ value: 'up' as const })),
    ...Array.from({ length: down }, () => ({ value: 'down' as const })),
    ...Array.from({ length: abstain }, () => ({ value: 'abstain' as const })),
  ])

export function makeProposal(overrides: Partial<Proposal> & { id: string }): Proposal {
  return {
    groupId: 'g-1',
    createdBy: 'alice',
    title: 'A proposal',
    description: '',
    tags: [],
    status: 'open' as ProposalStatus,
    round: 1,
    deadline: null,
    closedReason: null,
    estimatedCents: null,
    actualCents: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    completedAt: null,
    tally: votes(0, 0),
    myVote: null,
    votesRevealed: false,
    votes: null,
    pending: [],
    images: [],
    shares: [],
    payments: [],
    links: [],
    ...overrides,
  }
}
