import { useTranslation } from 'react-i18next'
import type { Participant } from '@/domain/repositories/BoardRepository'

/**
 * Naming who has not voted is what actually unblocks a vote in a small group — and it leaks nothing,
 * because a name is not a leaning.
 *
 * `compact` is for the card: a full name list is fine in the detail, one proposal at a time, but a
 * list of ten cards cannot each carry a growing wall of names. It caps at one name plus a count.
 */
export function MissingVoters({
  pending,
  participants,
  compact = false,
}: {
  pending: string[]
  participants: Participant[]
  compact?: boolean
}) {
  const { t } = useTranslation()
  const names = pending
    .map((id) => participants.find((p) => p.id === id)?.name)
    .filter((name): name is string => Boolean(name))

  const text = (() => {
    if (names.length === 0) return t('missing.none')
    if (!compact) return `${t('missing.heading')}: ${names.join(', ')}`
    if (names.length === 1) return t('missing.compactOne', { name: names[0] })
    return t('missing.compactMany', { name: names[0], count: names.length - 1 })
  })()

  return (
    <p className="text-sm" data-testid="missing-voters" style={{ color: 'var(--ink-muted)' }}>
      {text}
    </p>
  )
}
