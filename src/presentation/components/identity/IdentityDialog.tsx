import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AgoraPreview } from '@/domain/repositories/BoardRepository'
import { useBoard } from '@/presentation/context/boardContext'

/**
 * The "who are you?" step. Someone opens the link, we do not know them, so we ask — a list of the
 * names in the agora plus a way to add one. No PIN: a name is the only thing being asked for, and
 * picking a name that is already there is how you move your identity to a new phone.
 */
export function IdentityDialog({ slug, onIdentified }: { slug: string; onIdentified: () => void }) {
  const { t } = useTranslation()
  const { repo } = useBoard()
  const [preview, setPreview] = useState<AgoraPreview | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    void repo
      .preview(slug)
      .then((result) => {
        if (live) setPreview(result)
      })
      .catch((cause: unknown) => {
        if (live) setError(cause instanceof Error ? cause.message : String(cause))
      })
    return () => {
      live = false
    }
  }, [repo, slug])

  const claim = async (participantId: string) => {
    setBusy(true)
    try {
      await repo.claim({ slug, participantId })
      onIdentified()
    } finally {
      setBusy(false)
    }
  }

  const add = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (name.trim().length === 0) {
      setError(t('identity.nameRequired'))
      return
    }
    setBusy(true)
    try {
      await repo.addParticipant({ slug, name: name.trim() })
      onIdentified()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setError(/name taken/i.test(message) ? t('identity.nameTaken') : message)
    } finally {
      setBusy(false)
    }
  }

  if (!preview) {
    return (
      <p role="status" style={{ color: 'var(--ink-muted)' }}>
        {error ?? t('common.loading')}
      </p>
    )
  }

  return (
    <section className="grid gap-4" aria-labelledby="who-heading">
      <div className="grid gap-1">
        <h2 id="who-heading" className="text-2xl font-semibold">
          {t('identity.who')}
        </h2>
        <p style={{ color: 'var(--ink-muted)' }}>
          {t('identity.whoExplain', { agora: preview.name })}
        </p>
      </div>

      {!adding && (
        <>
          <ul className="grid gap-2">
            {preview.participants.map((participant) => (
              <li key={participant.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void claim(participant.id)}
                  className="min-h-11 w-full rounded-[--radius] border px-4 text-left font-medium disabled:opacity-60"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  {participant.name}
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => setAdding(true)}
            className="min-h-11 justify-self-start rounded-[--radius] px-4 font-medium"
            style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
          >
            {t('identity.notOnTheList')}
          </button>
        </>
      )}

      {adding && (
        <form onSubmit={(event) => void add(event)} className="grid gap-3" noValidate>
          <label className="grid gap-1">
            <span className="font-medium">{t('identity.yourName')}</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={40}
              autoComplete="nickname"
              className="min-h-11 min-w-0 rounded-[--radius] border px-3"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            />
          </label>

          <p role="alert" style={{ color: 'var(--danger)' }}>
            {error ?? ''}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 rounded-[--radius] px-4 font-medium disabled:opacity-60"
              style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
            >
              {t('identity.add')}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="min-h-11 rounded-[--radius] border px-4"
              style={{ borderColor: 'var(--border)' }}
            >
              {t('identity.back')}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
