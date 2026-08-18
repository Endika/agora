import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { uuidv7 } from 'uuidv7'
import type { Participant, Thread as ThreadModel } from '@/domain/repositories/BoardRepository'
import { useBoard } from '@/presentation/context/boardContext'
import { useAction } from '@/presentation/useAction'
import { CommentForm } from './CommentForm'
import { Thread } from './Thread'

interface Props {
  proposalId: string
  proposalAuthorId: string
  threads: ThreadModel[]
  participants: Participant[]
  meId: string
  slug: string
  onChanged: () => void
}

export function ThreadList({
  proposalId,
  proposalAuthorId,
  threads,
  participants,
  meId,
  slug,
  onChanged,
}: Props) {
  const { t } = useTranslation()
  const { repo } = useBoard()
  const { run, error } = useAction()
  const [opening, setOpening] = useState(false)

  const open = (body: string) => {
    setOpening(false)
    run(
      () => repo.addThread({ threadId: uuidv7(), proposalId, commentId: uuidv7(), body }),
      onChanged,
    )
  }

  return (
    <section className="grid gap-3" aria-label={t('threads.heading')}>
      {threads.length === 0 && !opening && (
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {t('threads.none')}
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      {threads.map((thread) => (
        <Thread
          key={thread.id}
          thread={thread}
          participants={participants}
          meId={meId}
          proposalAuthorId={proposalAuthorId}
          slug={slug}
          onChanged={onChanged}
        />
      ))}

      {opening ? (
        <CommentForm label={t('threads.open')} onSend={open} />
      ) : (
        <button
          type="button"
          onClick={() => setOpening(true)}
          className="min-h-11 justify-self-start rounded-[--radius] border px-4"
          style={{ borderColor: 'var(--border)' }}
        >
          {t('threads.open')}
        </button>
      )}
    </section>
  )
}
