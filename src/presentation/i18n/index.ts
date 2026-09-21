import i18next from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import es from './es.json'
import eu from './eu.json'

export const LOCALES = ['es', 'en', 'eu'] as const

/**
 * Keeps `<html lang>` telling the truth (WCAG 3.1.1, Level A). It is what decides which voice a
 * screen reader uses and how a word is pronounced, and `index.html` can only ship one guess.
 *
 * Both halves matter and only one of them was here. The picker wrote the attribute when somebody
 * used the picker, so a stored `agora:locale=en`, or a first visit from an English or Basque
 * browser, rendered the whole page in that language while the document still claimed Spanish —
 * which `html-has-lang` cannot see, because it only checks that the attribute exists.
 */
function followLanguage(): void {
  const write = (locale: string | undefined) => {
    if (locale !== undefined) document.documentElement.lang = locale
  }
  write(i18next.resolvedLanguage)
  i18next.on('languageChanged', write)
}

export async function initI18n(): Promise<void> {
  await i18next
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: { es: { translation: es }, en: { translation: en }, eu: { translation: eu } },
      fallbackLng: 'es',
      supportedLngs: LOCALES,
      interpolation: { escapeValue: false },
      detection: { order: ['localStorage', 'navigator'], lookupLocalStorage: 'agora:locale' },
    })
  followLanguage()
}
