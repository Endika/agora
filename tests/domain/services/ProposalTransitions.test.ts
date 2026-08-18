import { describe, it, expect } from 'vitest'
import {
  canClose,
  canComplete,
  canReopen,
  canVote,
  validateCloseReason,
} from '@/domain/services/ProposalTransitions'
import { makeProposal } from '../support/makeProposal'

describe('ProposalTransitions', () => {
  const debating = makeProposal({ id: 'p', status: 'debating', createdBy: 'alice' })

  it('lets only the creator reopen or close a tie', () => {
    expect(canReopen(debating, 'alice')).toBe(true)
    expect(canReopen(debating, 'bob')).toBe(false)
    expect(canClose(debating, 'bob')).toBe(false)
  })

  it('offers neither on a proposal that is not in debate', () => {
    const approved = makeProposal({ id: 'p', status: 'approved', createdBy: 'alice' })
    expect(canReopen(approved, 'alice')).toBe(false)
    expect(canClose(approved, 'alice')).toBe(false)
  })

  it('marks as done only what was approved', () => {
    expect(canComplete(makeProposal({ id: 'p', status: 'approved' }))).toBe(true)
    expect(canComplete(debating)).toBe(false)
  })

  it('freezes the vote outside open', () => {
    expect(canVote(makeProposal({ id: 'p', status: 'open' }))).toBe(true)
    expect(canVote(debating)).toBe(false)
  })

  it('refuses a close reason under 10 characters, whitespace not counted', () => {
    expect(() => validateCloseReason('   too few  ')).toThrow(/10/)
    expect(() => validateCloseReason('long enough reason')).not.toThrow()
  })
})
