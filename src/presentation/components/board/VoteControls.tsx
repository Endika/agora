import { useTranslation } from 'react-i18next'
import type { Proposal, VoteValue } from '@/domain/entities/Proposal'
import { canVote } from '@/domain/services/ProposalTransitions'

const OPTIONS: VoteValue[] = ['up', 'abstain', 'down']

/**
 * Three buttons of equal weight. Abstain is not a footnote: it counts for quorum and it is the
 * difference between "I don't mind" and "I haven't looked".
 */
export function VoteControls({
  proposal,
  onVote,
}: {
  proposal: Proposal
  onVote: (value: VoteValue) => void
}) {
  const { t } = useTranslation()
  const open = canVote(proposal)

  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label={t('psephoi.progress', {
        cast: proposal.tally.cast,
        total: proposal.tally.cast + proposal.pending.length,
      })}
    >
      {OPTIONS.map((value) => {
        const chosen = proposal.myVote === value
        return (
          <button
            key={value}
            type="button"
            disabled={!open}
            aria-pressed={chosen}
            onClick={() => onVote(value)}
            className="min-h-11 min-w-0 rounded-[--radius] border px-2 font-medium disabled:opacity-50"
            style={{
              background: chosen ? `var(--vote-${value})` : 'var(--surface)',
              color: chosen ? '#ffffff' : 'var(--ink)',
              borderColor: chosen ? `var(--vote-${value})` : 'var(--border)',
            }}
          >
            {t(`psephoi.${value}`)}
          </button>
        )
      })}
    </div>
  )
}
