import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { uuidv7 } from 'uuidv7'
import type {
  Comment,
  Participant,
  Thread as ThreadModel,
} from '@/domain/repositories/BoardRepository'
import { useBoard } from '@/presentation/context/boardContext'
import { CommentForm } from './CommentForm'
import { CommentText } from './CommentText'

interface Props {
  thread: ThreadModel
  participants: Participant[]
  meId: string
  proposalAuthorId: string
  slug: string
  onChanged: () => void
}

/**
 * A resolved thread is collapsed for everyone and expandable by anyone — it is never deleted, because
 * the argument that got settled is often the reason a decision makes sense a month later.
 *
 * `<details>` does the collapsing, so it works before any JavaScript decides to.
 */
export function Thread({ thread, participants, meId, proposalAuthorId, slug, onChanged }: Props) {
  const { t } = useTranslation()
  const { repo } = useBoard()
  const [comments, setComments] = useState<Comment[] | null>(null)
  const resolved = thread.resolvedAt !== null
  const mayResolve = meId === thread.authorId || meId === proposalAuthorId

  const nameOf = (id: string) => participants.find((p) => p.id === id)?.name ?? '—'
  const shown = comments ?? thread.comments
  const hidden = thread.commentCount - shown.length

  const loadAll = async () => {
    setComments(await repo.threadComments({ slug, threadId: thread.id }))
  }

  const reply = (body: string) => {
    void repo
      .addComment({ commentId: uuidv7(), threadId: thread.id, body })
      .then(onChanged)
      .then(() => setComments(null))
  }

  const body = (
    <div className="grid gap-3 pt-3">
      <ul className="grid gap-3">
        {shown.map((comment) => (
          <li key={comment.id} className="grid gap-1">
            <span className="text-sm font-medium" style={{ color: 'var(--ink-muted)' }}>
              {nameOf(comment.authorId)}
            </span>
            <CommentText body={comment.body} />
          </li>
        ))}
      </ul>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => void loadAll()}
          className="min-h-11 justify-self-start underline"
        >
          {t('threads.showAll', { count: thread.commentCount })}
        </button>
      )}

      <CommentForm label={t('threads.reply')} onSend={reply} />

      {mayResolve && (
        <button
          type="button"
          onClick={() =>
            void repo
              .setThreadResolved({ threadId: thread.id, resolved: !resolved })
              .then(onChanged)
          }
          className="min-h-11 justify-self-start rounded-[--radius] border px-4"
          style={{ borderColor: 'var(--border)' }}
        >
          {resolved ? t('threads.reopen') : t('threads.resolve')}
        </button>
      )}
    </div>
  )

  const summary = (
    <>
      {resolved && (
        <span
          className="mr-2 rounded-full px-2 py-0.5 text-xs"
          style={{ background: 'var(--surface-sunken)', color: 'var(--pos)' }}
        >
          {t('threads.resolved')}
        </span>
      )}
      <span className="font-medium">{nameOf(thread.authorId)}</span>
      <span style={{ color: 'var(--ink-muted)' }}>
        {' '}
        · {t('threads.count', { count: thread.commentCount })}
      </span>
    </>
  )

  // Resolved threads start closed; open ones stay open, because they are the live conversation.
  return (
    <details
      open={!resolved}
      className="rounded-[--radius] border p-3"
      style={{ borderColor: 'var(--border)' }}
    >
      <summary className="min-h-11 cursor-pointer">{summary}</summary>
      {body}
    </details>
  )
}
