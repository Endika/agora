import { useTranslation } from 'react-i18next'
import { Logo } from '@/presentation/components/Logo'

/**
 * Short, plain and honest — a privacy notice nobody reads is a dark pattern with extra steps. It names every
 * processor, says where the data actually sits (London, not "the EU"), and points at the two things a person
 * can do about it: export the agora, or delete it.
 */
export function PrivacyNotice() {
  const { t } = useTranslation()

  const section = (heading: string, body: string[]) => (
    <section className="grid gap-2" key={heading}>
      <h2 className="text-xl font-semibold">{t(heading)}</h2>
      {body.map((key) => (
        <p key={key}>{t(key)}</p>
      ))}
    </section>
  )

  return (
    <main className="mx-auto grid max-w-2xl gap-6 px-4 py-8">
      <header className="grid gap-2">
        <div className="flex items-center gap-3">
          <Logo size={32} />
          <h1 className="text-3xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
            {t('privacy.title')}
          </h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {t('privacy.updated')}
        </p>
      </header>

      {section('privacy.whoHeading', ['privacy.who'])}
      {section('privacy.whatHeading', ['privacy.what', 'privacy.noAccounts'])}
      {section('privacy.basisHeading', ['privacy.basis'])}
      {section('privacy.visibleHeading', ['privacy.visible'])}

      <section className="grid gap-2">
        <h2 className="text-xl font-semibold">{t('privacy.processorsHeading')}</h2>
        <ul className="grid gap-2">
          <li>{t('privacy.supabase')}</li>
          <li>{t('privacy.github')}</li>
        </ul>
        <p>{t('privacy.noAnalytics')}</p>
      </section>

      {section('privacy.retentionHeading', ['privacy.retention'])}
      {section('privacy.rightsHeading', ['privacy.rights'])}
      {section('privacy.deviceHeading', ['privacy.device'])}

      <a href="#/" className="min-h-11 content-center underline">
        {t('footer.back')}
      </a>
    </main>
  )
}
