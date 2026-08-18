import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExpensePanel } from '@/presentation/components/expense/ExpensePanel'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'
import { makeProposal } from '../../../domain/support/makeProposal'
import { renderWithBoard } from '../../support/renderWithBoard'

const people = [
  { id: 'alice', name: 'Alice' },
  { id: 'bob', name: 'Bob' },
  { id: 'carol', name: 'Carol' },
]

const proposal = (over: Partial<Parameters<typeof makeProposal>[0]> = {}) =>
  makeProposal({
    id: 'p1',
    status: 'approved',
    estimatedCents: 100_000,
    shares: people.map((person) => ({ participantId: person.id, optedIn: person.id !== 'carol' })),
    ...over,
  })

const money = (node: HTMLElement) => node.textContent!.replace(/\s/g, ' ')

describe('ExpensePanel', () => {
  it('splits the total between whoever is in, cent-exact', () => {
    renderWithBoard(
      <ExpensePanel
        proposal={proposal()}
        participants={people}
        meId="alice"
        onChanged={() => {}}
      />,
    )
    expect(screen.getAllByTestId('share-amount').map(money)).toEqual(['500,00 €', '500,00 €'])
    expect(screen.queryByText('Carol')).not.toBeInTheDocument()
  })

  it('answers the question people actually ask: how much of mine is left', () => {
    // 1000 € between two, 100 € in: 400 € to go.
    renderWithBoard(
      <ExpensePanel
        proposal={proposal({
          payments: [
            {
              id: 'y1',
              participantId: 'alice',
              cents: 10_000,
              createdAt: '2026-09-01T10:00:00.000Z',
            },
          ],
        })}
        participants={people}
        meId="alice"
        onChanged={() => {}}
      />,
    )
    expect(screen.getByText(/Te toca 500,00/)).toBeInTheDocument()
    expect(screen.getByText(/Has puesto 100,00/)).toBeInTheDocument()
    expect(screen.getByText(/Te falta 400,00/)).toBeInTheDocument()
  })

  it('says who has put in more than their share, not just who is short', () => {
    renderWithBoard(
      <ExpensePanel
        proposal={proposal({
          payments: [
            {
              id: 'y1',
              participantId: 'alice',
              cents: 60_000,
              createdAt: '2026-09-01T10:00:00.000Z',
            },
            {
              id: 'y2',
              participantId: 'bob',
              cents: 49_600,
              createdAt: '2026-09-01T11:00:00.000Z',
            },
          ],
        })}
        participants={people}
        meId="carol"
        onChanged={() => {}}
      />,
    )
    const amounts = screen.getAllByTestId('left-amount').map(money)
    // Alice put in 100 € over her share; Bob is 4 € short. Both are visible, both with their sign.
    expect(amounts[0]).toBe('100,00 € de más')
    expect(amounts[1]).toBe('falta 4,00 €')
  })

  it('says when the group has put in more than the proposal asked for', () => {
    renderWithBoard(
      <ExpensePanel
        proposal={proposal({
          payments: [
            {
              id: 'y1',
              participantId: 'alice',
              cents: 60_000,
              createdAt: '2026-09-01T10:00:00.000Z',
            },
            {
              id: 'y2',
              participantId: 'bob',
              cents: 60_000,
              createdAt: '2026-09-01T11:00:00.000Z',
            },
          ],
        })}
        participants={people}
        meId="alice"
        onChanged={() => {}}
      />,
    )
    expect(money(screen.getByTestId('total-left'))).toContain('200,00 € de más')
  })

  it('records what I put in, and lets me take a typo back out', async () => {
    const repo = new InMemoryBoardRepository()
    renderWithBoard(
      <ExpensePanel
        proposal={proposal({
          payments: [
            {
              id: 'y1',
              participantId: 'alice',
              cents: 10_000,
              createdAt: '2026-09-01T10:00:00.000Z',
            },
          ],
        })}
        participants={people}
        meId="alice"
        onChanged={() => {}}
      />,
      { repo },
    )

    await userEvent.click(screen.getByRole('button', { name: 'Apuntar lo que he puesto' }))
    await userEvent.type(screen.getByLabelText('¿Cuánto has puesto? (€)'), '50,25')
    await userEvent.click(screen.getByRole('button', { name: 'Apuntar' }))
    await waitFor(() => expect(repo.calls).toContain('addPayment'))

    await userEvent.click(screen.getByRole('button', { name: /Quitar el pago de 100,00/ }))
    await waitFor(() => expect(repo.calls).toContain('removePayment'))
  })

  it('refuses an amount with three decimals', async () => {
    const repo = new InMemoryBoardRepository()
    renderWithBoard(
      <ExpensePanel
        proposal={proposal()}
        participants={people}
        meId="alice"
        onChanged={() => {}}
      />,
      { repo },
    )
    await userEvent.click(screen.getByRole('button', { name: 'Apuntar lo que he puesto' }))
    await userEvent.type(screen.getByLabelText('¿Cuánto has puesto? (€)'), '10,005')
    await userEvent.click(screen.getByRole('button', { name: 'Apuntar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('dos decimales')
    expect(repo.calls).not.toContain('addPayment')
  })

  it('explains what an amount implies and how many are in', () => {
    renderWithBoard(
      <ExpensePanel
        proposal={proposal()}
        participants={people}
        meId="alice"
        onChanged={() => {}}
      />,
    )
    expect(
      screen.getByText(/se reparte a partes iguales entre quienes entren a pagar/),
    ).toBeInTheDocument()
    expect(screen.getByText(/2 entran a pagar/)).toBeInTheDocument()
  })

  it('says nothing at all when a proposal has no money in it', () => {
    const { container } = renderWithBoard(
      <ExpensePanel
        proposal={makeProposal({ id: 'p1' })}
        participants={people}
        meId="alice"
        onChanged={() => {}}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('freezes the opt-in once the proposal is done, but still lets a payment be recorded', () => {
    renderWithBoard(
      <ExpensePanel
        proposal={proposal({ status: 'completed', actualCents: 120_000 })}
        participants={people}
        meId="alice"
        onChanged={() => {}}
      />,
    )
    expect(screen.queryByRole('button', { name: /Entro a pagar/ })).not.toBeInTheDocument()
    // Paying up happens *after* the thing is done more often than before it.
    expect(screen.getByRole('button', { name: 'Apuntar lo que he puesto' })).toBeInTheDocument()
    expect(screen.getByText(/200,00\s€ más de lo previsto/)).toBeInTheDocument()
  })
})
