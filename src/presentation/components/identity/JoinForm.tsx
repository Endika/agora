import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EditPin } from '@/domain/value-objects/EditPin'
import { useBoard } from '@/presentation/context/boardContext'

interface Props {
  /** With a slug this joins an existing agora; without one it creates a new agora. */
  slug: string | null
  onDone: (slug: string) => void
  onRecover?: () => void
}

export function JoinForm({ slug, onDone, onRecover }: Props) {
  const { t } = useTranslation()
  const { repo } = useBoard()
  const [agoraName, setAgoraName] = useState('')
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (name.trim().length === 0) {
      setError(t('join.nameRequired'))
      return
    }
    try {
      EditPin.validateFormat(pin)
    } catch {
      setError(t('join.pinInvalid'))
      return
    }

    setBusy(true)
    try {
      const identity = slug
        ? await repo.joinAgora({ slug, name: name.trim(), pin })
        : await repo.createAgora({
            name: agoraName.trim() || name.trim(),
            creatorName: name.trim(),
            pin,
          })
      onDone(identity.slug)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setError(/name taken/i.test(message) ? t('join.nameTaken') : message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-4" noValidate>
      <h1 className="text-3xl font-semibold">
        {slug ? t('join.heading') : t('join.createHeading')}
      </h1>

      {!slug && (
        <label className="grid gap-1">
          <span className="font-medium">{t('join.agoraName')}</span>
          <input
            value={agoraName}
            onChange={(event) => setAgoraName(event.target.value)}
            maxLength={80}
            className="min-h-11 min-w-0 rounded-[--radius] border px-3"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          />
        </label>
      )}

      <label className="grid gap-1">
        <span className="font-medium">{t('join.yourName')}</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={40}
          autoComplete="nickname"
          className="min-h-11 min-w-0 rounded-[--radius] border px-3"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        />
      </label>

      {/* The hint is described, not labelled: inside the label it would become part of the field's
          accessible name. */}
      <div className="grid gap-1">
        <label htmlFor="join-pin" className="font-medium">
          {t('join.pin')}
        </label>
        <input
          id="join-pin"
          aria-describedby="join-pin-hint"
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="off"
          className="min-h-11 min-w-0 rounded-[--radius] border px-3"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            fontFamily: 'var(--font-data)',
          }}
        />
        <p id="join-pin-hint" className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {t('join.pinHint')}
        </p>
      </div>

      {/* role="alert" so a validation error is announced at once, and so a test can find it
          without matching the hint text. */}
      <p role="alert" style={{ color: 'var(--danger)' }}>
        {error ?? ''}
      </p>

      <button
        type="submit"
        disabled={busy}
        className="min-h-11 rounded-[--radius] px-4 font-medium disabled:opacity-60"
        style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
      >
        {slug ? t('join.submit') : t('join.create')}
      </button>

      {slug && onRecover && (
        <button type="button" onClick={onRecover} className="justify-self-start underline">
          {t('join.recoverLink')}
        </button>
      )}
    </form>
  )
}
