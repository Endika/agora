import i18next from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import es from './es.json'
import eu from './eu.json'

export const LOCALES = ['es', 'en', 'eu'] as const

export function initI18n() {
  return i18next
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: { es: { translation: es }, en: { translation: en }, eu: { translation: eu } },
      fallbackLng: 'es',
      supportedLngs: LOCALES,
      interpolation: { escapeValue: false },
      detection: { order: ['localStorage', 'navigator'], lookupLocalStorage: 'agora:locale' },
    })
}
