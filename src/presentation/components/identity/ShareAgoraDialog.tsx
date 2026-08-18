import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { QrCode } from '@/presentation/components/QrCode'
import { agoraLink } from './agoraLink'

export function ShareAgoraDialog({ slug }: { slug: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const link = agoraLink(slug)

  const copy = async () => {
    await navigator.clipboard?.writeText(link)
    setCopied(true)
  }

  return (
    <section className="grid gap-4" aria-labelledby="share-heading">
      <p id="share-heading" style={{ color: 'var(--ink-muted)' }}>
        {t('share.explain')}
      </p>

      <a
        href={link}
        className="min-w-0 break-all underline"
        style={{ fontFamily: 'var(--font-data)' }}
      >
        {link}
      </a>

      <QrCode value={link} label={t('share.qrAlt')} />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void copy()}
          className="min-h-11 rounded-[--radius] px-4 font-medium"
          style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
        >
          {t('share.copy')}
        </button>
        <span aria-live="polite" style={{ color: 'var(--pos)' }}>
          {copied ? t('share.copied') : ''}
        </span>
      </div>
    </section>
  )
}
