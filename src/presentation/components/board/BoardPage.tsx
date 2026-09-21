import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Proposal, VoteValue } from '@/domain/entities/Proposal'
import type { BoardSnapshot } from '@/domain/repositories/BoardRepository'
import { ProposalForm, type ProposalDraft } from '@/presentation/components/proposal/ProposalForm'
import { Sheet } from '@/presentation/components/Sheet'
import { useBoard } from '@/presentation/context/boardContext'
import { clearDraft, draftKey } from '@/presentation/drafts'
import {
  boardHref,
  closeTo,
  openCompose,
  openEdit,
  proposalHref,
  type Route,
} from '@/presentation/routing'
import { useAction } from '@/presentation/useAction'
import { useWideViewport } from '@/presentation/useWideViewport'
import { BoardFilters, type Filter } from './BoardFilters'
import { ProposalCard } from './ProposalCard'
import { ProposalDetail } from './ProposalDetail'

/** The list arrives already ordered by the repository; the spec's order is not the view's opinion. */
export function BoardPage({ board, route }: { board: BoardSnapshot; route: Route }) {
  const { t } = useTranslation()
  const { repo, reload, images: pipeline } = useBoard()
  const { run, error, pendingFor, doneFor } = useAction()
  const [filter, setFilter] = useState<Filter>({ kind: 'all' })

  // From `lg` up there is room to read a proposal without covering the board it came from, so the
  // same route renders as a side panel instead of a sheet. Same address, same node, different shape.
  const wide = useWideViewport()

  // Writing and editing are routes, so the sheet that is open is a fact about the address bar and
  // never something this component has to remember.
  const composing = route.kind === 'compose'

  // Where a sheet goes when it is left. The edit sheet was opened from the proposal you were
  // reading, so cancelling or saving has to put that proposal back, not the list behind it.
  const closeHref =
    route.kind === 'edit'
      ? proposalHref(board.group.slug, route.proposalId)
      : boardHref(board.group.slug)
  const closeSheet = () => closeTo(closeHref)

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

  // How the ballot works is a property of the agora, not of any one proposal, so it is said once
  // here rather than once per open card — and it has to be read *before* the first vote button,
  // because "open at quorum, with your name on it" changes how somebody votes.
  //
  // Which tense, not whether. A list with nothing left open has nothing still to promise, but its
  // cards are covered in names against senses, and going silent there left the rule nowhere on
  // screen at any width. Same paragraph, one ternary: exactly once, by construction.
  //
  // Both questions are asked of `visible`, not of the whole board: this paragraph sits directly
  // above that list and describes it. Asking the board instead put the rule over "no hay propuestas
  // todavía" whenever a filter came up empty, and left a tag whose proposals are all resolved being
  // promised something in the future tense.
  const anyProposal = visible.length > 0
  const anyOpen = visible.some((proposal) => proposal.status === 'open')

  const act = (action: () => Promise<unknown>) => run(action, reload)

  // Images are picked before the proposal exists, so they are uploaded once it has an id.
  const attachAll = async (proposalId: string, draft: ProposalDraft) => {
    for (const prepared of draft.images) {
      await pipeline.attach({ slug: board.group.slug, proposalId, prepared })
    }
  }

  // Closing first is deliberate: the sheet goes away at once and the write finishes behind it.
  // Which is exactly why the draft is only dropped once the text is somewhere safer than the
  // device — a write that fails must leave the words where the author can still reach them.
  const publish = ({ images: picked, ...draft }: ProposalDraft) => {
    const key = draftKey(board.group.slug)
    closeSheet()
    act(async () => {
      const proposalId = await repo.createProposal({ slug: board.group.slug, ...draft })
      clearDraft(key)
      await attachAll(proposalId, { ...draft, images: picked })
    })
  }

  const save = (proposalId: string, { images: picked, ...draft }: ProposalDraft) => {
    const key = draftKey(board.group.slug, proposalId)
    closeSheet()
    act(async () => {
      await repo.updateProposal({ proposalId, ...draft })
      clearDraft(key)
      await attachAll(proposalId, { ...draft, images: picked })
    })
  }

  // Which copy of the vote controls a write belongs to. The same proposal can be on screen twice —
  // once as a card, once in the panel beside it — and every result has to find its way back to the
  // exact place the tap came from, however many other writes overtake it on the way.
  const voteKey = (proposalId: string, where: 'card' | 'detail') => `${where}:${proposalId}`

  // Pending is a fact about the *proposal*, not about one copy of its buttons: both copies go dead
  // while either one is writing, so nothing can be queued behind a write that is still going.
  const voteBusy = (proposalId: string) =>
    pendingFor(voteKey(proposalId, 'card')) || pendingFor(voteKey(proposalId, 'detail'))

  const actionsFor = (proposal: Proposal, where: 'card' | 'detail') => ({
    onVote: (value: VoteValue) => {
      run(
        () => repo.castVote({ proposalId: proposal.id, round: proposal.round, value }),
        reload,
        // One sentence per choice rather than one sentence with a slot: "Has votado en blanco"
        // and "You abstained" are not the same shape, and a slot would force one of them to be
        // wrong.
        t(`psephoi.voted.${value}`),
        voteKey(proposal.id, where),
      )
    },
    onEdit: () => openEdit(board.group.slug, proposal.id),
    onReopen: () => act(() => repo.reopenProposal(proposal.id)),
    onClose: (reason: string) => act(() => repo.closeProposal({ proposalId: proposal.id, reason })),
    onComplete: (actualCents: number | null) =>
      act(() => repo.completeProposal({ proposalId: proposal.id, actualCents })),
  })

  // Finished proposals are kept, not deleted — they just stop competing for attention.
  const isArchived = (status: string) => ['completed', 'rejected', 'closed'].includes(status)
  const live = visible.filter((proposal) => !isArchived(proposal.status))
  const archived = visible.filter((proposal) => isArchived(proposal.status))
  const byRouteId = (id: string) => board.proposals.find((proposal) => proposal.id === id)
  const beingEdited = route.kind === 'edit' ? byRouteId(route.proposalId) : undefined
  const open = route.kind === 'proposal' ? byRouteId(route.proposalId) : undefined

  // Whether the open proposal is a panel rather than a sheet. Everything downstream — the column
  // count, where the focus goes — follows from this one answer.
  const panelled = wide && open !== undefined

  const panel = useRef<HTMLElement | null>(null)

  // The panel is not modal, so nothing moves focus for us — and clicking a card would otherwise
  // leave the reader twenty-odd tab stops short of the thing they just asked to read. Moving focus
  // to content the user explicitly requested is allowed; trapping it there is not.
  // preventScroll: the panel is sticky and already beside the card that opened it, so scrolling it
  // into view only shoves the header off the top of a page that was fine where it was.
  useEffect(() => {
    if (panelled) panel.current?.focus({ preventScroll: true })
  }, [panelled, open?.id])

  // Leaving the panel puts focus back on the card it came from, the way the sheet already does for
  // its opener. Landing on <body> loses a keyboard reader their place in a fifteen-card list.
  const leavePanel = () => {
    if (open) {
      const href = proposalHref(board.group.slug, open.id)
      document.querySelector<HTMLElement>(`a[href="${href}"]`)?.focus()
    }
    closeSheet()
  }

  // One column beside the panel, two when the board has the width to itself: reserving an empty
  // 28rem track for a panel that is not open leaves the commonest desktop state half blank.
  const columns = panelled ? '' : ' lg:grid-cols-2'

  const card = (proposal: Proposal) => (
    <li key={proposal.id} className="min-w-0">
      <ProposalCard
        proposal={proposal}
        participants={board.participants}
        threads={board.threads.filter((thread) => thread.proposalId === proposal.id)}
        slug={board.group.slug}
        onVote={actionsFor(proposal, 'card').onVote}
        votePending={voteBusy(proposal.id)}
        voteDone={doneFor(voteKey(proposal.id, 'card'))}
      />
    </li>
  )

  return (
    <div
      className={`grid min-w-0 gap-8${panelled ? ' lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]' : ''}`}
    >
      <section className="grid min-w-0 gap-4" aria-label={board.group.name}>
        {error && (
          <p role="alert" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        {composing && (
          <Sheet label={t('proposal.new')} onClose={closeSheet}>
            <ProposalForm
              others={board.proposals}
              draftKey={draftKey(board.group.slug)}
              onSubmit={publish}
              onCancel={closeSheet}
            />
          </Sheet>
        )}

        {beingEdited && (
          <Sheet label={t('proposal.editHeading')} onClose={closeSheet}>
            <ProposalForm
              others={board.proposals.filter((other) => other.id !== beingEdited.id)}
              initial={beingEdited}
              draftKey={draftKey(board.group.slug, beingEdited.id)}
              onSubmit={(draft) => save(beingEdited.id, draft)}
              onCancel={closeSheet}
            />
          </Sheet>
        )}

        {/* Opening a proposal is a route, so the phone's back button closes it. */}
        {open && !wide && (
          <Sheet label={open.title} onClose={closeSheet}>
            <ProposalDetail
              proposal={open}
              board={board}
              onChanged={reload}
              votePending={voteBusy(open.id)}
              voteDone={doneFor(voteKey(open.id, 'detail'))}
              {...actionsFor(open, 'detail')}
            />
          </Sheet>
        )}

        <button
          type="button"
          onClick={() => openCompose(board.group.slug)}
          className="min-h-11 justify-self-start rounded-[--radius] px-4 font-medium"
          style={{ background: 'var(--brand-strong)', color: 'var(--brand-ink)' }}
        >
          {t('proposal.new')}
        </button>

        <BoardFilters tags={tags} pendingMine={pendingMine} filter={filter} onChange={setFilter} />

        {/* Only when the list is the whole screen. With a proposal open — sheet or panel — the
            detail is what the reader is reading, and it says the rule itself, in the tense that
            proposal is actually in. Two predicates were deciding the tense of one route: the board
            asked "is anything open?" and the detail asked "is this one resolved?", so a resolved
            proposal on a mixed board read in the past tense at 390 px and was still being promised
            secrecy at 1280 px, 143 px from its own published roll of names. */}
        {anyProposal && open === undefined && (
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            {t(anyOpen ? 'psephoi.secret' : 'psephoi.secretPast')}
          </p>
        )}

        {live.length === 0 && archived.length === 0 ? (
          <p style={{ color: 'var(--ink-muted)' }}>{t('board.empty')}</p>
        ) : (
          <ul className={`grid gap-4${columns}`}>{live.map(card)}</ul>
        )}

        {archived.length > 0 && (
          <details
            className="rounded-[--radius] border p-4"
            style={{ borderColor: 'var(--border)' }}
          >
            <summary className="min-h-11 cursor-pointer font-medium">
              {t('board.archived', { count: archived.length })}
            </summary>
            <div className="grid gap-3 pt-4">
              <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                {t('board.archivedExplain')}
              </p>
              <ul className={`grid gap-4${columns}`}>{archived.map(card)}</ul>
            </div>
          </details>
        )}
      </section>

      {/* Not a dialog: the board beside it stays live, so nothing here may go `inert` or trap Tab.
          It scrolls on its own so a long debate never runs off the bottom. */}
      {panelled && open && (
        <aside
          ref={panel}
          tabIndex={-1}
          className="sticky top-8 grid max-h-[calc(100dvh-4rem)] min-w-0 gap-4 self-start overflow-y-auto overscroll-contain rounded-[--radius] border p-4 outline-none"
          style={{ borderColor: 'var(--border)' }}
          aria-label={open.title}
        >
          <button
            type="button"
            onClick={leavePanel}
            className="min-h-11 justify-self-start rounded-[--radius] border px-4"
            style={{ borderColor: 'var(--border-control)' }}
          >
            {t('board.back')}
          </button>
          <ProposalDetail
            proposal={open}
            board={board}
            onChanged={reload}
            votePending={voteBusy(open.id)}
            voteDone={doneFor(voteKey(open.id, 'detail'))}
            {...actionsFor(open, 'detail')}
          />
        </aside>
      )}
    </div>
  )
}
