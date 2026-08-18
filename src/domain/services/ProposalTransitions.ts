import type { Proposal } from '@/domain/entities/Proposal'

export const canReopen = (p: Proposal, actorId: string): boolean =>
  p.status === 'debating' && p.createdBy === actorId

export const canClose = (p: Proposal, actorId: string): boolean =>
  p.status === 'debating' && p.createdBy === actorId

export const canComplete = (p: Proposal): boolean => p.status === 'approved'

export const canVote = (p: Proposal): boolean => p.status === 'open'

export function validateCloseReason(reason: string): void {
  if (reason.trim().length < 10) throw new Error('closeReason: at least 10 characters')
}
