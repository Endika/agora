import { describe, it, expect } from 'vitest'
import { Money } from '@/domain/value-objects/Money'

describe('Money', () => {
  it('rejects negative amounts', () => {
    expect(() => Money.fromEuros(-1)).toThrow(/non-negative/)
  })
  it('rejects more than 2 decimals', () => {
    expect(() => Money.fromEuros(1.234)).toThrow(/2 decimals/)
  })
  it('rejects amounts above 999_999.99', () => {
    expect(() => Money.fromEuros(1_000_000)).toThrow(/maximum/)
  })
  it('stores integer cents', () => {
    expect(Money.fromEuros(12.34).cents).toBe(1234)
  })
  it('sums without floating-point drift', () => {
    const a = Money.fromEuros(0.1)
    const b = Money.fromEuros(0.2)
    expect(a.plus(b).toEuros()).toBe(0.3)
  })
  it('splits 100.00 among 3 without losing a cent (criterion 11)', () => {
    const parts = Money.fromEuros(100).splitInto(3)
    expect(parts.map((m) => m.cents)).toEqual([3334, 3333, 3333])
    expect(parts.reduce((sum, m) => sum + m.cents, 0)).toBe(10000)
  })
  it('divides into equal shares with rounding', () => {
    const shares = Money.fromEuros(10).splitInto(3)
    expect(shares.map((m) => m.cents)).toEqual([334, 333, 333])
    expect(shares.reduce((s, m) => s.plus(m), Money.fromEuros(0)).cents).toBe(1000)
  })
})
