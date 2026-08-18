import { useTranslation } from 'react-i18next'
import type { Participant } from '@/domain/repositories/BoardRepository'

/**
 * Naming who has not voted is what actually unblocks a vote in a small group — and it leaks nothing,
 * because a name is not a leaning.
 */
export function MissingVoters({
  pending,
  participants,
}: {
  pending: string[]
  participants: Participant[]
}) {
  const { t } = useTranslation()
  const names = pending
    .map((id) => participants.find((p) => p.id === id)?.name)
    .filter((name): name is string => Boolean(name))

  return (
    <p className="text-sm" data-testid="missing-voters" style={{ color: 'var(--ink-muted)' }}>
      {names.length === 0 ? t('missing.none') : `${t('missing.heading')}: ${names.join(', ')}`}
    </p>
  )
}
