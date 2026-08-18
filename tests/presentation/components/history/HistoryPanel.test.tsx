import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { HistoryPanel } from '@/presentation/components/history/HistoryPanel'
import type { BoardSnapshot } from '@/domain/repositories/BoardRepository'
import { makeProposal } from '../../../domain/support/makeProposal'
import { renderWithBoard } from '../../support/renderWithBoard'

const board = (history: BoardSnapshot['history']): BoardSnapshot => ({
  version: '2026-09-01T10:00:00.000Z',
  group: { id: 'g', slug: 'abcd1234', name: 'Cuadrilla' },
  me: { id: 'p1', name: 'Endika' },
  participants: [{ id: 'p1', name: 'Endika' }],
  proposals: [makeProposal({ id: 'pr1', title: 'Viaje a la costa' })],
  threads: [],
  history,
})

const entry = (over: Partial<BoardSnapshot['history'][number]>) => ({
  id: 'h1',
  proposalId: 'pr1',
  participantId: 'p1',
  type: 'proposal_created',
  description: 'Viaje a la costa',
  createdAt: '2026-09-01T18:42:00.000Z',
  ...over,
})

describe('HistoryPanel', () => {
  it('names nobody for something nobody did, and says it in Spanish', () => {
    // What went wrong before: "Alguien quedó approved".
    renderWithBoard(
      <HistoryPanel
        board={board([entry({ type: 'resolved', participantId: null, description: 'approved' })])}
      />,
    )
    expect(screen.getByText('«Viaje a la costa» quedó Aprobada')).toBeInTheDocument()
    expect(screen.queryByText(/Alguien/)).not.toBeInTheDocument()
    expect(screen.queryByText(/approved/)).not.toBeInTheDocument()
  })

  it('says who did what, and to which proposal', () => {
    renderWithBoard(<HistoryPanel board={board([entry({})])} />)
    expect(screen.getByText('Endika propuso «Viaje a la costa»')).toBeInTheDocument()
  })

  it('shows a recorded payment as money, not as a pile of cents', () => {
    renderWithBoard(
      <HistoryPanel board={board([entry({ type: 'liquidation_added', description: '4000' })])} />,
    )
    expect(screen.getByText(/40,00 €/)).toBeInTheDocument()
  })

  it('falls back to the raw type rather than dropping an entry it does not know', () => {
    renderWithBoard(<HistoryPanel board={board([entry({ type: 'something_new' })])} />)
    expect(screen.getByText('Endika: something_new')).toBeInTheDocument()
  })

  it('handles an entry about a proposal that is no longer there', () => {
    renderWithBoard(<HistoryPanel board={board([entry({ proposalId: 'gone' })])} />)
    expect(screen.getByText('Endika propuso «una propuesta»')).toBeInTheDocument()
  })
})
