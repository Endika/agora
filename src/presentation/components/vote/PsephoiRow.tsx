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
  /**
   * Whether one of these pebbles is the reader's own. Presence, never direction: the ring says
   * "yours is in", and which way it went stays secret until the whole row turns.
   */
  mine?: boolean
}

/** A long row should not take a second to finish arriving, so the stagger stops counting at eight. */
const STAGGER_CAP = 8

/**
 * The signature element. Athenians voted with pebbles — psephos means both "pebble" and "vote" —
 * so a vote here is a pebble and each proposal carries one slot per participant.
 *
 * The row *is* the rule: an empty slot is somebody who has not voted, a stone pebble is a vote cast
 * but not revealed, and colour only ever appears once the vote is over. Nothing explains the secret
 * ballot because nothing has to — except that a screen-reader-only cue is not enough on its own, so
 * the same fact is also said in text where the caller asks for it.
 *
 * Two things are allowed to move. Your own pebble lands when you cast it, and the whole row fades
 * up when quorum turns it from stone to colour. Both are marked `data-motion` so the reduced-motion
 * rule in `tokens.css` can swap the movement for a fade instead of deleting the moment.
 */
export function PsephoiRow({ participants, cast, revealed, explainSecret, mine = false }: Props) {
  const { t } = useTranslation()
  const filled = revealed ? revealed.length : Math.min(cast, participants)
  const empty = Math.max(0, participants - filled)

  // Only while the vote is secret. Once every pebble carries its colour, pointing at one of them
  // and calling it yours would hand a shoulder-surfer the answer for free.
  const marked = mine && !revealed && filled > 0

  return (
    <>
      <div
        className="flex flex-wrap items-center gap-1.5"
        role="img"
        aria-label={t(marked ? 'psephoi.progressMine' : 'psephoi.progress', {
          cast: filled,
          total: participants,
        })}
      >
        {Array.from({ length: filled }, (_, i) => {
          const value = revealed?.[i]
          // Abstain is a ring, not another shade of grey: revealed it would otherwise look exactly like
          // an unrevealed pebble, and colour must never be the only thing carrying the meaning.
          const hollow = value === 'abstain'
          // The last one, because that is the one that was just added: it mounts with the vote, so
          // it is the pebble that can be seen to land. Position says nothing about direction.
          const own = marked && i === filled - 1
          return (
            <span
              // The key changes the moment the row is revealed, so every pebble remounts and the
              // reveal animation actually runs instead of being a no-op on a node that never left.
              key={revealed ? `revealed-${i}` : `cast-${i}`}
              data-testid={own ? 'pebble-mine' : 'pebble-cast'}
              {...(value ? { 'data-vote': value } : {})}
              {...(revealed ? { 'data-motion': 'row-reveal' } : {})}
              {...(own ? { 'data-motion': 'pebble-land' } : {})}
              title={value ? t(`psephoi.${value}`) : undefined}
              className={hollow ? 'size-3.5 rounded-full border-[3px]' : 'size-3.5 rounded-full'}
              style={{
                ...(hollow
                  ? { borderColor: 'var(--vote-abstain)' }
                  : { background: value ? `var(--vote-${value})` : 'var(--pebble)' }),
                ...(own
                  ? {
                      // An outline, not a box-shadow: it needs no gap colour, so the ring reads the
                      // same on the card, in the sheet and in the panel.
                      outline: '2px solid var(--ink)',
                      outlineOffset: '2px',
                      animation: 'pebble-land 180ms ease-out both',
                    }
                  : {}),
                ...(revealed
                  ? {
                      animation: 'row-reveal 240ms ease-out both',
                      animationDelay: `${Math.min(i, STAGGER_CAP) * 40}ms`,
                    }
                  : {}),
              }}
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
