const MAX_CENTS = 99_999_999

export class Money {
  private constructor(readonly cents: number) {}

  static fromEuros(euros: number): Money {
    if (euros < 0) throw new Error('Money: amount must be non-negative')
    if (!Number.isFinite(euros)) throw new Error('Money: amount must be finite')
    const cents = Math.round(euros * 100)
    if (Math.abs(cents / 100 - euros) > 1e-9) throw new Error('Money: at most 2 decimals')
    if (cents > MAX_CENTS) throw new Error('Money: maximum 999999.99')
    return new Money(cents)
  }

  static fromCents(cents: number): Money {
    if (!Number.isInteger(cents) || cents < 0) throw new Error('Money: invalid cents')
    if (cents > MAX_CENTS) throw new Error('Money: maximum 999999.99')
    return new Money(cents)
  }

  plus(other: Money): Money {
    return Money.fromCents(this.cents + other.cents)
  }

  minus(other: Money): Money {
    return Money.fromCents(Math.max(0, this.cents - other.cents))
  }

  toEuros(): number {
    return this.cents / 100
  }

  splitInto(n: number): Money[] {
    if (!Number.isInteger(n) || n <= 0) throw new Error('Money: split count must be positive int')
    const base = Math.floor(this.cents / n)
    const remainder = this.cents - base * n
    return Array.from({ length: n }, (_, i) => Money.fromCents(base + (i < remainder ? 1 : 0)))
  }
}
