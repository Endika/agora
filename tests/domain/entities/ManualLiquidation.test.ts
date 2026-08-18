import { describe, it, expect } from 'vitest'
import { ManualLiquidation } from '@/domain/entities/ManualLiquidation'
import { Money } from '@/domain/value-objects/Money'

describe('ManualLiquidation', () => {
  const base = {
    proposalId: 'p-house-deposit',
    amount: Money.fromEuros(400),
    paidBy: 'u-javi',
    affects: ['u-javi', 'u-endika', 'u-marta', 'u-iker'],
  }

  it('creates a pending liquidation when nobody fronted the money', () => {
    const s = ManualLiquidation.create({ ...base, paidBy: null }).toSnapshot()
    expect(s.paidBy).toBeNull()
    expect(s.cents).toBe(40000)
    expect(s.paidShares).toEqual([])
  })

  it('rejects a non-positive amount', () => {
    expect(() => ManualLiquidation.create({ ...base, amount: Money.fromCents(0) })).toThrow(/> 0/)
  })

  it('rejects duplicate participants in affects', () => {
    expect(() => ManualLiquidation.create({ ...base, affects: ['a', 'a'] })).toThrow(/unique/i)
  })

  it('toggles a share paid then unpaid', () => {
    const liq = ManualLiquidation.create(base).toggleShare('u-endika')
    expect(liq.toSnapshot().paidShares).toEqual(['u-endika'])
    expect(liq.toggleShare('u-endika').toSnapshot().paidShares).toEqual([])
  })

  it('drops the paid mark of whoever leaves affects on edit', () => {
    const liq = ManualLiquidation.create(base).toggleShare('u-iker')
    const edited = liq.edit({
      amount: Money.fromEuros(400),
      paidBy: 'u-javi',
      affects: ['u-javi', 'u-endika', 'u-marta'],
    })
    expect(edited.toSnapshot().paidShares).toEqual([])
  })

  it('refuses a snapshot whose paid shares are not among the affected', () => {
    const s = ManualLiquidation.create(base).toSnapshot()
    expect(() => ManualLiquidation.restore({ ...s, paidShares: ['u-nobody'] })).toThrow(/subset/i)
  })
})
