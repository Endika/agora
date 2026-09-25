export interface VisitedAgora {
  slug: string
  name: string
  visitedAt: number
}

/**
 * The agoras this device has been in. A port, because where that list lives is a device decision:
 * there are no accounts, so it never leaves the phone and it costs no egress.
 */
export interface VisitedAgorasStore {
  list(): VisitedAgora[]
  remember(slug: string, name: string): void
  forget(slug: string): void
}

/**
 * Thrown by remember/forget when the write itself fails — quota exceeded or storage blocked. A
 * read failure never throws: the adapter falls back to an empty list and simply skips the write,
 * the same as a key that was never set. It lives beside the port, like `notAParticipant`, because
 * the UI needs the same type the adapter throws without reaching into the adapter itself.
 */
export class VisitedAgorasWriteFailed extends Error {
  constructor(cause: unknown) {
    super('agora:visited could not be saved', { cause })
  }
}
