type Listener = (event: MediaQueryListEvent) => void

const answers = new Map<string, boolean>()
const listeners = new Map<string, Set<Listener>>()

/**
 * jsdom's own `matchMedia` answers "no" to everything and never changes its mind, so a component
 * that reacts to a breakpoint cannot be tested through it. This stub answers "no" by default —
 * the phone-shaped reading every existing test was written against — and lets one test say
 * otherwise out loud, listeners included.
 */
export function installMatchMedia(): void {
  window.matchMedia = (query: string) =>
    ({
      get matches() {
        return answers.get(query) ?? false
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: Listener) => setOf(query).add(listener),
      removeEventListener: (_type: string, listener: Listener) => setOf(query).delete(listener),
      addListener: (listener: Listener) => setOf(query).add(listener),
      removeListener: (listener: Listener) => setOf(query).delete(listener),
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}

/**
 * Makes one query start answering `matches`, and tells whoever was listening — so a test can move
 * the window across the breakpoint and watch the layout follow, not just mount at a width.
 */
export function matchMediaMatches(matches: boolean, query = '(min-width: 1024px)'): void {
  answers.set(query, matches)
  for (const listener of [...setOf(query)])
    listener({ matches, media: query } as MediaQueryListEvent)
}

/** Every test starts on a phone. Called from the global setup so no file has to remember. */
export function resetMatchMedia(): void {
  answers.clear()
  listeners.clear()
}

function setOf(query: string): Set<Listener> {
  const existing = listeners.get(query)
  if (existing) return existing
  const created = new Set<Listener>()
  listeners.set(query, created)
  return created
}
