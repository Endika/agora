import { useTranslation } from 'react-i18next'
import type { Proposal, VoteValue } from '@/domain/entities/Proposal'
import type { BoardSnapshot } from '@/domain/repositories/BoardRepository'
import { ExpensePanel } from '@/presentation/components/expense/ExpensePanel'
import { ImageGallery } from '@/presentation/components/proposal/ImageGallery'
import { MarkdownView } from '@/presentation/components/proposal/MarkdownView'
import { ThreadList } from '@/presentation/components/threads/ThreadList'
import { PsephoiRow } from '@/presentation/components/vote/PsephoiRow'
import { DeadlineChip } from './DeadlineChip'
import { MissingVoters } from './MissingVoters'
import { ProposalActions } from './ProposalActions'
import { VoteControls } from './VoteControls'

interface Props {
  proposal: Proposal
  board: BoardSnapshot
  onVote: (value: VoteValue) => void
  onEdit: () => void
  onReopen: () => void
  onClose: (reason: string) => void
  onComplete: (actualCents: number | null) => void
  onChanged: () => void
}

/** Everything about one proposal: the full text, the images, the money and the conversation. */
export function ProposalDetail({
  proposal,
  board,
  onVote,
  onEdit,
  onReopen,
  onClose,
  onComplete,
  onChanged,
}: Props) {
  const { t } = useTranslation()
  const titleOf = (id: string) => board.proposals.find((other) => other.id === id)?.title

  return (
    <article className="grid min-w-0 gap-5">
      <header className="grid min-w-0 gap-2">
        <h2 className="break-words text-2xl font-semibold">{proposal.title}</h2>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span>{t(`status.${proposal.status}`)}</span>
          {proposal.status === 'open' && <DeadlineChip deadline={proposal.deadline} />}
          {proposal.round > 1 && <span>{t('actions.round', { round: proposal.round })}</span>}
          {proposal.tags.map((tag) => (
            <span key={tag} style={{ color: 'var(--ink-muted)' }}>
              #{tag}
            </span>
          ))}
        </p>
      </header>

      {proposal.description.trim().length > 0 && <MarkdownView markdown={proposal.description} />}

      <ImageGallery images={proposal.images} />

      {proposal.links.map((link) => (
        <p
          key={`${link.kind}-${link.toId}`}
          className="text-sm"
          style={{ color: 'var(--ink-muted)' }}
        >
          {t(link.kind === 'related' ? 'proposal.linkRelated' : 'proposal.linkSupersedes')}:{' '}
          {titleOf(link.toId) ?? '—'}
        </p>
      ))}

      {proposal.closedReason && (
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {proposal.closedReason}
        </p>
      )}

      <div className="grid gap-2">
        <PsephoiRow
          participants={board.participants.length}
          cast={proposal.tally.cast}
          revealed={proposal.votes?.map((vote) => vote.value) ?? null}
        />
        {proposal.status === 'open' && (
          <>
            <VoteControls proposal={proposal} onVote={onVote} />
            <MissingVoters pending={proposal.pending} participants={board.participants} />
          </>
        )}
      </div>

      <ExpensePanel
        proposal={proposal}
        participants={board.participants}
        meId={board.me.id}
        onChanged={onChanged}
      />

      <ThreadList
        proposalId={proposal.id}
        proposalAuthorId={proposal.createdBy}
        threads={board.threads.filter((thread) => thread.proposalId === proposal.id)}
        participants={board.participants}
        meId={board.me.id}
        slug={board.group.slug}
        onChanged={onChanged}
      />

      <ProposalActions
        proposal={proposal}
        meId={board.me.id}
        onEdit={onEdit}
        onReopen={onReopen}
        onClose={onClose}
        onComplete={onComplete}
      />
    </article>
  )
}
