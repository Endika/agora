/**
 * The one table mapping an agora's mode and a round's state onto the sentence the reader is owed.
 * Both places that say it read it from here — the board above its list, the detail beside its vote
 * buttons — because the last time each decided for itself they disagreed, and a resolved proposal
 * was promised secrecy 143 px from its own published roll of names.
 *
 * In a secret agora neither variant promises a name: there will never be one to publish.
 */
export function ballotSentenceKey(ballotOpen: boolean, resolved: boolean): string {
  if (ballotOpen) return resolved ? 'psephoi.secretPast' : 'psephoi.secret'
  return resolved ? 'psephoi.secretForeverPast' : 'psephoi.secretForever'
}
