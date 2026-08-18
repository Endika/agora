import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { HistoryPanel } from '@/presentation/components/history/HistoryPanel'
import type { BoardSnapshot, HistoryEntry } from '@/domain/repositories/BoardRepository'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'
import { makeProposal } from '../../../domain/support/makeProposal'
import { renderWithBoard } from '../../support/renderWithBoard'

const entry = (over: Partial<HistoryEntry>): HistoryEntry => ({
  id: 'h1',
  proposalId: 'pr1',
  participantId: 'p1',
  type: 'proposal_created',
  description: 'Viaje a la costa',
  createdAt: '2026-09-01T18:42:00.000Z',
  ...over,
})

/** The panel fetches history itself, so the fake is seeded and the board only supplies names and titles. */
async function panelWith(entries: HistoryEntry[]) {
  const repo = new InMemoryBoardRepository()
  const { slug, participantId } = await repo.createAgora({
    name: 'Cuadrilla',
    creatorName: 'Endika',
  })
  repo.seedHistory(
    slug,
    entries.map((item) => ({
      ...item,
      participantId: item.participantId === null ? null : participantId,
    })),
  )

  const board: BoardSnapshot = {
    version: '2026-09-01T10:00:00.000Z',
    group: { id: 'g', slug, name: 'Cuadrilla' },
    me: { id: participantId, name: 'Endika' },
    participants: [{ id: participantId, name: 'Endika' }],
    proposals: [makeProposal({ id: 'pr1', title: 'Viaje a la costa' })],
    threads: [],
    history: [],
  }

  return { repo, slug, ...renderWithBoard(<HistoryPanel board={board} />, { repo, slug }) }
}

describe('HistoryPanel', () => {
  it('fetches the history rather than expecting it in the board', async () => {
    const { repo } = await panelWith([entry({})])
    expect(await screen.findByText('Endika propuso «Viaje a la costa»')).toBeInTheDocument()
    // The whole point of the change: history is a call, not part of every board read.
    expect(repo.calls).toContain('history')
  })

  it('names nobody for something nobody did, and says it in Spanish', async () => {
    // What went wrong before: "Alguien quedó approved".
    await panelWith([entry({ type: 'resolved', participantId: null, description: 'approved' })])
    expect(await screen.findByText('«Viaje a la costa» quedó Aprobada')).toBeInTheDocument()
    expect(screen.queryByText(/Alguien/)).not.toBeInTheDocument()
    expect(screen.queryByText(/approved/)).not.toBeInTheDocument()
  })

  it('shows a payment as money, not as a pile of cents', async () => {
    await panelWith([entry({ type: 'payment_added', description: '4000' })])
    expect(await screen.findByText(/40,00\s€/)).toBeInTheDocument()
  })

  it('falls back to the raw type rather than dropping an entry it does not know', async () => {
    await panelWith([entry({ type: 'something_new' })])
    expect(await screen.findByText('Endika: something_new')).toBeInTheDocument()
  })

  it('handles an entry about a proposal that is no longer there', async () => {
    await panelWith([entry({ proposalId: 'gone' })])
    expect(await screen.findByText('Endika propuso «una propuesta»')).toBeInTheDocument()
  })
})
