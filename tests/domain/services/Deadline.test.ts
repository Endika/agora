import { describe, it, expect } from 'vitest'
import { deadlineState } from '@/domain/services/Deadline'

const now = '2026-09-10T12:00:00.000Z'

describe('deadlineState', () => {
  it('counts whole days, not 24-hour blocks', () => {
    // Tomorrow at 09:00 is "1 day", even asked at midday: people count calendar days.
    expect(deadlineState('2026-09-11T09:00:00.000Z', now)).toEqual({ kind: 'days', days: 1 })
    expect(deadlineState('2026-09-13T23:59:00.000Z', now)).toEqual({ kind: 'days', days: 3 })
  })

  it('calls the last day the last day', () => {
    expect(deadlineState('2026-09-10T23:59:00.000Z', now)).toEqual({ kind: 'today' })
  })

  it('knows when it is over', () => {
    expect(deadlineState('2026-09-09T23:59:00.000Z', now)).toEqual({ kind: 'passed' })
    expect(deadlineState('2026-09-10T11:00:00.000Z', now)).toEqual({ kind: 'passed' })
  })

  it('says nothing when there is no deadline', () => {
    expect(deadlineState(null, now)).toEqual({ kind: 'none' })
  })
})
