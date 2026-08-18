import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { JoinForm } from '@/presentation/components/identity/JoinForm'
import { RecoverPinDialog } from '@/presentation/components/identity/RecoverPinDialog'
import { ShareAgoraDialog } from '@/presentation/components/identity/ShareAgoraDialog'
import { useBoard } from '@/presentation/context/boardContext'
import { openAgora } from '@/presentation/routing'

export function AgoraApp() {
  const { t } = useTranslation()
  const { slug, board, status, error, reload } = useBoard()
  const [recovering, setRecovering] = useState(false)

  return (
    <main className="mx-auto grid max-w-2xl gap-8 px-4 py-8">
      <header className="grid gap-1">
        <h1 className="text-4xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
          {t('app.name')}
        </h1>
        <p style={{ color: 'var(--ink-muted)' }}>{t('app.tagline')}</p>
      </header>

      {status === 'loading' && <p aria-live="polite">{t('common.loading')}</p>}

      {status === 'error' && (
        <p aria-live="polite" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      {status === 'idle' && <JoinForm slug={null} onDone={openAgora} />}

      {status === 'joining' && slug && !recovering && (
        <JoinForm slug={slug} onDone={reload} onRecover={() => setRecovering(true)} />
      )}

      {status === 'joining' && slug && recovering && (
        <RecoverPinDialog slug={slug} onDone={reload} />
      )}

      {status === 'ready' && board && (
        <>
          <section className="grid gap-2">
            <h2 className="text-2xl font-semibold">{board.group.name}</h2>
            <ul className="flex flex-wrap gap-2">
              {board.participants.map((participant) => (
                <li
                  key={participant.id}
                  className="rounded-full px-3 py-1 text-sm"
                  style={{ background: 'var(--surface-sunken)' }}
                >
                  {participant.name}
                </li>
              ))}
            </ul>
          </section>
          <ShareAgoraDialog slug={board.group.slug} />
        </>
      )}
    </main>
  )
}
