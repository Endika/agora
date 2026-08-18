import { describe, it, expect } from 'vitest'
import { sortProposals } from '@/domain/services/ProposalSorter'
import { makeProposal, votes } from '../support/makeProposal'

const higherNet = makeProposal({
  id: 'higher-net',
  status: 'approved',
  tally: votes(3, 0),
  createdAt: '2026-09-03T10:00:00.000Z',
})
const older = makeProposal({
  id: 'older',
  status: 'approved',
  tally: votes(1, 0),
  createdAt: '2026-09-01T10:00:00.000Z',
})
const newerSameNet = makeProposal({
  id: 'newer-same-net',
  status: 'approved',
  tally: votes(1, 0),
  createdAt: '2026-09-02T10:00:00.000Z',
})
const openOne = makeProposal({ id: 'open-one', status: 'open' })
const debating = makeProposal({
  id: 'debating',
  status: 'debating',
  createdAt: '2026-09-04T10:00:00.000Z',
})
const done = makeProposal({
  id: 'done',
  status: 'completed',
  completedAt: '2026-09-05T10:00:00.000Z',
})
const rejected = makeProposal({ id: 'rejected', status: 'rejected' })

describe('sortProposals', () => {
  const expected = [
    'higher-net',
    'older',
    'newer-same-net',
    'open-one',
    'debating',
    'done',
    'rejected',
  ]

  it('orders approved by net then by age, and buckets the rest below', () => {
    expect(
      sortProposals([older, newerSameNet, higherNet, openOne, debating, done, rejected]).map(
        (p) => p.id,
      ),
    ).toEqual(expected)
  })

  it('is stable whatever order it receives, so a reload never reshuffles', () => {
    expect(
      sortProposals([rejected, done, debating, openOne, higherNet, newerSameNet, older]).map(
        (p) => p.id,
      ),
    ).toEqual(expected)
  })

  it('breaks a full tie by id so the order can never depend on chance', () => {
    const a = makeProposal({ id: 'a', status: 'approved', tally: votes(1, 0) })
    const b = makeProposal({ id: 'b', status: 'approved', tally: votes(1, 0) })
    expect(sortProposals([b, a]).map((p) => p.id)).toEqual(['a', 'b'])
  })
})
