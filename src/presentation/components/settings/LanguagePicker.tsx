import { useTranslation } from 'react-i18next'
import { LOCALES } from '@/presentation/i18n'

/** The detector already persists `agora:locale` on changeLanguage; this only sets <html lang>. */
export function LanguagePicker() {
  const { t, i18n } = useTranslation()

  return (
    <label className="flex min-w-0 items-center gap-2">
      <span>{t('settings.language')}</span>
      <select
        value={i18n.language}
        onChange={(event) => {
          const locale = event.target.value
          void i18n.changeLanguage(locale)
          document.documentElement.lang = locale
        }}
        className="min-h-11 min-w-0 rounded-[--radius] border px-2"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {t(`settings.locale.${locale}`)}
          </option>
        ))}
      </select>
    </label>
  )
}
