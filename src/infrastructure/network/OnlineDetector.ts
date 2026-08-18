import type { OnlineDetector } from '@/domain/ports/OnlineDetector'

/** `navigator.onLine` is a hint, not a promise — a failed request is the real signal, handled upstream. */
export const BrowserOnlineDetector: OnlineDetector = {
  isOnline: () => navigator.onLine,
  onChange(listener) {
    window.addEventListener('online', listener)
    window.addEventListener('offline', listener)
    return () => {
      window.removeEventListener('online', listener)
      window.removeEventListener('offline', listener)
    }
  },
}

export class FakeOnlineDetector implements OnlineDetector {
  private online = true
  private readonly listeners = new Set<() => void>()

  isOnline(): boolean {
    return this.online
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  goOffline(): void {
    this.online = false
    this.listeners.forEach((listener) => listener())
  }

  goOnline(): void {
    this.online = true
    this.listeners.forEach((listener) => listener())
  }
}
