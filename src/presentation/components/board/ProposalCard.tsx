import { useTranslation } from 'react-i18next'
import type { Proposal, VoteValue } from '@/domain/entities/Proposal'
import type { Participant } from '@/domain/repositories/BoardRepository'
import type { Thread } from '@/domain/repositories/BoardRepository'
import { ImageGallery } from '@/presentation/components/proposal/ImageGallery'
import { ExpensePanel } from '@/presentation/components/expense/ExpensePanel'
import { ThreadList } from '@/presentation/components/threads/ThreadList'
import { MarkdownView } from '@/presentation/components/proposal/MarkdownView'
import { MissingVoters } from './MissingVoters'
import { ProposalActions } from './ProposalActions'
import { QuorumBar } from './QuorumBar'
import { VoteControls } from './VoteControls'

interface Props {
  proposal: Proposal
  participants: Participant[]
  meId: string
  /** Links point at ids; the card shows titles, which is what a reader recognises. */
  titleOf: (proposalId: string) => string | undefined
  threads: Thread[]
  slug: string
  onChanged: () => void
  onEdit: () => void
  onVote: (value: VoteValue) => void
  onReopen: () => void
  onClose: (reason: string) => void
  onComplete: (actualCents: number | null) => void
}

const STATUS_COLOR: Record<Proposal['status'], string> = {
  open: 'var(--ink-muted)',
  approved: 'var(--pos)',
  rejected: 'var(--danger)',
  debating: 'var(--warn)',
  completed: 'var(--pos)',
  closed: 'var(--ink-muted)',
}

export function ProposalCard({
  proposal,
  participants,
  meId,
  titleOf,
  threads,
  slug,
  onChanged,
  onEdit,
  onVote,
  onReopen,
  onClose,
  onComplete,
}: Props) {
  const { t } = useTranslation()

  return (
    <article
      className="grid min-w-0 gap-4 rounded-[--radius] border p-4"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      aria-labelledby={`title-${proposal.id}`}
    >
      <header className="grid min-w-0 gap-1">
        <h3 id={`title-${proposal.id}`} className="text-lg font-semibold">
          {proposal.title}
        </h3>
        <p
          className="flex flex-wrap gap-x-3 text-sm"
          style={{ color: STATUS_COLOR[proposal.status] }}
        >
          <span>{t(`status.${proposal.status}`)}</span>
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

      <QuorumBar proposal={proposal} participants={participants.length} />

      {proposal.status === 'open' && (
        <>
          <VoteControls proposal={proposal} onVote={onVote} />
          <MissingVoters pending={proposal.pending} participants={participants} />
        </>
      )}

      <ExpensePanel
        proposal={proposal}
        participants={participants}
        meId={meId}
        onChanged={onChanged}
      />

      <ThreadList
        proposalId={proposal.id}
        proposalAuthorId={proposal.createdBy}
        threads={threads}
        participants={participants}
        meId={meId}
        slug={slug}
        onChanged={onChanged}
      />

      <ProposalActions
        proposal={proposal}
        meId={meId}
        onEdit={onEdit}
        onReopen={onReopen}
        onClose={onClose}
        onComplete={onComplete}
      />
    </article>
  )
}
