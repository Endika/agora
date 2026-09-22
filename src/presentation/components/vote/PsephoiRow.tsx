import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CastVote, VoteValue } from '@/domain/entities/Proposal'
import type { Participant } from '@/domain/repositories/BoardRepository'
import { type BallotState, ballotSentenceKey } from './ballotSentence'

interface Pebbles {
  /** Everyone entitled to vote: the row's length, and the names the roll is written from. */
  participants: Participant[]
  cast: number
  /** Null while the vote is open. Once resolved, every vote in the round, with its voter. */
  revealed: CastVote[] | null
  /**
   * Whether one of these pebbles is the reader's own. Presence, never direction: the ring says
   * "yours is in", and which way it went stays secret until the whole row turns.
   */
  mine?: boolean
}

/**
 * Whether this row is allowed to explain the ballot rule in text, and — when it is — which rule.
 * The row itself cannot tell whether it is the one copy of that sentence on the page, so the
 * caller says so explicitly: the board says it once above the list, the detail repeats it because
 * it can be opened on its own, and the list card never does, to avoid saying it once per open
 * proposal.
 *
 * The two travel together on purpose. The mode is a fact about the agora that the row has no way
 * of deriving — in a secret agora `revealed` is a list of votes with no voter, which looks exactly
 * like a bug from in here — and a separate optional prop could be forgotten at the one call site
 * that matters. Tied to the permission, the type will not let anybody explain a rule without
 * saying which of the two it is, and the card that stays quiet is not handed a fact it must not use.
 */
type Explaining =
  | { explainSecret: false }
  | {
      explainSecret: true
      /** From `board.group.ballotOpen`: true if the ballot opens when the proposal closes. */
      ballotOpen: boolean
      /**
       * Whether the proposal is over. The row cannot derive it: `revealed` says "and published",
       * which used to be the same thing and is not any more — a secret agora closes a partial
       * ballot without publishing it, and a row that read `revealed === null` as "still open"
       * would promise a reveal over pebbles that will never take a colour.
       */
      resolved: boolean
    }

type Props = Pebbles & Explaining

/**
 * The two facts the row holds, read as the three states the sentence distinguishes. Closed without a
 * reveal is its own case, not a variant of open: it is the end of the story, and the story is that
 * these votes are never published.
 */
const state = (resolved: boolean, revealed: CastVote[] | null): BallotState =>
  !resolved ? 'open' : revealed !== null ? 'published' : 'withheld'

/** A long row should not take a second to finish arriving, so the stagger stops counting at eight. */
const STAGGER_CAP = 8

/**
 * Comfortably past both landing variants: the 180 ms `pebble-land` set inline below and the
 * 200 ms `pebble-land-still` that `tokens.css` swaps in under reduced motion. (260 ms is
 * `row-reveal-still`, a different keyframe on a different element — it never gates this timer.)
 * A test in `tokens.test.ts` reads both durations out of the source and holds this above them.
 */
export const LANDING_MS = 400

/** Grouped the way the row reads: in favour, blank, against. Only groups with a vote are shown. */
const ROLL_ORDER: VoteValue[] = ['up', 'abstain', 'down']

/**
 * The signature element. Athenians voted with pebbles — psephos means both "pebble" and "vote" —
 * so a vote here is a pebble and each proposal carries one slot per participant.
 *
 * The row *is* the rule: an empty slot is somebody who has not voted, a stone pebble is a vote cast
 * but not revealed, and colour only ever appears once the vote is over. What the row cannot say is
 * the half of the rule that changes how people vote — whether the ballot stays secret after quorum
 * or turns and carries your name, which each agora chose when it was created — so the same fact is
 * said in text where the caller asks for it, before anybody taps anything.
 *
 * Once it resolves the row keeps being the summary and the roll underneath is the detail: who voted
 * what, grouped by sense. The roll is the *only* place the attribution is published, and that is on
 * purpose: the row is a single `role="img"`, which makes its pebbles presentational, so a `title`
 * naming the voter arrives as a description on a nameless generic — a mouse-hover tooltip, out of
 * reach of a keyboard and of a touchscreen. It looked like an accessibility guarantee and was not
 * one, so there is none, and the list two lines below says it properly to everybody.
 *
 * Two things are allowed to move. Your own pebble lands when you cast it, and the whole row fades
 * up when quorum turns it from stone to colour. Both are marked `data-motion` so the reduced-motion
 * rule in `tokens.css` can swap the movement for a fade instead of deleting the moment.
 *
 * `data-motion` is the only way past that rule, so it stays inside this file: two values, two
 * animations, both about the vote. A test counts them.
 */
export function PsephoiRow(props: Props) {
  const { participants, cast, revealed, mine = false } = props
  const { t } = useTranslation()
  const total = participants.length
  const filled = revealed ? revealed.length : Math.min(cast, total)
  const empty = Math.max(0, total - filled)

  // Only while the vote is secret. Once every pebble carries its colour, pointing at one of them
  // and calling it yours would hand a shoulder-surfer the answer for free.
  const marked = mine && !revealed && filled > 0

  // A vote may have no name to print: erasure cascades onto votes, and a secret agora never sends
  // the voter at all. Either way it drops out of the roll, and never renders as "undefined" next
  // to a sense.
  const nameOf = (participantId: string | undefined) =>
    participants.find((person) => person.id === participantId)?.name

  // Built only from `revealed`, which is the server's own "the round is over" signal. While the
  // proposal is open there is no list to leak, because there is nothing to build it from.
  const roll = (revealed ?? [])
    .reduce<{ value: VoteValue; names: string[] }[]>((groups, vote) => {
      const name = nameOf(vote.participantId)
      if (name === undefined) return groups
      const group = groups.find((candidate) => candidate.value === vote.value)
      if (group) group.names.push(name)
      else groups.push({ value: vote.value, names: [name] })
      return groups
    }, [])
    .sort((a, b) => ROLL_ORDER.indexOf(a.value) - ROLL_ORDER.indexOf(b.value))

  // The ceremony belongs to your vote arriving, not to a node appearing in a list. Keyed to a DOM
  // position it also fired every time somebody *else* voted — the ring stepped one pebble to the
  // right and played your animation for their vote — and again on every first paint. An effect on
  // `mine` fires once, when your own vote lands, and never for anybody else's.
  const [landing, setLanding] = useState(false)
  const already = useRef(mine)
  useEffect(() => {
    const arrived = mine && !already.current
    already.current = mine
    if (!arrived) return undefined
    setLanding(true)
    // Taken off again once it is over, so that a node moved by a later re-sort of the board does
    // not restart it. `onAnimationEnd` would be exact, but jsdom has no AnimationEvent and an
    // untestable branch is worse than a timer that outlasts both durations.
    const timer = setTimeout(() => setLanding(false), LANDING_MS)
    return () => clearTimeout(timer)
  }, [mine])

  return (
    <>
      <div
        className="flex flex-wrap items-center gap-1.5"
        role="img"
        aria-label={t(marked ? 'psephoi.progressMine' : 'psephoi.progress', {
          cast: filled,
          total,
        })}
      >
        {Array.from({ length: filled }, (_, i) => {
          const vote = revealed?.[i]
          const value = vote?.value
          // Abstain is a ring, not another shade of grey: revealed it would otherwise look exactly like
          // an unrevealed pebble, and colour must never be the only thing carrying the meaning.
          const hollow = value === 'abstain'
          // Always the first slot. There is no person-to-pebble mapping to be right about, so the
          // position is arbitrary — but it has to be *fixed*: a ring that walks rightwards as other
          // people vote teaches a mapping that does not exist, on the one screen whose whole
          // premise is that it does not.
          const own = marked && i === 0
          return (
            <span
              // The key changes the moment the row is revealed, so every pebble remounts and the
              // reveal animation actually runs instead of being a no-op on a node that never left.
              key={revealed ? `revealed-${i}` : `cast-${i}`}
              data-testid={own ? 'pebble-mine' : 'pebble-cast'}
              {...(value ? { 'data-vote': value } : {})}
              {...(revealed ? { 'data-motion': 'row-reveal' } : {})}
              {...(own && landing ? { 'data-motion': 'pebble-land' } : {})}
              onAnimationEnd={own && landing ? () => setLanding(false) : undefined}
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
                    }
                  : {}),
                ...(own && landing ? { animation: 'pebble-land 180ms ease-out both' } : {}),
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
      {props.explainSecret && (
        // One paragraph, one sentence out of four, and the choice is total — which is how "exactly
        // once on screen" survives by construction rather than by a caller remembering. The past
        // tense matters as much as the future one: somebody arriving on a resolved proposal
        // through a shared link finds a roll of names, or pointedly does not, and is owed the rule
        // that decided it, even though there is nothing left to promise them.
        //
        // `revealed` alone cannot choose: it says the round is over, never what that publishes. A
        // secret agora resolves with its voters stripped, so reading it alone lands on "now the
        // whole group sees them, with the name of whoever cast them" over a roll that will never
        // exist. That was the lie; the mode is here so it cannot be told.
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {t(ballotSentenceKey(props.ballotOpen, state(props.resolved, revealed)))}
        </p>
      )}
      {roll.length > 0 && (
        // One sense per line, and names that wrap rather than truncate: a name is as long as
        // somebody's name is, and at 280 px a single group already takes three lines. Inline with
        // a separator — which is how the spec sketched it — puts the "·" at the start or the end
        // of a wrapped line as soon as the names are real, and one group's tail ends up sharing a
        // line with the next group's label. Aligned labels read faster and never do that.
        // The label stays in --ink rather than its vote colour: --vote-up is 4.84:1 on --surface,
        // where a card puts it, and 4.23:1 on --ground, where the sheet and the panel put it. The
        // second is the binding one, a UI-component pass and a small-text fail. The colour is
        // right above, in the pebbles.
        <ul
          data-testid="vote-roll"
          aria-label={t('psephoi.roll')}
          className="grid min-w-0 gap-y-1 text-sm"
          style={{ color: 'var(--ink-muted)' }}
        >
          {roll.map((group) => (
            <li
              key={group.value}
              // Hanging indent: at 280 px a group runs to four lines, and flush-left continuations
              // start at the same x as the next group's label, leaving --ink against --ink-muted
              // as the only thing telling them apart. Indented, the labels are the only text on
              // that edge. Costs nothing at widths where nothing wraps.
              className="-indent-4 min-w-0 break-words pl-4"
              data-testid={`roll-${group.value}`}
            >
              <span style={{ color: 'var(--ink)' }}>{t(`psephoi.${group.value}`)}</span>
              {`: ${group.names.join(', ')}`}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
