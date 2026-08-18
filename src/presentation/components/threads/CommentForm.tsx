import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export function CommentForm({ label, onSend }: { label: string; onSend: (body: string) => void }) {
  const { t } = useTranslation()
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (body.trim().length === 0) {
      setError(t('threads.empty'))
      return
    }
    setError(null)
    onSend(body.trim())
    setBody('')
  }

  return (
    <form onSubmit={submit} className="grid gap-2" noValidate>
      <label className="grid gap-1">
        <span className="text-sm font-medium">{label}</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={2}
          maxLength={2000}
          placeholder={t('threads.placeholder')}
          className="min-w-0 rounded-[--radius] border p-2"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        className="min-h-11 justify-self-start rounded-[--radius] px-4 font-medium"
        style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
      >
        {t('threads.send')}
      </button>
    </form>
  )
}
