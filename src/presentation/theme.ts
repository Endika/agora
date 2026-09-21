const STORAGE_KEY = 'agora:theme'

export type ThemeChoice = 'system' | 'light' | 'dark'

/** No stored key, or anything other than 'dark'/'light', reads as following the system. */
export function readTheme(): ThemeChoice {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'dark' || stored === 'light' ? stored : 'system'
}

/** 'system' erases both the attribute and the stored key; the other two write both. */
export function applyTheme(choice: ThemeChoice): void {
  if (choice === 'system') {
    document.documentElement.removeAttribute('data-theme')
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  document.documentElement.setAttribute('data-theme', choice)
  localStorage.setItem(STORAGE_KEY, choice)
}
