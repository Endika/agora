import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { VoteValue } from '@/domain/entities/Proposal'
import type { BoardSnapshot } from '@/domain/repositories/BoardRepository'
import { useBoard } from '@/presentation/context/boardContext'
import { useAction } from '@/presentation/useAction'
import { ProposalForm, type ProposalDraft } from '@/presentation/components/proposal/ProposalForm'
import { Sheet } from '@/presentation/components/Sheet'
import { BoardFilters, type Filter } from './BoardFilters'
import { ProposalCard } from './ProposalCard'

/** The list arrives already ordered by the repository; the spec's order is not the view's opinion. */
export function BoardPage({ board }: { board: BoardSnapshot }) {
  const { t } = useTranslation()
  const { repo, reload, images: pipeline } = useBoard()
  const [filter, setFilter] = useState<Filter>({ kind: 'all' })
  const { run, error } = useAction()
  const [composing, setComposing] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  const tags = useMemo(
    () => [...new Set(board.proposals.flatMap((proposal) => proposal.tags))].sort(),
    [board.proposals],
  )

  const pendingMine = board.proposals.filter(
    (proposal) => proposal.status === 'open' && proposal.myVote === null,
  ).length

  const visible = board.proposals.filter((proposal) => {
    if (filter.kind === 'pending-mine')
      return proposal.status === 'open' && proposal.myVote === null
    if (filter.kind === 'tag') return proposal.tags.includes(filter.tag)
    return true
  })

  const act = (action: () => Promise<unknown>) => run(action, reload)

  // Images are picked before the proposal exists, so they are uploaded once it has an id.
  const attachAll = async (proposalId: string, draft: ProposalDraft) => {
    for (const prepared of draft.images) {
      await pipeline.attach({ slug: board.group.slug, proposalId, prepared })
    }
  }

  const publish = ({ images: picked, ...draft }: ProposalDraft) => {
    setComposing(false)
    act(async () => {
      const proposalId = await repo.createProposal({ slug: board.group.slug, ...draft })
      await attachAll(proposalId, { ...draft, images: picked })
    })
  }

  const save = (proposalId: string, { images: picked, ...draft }: ProposalDraft) => {
    setEditing(null)
    act(async () => {
      await repo.updateProposal({ proposalId, ...draft })
      await attachAll(proposalId, { ...draft, images: picked })
    })
  }

  // Finished proposals are kept, not deleted — they just stop competing for attention.
  const isArchived = (status: string) => ['completed', 'rejected', 'closed'].includes(status)
  const live = visible.filter((proposal) => !isArchived(proposal.status))
  const archived = visible.filter((proposal) => isArchived(proposal.status))
  const beingEdited = board.proposals.find((proposal) => proposal.id === editing)

  const card = (proposal: (typeof board.proposals)[number]) => (
    <li key={proposal.id} className="min-w-0">
      <ProposalCard
        proposal={proposal}
        participants={board.participants}
        meId={board.me.id}
        titleOf={(id) => board.proposals.find((other) => other.id === id)?.title}
        threads={board.threads.filter((thread) => thread.proposalId === proposal.id)}
        slug={board.group.slug}
        onChanged={reload}
        onEdit={() => setEditing(proposal.id)}
        onVote={(value: VoteValue) =>
          act(() => repo.castVote({ proposalId: proposal.id, round: proposal.round, value }))
        }
        onReopen={() => act(() => repo.reopenProposal(proposal.id))}
        onClose={(reason) => act(() => repo.closeProposal({ proposalId: proposal.id, reason }))}
        onComplete={(actualCents) =>
          act(() => repo.completeProposal({ proposalId: proposal.id, actualCents }))
        }
      />
    </li>
  )

  return (
    <section className="grid gap-4" aria-label={board.group.name}>
      {composing && (
        <Sheet label={t('proposal.new')} onClose={() => setComposing(false)}>
          <ProposalForm
            others={board.proposals}
            onSubmit={publish}
            onCancel={() => setComposing(false)}
          />
        </Sheet>
      )}

      {beingEdited && (
        <Sheet label={t('proposal.editHeading')} onClose={() => setEditing(null)}>
          <ProposalForm
            others={board.proposals.filter((other) => other.id !== beingEdited.id)}
            initial={beingEdited}
            onSubmit={(draft) => save(beingEdited.id, draft)}
            onCancel={() => setEditing(null)}
          />
        </Sheet>
      )}

      {
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="min-h-11 justify-self-start rounded-[--radius] px-4 font-medium"
          style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
        >
          {t('proposal.new')}
        </button>
      }

      {error && (
        <p role="alert" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      <BoardFilters tags={tags} pendingMine={pendingMine} filter={filter} onChange={setFilter} />

      {live.length === 0 && archived.length === 0 ? (
        <p style={{ color: 'var(--ink-muted)' }}>{t('board.empty')}</p>
      ) : (
        <ul className="grid gap-4">{live.map(card)}</ul>
      )}

      {archived.length > 0 && (
        <details className="rounded-[--radius] border p-4" style={{ borderColor: 'var(--border)' }}>
          <summary className="min-h-11 cursor-pointer font-medium">
            {t('board.archived', { count: archived.length })}
          </summary>
          <div className="grid gap-3 pt-4">
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
              {t('board.archivedExplain')}
            </p>
            <ul className="grid gap-4">{archived.map(card)}</ul>
          </div>
        </details>
      )}
    </section>
  )
}
