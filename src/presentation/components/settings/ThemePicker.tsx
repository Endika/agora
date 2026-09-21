import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { applyTheme, readTheme, type ThemeChoice } from '@/presentation/theme'

const THEME_LABEL_KEY: Record<ThemeChoice, string> = {
  system: 'settings.themeSystem',
  light: 'settings.themeLight',
  dark: 'settings.themeDark',
}

export function ThemePicker() {
  const { t } = useTranslation()
  const [theme, setTheme] = useState<ThemeChoice>(() => readTheme())

  return (
    <label className="flex min-w-0 items-center gap-2">
      <span>{t('settings.theme')}</span>
      <select
        value={theme}
        onChange={(event) => {
          const choice = event.target.value as ThemeChoice
          applyTheme(choice)
          setTheme(choice)
        }}
        className="min-h-11 min-w-0 rounded-[--radius] border px-2"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {(Object.keys(THEME_LABEL_KEY) as ThemeChoice[]).map((choice) => (
          <option key={choice} value={choice}>
            {t(THEME_LABEL_KEY[choice])}
          </option>
        ))}
      </select>
    </label>
  )
}
