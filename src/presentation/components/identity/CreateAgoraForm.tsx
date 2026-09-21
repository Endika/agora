import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBoard } from '@/presentation/context/boardContext'

/** Two fields, both of them names: what the agora is called and what you are called. */
export function CreateAgoraForm({ onCreated }: { onCreated: (slug: string) => void }) {
  const { t } = useTranslation()
  const { repo } = useBoard()
  const [agoraName, setAgoraName] = useState('')
  const [name, setName] = useState('')
  // The secret mode is the default: the easy path is the one that protects.
  const [ballotOpen, setBallotOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (agoraName.trim().length === 0) {
      setError(t('create.nameRequired'))
      return
    }
    if (name.trim().length === 0) {
      setError(t('identity.nameRequired'))
      return
    }
    setBusy(true)
    try {
      const identity = await repo.createAgora({
        name: agoraName.trim(),
        creatorName: name.trim(),
        ballotOpen,
      })
      onCreated(identity.slug)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const field = { background: 'var(--surface)', borderColor: 'var(--border)' }

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-4" noValidate>
      <h2 className="text-2xl font-semibold">{t('create.heading')}</h2>

      <div className="grid gap-1">
        <label htmlFor="create-agora-name" className="font-medium">
          {t('create.agoraName')}
        </label>
        <input
          id="create-agora-name"
          aria-describedby="create-agora-name-hint"
          value={agoraName}
          onChange={(event) => setAgoraName(event.target.value)}
          maxLength={80}
          className="min-h-11 min-w-0 rounded-[--radius] border px-3"
          style={field}
        />
        <p id="create-agora-name-hint" className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {t('create.agoraNameHint')}
        </p>
      </div>

      <fieldset className="grid gap-2 rounded-[--radius] border p-3" style={field}>
        <legend className="px-1 font-medium">{t('create.ballotMode.legend')}</legend>

        <div className="grid min-h-11 grid-cols-[auto_1fr] items-start gap-x-2 gap-y-0.5 py-1">
          <input
            type="radio"
            id="ballot-mode-secret"
            name="ballotMode"
            checked={!ballotOpen}
            onChange={() => setBallotOpen(false)}
            aria-describedby="ballot-mode-secret-hint"
            className="mt-1 h-5 w-5"
          />
          <label htmlFor="ballot-mode-secret" className="font-medium">
            {t('create.ballotMode.secretLabel')}
          </label>
          <span />
          <p id="ballot-mode-secret-hint" className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            {t('create.ballotMode.secretHint')}
          </p>
        </div>

        <div className="grid min-h-11 grid-cols-[auto_1fr] items-start gap-x-2 gap-y-0.5 py-1">
          <input
            type="radio"
            id="ballot-mode-open"
            name="ballotMode"
            checked={ballotOpen}
            onChange={() => setBallotOpen(true)}
            aria-describedby="ballot-mode-open-hint"
            className="mt-1 h-5 w-5"
          />
          <label htmlFor="ballot-mode-open" className="font-medium">
            {t('create.ballotMode.openLabel')}
          </label>
          <span />
          <p id="ballot-mode-open-hint" className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            {t('create.ballotMode.openHint')}
          </p>
        </div>
      </fieldset>

      <label className="grid gap-1">
        <span className="font-medium">{t('identity.yourName')}</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={40}
          autoComplete="nickname"
          className="min-h-11 min-w-0 rounded-[--radius] border px-3"
          style={field}
        />
      </label>

      {error && (
        <p role="alert" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="min-h-11 justify-self-start rounded-[--radius] px-4 font-medium disabled:opacity-60"
        style={{ background: 'var(--brand-strong)', color: 'var(--brand-ink)' }}
      >
        {t('create.submit')}
      </button>
    </form>
  )
}
