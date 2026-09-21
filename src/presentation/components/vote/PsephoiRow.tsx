import { useTranslation } from 'react-i18next'
import type { VoteValue } from '@/domain/entities/Proposal'

interface Props {
  participants: number
  cast: number
  /** Null while the vote is open. Once resolved, every vote in the round. */
  revealed: VoteValue[] | null
  /**
   * Whether this row is allowed to explain the secret ballot in text. The row itself cannot tell
   * whether it is the one copy of that sentence on the page, so the caller says so explicitly —
   * the board says it once above the list, the detail repeats it because it can be opened on its
   * own, and the list card never does, to avoid saying it once per open proposal.
   */
  explainSecret: boolean
}

/**
 * The signature element. Athenians voted with pebbles — psephos means both "pebble" and "vote" —
 * so a vote here is a pebble and each proposal carries one slot per participant.
 *
 * The row *is* the rule: an empty slot is somebody who has not voted, a stone pebble is a vote cast
 * but not revealed, and colour only ever appears once the vote is over. Nothing explains the secret
 * ballot because nothing has to — except that a screen-reader-only cue is not enough on its own, so
 * the same fact is also said in text where the caller asks for it.
 */
export function PsephoiRow({ participants, cast, revealed, explainSecret }: Props) {
  const { t } = useTranslation()
  const filled = revealed ? revealed.length : Math.min(cast, participants)
  const empty = Math.max(0, participants - filled)

  return (
    <>
      <div
        className="flex flex-wrap items-center gap-1.5"
        role="img"
        aria-label={t('psephoi.progress', { cast: filled, total: participants })}
      >
        {Array.from({ length: filled }, (_, i) => {
          const value = revealed?.[i]
          // Abstain is a ring, not another shade of grey: revealed it would otherwise look exactly like
          // an unrevealed pebble, and colour must never be the only thing carrying the meaning.
          const hollow = value === 'abstain'
          return (
            <span
              key={`cast-${i}`}
              data-testid="pebble-cast"
              {...(value ? { 'data-vote': value } : {})}
              title={value ? t(`psephoi.${value}`) : undefined}
              className={hollow ? 'size-3.5 rounded-full border-[3px]' : 'size-3.5 rounded-full'}
              style={
                hollow
                  ? { borderColor: 'var(--vote-abstain)' }
                  : { background: value ? `var(--vote-${value})` : 'var(--pebble)' }
              }
            />
          )
        })}
        {Array.from({ length: empty }, (_, i) => (
          <span
            key={`empty-${i}`}
            data-testid="pebble-empty"
            className="size-3.5 rounded-full border-2 border-dashed"
            style={{ borderColor: 'var(--pebble-empty)' }}
          />
        ))}
      </div>
      {explainSecret && !revealed && (
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {t('psephoi.secret')}
        </p>
      )}
    </>
  )
}
