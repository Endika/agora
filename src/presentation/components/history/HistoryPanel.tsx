import { useTranslation } from 'react-i18next'
import type { BoardSnapshot } from '@/domain/repositories/BoardRepository'

/** Who did what, newest first. Attribution comes from the RPCs, so it cannot be spoofed by a client. */
export function HistoryPanel({ board }: { board: BoardSnapshot }) {
  const { t, i18n } = useTranslation()
  const nameOf = (id: string | null) =>
    board.participants.find((participant) => participant.id === id)?.name ?? t('history.someone')

  const when = new Intl.DateTimeFormat(i18n.language, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  const entries = [...board.history].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

  return (
    <section className="grid gap-2" aria-label={t('history.heading')}>
      {entries.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {t('history.empty')}
        </p>
      ) : (
        <ul className="grid gap-1 text-sm">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap gap-x-2">
              <span style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-data)' }}>
                {when.format(new Date(entry.createdAt))}
              </span>
              <span className="font-medium">{nameOf(entry.participantId)}</span>
              {/* An unknown type is shown raw rather than hidden: better a rough line than a silent gap. */}
              <span>
                {i18n.exists(`history.${entry.type}`) ? t(`history.${entry.type}`) : entry.type}
              </span>
              {entry.description && (
                <span style={{ color: 'var(--ink-muted)' }}>{entry.description}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
