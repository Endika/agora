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
    pin: '1234',
  })
  for (const name of names.slice(1)) await repo.joinAgora({ slug, name, pin: '1234' })
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
    renderWithBoard(<BoardPage board={board} />, { repo, slug })

    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titles).toEqual(['Trip to the coast', 'Repaint the hallway', 'Buy a projector'])
  })

  it('names who has not voted yet, and nobody who has', async () => {
    const { repo, slug, as } = await agoraWith(['alice', 'bob', 'carol'])
    const id = await repo.createProposal({ slug, title: 'Rent a van' })
    as('alice')
    await repo.castVote({ proposalId: id, round: 1, value: 'up' })

    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} />, { repo, slug })

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
    const { container } = renderWithBoard(<BoardPage board={board} />, { repo, slug })

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
    const bobView = renderWithBoard(<BoardPage board={asBob} />, { repo, slug })
    expect(screen.getByText('En debate')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reabrir la votación' })).not.toBeInTheDocument()
    bobView.unmount()

    as('alice')
    const asAlice = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={asAlice} />, { repo, slug })
    expect(screen.getByRole('button', { name: 'Reabrir la votación' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar con motivo' })).toBeInTheDocument()
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
    renderWithBoard(<BoardPage board={board} />, { repo, slug })

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar con motivo' }))
    await userEvent.type(screen.getByLabelText('Motivo'), 'no vale')
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Motivo'), ' porque lo hablamos en persona')
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeEnabled()
  })

  it('badges and filters what is waiting on my vote', async () => {
    const { repo, slug, as } = await agoraWith(['alice', 'bob'])
    const mine = await repo.createProposal({ slug, title: 'Rent a van' })
    const voted = await repo.createProposal({ slug, title: 'Buy chairs' })
    as('alice')
    await repo.castVote({ proposalId: voted, round: 1, value: 'up' })

    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} />, { repo, slug })

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
    renderWithBoard(<BoardPage board={board} />, { repo, slug })

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
    renderWithBoard(<BoardPage board={board} />, { repo, slug })

    expect(screen.getByText('Aprobada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'A favor' })).not.toBeInTheDocument()
    const card = screen.getByRole('article')
    expect(within(card).getAllByTestId('pebble-cast')[0]).toHaveAttribute('data-vote', 'up')
  })
})
