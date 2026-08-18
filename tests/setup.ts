import '@testing-library/jest-dom/vitest'
import i18next from 'i18next'
import { initI18n } from '@/presentation/i18n'

// Tests assert real copy, so i18n is initialised here and pinned to Spanish: jsdom reports en-US
// and the language detector would otherwise pick English half the time.
await initI18n()
await i18next.changeLanguage('es')

// jsdom implements no matchMedia, and components legitimately ask about display-mode and
// prefers-reduced-motion. A stub that answers "no" keeps those paths testable.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
