import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BoardPage } from '@/presentation/components/board/BoardPage'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'
import { renderWithBoard } from '../../support/renderWithBoard'

async function agoraWith(names: string[]) {
  const repo = new InMemoryBoardRepository()
  const { slug } = await repo.createAgora({
    name: 'Cuadrilla',
    creatorName: names[0]!,
  })
  for (const name of names.slice(1)) await repo.addParticipant({ slug, name })
  const as = (name: string) => repo.actAs(repo.participantId(slug, name))
  as(names[0]!)
  return { repo, slug, as }
}

describe('BoardPage', () => {
  it('lists approved proposals first, by backing then by age', async () => {
    const { repo, slug, as } = await agoraWith(['alice', 'bob'])
    const weak = await repo.createProposal({ slug, title: 'Repaint the hallway' })
    const strong = await repo.createProposal({ slug, title: 'Trip to the coast' })
    await repo.createProposal({ slug, title: 'Buy a projector' })

    for (const name of ['alice', 'bob']) {
      as(name)
      await repo.castVote({ proposalId: strong, round: 1, value: 'up' })
    }
    as('alice')
    await repo.castVote({ proposalId: weak, round: 1, value: 'up' })
    as('bob')
    await repo.castVote({ proposalId: weak, round: 1, value: 'abstain' })

    as('alice')
    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} openId={null} />, { repo, slug })

    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titles).toEqual(['Trip to the coast', 'Repaint the hallway', 'Buy a projector'])
  })

  it('names who has not voted yet, and nobody who has', async () => {
    const { repo, slug, as } = await agoraWith(['alice', 'bob', 'carol'])
    const id = await repo.createProposal({ slug, title: 'Rent a van' })
    as('alice')
    await repo.castVote({ proposalId: id, round: 1, value: 'up' })

    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} openId={null} />, { repo, slug })

    const missing = screen.getByTestId('missing-voters')
    expect(missing).toHaveTextContent('bob')
    expect(missing).toHaveTextContent('carol')
    expect(missing).not.toHaveTextContent('alice')
  })

  it('shows counts but no sentiment while the vote is open', async () => {
    const { repo, slug, as } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Buy chairs' })
    as('bob')
    await repo.castVote({ proposalId: id, round: 1, value: 'down' })

    as('alice')
    const board = await repo.getBoard(slug)
    const { container } = renderWithBoard(<BoardPage board={board} openId={null} />, { repo, slug })

    expect(screen.getByText(/1 de 2 han votado/)).toBeInTheDocument()
    expect(container.querySelectorAll('[data-vote]')).toHaveLength(0)
    expect(screen.getAllByTestId('pebble-cast')).toHaveLength(1)
    expect(screen.getAllByTestId('pebble-empty')).toHaveLength(1)
  })

  it('offers reopen and close to the creator of a tie, and to nobody else', async () => {
    const { repo, slug, as } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Paint the hallway' })
    as('alice')
    await repo.castVote({ proposalId: id, round: 1, value: 'up' })
    as('bob')
    await repo.castVote({ proposalId: id, round: 1, value: 'down' })

    const asBob = await repo.getBoard(slug)
    const bobView = renderWithBoard(<BoardPage board={asBob} openId={id} />, { repo, slug })
    // The list row is still mounted behind the sheet, so the assertions scope to the dialog.
    const asBobDialog = within(screen.getByRole('dialog'))
    expect(asBobDialog.getByText('En debate')).toBeInTheDocument()
    expect(
      asBobDialog.queryByRole('button', { name: 'Reabrir la votación' }),
    ).not.toBeInTheDocument()
    bobView.unmount()

    as('alice')
    const asAlice = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={asAlice} openId={id} />, { repo, slug })
    const asAliceDialog = within(screen.getByRole('dialog'))
    expect(asAliceDialog.getByRole('button', { name: 'Reabrir la votación' })).toBeInTheDocument()
    expect(asAliceDialog.getByRole('button', { name: 'Cerrar con motivo' })).toBeInTheDocument()
  })

  it('refuses to send a closing reason under ten characters', async () => {
    const { repo, slug, as } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Paint the hallway' })
    as('alice')
    await repo.castVote({ proposalId: id, round: 1, value: 'up' })
    as('bob')
    await repo.castVote({ proposalId: id, round: 1, value: 'down' })
    as('alice')

    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} openId={id} />, { repo, slug })

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar con motivo' }))
    await userEvent.type(screen.getByLabelText('Motivo'), 'no vale')
    // "Cerrar" alone would also match the sheet's own close button, which is why the copy is explicit.
    expect(screen.getByRole('button', { name: 'Cerrar la propuesta' })).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Motivo'), ' porque lo hablamos en persona')
    expect(screen.getByRole('button', { name: 'Cerrar la propuesta' })).toBeEnabled()
  })

  it('badges and filters what is waiting on my vote', async () => {
    const { repo, slug, as } = await agoraWith(['alice', 'bob'])
    const mine = await repo.createProposal({ slug, title: 'Rent a van' })
    const voted = await repo.createProposal({ slug, title: 'Buy chairs' })
    as('alice')
    await repo.castVote({ proposalId: voted, round: 1, value: 'up' })

    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} openId={null} />, { repo, slug })

    expect(screen.getByTestId('pending-mine-badge')).toHaveTextContent('1')
    await userEvent.click(screen.getByRole('button', { name: /Me toca votar/ }))

    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titles).toEqual(['Rent a van'])
    expect(mine).toBeTruthy()
  })

  it('sends my vote and shows it as chosen', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Rent a van' })
    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} openId={null} />, { repo, slug })

    await userEvent.click(screen.getByRole('button', { name: 'A favor' }))
    await waitFor(() => expect(repo.calls).toContain('castVote'))
    expect(id).toBeTruthy()
  })

  it('freezes the vote once the proposal is resolved', async () => {
    const { repo, slug, as } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Rent a van' })
    as('alice')
    await repo.castVote({ proposalId: id, round: 1, value: 'up' })
    as('bob')
    await repo.castVote({ proposalId: id, round: 1, value: 'up' })

    as('alice')
    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} openId={null} />, { repo, slug })

    expect(screen.getByText('Aprobada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'A favor' })).not.toBeInTheDocument()
    const card = screen.getByRole('article')
    expect(within(card).getAllByTestId('pebble-cast')[0]).toHaveAttribute('data-vote', 'up')
  })
})

describe('BoardPage, the list itself', () => {
  it('shows a taste of the description rather than the whole thing', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    await repo.createProposal({
      slug,
      title: 'Alquilar una furgoneta',
      description:
        '## Plan\n\n- Salimos el viernes y volvemos el domingo por la tarde, con parada para comer\n- Hay que decidir quién conduce cada tramo del viaje y cómo repartimos la gasolina',
    })
    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} openId={null} />, { repo, slug })

    // The syntax is gone and the text is cut, so the row stays a row.
    const preview = screen.getByText(/Plan · Salimos el viernes/)
    expect(preview.textContent!.length).toBeLessThan(160)
    expect(preview.textContent).toContain('…')
    expect(screen.queryByText(/^##/)).not.toBeInTheDocument()
  })

  it('links into the proposal and counts its comments', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Paint the hallway' })
    await repo.addThread({ threadId: 't1', proposalId: id, commentId: 'c1', body: 'root' })
    await repo.addComment({ commentId: 'c2', threadId: 't1', body: 'reply' })

    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} openId={null} />, { repo, slug })

    expect(screen.getByRole('link', { name: 'Ver la propuesta' })).toHaveAttribute(
      'href',
      `#/g/${slug}/p/${id}`,
    )
    expect(screen.getByText('2 comentarios')).toBeInTheDocument()
    // Singular is singular: "1 comentarios" is what makes an app feel unfinished.
    expect(screen.queryByText('1 comentarios')).not.toBeInTheDocument()
  })

  it('says how long the vote has left, in days', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    await repo.createProposal({ slug, title: 'Order the cake', deadline: soon })

    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} openId={null} />, { repo, slug })
    expect(screen.getByText('Quedan 3 días')).toBeInTheDocument()
  })

  it('keeps comments and the expense out of the list, and shows them in the proposal', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Dinner out', estimatedCents: 6000 })
    await repo.addThread({
      threadId: 't1',
      proposalId: id,
      commentId: 'c1',
      body: 'a comment body',
    })
    const board = await repo.getBoard(slug)

    const list = renderWithBoard(<BoardPage board={board} openId={null} />, { repo, slug })
    expect(screen.queryByText('a comment body')).not.toBeInTheDocument()
    expect(screen.queryByText('Gasto')).not.toBeInTheDocument()
    list.unmount()

    renderWithBoard(<BoardPage board={board} openId={id} />, { repo, slug })
    expect(screen.getByText('a comment body')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Gasto' })).toBeInTheDocument()
  })
})
