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
  { id: 'dave', name: 'Dave' },
]

const withShares = (optedIn: string[], overrides = {}) =>
  makeProposal({
    id: 'p1',
    status: 'approved',
    estimatedCents: 10000,
    shares: people.map((person) => ({
      participantId: person.id,
      optedIn: optedIn.includes(person.id),
    })),
    ...overrides,
  })

describe('ExpensePanel', () => {
  it('splits 100 € among the three who opted in, cent-exact (criterion 11)', () => {
    renderWithBoard(
      <ExpensePanel
        proposal={withShares(['alice', 'bob', 'carol'])}
        participants={people}
        meId="alice"
        onChanged={() => {}}
      />,
    )

    // Intl puts a non-breaking space before the €, so the comparison normalises whitespace.
    const amounts = screen
      .getAllByTestId('share-amount')
      .map((node) => node.textContent!.replace(/\s/g, ' '))
    expect(amounts).toEqual(['33,34 €', '33,33 €', '33,33 €'])
    expect(screen.getByTestId('share-total')).toHaveTextContent('100,00 €')
  })

  it('splits among the opt-ins only, never the whole agora', () => {
    renderWithBoard(
      <ExpensePanel
        proposal={withShares(['alice', 'bob'])}
        participants={people}
        meId="alice"
        onChanged={() => {}}
      />,
    )
    expect(screen.getAllByTestId('share-amount')).toHaveLength(2)
    expect(screen.queryByText('Dave')).not.toBeInTheDocument()
  })

  it('lets me opt in and out', async () => {
    const repo = new InMemoryBoardRepository()
    renderWithBoard(
      <ExpensePanel
        proposal={withShares(['bob'])}
        participants={people}
        meId="alice"
        onChanged={() => {}}
      />,
      { repo },
    )

    const button = screen.getByRole('button', { name: 'No entro' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(button)
    await waitFor(() => expect(repo.calls).toContain('setExpenseShare'))
  })

  it('shows the deviation when the real cost lands', () => {
    renderWithBoard(
      <ExpensePanel
        proposal={withShares(['alice'], { status: 'completed', actualCents: 12000 })}
        participants={people}
        meId="alice"
        onChanged={() => {}}
      />,
    )
    expect(screen.getByText('20,00 € más de lo previsto')).toBeInTheDocument()
  })

  it('freezes the expense once the proposal is done', () => {
    renderWithBoard(
      <ExpensePanel
        proposal={withShares(['alice'], { status: 'completed', actualCents: 10000 })}
        participants={people}
        meId="alice"
        onChanged={() => {}}
      />,
    )
    expect(screen.queryByRole('button', { name: /entro/i })).not.toBeInTheDocument()
    expect(screen.getByText(/el gasto ya no se toca/)).toBeInTheDocument()
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

  it('records a payment and marks the payer as settled', async () => {
    const repo = new InMemoryBoardRepository()
    const proposal = withShares(['alice', 'bob'], {
      liquidations: [
        {
          id: 'l1',
          cents: 5000,
          paidBy: 'alice',
          affects: ['alice', 'bob'],
          paidShares: [],
          createdAt: '2026-09-01T10:00:00.000Z',
        },
      ],
    })

    renderWithBoard(
      <ExpensePanel proposal={proposal} participants={people} meId="alice" onChanged={() => {}} />,
      { repo },
    )

    expect(screen.getByText('Lo puso Alice')).toBeInTheDocument()
    // The payer's own share counts as paid; Bob's does not.
    expect(screen.getByLabelText('Marcar la parte de Alice como pagada')).toBeChecked()
    expect(screen.getByLabelText('Marcar la parte de Bob como pagada')).not.toBeChecked()
    expect(screen.getByText(/Pagado 25,00 €/)).toBeInTheDocument()
    expect(screen.getByText(/Pendiente 25,00 €/)).toBeInTheDocument()

    await userEvent.click(screen.getByLabelText('Marcar la parte de Bob como pagada'))
    await waitFor(() => expect(repo.calls).toContain('setLiquidationSharePaid'))
  })

  it('refuses an amount with three decimals', async () => {
    const repo = new InMemoryBoardRepository()
    renderWithBoard(
      <ExpensePanel
        proposal={withShares(['alice'])}
        participants={people}
        meId="alice"
        onChanged={() => {}}
      />,
      { repo },
    )

    await userEvent.click(screen.getByRole('button', { name: 'Registrar un pago' }))
    await userEvent.type(screen.getByLabelText('Importe (€)'), '10,005')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar un pago' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('dos decimales')
    expect(repo.calls).not.toContain('addLiquidation')
  })
})
