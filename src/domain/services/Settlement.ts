import { Money } from '@/domain/value-objects/Money'

export interface Payment {
  id: string
  participantId: string
  cents: number
  createdAt: string
}

export interface Balance {
  participantId: string
  /** What this person owes: the total split between whoever is in. */
  shareCents: number
  paidCents: number
  /** Positive: still to pay. Negative: they put in more than their share. */
  leftCents: number
}

export interface Settlement {
  totalCents: number
  paidCents: number
  leftCents: number
  balances: Balance[]
}

/**
 * What each person owes and what they have already put in.
 *
 * The model is the one a group actually uses: a total, the people it is split between, and payments made
 * against your own share — so "I put in 100 of my 500" is a fact the app can state, rather than something
 * you work out from a list of transactions.
 *
 * The split is cent-exact through `Money.splitInto`: the remainder is handed out one cent at a time, so the
 * shares always add back up to the total.
 */
export function settle(input: {
  totalCents: number | null
  optedIn: string[]
  payments: Payment[]
}): Settlement {
  const { totalCents, optedIn, payments } = input
  if (totalCents === null || optedIn.length === 0) {
    const paid = payments.reduce((sum, payment) => sum + payment.cents, 0)
    return {
      totalCents: totalCents ?? 0,
      paidCents: paid,
      leftCents: (totalCents ?? 0) - paid,
      balances: [],
    }
  }

  const shares = Money.fromCents(totalCents).splitInto(optedIn.length)
  const balances = optedIn.map((participantId, index) => {
    const shareCents = shares[index]!.cents
    const paidCents = payments
      .filter((payment) => payment.participantId === participantId)
      .reduce((sum, payment) => sum + payment.cents, 0)
    return { participantId, shareCents, paidCents, leftCents: shareCents - paidCents }
  })

  // Payments from people who are not in the split still count towards the total: somebody paying for the
  // group is a favour, not an accounting error.
  const paidCents = payments.reduce((sum, payment) => sum + payment.cents, 0)
  return { totalCents, paidCents, leftCents: totalCents - paidCents, balances }
}
