import { describe, it, expect } from 'vitest'
import { parseBoard } from '@/infrastructure/persistence/schemas'

const board = {
  version: '2026-09-01T10:00:00.000Z',
  group: { id: 'g', slug: 'abcd1234', name: 'Cuadrilla', ballotOpen: true },
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

  it('carries the agora ballot mode, which the board reads to decide what it promises', () => {
    expect(parseBoard(board).group.ballotOpen).toBe(true)
    const secret = { ...board, group: { ...board.group, ballotOpen: false } }
    expect(parseBoard(secret).group.ballotOpen).toBe(false)
  })

  // A secret agora's resolved proposal ships senses with no voter attached. Required here, the
  // whole board would fail to parse and the app would show nothing at all.
  it('accepts a resolved vote with no participant, the shape a secret agora sends', () => {
    const resolved = {
      ...board,
      group: { ...board.group, ballotOpen: false },
      proposals: [
        {
          ...board.proposals[0],
          status: 'approved',
          votesRevealed: true,
          votes: [{ value: 'up' }, { value: 'abstain' }],
          pending: [],
        },
      ],
    }
    const votes = parseBoard(resolved).proposals[0]!.votes!
    expect(votes.map((vote) => vote.value)).toEqual(['up', 'abstain'])
    expect(votes.every((vote) => vote.participantId === undefined)).toBe(true)
  })

  it('still carries the voter when the agora is open', () => {
    const resolved = {
      ...board,
      proposals: [
        {
          ...board.proposals[0],
          status: 'approved',
          votesRevealed: true,
          votes: [{ participantId: 'p1', value: 'up' }],
          pending: [],
        },
      ],
    }
    expect(parseBoard(resolved).proposals[0]!.votes![0]!.participantId).toBe('p1')
  })

  it('takes null where the contract allows it, and nothing else', () => {
    expect(parseBoard(board).proposals[0]!.deadline).toBeNull()
    const wrong = { ...board, proposals: [{ ...board.proposals[0], deadline: 5 }] }
    expect(() => parseBoard(wrong)).toThrow()
  })
})
