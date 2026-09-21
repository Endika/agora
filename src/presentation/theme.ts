/**
 * Also spelled out, unavoidably, in the inline bootstrap in `index.html` — which has to run before
 * the first paint, so it cannot import this. Renaming it here alone left the theme silently
 * reverting to the system on every reload with the whole suite green, so a test reads the key back
 * out of `index.html` and holds the two together.
 */
export const THEME_KEY = 'agora:theme'

export type ThemeChoice = 'system' | 'light' | 'dark'

/** No stored key, or anything other than 'dark'/'light', reads as following the system. */
export function readTheme(): ThemeChoice {
  const stored = localStorage.getItem(THEME_KEY)
  return stored === 'dark' || stored === 'light' ? stored : 'system'
}

/** 'system' erases both the attribute and the stored key; the other two write both. */
export function applyTheme(choice: ThemeChoice): void {
  if (choice === 'system') {
    document.documentElement.removeAttribute('data-theme')
    localStorage.removeItem(THEME_KEY)
    return
  }
  document.documentElement.setAttribute('data-theme', choice)
  localStorage.setItem(THEME_KEY, choice)
}
