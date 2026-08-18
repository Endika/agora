export interface ManualShare {
  participantId: string
  cents: number
  paid: boolean
}

export interface ManualLiquidationView {
  totalCents: number
  paidCents: number
  pendingCents: number
  shares: ManualShare[]
}

interface ManualLiquidationLike {
  cents: number
  paidBy: string | null
  affects: string[]
  paidShares: string[]
}

export const ManualLiquidationSplitter = {
  compute(liq: ManualLiquidationLike, participantIds: string[]): ManualLiquidationView {
    const requested = liq.affects.filter((id) => participantIds.includes(id))
    const list = requested.length > 0 ? requested : participantIds
    const k = list.length
    if (k === 0) return { totalCents: 0, paidCents: 0, pendingCents: 0, shares: [] }

    const base = Math.floor(liq.cents / k)
    const remainder = liq.cents - base * k
    const paidSet = new Set(liq.paidShares)

    let paidCents = 0
    const shares: ManualShare[] = list.map((participantId, i) => {
      const cents = base + (i < remainder ? 1 : 0)
      const paid = participantId === liq.paidBy || paidSet.has(participantId)
      if (paid) paidCents += cents
      return { participantId, cents, paid }
    })

    return { totalCents: liq.cents, paidCents, pendingCents: liq.cents - paidCents, shares }
  },
}
