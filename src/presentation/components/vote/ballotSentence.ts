/**
 * The four sentences the ballot rule is ever said in, as i18n keys. Spelled out rather than left as
 * `string` so that a key the bundles do not have stops being a runtime shrug — the table is the one
 * place any of them is named, and a typo here would otherwise reach the screen as a raw key.
 *
 * What it does not catch is one valid key swapped for another valid one, which is a lie and not a
 * typo; that stays the tests' job, and they do catch it.
 */
export type BallotSentenceKey =
  'psephoi.secret' | 'psephoi.secretPast' | 'psephoi.secretForever' | 'psephoi.secretForeverPast'

/**
 * The one table mapping an agora's mode and a round's state onto the sentence the reader is owed.
 * Both places that say it read it from here — the board above its list, the detail beside its vote
 * buttons — because the last time each decided for itself they disagreed, and a resolved proposal
 * was promised secrecy 143 px from its own published roll of names.
 *
 * In a secret agora neither variant promises a name: there will never be one to publish. Both stay
 * claims about what the record carries, never about what anybody can work out — in a flat of two, a
 * resolved 1-1 tells each voter how the other voted, and no ballot can promise otherwise.
 */
export function ballotSentenceKey(ballotOpen: boolean, resolved: boolean): BallotSentenceKey {
  if (ballotOpen) return resolved ? 'psephoi.secretPast' : 'psephoi.secret'
  return resolved ? 'psephoi.secretForeverPast' : 'psephoi.secretForever'
}
