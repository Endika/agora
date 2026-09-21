import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import i18next from 'i18next'
import { initI18n } from '@/presentation/i18n'
import { installMatchMedia, resetMatchMedia } from './support/matchMedia'

// Tests assert real copy, so i18n is initialised here and pinned to Spanish: jsdom reports en-US
// and the language detector would otherwise pick English half the time.
await initI18n()
await i18next.changeLanguage('es')

// Components legitimately ask about display-mode, prefers-reduced-motion and the desktop
// breakpoint. The stub answers "no" to every query — which is what jsdom did, so nothing that
// was passing changes — but a test can now say otherwise with `matchMediaMatches`.
installMatchMedia()
afterEach(resetMatchMedia)
