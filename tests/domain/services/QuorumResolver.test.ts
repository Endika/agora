import { describe, it, expect } from 'vitest'
import { hasQuorum, resolve } from '@/domain/services/QuorumResolver'
import { votes } from '../support/makeProposal'

const NOW = '2026-09-01T10:00:00.000Z'
const YESTERDAY = '2026-08-31T10:00:00.000Z'

describe('QuorumResolver', () => {
  it('counts abstentions for quorum but not for the net, so 1 up + 3 abstain approves', () => {
    const t = votes(1, 0, 3)
    expect(t.net).toBe(1)
    expect(t.cast).toBe(4)
    expect(resolve({ status: 'open', tally: t, participants: 4, deadline: null, now: NOW })).toBe(
      'approved',
    )
  })

  it('sends a tie to debating', () => {
    expect(
      resolve({ status: 'open', tally: votes(2, 2), participants: 4, deadline: null, now: NOW }),
    ).toBe('debating')
  })

  it('rejects when the net is negative', () => {
    expect(
      resolve({ status: 'open', tally: votes(1, 3), participants: 4, deadline: null, now: NOW }),
    ).toBe('rejected')
  })

  it('stays open while someone has not voted and there is no deadline', () => {
    expect(
      resolve({ status: 'open', tally: votes(2, 0), participants: 4, deadline: null, now: NOW }),
    ).toBe('open')
  })

  it('reaches quorum on a passed deadline with partial votes', () => {
    expect(hasQuorum({ cast: 2, participants: 4, deadline: YESTERDAY, now: NOW })).toBe(true)
    expect(
      resolve({
        status: 'open',
        tally: votes(0, 2),
        participants: 4,
        deadline: YESTERDAY,
        now: NOW,
      }),
    ).toBe('rejected')
  })

  it('never re-resolves a proposal that already left open', () => {
    expect(
      resolve({
        status: 'completed',
        tally: votes(3, 0),
        participants: 3,
        deadline: null,
        now: NOW,
      }),
    ).toBe('completed')
  })
})
