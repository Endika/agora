import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBoard } from '@/presentation/context/boardContext'

/** Moving your name to a new phone. The PIN is checked on the server and throttled there. */
export function RecoverPinDialog({ slug, onDone }: { slug: string; onDone: () => void }) {
  const { t } = useTranslation()
  const { repo } = useBoard()
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      const result = await repo.recover({ slug, name: name.trim(), pin })
      if (result.ok) onDone()
      else setError(t('recover.wrongPin'))
    } catch (cause) {
      const code = (cause as { code?: string }).code
      setError(code === 'PT429' ? t('recover.throttled') : t('recover.wrongPin'))
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-4" noValidate>
      <h1 className="text-2xl font-semibold">{t('recover.heading')}</h1>
      <p style={{ color: 'var(--ink-muted)' }}>{t('recover.explain')}</p>

      <label className="grid gap-1">
        <span className="font-medium">{t('join.yourName')}</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="min-h-11 min-w-0 rounded-[--radius] border px-3"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        />
      </label>

      <label className="grid gap-1">
        <span className="font-medium">{t('join.pin')}</span>
        <input
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          className="min-h-11 min-w-0 rounded-[--radius] border px-3"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            fontFamily: 'var(--font-data)',
          }}
        />
      </label>

      {/* role="alert" so a validation error is announced at once, and so a test can find it
          without matching the hint text. */}
      <p role="alert" style={{ color: 'var(--danger)' }}>
        {error ?? ''}
      </p>

      <button
        type="submit"
        className="min-h-11 rounded-[--radius] px-4 font-medium"
        style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
      >
        {t('recover.submit')}
      </button>
    </form>
  )
}
