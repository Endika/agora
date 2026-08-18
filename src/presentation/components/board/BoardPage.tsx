import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { VoteValue } from '@/domain/entities/Proposal'
import type { BoardSnapshot } from '@/domain/repositories/BoardRepository'
import { useBoard } from '@/presentation/context/boardContext'
import { ProposalForm, type ProposalDraft } from '@/presentation/components/proposal/ProposalForm'
import { BoardFilters, type Filter } from './BoardFilters'
import { ProposalCard } from './ProposalCard'

/** The list arrives already ordered by the repository; the spec's order is not the view's opinion. */
export function BoardPage({ board }: { board: BoardSnapshot }) {
  const { t } = useTranslation()
  const { repo, reload } = useBoard()
  const [filter, setFilter] = useState<Filter>({ kind: 'all' })
  const [composing, setComposing] = useState(false)

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

  const act = (run: () => Promise<unknown>) => {
    void run().then(reload)
  }

  const publish = (draft: ProposalDraft) => {
    setComposing(false)
    act(() => repo.createProposal({ slug: board.group.slug, ...draft }))
  }

  return (
    <section className="grid gap-4" aria-label={board.group.name}>
      {composing ? (
        <ProposalForm
          others={board.proposals}
          onSubmit={publish}
          onCancel={() => setComposing(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="min-h-11 justify-self-start rounded-[--radius] px-4 font-medium"
          style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
        >
          {t('proposal.new')}
        </button>
      )}

      <BoardFilters tags={tags} pendingMine={pendingMine} filter={filter} onChange={setFilter} />

      {visible.length === 0 ? (
        <p style={{ color: 'var(--ink-muted)' }}>{t('board.empty')}</p>
      ) : (
        <ul className="grid gap-4">
          {visible.map((proposal) => (
            <li key={proposal.id} className="min-w-0">
              <ProposalCard
                proposal={proposal}
                participants={board.participants}
                meId={board.me.id}
                titleOf={(id) => board.proposals.find((other) => other.id === id)?.title}
                onVote={(value: VoteValue) =>
                  act(() =>
                    repo.castVote({ proposalId: proposal.id, round: proposal.round, value }),
                  )
                }
                onReopen={() => act(() => repo.reopenProposal(proposal.id))}
                onClose={(reason) =>
                  act(() => repo.closeProposal({ proposalId: proposal.id, reason }))
                }
                onComplete={() =>
                  act(() => repo.completeProposal({ proposalId: proposal.id, actualCents: null }))
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
