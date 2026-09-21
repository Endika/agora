import { useSyncExternalStore } from 'react'

/** Tailwind's `lg`. Below it the board and one open proposal cannot both be read at once. */
const WIDE = '(min-width: 1024px)'

/** Optional call: a runtime without `matchMedia` gets the phone-shaped reading, not a crash. */
const isWide = () => window.matchMedia?.(WIDE).matches === true

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia?.(WIDE)
  query?.addEventListener('change', onChange)
  return () => query?.removeEventListener('change', onChange)
}

/**
 * The one media query this app answers in JS instead of CSS. A `lg:hidden` / `hidden lg:block`
 * pair would be simpler, but it renders the open proposal twice — two headings, two vote buttons,
 * two comment forms in the accessibility tree, one of them invisible. One hook, one node.
 */
export function useWideViewport(): boolean {
  return useSyncExternalStore(subscribe, isWide, () => false)
}
