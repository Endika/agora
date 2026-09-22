import { useTranslation } from 'react-i18next'
import type { Proposal, VoteValue } from '@/domain/entities/Proposal'
import { canVote } from '@/domain/services/ProposalTransitions'

const OPTIONS: VoteValue[] = ['up', 'abstain', 'down']

/**
 * Three buttons of equal weight. Abstain is not a footnote: it counts for quorum and it is the
 * difference between "I don't mind" and "I haven't looked".
 *
 * Voting is the most consequential thing anybody does here and it costs one tap, so the app has to
 * be the one that acknowledges it: the three buttons go dead while the write is in the air, and a
 * live region says out loud what was just voted. There is no confirmation step and no undo: the tap
 * is the vote, as it always was.
 *
 * What the disabled state buys is that nothing can be queued *behind* a write that is still going —
 * the slow case, which is the one that used to leave people tapping. It holds for both copies of a
 * proposal that is on screen twice: `pending` is a fact about the proposal, so the card's buttons
 * and the panel's go dead together. Against a local write that returns in the same tick both halves
 * of a double tap still land, and that is harmless: casting the same value twice is an upsert of
 * the same row.
 *
 * `done` is the other half and is *not* shared: it belongs to the copy the tap came from, so a
 * confirmation is only ever read out where somebody is looking. Two proposals voted in quick
 * succession used to cross over, and the slower one's sentence was announced on the faster one's
 * card.
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
              className="min-h-11 min-w-0 flex-1 rounded-(--radius) border px-2 font-medium disabled:opacity-50"
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
      {/* Always in the DOM, empty until there is something to say. A live region inserted with its
          text already in it is frequently not announced — screen readers watch these for changes,
          not for arrivals — and the announcement that would be lost is the first one, which is the
          whole point of this. Standing there empty also reserves the line, so the confirmation
          does not shove the rest of the card down as it appears. */}
      <p role="status" className="min-h-5 text-sm font-medium" style={{ color: 'var(--ink)' }}>
        {done}
      </p>
      <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
        {t('psephoi.abstainCounts')}
      </p>
    </div>
  )
}
