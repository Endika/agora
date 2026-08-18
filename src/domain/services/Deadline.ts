export type DeadlineState =
  { kind: 'none' } | { kind: 'passed' } | { kind: 'today' } | { kind: 'days'; days: number }

const DAY = 24 * 60 * 60 * 1000

/**
 * How much time a vote has left, in the terms people use: "3 days", "today", or "the deadline passed".
 * Whole days by calendar day, not by 24-hour blocks — "tomorrow" should not read as "1 day" at 23:00.
 */
export function deadlineState(deadline: string | null, now: string): DeadlineState {
  if (deadline === null) return { kind: 'none' }

  const startOfDay = (value: string) => {
    const date = new Date(value)
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  }

  const days = Math.round((startOfDay(deadline) - startOfDay(now)) / DAY)
  if (Date.parse(now) > Date.parse(deadline)) return { kind: 'passed' }
  if (days <= 0) return { kind: 'today' }
  return { kind: 'days', days }
}
