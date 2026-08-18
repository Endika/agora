import type { ProposalStatus, VoteTally, VoteValue } from '@/domain/entities/Proposal'

export function tally(votes: { value: VoteValue }[]): VoteTally {
  const up = votes.filter((v) => v.value === 'up').length
  const down = votes.filter((v) => v.value === 'down').length
  const abstain = votes.filter((v) => v.value === 'abstain').length
  return { up, down, abstain, cast: up + down + abstain, net: up - down }
}

export function hasQuorum(input: {
  cast: number
  participants: number
  deadline: string | null
  now: string
}): boolean {
  if (input.participants > 0 && input.cast >= input.participants) return true
  return input.deadline !== null && Date.parse(input.now) > Date.parse(input.deadline)
}

/**
 * Mirror of agora.resolve_proposal in SQL. Both must agree; the SQL tests are what prove it.
 */
export function resolve(input: {
  status: ProposalStatus
  tally: VoteTally
  participants: number
  deadline: string | null
  now: string
}): ProposalStatus {
  if (input.status !== 'open') return input.status
  const quorum = hasQuorum({
    cast: input.tally.cast,
    participants: input.participants,
    deadline: input.deadline,
    now: input.now,
  })
  if (!quorum) return 'open'
  if (input.tally.net > 0) return 'approved'
  if (input.tally.net < 0) return 'rejected'
  return 'debating'
}
