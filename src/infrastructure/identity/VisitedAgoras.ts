import type { VisitedAgora, VisitedAgorasStore } from '@/domain/ports/VisitedAgorasStore'
import { VisitedAgorasWriteFailed } from '@/domain/ports/VisitedAgorasStore'

const KEY = 'agora:visited'
const KEPT = 12

function isVisitedAgora(entry: unknown): entry is VisitedAgora {
  const candidate = entry as Partial<VisitedAgora>
  return (
    typeof candidate.slug === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.visitedAt === 'number'
  )
}

/**
 * Whatever of the stored list can be trusted, never a throw. A missing key, bad JSON, or a value
 * that isn't an array all read as no agoras yet — the same "start empty" the rest of the app uses
 * for unreadable data. A malformed entry among otherwise good ones is dropped on its own: the rest
 * is still real data, so remember/forget build the next write on it instead of starting over.
 */
function readStored(): VisitedAgora[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isVisitedAgora)
  } catch {
    return []
  }
}

/** localStorage adapter for the VisitedAgorasStore port. */
export const VisitedAgoras: VisitedAgorasStore = {
  list(): VisitedAgora[] {
    return readStored().sort((a, b) => b.visitedAt - a.visitedAt)
  },

  remember(slug: string, name: string): void {
    const rest = readStored().filter((entry) => entry.slug !== slug)
    const next = [{ slug, name, visitedAt: Date.now() }, ...rest].slice(0, KEPT)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch (cause) {
      throw new VisitedAgorasWriteFailed(cause)
    }
  },

  forget(slug: string): void {
    const next = readStored().filter((entry) => entry.slug !== slug)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch (cause) {
      throw new VisitedAgorasWriteFailed(cause)
    }
  },
}
