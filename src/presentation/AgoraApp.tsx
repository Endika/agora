import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AgoraList } from '@/presentation/components/AgoraList'
import { BoardPage } from '@/presentation/components/board/BoardPage'
import { CreateAgoraForm } from '@/presentation/components/identity/CreateAgoraForm'
import { DangerZone } from '@/presentation/components/identity/DangerZone'
import { IdentityDialog } from '@/presentation/components/identity/IdentityDialog'
import { ShareAgoraDialog } from '@/presentation/components/identity/ShareAgoraDialog'
import { Logo } from '@/presentation/components/Logo'
import { useBoard } from '@/presentation/context/boardContext'
import { openAgora } from '@/presentation/routing'

export function AgoraApp() {
  const { t } = useTranslation()
  const { slug, board, status, error, reload, visited } = useBoard()
  const [switching, setSwitching] = useState(false)
  const knownAgoras = visited.list()

  const identified = () => {
    setSwitching(false)
    reload()
  }

  return (
    <div className="grid min-h-dvh grid-rows-[1fr_auto]">
      <main className="mx-auto grid w-full max-w-2xl content-start gap-8 px-4 py-8">
        <header className="grid gap-1">
          <div className="flex items-center gap-3">
            <Logo />
            <h1 className="text-4xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              {t('app.name')}
            </h1>
          </div>
          <p style={{ color: 'var(--ink-muted)' }}>{t('app.tagline')}</p>
        </header>

        {status === 'loading' && <p role="status">{t('common.loading')}</p>}

        {status === 'error' && (
          <p role="alert" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        {status === 'idle' && (
          <>
            <AgoraList agoras={knownAgoras} onOpen={openAgora} />
            <CreateAgoraForm onCreated={openAgora} />
          </>
        )}

        {slug && (status === 'joining' || switching) && (
          <IdentityDialog slug={slug} onIdentified={identified} />
        )}

        {status === 'ready' && board && !switching && (
          <>
            <section className="grid gap-2">
              <h2 className="text-2xl font-semibold">{board.group.name}</h2>
              <p
                className="flex flex-wrap items-center gap-3 text-sm"
                style={{ color: 'var(--ink-muted)' }}
              >
                <span>{t('home.youAre', { name: board.me.name })}</span>
                <button type="button" onClick={() => setSwitching(true)} className="underline">
                  {t('identity.switch')}
                </button>
              </p>
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

            <BoardPage board={board} />

            {/* Folded away: sharing matters once, the board matters every time. */}
            <details
              className="rounded-[--radius] border p-4"
              style={{ borderColor: 'var(--border)' }}
            >
              <summary className="min-h-11 cursor-pointer font-medium">
                {t('share.heading')}
              </summary>
              <div className="grid gap-6 pt-4">
                <ShareAgoraDialog slug={board.group.slug} />
                <DangerZone
                  slug={board.group.slug}
                  agoraName={board.group.name}
                  onDeleted={() => {
                    visited.forget(board.group.slug)
                    window.location.hash = ''
                  }}
                />
              </div>
            </details>
          </>
        )}
      </main>

      <footer
        className="mx-auto w-full max-w-2xl px-4 py-6 text-sm"
        style={{ color: 'var(--ink-muted)' }}
      >
        {t('footer.version', { version: __APP_VERSION__ })}
      </footer>
    </div>
  )
}
