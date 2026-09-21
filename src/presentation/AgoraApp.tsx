import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AgoraList } from '@/presentation/components/AgoraList'
import { BoardPage } from '@/presentation/components/board/BoardPage'
import { CreateAgoraForm } from '@/presentation/components/identity/CreateAgoraForm'
import { DangerZone } from '@/presentation/components/identity/DangerZone'
import { IdentityDialog } from '@/presentation/components/identity/IdentityDialog'
import { ShareAgoraDialog } from '@/presentation/components/identity/ShareAgoraDialog'
import { ExportButtons } from '@/presentation/components/history/ExportButtons'
import { HistoryPanel } from '@/presentation/components/history/HistoryPanel'
import type { OnlineDetector } from '@/domain/ports/OnlineDetector'
import { InstallPrompt } from '@/presentation/components/pwa/InstallPrompt'
import { SyncStatus } from '@/presentation/components/pwa/SyncStatus'
import { LanguagePicker } from '@/presentation/components/settings/LanguagePicker'
import { ThemePicker } from '@/presentation/components/settings/ThemePicker'
import { Logo } from '@/presentation/components/Logo'
import { useBoard } from '@/presentation/context/boardContext'
import { openAgora, privacyHref, type Route } from '@/presentation/routing'

export function AgoraApp({ network, route }: { network: OnlineDetector; route: Route }) {
  const { t } = useTranslation()
  const { slug, board, status, error, reload, visited, queue, sync } = useBoard()
  const [switching, setSwitching] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [knownAgoras, setKnownAgoras] = useState(() => visited.list())

  const identified = () => {
    setSwitching(false)
    reload()
  }

  return (
    <div className="grid min-h-dvh grid-rows-[1fr_auto]">
      {/* One readable column on a phone; from `lg` up, room for the board and an open proposal
          side by side rather than 300 px of empty ground on either flank. */}
      <main className="mx-auto grid w-full min-w-0 max-w-2xl content-start gap-8 px-4 py-8 lg:max-w-6xl">
        <header className="grid gap-1">
          <div className="flex items-center gap-3">
            <Logo />
            <h1 className="text-4xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              {t('app.name')}
            </h1>
          </div>
          <p style={{ color: 'var(--ink-muted)' }}>{t('app.tagline')}</p>
        </header>

        <InstallPrompt />

        <SyncStatus queue={queue} network={network} onReconnect={sync} />

        {status === 'loading' && <p role="status">{t('common.loading')}</p>}

        {status === 'error' && (
          <p role="alert" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        {status === 'idle' && (
          <>
            <AgoraList
              agoras={knownAgoras}
              onOpen={openAgora}
              onForget={(slug) => {
                visited.forget(slug)
                setKnownAgoras(visited.list())
              }}
            />
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
                {/* 129x20 px, and the first tab stop on the page. Not a 2.5.8 failure — the
                    nearest other target's centre is 316 px away, so Spacing applies, and it is
                    inline text, so Inline applies too — but 2.5.5 AAA asks for 44, and the first
                    thing a keyboard or a shaky hand lands on is the wrong place to spend the
                    exception. Same pair the privacy link in the footer already carries. */}
                <button
                  type="button"
                  onClick={() => setSwitching(true)}
                  className="min-h-11 content-center underline"
                >
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

            <BoardPage board={board} route={route} />

            {/* Folded away: the board matters every time, everything below it does not. */}
            {/* The panel is only mounted once the disclosure is open, which is what makes the fetch lazy. */}
            <details
              className="rounded-[--radius] border p-4"
              style={{ borderColor: 'var(--border)' }}
              onToggle={(event) => setHistoryOpen(event.currentTarget.open)}
            >
              <summary className="min-h-11 cursor-pointer font-medium">
                {t('history.heading')}
              </summary>
              <div className="pt-4">{historyOpen && <HistoryPanel board={board} />}</div>
            </details>

            <details
              className="rounded-[--radius] border p-4"
              style={{ borderColor: 'var(--border)' }}
            >
              <summary className="min-h-11 cursor-pointer font-medium">
                {t('share.heading')}
              </summary>
              <div className="pt-4">
                <ShareAgoraDialog slug={board.group.slug} />
              </div>
            </details>

            <details
              className="rounded-[--radius] border p-4"
              style={{ borderColor: 'var(--border)' }}
            >
              <summary className="min-h-11 cursor-pointer font-medium">
                {t('export.heading')}
              </summary>
              <div className="pt-4">
                <ExportButtons board={board} />
              </div>
            </details>

            <details
              className="rounded-[--radius] border-2 p-4"
              style={{ borderColor: 'var(--danger)' }}
            >
              <summary
                className="min-h-11 cursor-pointer font-medium"
                style={{ color: 'var(--danger)' }}
              >
                {t('danger.heading')}
              </summary>
              <div className="pt-4">
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
        className="mx-auto flex w-full max-w-2xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-6 text-sm lg:max-w-6xl"
        style={{ color: 'var(--ink-muted)' }}
      >
        <span>{t('footer.version', { version: __APP_VERSION__ })}</span>
        {/* Carries the agora along: half of "who can see this" is the ballot mode, and the notice
            can only name the reader's own if it knows which agora they are reading from. */}
        <a href={privacyHref(slug)} className="min-h-11 content-center underline">
          {t('footer.privacy')}
        </a>
        <LanguagePicker />
        <ThemePicker />
      </footer>
    </div>
  )
}
