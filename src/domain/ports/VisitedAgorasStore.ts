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
