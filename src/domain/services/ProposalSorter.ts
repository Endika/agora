import type { Proposal, ProposalStatus } from '@/domain/entities/Proposal'

const BUCKET: Record<ProposalStatus, number> = {
  approved: 0,
  open: 1,
  debating: 1,
  completed: 2,
  rejected: 3,
  closed: 3,
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/** Deterministic order; id ASC is the final tiebreak so a reload never reshuffles the list. */
export function sortProposals(list: Proposal[]): Proposal[] {
  return [...list].sort((a, b) => {
    const bucket = BUCKET[a.status] - BUCKET[b.status]
    if (bucket !== 0) return bucket
    switch (BUCKET[a.status]) {
      case 0:
        return b.tally.net - a.tally.net || cmp(a.createdAt, b.createdAt) || cmp(a.id, b.id)
      case 1:
        return cmp(a.createdAt, b.createdAt) || cmp(a.id, b.id)
      case 2:
        return cmp(b.completedAt ?? '', a.completedAt ?? '') || cmp(a.id, b.id)
      default:
        return cmp(b.createdAt, a.createdAt) || cmp(a.id, b.id)
    }
  })
}
