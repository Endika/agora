import { describe, it, expect } from 'vitest'
import { settle } from '@/domain/services/Settlement'

describe('settle', () => {
  it('splits the total between whoever is in, cent-exact', () => {
    const result = settle({ totalCents: 100_000, optedIn: ['a', 'b', 'c'], payments: [] })
    expect(result.balances.map((balance) => balance.shareCents)).toEqual([33334, 33333, 33333])
    expect(result.balances.reduce((sum, balance) => sum + balance.shareCents, 0)).toBe(100_000)
  })

  it('answers the question people actually ask: how much is left of mine', () => {
    // 1000 € between two is 500 each; putting in 100 leaves 400.
    const result = settle({
      totalCents: 100_000,
      optedIn: ['a', 'b'],
      payments: [
        { id: 'p1', participantId: 'a', cents: 10_000, createdAt: '2026-09-01T10:00:00.000Z' },
      ],
    })
    const a = result.balances.find((balance) => balance.participantId === 'a')!
    expect(a).toMatchObject({ shareCents: 50_000, paidCents: 10_000, leftCents: 40_000 })
    expect(result.balances.find((balance) => balance.participantId === 'b')!.leftCents).toBe(50_000)
  })

  it('adds several payments from the same person', () => {
    const result = settle({
      totalCents: 60_000,
      optedIn: ['a', 'b'],
      payments: [
        { id: 'p1', participantId: 'a', cents: 10_000, createdAt: '2026-09-01T10:00:00.000Z' },
        { id: 'p2', participantId: 'a', cents: 5_000, createdAt: '2026-09-02T10:00:00.000Z' },
      ],
    })
    expect(result.balances[0]).toMatchObject({ paidCents: 15_000, leftCents: 15_000 })
  })

  it('says when somebody put in more than their share', () => {
    const result = settle({
      totalCents: 10_000,
      optedIn: ['a', 'b'],
      payments: [
        { id: 'p1', participantId: 'a', cents: 10_000, createdAt: '2026-09-01T10:00:00.000Z' },
      ],
    })
    expect(result.balances[0]!.leftCents).toBe(-5_000)
    expect(result.leftCents).toBe(0)
  })

  it('counts a payment from somebody outside the split towards the total', () => {
    const result = settle({
      totalCents: 10_000,
      optedIn: ['a'],
      payments: [
        { id: 'p1', participantId: 'z', cents: 4_000, createdAt: '2026-09-01T10:00:00.000Z' },
      ],
    })
    expect(result.paidCents).toBe(4_000)
    expect(result.leftCents).toBe(6_000)
    expect(result.balances[0]!.leftCents).toBe(10_000)
  })

  it('has nothing to split when nobody is in', () => {
    expect(settle({ totalCents: 10_000, optedIn: [], payments: [] }).balances).toEqual([])
  })
})
