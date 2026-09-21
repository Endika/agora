import { useTranslation } from 'react-i18next'
import type { Proposal, VoteValue } from '@/domain/entities/Proposal'
import { canVote } from '@/domain/services/ProposalTransitions'

const OPTIONS: VoteValue[] = ['up', 'abstain', 'down']

/**
 * Three buttons of equal weight. Abstain is not a footnote: it counts for quorum and it is the
 * difference between "I don't mind" and "I haven't looked".
 *
 * Voting is the most consequential thing anybody does here and it costs one tap, so the app has to
 * be the one that acknowledges it: the three buttons go dead while the write is in the air — a
 * double tap used to cast twice — and a live region says out loud what was just voted. There is no
 * confirmation step and no undo: the tap is the vote, as it always was.
 */
export function VoteControls({
  proposal,
  onVote,
  pending = false,
  done = null,
}: {
  proposal: Proposal
  onVote: (value: VoteValue) => void
  /** A vote from this copy of the controls is still in flight. */
  pending?: boolean
  /** What was voted, once it landed. Null until then. */
  done?: string | null
}) {
  const { t } = useTranslation()
  const open = canVote(proposal)

  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('psephoi.choose')}>
        {OPTIONS.map((value) => {
          const chosen = proposal.myVote === value
          return (
            <button
              key={value}
              type="button"
              disabled={!open || pending}
              aria-pressed={chosen}
              onClick={() => onVote(value)}
              className="min-h-11 min-w-0 flex-1 rounded-[--radius] border px-2 font-medium disabled:opacity-50"
              style={{
                background: chosen ? `var(--vote-${value})` : 'var(--surface-sunken)',
                color: chosen ? 'var(--on-fill)' : 'var(--ink)',
                borderColor: chosen ? `var(--vote-${value})` : 'var(--border-control)',
              }}
            >
              {t(`psephoi.${value}`)}
            </button>
          )
        })}
      </div>
      {done !== null && (
        <p className="text-sm font-medium" style={{ color: 'var(--ink)' }} role="status">
          {done}
        </p>
      )}
      <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
        {t('psephoi.abstainCounts')}
      </p>
    </div>
  )
}
