import { useTranslation } from 'react-i18next'
import type { BoardSnapshot, HistoryEntry } from '@/domain/repositories/BoardRepository'
import { formatCents } from '@/presentation/components/expense/money'

/**
 * Who did what, newest first, as sentences.
 *
 * Two things this deliberately does not do: invent an actor for events nobody performed — a proposal
 * resolving is the quorum's doing, not a person's — and print the raw status the database uses. The line
 * says which proposal it is about, because a history without titles is unreadable a week later.
 */
export function HistoryPanel({ board }: { board: BoardSnapshot }) {
  const { t, i18n } = useTranslation()

  const when = new Intl.DateTimeFormat(i18n.language, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  const line = (entry: HistoryEntry): string => {
    const name = board.participants.find((p) => p.id === entry.participantId)?.name ?? ''
    const title =
      board.proposals.find((proposal) => proposal.id === entry.proposalId)?.title ??
      t('history.line.deletedProposal')

    const detail =
      entry.type === 'resolved'
        ? t(`status.${entry.description}`, { defaultValue: entry.description })
        : entry.type === 'liquidation_added'
          ? formatCents(Number(entry.description) || 0, i18n.language)
          : entry.description

    const key = `history.line.${entry.type}`
    if (!i18n.exists(key)) return t('history.line.fallback', { name, type: entry.type })
    return t(key, { name, title, detail })
  }

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
              <span className="min-w-0">{line(entry)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
