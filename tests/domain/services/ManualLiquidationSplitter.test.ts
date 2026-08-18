import { describe, it, expect } from 'vitest'
import { ManualLiquidationSplitter } from '@/domain/services/ManualLiquidationSplitter'

const participants = ['javi', 'endika', 'marta', 'iker']

describe('ManualLiquidationSplitter', () => {
  it('splits per head and auto-marks the payer share as paid', () => {
    const view = ManualLiquidationSplitter.compute(
      {
        cents: 40000,
        paidBy: 'javi',
        affects: ['javi', 'endika', 'marta', 'iker'],
        paidShares: [],
      },
      participants,
    )
    expect(view.totalCents).toBe(40000)
    expect(view.shares).toHaveLength(4)
    expect(view.shares.every((s) => s.cents === 10000)).toBe(true)
    const javi = view.shares.find((s) => s.participantId === 'javi')!
    expect(javi.paid).toBe(true) // payer auto-paid
    expect(view.shares.find((s) => s.participantId === 'endika')!.paid).toBe(false)
  })

  it('treats empty affects as all participants', () => {
    const view = ManualLiquidationSplitter.compute(
      { cents: 40000, paidBy: null, affects: [], paidShares: [] },
      participants,
    )
    expect(view.shares).toHaveLength(4)
  })

  it('distributes the remainder cent-perfectly', () => {
    const view = ManualLiquidationSplitter.compute(
      { cents: 100, paidBy: null, affects: ['a', 'b', 'c'], paidShares: [] },
      ['a', 'b', 'c'],
    )
    expect(view.shares.map((s) => s.cents).sort((x, y) => x - y)).toEqual([33, 33, 34])
    expect(view.shares.reduce((acc, s) => acc + s.cents, 0)).toBe(100)
  })

  it('reflects hand-marked paid shares', () => {
    const view = ManualLiquidationSplitter.compute(
      { cents: 40000, paidBy: null, affects: participants, paidShares: ['endika'] },
      participants,
    )
    expect(view.shares.find((s) => s.participantId === 'endika')!.paid).toBe(true)
    expect(view.paidCents).toBe(10000)
    expect(view.pendingCents).toBe(30000)
  })
})
