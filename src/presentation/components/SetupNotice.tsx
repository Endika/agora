import { useTranslation } from 'react-i18next'

/**
 * A missing integration must not be a blank page. This is what shows when the Supabase URL or key is
 * absent — the app says what is wrong and what to do, instead of throwing in the console.
 */
export function SetupNotice({ detail }: { detail: string }) {
  const { t } = useTranslation()
  return (
    <main className="mx-auto grid max-w-2xl gap-4 px-4 py-10" role="alert">
      <h1 className="text-3xl font-semibold">{t('setup.heading')}</h1>
      <p style={{ color: 'var(--ink-muted)' }}>{t('setup.explain')}</p>
      <p className="text-sm" style={{ fontFamily: 'var(--font-data)', color: 'var(--danger)' }}>
        {detail}
      </p>
    </main>
  )
}
