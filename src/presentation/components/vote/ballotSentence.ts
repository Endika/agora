/**
 * The five sentences the ballot rule is ever said in, as i18n keys. Spelled out rather than left as
 * `string` so that a key the bundles do not have stops being a runtime shrug — the table is the one
 * place any of them is named, and a typo here would otherwise reach the screen as a raw key.
 *
 * What it does not catch is one valid key swapped for another valid one, which is a lie and not a
 * typo; that stays the tests' job, and they do catch it.
 */
export type BallotSentenceKey =
  | 'psephoi.secret'
  | 'psephoi.secretPast'
  | 'psephoi.secretForever'
  | 'psephoi.secretForeverPast'
  | 'psephoi.secretForeverWithheld'

/**
 * What the reader is looking at — which is not the same question as "is the round over".
 *
 * This is the non-obvious part, and the reason the table has three states and not two. "Resolved"
 * used to be one thing because closing always published. It is not one thing any more: a secret
 * agora withholds the votes of a proposal that closed without everybody voting, because the board
 * names who has not voted all through the round, so a partial reveal afterwards hands those names
 * their values. So closing now splits into *closed and published* and *closed and withheld*, and
 * they are owed different sentences — the second is looking at pebbles that will never take a
 * colour, and "now the whole group sees them" would be a plain lie over the top of them.
 */
export type BallotState = 'open' | 'published' | 'withheld'

/**
 * The one table mapping an agora's mode and a proposal's state onto the sentence the reader is owed.
 * Both places that say it read it from here — the board above its list, the detail beside its vote
 * buttons — because the last time each decided for itself they disagreed, and a resolved proposal
 * was promised secrecy 143 px from its own published roll of names.
 *
 * Every variant speaks of the proposal being open or closed, never of quorum. Quorum is only one of
 * the two ways `agora.resolve_proposal` closes a vote — the other is a deadline passing — so "until
 * quorum was reached" was false on every proposal that ran out of time, which is exactly the case
 * the withheld sentence exists for. Closing is what publishes; how it closed is a different fact and
 * not one this paragraph promises anything about.
 *
 * In a secret agora no variant promises a name: there will never be one to publish. All of them stay
 * claims about what the record carries, never about what anybody can work out — in a flat of two, a
 * resolved 1-1 tells each voter how the other voted, and no ballot can promise otherwise.
 */
export function ballotSentenceKey(ballotOpen: boolean, state: BallotState): BallotSentenceKey {
  // An open ballot publishes whatever it has the moment the proposal closes, partial or not: the
  // names are going out anyway, so there is nothing for it to withhold and no third state to be in.
  if (ballotOpen) return state === 'open' ? 'psephoi.secret' : 'psephoi.secretPast'
  if (state === 'open') return 'psephoi.secretForever'
  return state === 'published' ? 'psephoi.secretForeverPast' : 'psephoi.secretForeverWithheld'
}
