import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { VoteValue } from '@/domain/entities/Proposal'
import type { BoardSnapshot } from '@/domain/repositories/BoardRepository'
import { useBoard } from '@/presentation/context/boardContext'
import { BoardFilters, type Filter } from './BoardFilters'
import { ProposalCard } from './ProposalCard'

/** The list arrives already ordered by the repository; the spec's order is not the view's opinion. */
export function BoardPage({ board }: { board: BoardSnapshot }) {
  const { t } = useTranslation()
  const { repo, reload } = useBoard()
  const [filter, setFilter] = useState<Filter>({ kind: 'all' })

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

  return (
    <section className="grid gap-4" aria-label={board.group.name}>
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
