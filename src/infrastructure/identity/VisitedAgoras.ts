import type { VisitedAgora, VisitedAgorasStore } from '@/domain/ports/VisitedAgorasStore'

const KEY = 'agora:visited'
const KEPT = 12

/** localStorage adapter for the VisitedAgorasStore port. */
export const VisitedAgoras: VisitedAgorasStore = {
  list(): VisitedAgora[] {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed
        .filter((entry): entry is VisitedAgora => {
          const candidate = entry as Partial<VisitedAgora>
          return typeof candidate.slug === 'string' && typeof candidate.name === 'string'
        })
        .sort((a, b) => b.visitedAt - a.visitedAt)
    } catch {
      // A corrupt entry must not take the home screen down with it.
      return []
    }
  },

  remember(slug: string, name: string): void {
    const rest = VisitedAgoras.list().filter((entry) => entry.slug !== slug)
    const next = [{ slug, name, visitedAt: Date.now() }, ...rest].slice(0, KEPT)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      // Storage full or blocked: the list is a convenience, never a requirement.
    }
  },

  forget(slug: string): void {
    const next = VisitedAgoras.list().filter((entry) => entry.slug !== slug)
    localStorage.setItem(KEY, JSON.stringify(next))
  },
}
