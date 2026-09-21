import { useTranslation } from 'react-i18next'
import { LOCALES } from '@/presentation/i18n'

/**
 * The detector persists `agora:locale` on changeLanguage, and `initI18n` keeps `<html lang>` in
 * step with it from boot onwards — so this only has to change the language.
 */
export function LanguagePicker() {
  const { t, i18n } = useTranslation()

  return (
    <label className="flex min-w-0 items-center gap-2">
      <span>{t('settings.language')}</span>
      <select
        value={i18n.language}
        onChange={(event) => void i18n.changeLanguage(event.target.value)}
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
