import { useTranslation } from 'react-i18next'
import type { VoteValue } from '@/domain/entities/Proposal'

interface Props {
  participants: number
  cast: number
  /** Null while the vote is open. Once resolved, every vote in the round. */
  revealed: VoteValue[] | null
}

/**
 * The signature element. Athenians voted with pebbles — psephos means both "pebble" and "vote" —
 * so a vote here is a pebble and each proposal carries one slot per participant.
 *
 * The row *is* the rule: an empty slot is somebody who has not voted, a stone pebble is a vote cast
 * but not revealed, and colour only ever appears once the vote is over. Nothing explains the secret
 * ballot because nothing has to.
 */
export function PsephoiRow({ participants, cast, revealed }: Props) {
  const { t } = useTranslation()
  const filled = revealed ? revealed.length : Math.min(cast, participants)
  const empty = Math.max(0, participants - filled)

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="img"
      aria-label={`${t('psephoi.progress', { cast: filled, total: participants })}${
        revealed ? '' : `. ${t('psephoi.secret')}`
      }`}
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
  )
}
