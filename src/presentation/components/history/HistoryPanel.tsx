import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BoardSnapshot, HistoryEntry } from '@/domain/repositories/BoardRepository'
import { formatCents } from '@/presentation/components/expense/money'
import { useBoard } from '@/presentation/context/boardContext'

/**
 * Who did what, newest first, as sentences.
 *
 * Two things this deliberately does not do: invent an actor for events nobody performed — a proposal
 * resolving is the quorum's doing, not a person's — and print the raw status the database uses. The line
 * says which proposal it is about, because a history without titles is unreadable a week later.
 */
export function HistoryPanel({ board }: { board: BoardSnapshot }) {
  const { t, i18n } = useTranslation()
  const { repo } = useBoard()
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  // Fetched here, not shipped with the board: this is the field that grows per action, and almost nobody
  // opens it. The component only mounts when the disclosure is open.
  useEffect(() => {
    let live = true
    void repo
      .history({ slug: board.group.slug })
      .then((result) => {
        if (live) setEntries(result)
      })
      .catch((cause: unknown) => {
        if (live) setFailure(cause instanceof Error ? cause.message : String(cause))
      })
    return () => {
      live = false
    }
  }, [repo, board.group.slug])

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
        : entry.type === 'payment_added'
          ? formatCents(Number(entry.description) || 0, i18n.language)
          : entry.description

    const key = `history.line.${entry.type}`
    if (!i18n.exists(key)) return t('history.line.fallback', { name, type: entry.type })
    return t(key, { name, title, detail })
  }

  if (failure !== null) {
    return (
      <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>
        {failure}
      </p>
    )
  }

  if (entries === null) {
    return (
      <p role="status" className="text-sm" style={{ color: 'var(--ink-muted)' }}>
        {t('common.loading')}
      </p>
    )
  }

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
