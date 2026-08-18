import { useTranslation } from 'react-i18next'
import type { Proposal, VoteValue } from '@/domain/entities/Proposal'
import type { Participant, Thread } from '@/domain/repositories/BoardRepository'
import { formatCents } from '@/presentation/components/expense/money'
import { PsephoiRow } from '@/presentation/components/vote/PsephoiRow'
import { excerpt } from '@/presentation/utils/excerpt'
import { proposalHref } from '@/presentation/routing'
import { DeadlineChip } from './DeadlineChip'
import { MissingVoters } from './MissingVoters'
import { VoteControls } from './VoteControls'

interface Props {
  proposal: Proposal
  participants: Participant[]
  threads: Thread[]
  slug: string
  onVote: (value: VoteValue) => void
}

const STATUS_COLOR: Record<Proposal['status'], string> = {
  open: 'var(--ink-muted)',
  approved: 'var(--pos)',
  rejected: 'var(--danger)',
  debating: 'var(--warn)',
  completed: 'var(--pos)',
  closed: 'var(--ink-muted)',
}

/**
 * The list row: enough to decide, not everything there is.
 *
 * Title, a taste of the description, how the vote is going, how long is left, and the three vote buttons —
 * because voting from the list is the thing people do most. Comments, images, the expense breakdown and the
 * actions live in the proposal itself, one tap away.
 */
export function ProposalCard({ proposal, participants, threads, slug, onVote }: Props) {
  const { t, i18n } = useTranslation()
  const comments = threads.reduce((total, thread) => total + thread.commentCount, 0)
  const preview = excerpt(proposal.description)

  return (
    <article
      className="grid min-w-0 gap-3 rounded-[--radius] border p-4"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      aria-labelledby={`title-${proposal.id}`}
    >
      <header className="grid min-w-0 gap-1">
        <h3 id={`title-${proposal.id}`} className="break-words text-lg font-semibold">
          <a href={proposalHref(slug, proposal.id)} className="hover:underline">
            {proposal.title}
          </a>
        </h3>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span style={{ color: STATUS_COLOR[proposal.status] }}>
            {t(`status.${proposal.status}`)}
          </span>
          {proposal.status === 'open' && <DeadlineChip deadline={proposal.deadline} />}
          {proposal.round > 1 && (
            <span style={{ color: 'var(--ink-muted)' }}>
              {t('actions.round', { round: proposal.round })}
            </span>
          )}
          {proposal.tags.map((tag) => (
            <span key={tag} style={{ color: 'var(--ink-muted)' }}>
              #{tag}
            </span>
          ))}
        </p>
      </header>

      {preview.length > 0 && (
        <p className="break-words text-sm" style={{ color: 'var(--ink-muted)' }}>
          {preview}
        </p>
      )}

      <div className="grid gap-1">
        <PsephoiRow
          participants={participants.length}
          cast={proposal.tally.cast}
          revealed={proposal.votes?.map((vote) => vote.value) ?? null}
        />
        <p
          className="text-sm"
          style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-data)' }}
        >
          {t('quorum.progress', { cast: proposal.tally.cast, total: participants.length })}
          {proposal.votesRevealed ? ` · ${t('quorum.net', { net: proposal.tally.net })}` : ''}
        </p>
      </div>

      {proposal.status === 'open' && (
        <>
          <VoteControls proposal={proposal} onVote={onVote} />
          <MissingVoters pending={proposal.pending} participants={participants} />
        </>
      )}

      <p className="flex flex-wrap gap-x-3 text-sm" style={{ color: 'var(--ink-muted)' }}>
        {comments > 0 && <span>{t('board.comments', { count: comments })}</span>}
        {proposal.images.length > 0 && (
          <span>{t('board.images', { count: proposal.images.length })}</span>
        )}
        {(proposal.actualCents ?? proposal.estimatedCents) !== null && (
          <span style={{ fontFamily: 'var(--font-data)' }}>
            {formatCents(proposal.actualCents ?? proposal.estimatedCents!, i18n.language)}
          </span>
        )}
      </p>

      <a
        href={proposalHref(slug, proposal.id)}
        className="min-h-11 content-center justify-self-start underline"
      >
        {t('board.openProposal')}
      </a>
    </article>
  )
}
