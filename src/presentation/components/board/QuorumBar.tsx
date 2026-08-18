import { useTranslation } from 'react-i18next'
import type { Proposal } from '@/domain/entities/Proposal'
import { PsephoiRow } from '@/presentation/components/vote/PsephoiRow'

/** Counts and the deadline. Never a leaning: that is the psephoi row's business, and only at quorum. */
export function QuorumBar({
  proposal,
  participants,
}: {
  proposal: Proposal
  participants: number
}) {
  const { t, i18n } = useTranslation()
  const revealed = proposal.votes?.map((vote) => vote.value) ?? null

  return (
    <div className="grid gap-2">
      <PsephoiRow participants={participants} cast={proposal.tally.cast} revealed={revealed} />
      <p className="text-sm" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-data)' }}>
        {t('quorum.progress', { cast: proposal.tally.cast, total: participants })}
        {proposal.votesRevealed ? ` · ${t('quorum.net', { net: proposal.tally.net })}` : ''}
      </p>
      <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
        {proposal.deadline
          ? t('quorum.deadline', {
              date: new Intl.DateTimeFormat(i18n.language, {
                day: 'numeric',
                month: 'long',
              }).format(new Date(proposal.deadline)),
            })
          : t('quorum.noDeadline')}
      </p>
    </div>
  )
}
