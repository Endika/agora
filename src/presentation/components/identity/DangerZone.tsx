import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBoard } from '@/presentation/context/boardContext'

/** Erasure for real: rows and Storage objects. Guarded by typing the name, which stops slips. */
export function DangerZone({
  slug,
  agoraName,
  onDeleted,
}: {
  slug: string
  agoraName: string
  onDeleted: () => void
}) {
  const { t } = useTranslation()
  const { repo } = useBoard()
  const [confirmName, setConfirmName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    const result = await repo.deleteAgora({ slug, confirmName })
    if (result.ok) onDeleted()
    else setError(t('danger.mismatch'))
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-2" noValidate>
      <h3 className="font-semibold" style={{ color: 'var(--danger)' }}>
        {t('danger.heading')}
      </h3>
      <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
        {t('danger.explain')}
      </p>

      <label className="grid gap-1">
        <span className="text-sm font-medium">{t('danger.confirmLabel')}</span>
        <input
          value={confirmName}
          onChange={(event) => setConfirmName(event.target.value)}
          placeholder={agoraName}
          className="min-h-11 min-w-0 rounded-[--radius] border px-3"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        />
      </label>

      <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>
        {error ?? ''}
      </p>

      <button
        type="submit"
        disabled={confirmName.trim().length === 0}
        className="min-h-11 justify-self-start rounded-[--radius] px-4 font-medium disabled:opacity-50"
        style={{ background: 'var(--danger)', color: '#ffffff' }}
      >
        {t('danger.submit')}
      </button>
    </form>
  )
}
