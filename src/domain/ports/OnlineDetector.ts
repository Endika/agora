/**
 * Whether the app can reach the network. A port: the browser's answer is only a hint, and tests need to
 * take the network away on purpose.
 */
export interface OnlineDetector {
  isOnline(): boolean
  /** Returns the unsubscribe function. */
  onChange(listener: () => void): () => void
}
