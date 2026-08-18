import { uuidv7 } from 'uuidv7'
import { Money } from '@/domain/value-objects/Money'

export interface ManualLiquidationSnapshot {
  id: string
  proposalId: string
  cents: number
  /** null = pending (nobody fronted it); a participantId = that person advanced the full amount. */
  paidBy: string | null
  /** Participants the cost is split among. Empty array means "everyone who opted in". */
  affects: string[]
  /** Affected participants whose share was hand-marked paid (the payer's own share is implicit). */
  paidShares: string[]
  createdAt: string
}

export class ManualLiquidation {
  private constructor(private readonly s: ManualLiquidationSnapshot) {}

  private static validate(amount: Money, affects: string[], paidShares: string[]): void {
    if (amount.cents <= 0) throw new Error('ManualLiquidation: amount must be > 0')
    if (new Set(affects).size !== affects.length)
      throw new Error('ManualLiquidation: affects must contain unique participantIds')
    if (new Set(paidShares).size !== paidShares.length)
      throw new Error('ManualLiquidation: paidShares must contain unique participantIds')
    if (affects.length > 0) {
      const set = new Set(affects)
      for (const id of paidShares)
        if (!set.has(id))
          throw new Error('ManualLiquidation: paidShares must be a subset of affects')
    }
  }

  static create(input: {
    proposalId: string
    amount: Money
    paidBy: string | null
    affects: string[]
  }): ManualLiquidation {
    ManualLiquidation.validate(input.amount, input.affects, [])
    return new ManualLiquidation({
      id: uuidv7(),
      proposalId: input.proposalId,
      cents: input.amount.cents,
      paidBy: input.paidBy,
      affects: [...input.affects],
      paidShares: [],
      createdAt: new Date().toISOString(),
    })
  }

  static restore(s: ManualLiquidationSnapshot): ManualLiquidation {
    ManualLiquidation.validate(Money.fromCents(s.cents), s.affects, s.paidShares)
    return new ManualLiquidation({ ...s, affects: [...s.affects], paidShares: [...s.paidShares] })
  }

  edit(input: { amount: Money; paidBy: string | null; affects: string[] }): ManualLiquidation {
    // Dropping someone from affects must drop their paid mark too, or the view would count a
    // share nobody owes any more.
    const nextPaidShares = this.s.paidShares.filter(
      (id) => input.affects.length === 0 || input.affects.includes(id),
    )
    ManualLiquidation.validate(input.amount, input.affects, nextPaidShares)
    return new ManualLiquidation({
      ...this.s,
      cents: input.amount.cents,
      paidBy: input.paidBy,
      affects: [...input.affects],
      paidShares: nextPaidShares,
    })
  }

  toggleShare(participantId: string): ManualLiquidation {
    const paid = this.s.paidShares.includes(participantId)
    return new ManualLiquidation({
      ...this.s,
      paidShares: paid
        ? this.s.paidShares.filter((id) => id !== participantId)
        : [...this.s.paidShares, participantId],
    })
  }

  get id(): string {
    return this.s.id
  }

  get proposalId(): string {
    return this.s.proposalId
  }

  toSnapshot(): ManualLiquidationSnapshot {
    return { ...this.s, affects: [...this.s.affects], paidShares: [...this.s.paidShares] }
  }
}
