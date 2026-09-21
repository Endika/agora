import { describe, it, expect } from 'vitest'
import { parseBoard } from '@/infrastructure/persistence/schemas'

const board = {
  version: '2026-09-01T10:00:00.000Z',
  group: { id: 'g', slug: 'abcd1234', name: 'Cuadrilla' },
  me: { id: 'p1', name: 'alice' },
  participants: [{ id: 'p1', name: 'alice' }],
  proposals: [
    {
      id: 'pr1',
      groupId: 'g',
      createdBy: 'p1',
      title: 'Trip to the coast',
      description: '',
      tags: [],
      status: 'open',
      round: 1,
      deadline: null,
      closedReason: null,
      estimatedCents: null,
      actualCents: null,
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
      completedAt: null,
      tally: { up: 0, down: 0, abstain: 0, cast: 0, net: 0 },
      myVote: null,
      votesRevealed: false,
      votes: null,
      pending: ['p1'],
      images: [],
      shares: [],
      payments: [],
      links: [],
    },
  ],
  threads: [],
  history: [],
}

describe('parseBoard', () => {
  it('accepts the payload the rpc returns', () => {
    expect(parseBoard(board).proposals[0]!.title).toBe('Trip to the coast')
  })

  it('rejects a status in Spanish, because the wire protocol is English', () => {
    const spanish = { ...board, proposals: [{ ...board.proposals[0], status: 'aprobada' }] }
    expect(() => parseBoard(spanish)).toThrow()
  })

  it('rejects a payload that carries vote values with no reveal flag set', () => {
    const broken = { ...board, proposals: [{ ...board.proposals[0], votes: 'nope' }] }
    expect(() => parseBoard(broken)).toThrow()
  })

  // The three constraints the zod/mini translation had to carry over by hand, and the three ways
  // that translation could have quietly loosened the contract.
  it('rejects a round that is not positive', () => {
    const zero = { ...board, proposals: [{ ...board.proposals[0], round: 0 }] }
    expect(() => parseBoard(zero)).toThrow()
  })

  it('rejects a cent amount that is not a whole number', () => {
    const fraction = { ...board, proposals: [{ ...board.proposals[0], estimatedCents: 10.5 }] }
    expect(() => parseBoard(fraction)).toThrow()
  })

  it('takes null where the contract allows it, and nothing else', () => {
    expect(parseBoard(board).proposals[0]!.deadline).toBeNull()
    const wrong = { ...board, proposals: [{ ...board.proposals[0], deadline: 5 }] }
    expect(() => parseBoard(wrong)).toThrow()
  })
})
