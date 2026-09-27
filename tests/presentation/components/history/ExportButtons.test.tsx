import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { ExportButtons } from '@/presentation/components/history/ExportButtons'
import type { BoardSnapshot, HistoryEntry } from '@/domain/repositories/BoardRepository'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'
import { renderWithBoard } from '../../support/renderWithBoard'

class UnreachableHistory extends InMemoryBoardRepository {
  override async history(): Promise<HistoryEntry[]> {
    throw new TypeError('Failed to fetch')
  }
}

let downloaded: Blob[]

beforeEach(() => {
  downloaded = []
  URL.createObjectURL = (blob: Blob | MediaSource) => {
    downloaded.push(blob as Blob)
    return 'blob:export'
  }
  URL.revokeObjectURL = () => {}
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

afterEach(() => vi.restoreAllMocks())

async function exportWith(repo: InMemoryBoardRepository) {
  const { slug, participantId } = await repo.createAgora({
    name: 'Cuadrilla',
    creatorName: 'Endika',
    ballotOpen: true,
  })
  repo.seedHistory(slug, [
    {
      id: 'h1',
      proposalId: null,
      participantId,
      type: 'proposal_created',
      description: 'Viaje a la costa',
      createdAt: '2026-09-01T18:42:00.000Z',
    },
  ])
  const board: BoardSnapshot = {
    version: '2026-09-01T10:00:00.000Z',
    group: { id: 'g', slug, name: 'Cuadrilla', ballotOpen: true },
    me: { id: participantId, name: 'Endika' },
    participants: [{ id: participantId, name: 'Endika' }],
    proposals: [],
    threads: [],
    history: [],
  }
  renderWithBoard(<ExportButtons board={board} />, { repo, slug })
}

describe('ExportButtons', () => {
  it('puts the fetched history in the JSON', async () => {
    await exportWith(new InMemoryBoardRepository())
    fireEvent.click(screen.getByRole('button', { name: 'Descargar JSON' }))
    await waitFor(() => expect(downloaded).toHaveLength(1))
    const json = JSON.parse(await downloaded[0]!.text()) as { history: HistoryEntry[] }
    expect(json.history.map((entry) => entry.id)).toEqual(['h1'])
  })

  it('refuses a JSON without its history and says so, instead of downloading it short', async () => {
    await exportWith(new UnreachableHistory())
    fireEvent.click(screen.getByRole('button', { name: 'Descargar JSON' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se ha descargado el JSON: no se ha podido cargar el historial. Inténtalo de nuevo.',
    )
    expect(downloaded).toHaveLength(0)
  })

  it('still downloads the Markdown offline, which never carried the history', async () => {
    await exportWith(new UnreachableHistory())
    fireEvent.click(screen.getByRole('button', { name: 'Descargar Markdown' }))
    await waitFor(() => expect(downloaded).toHaveLength(1))
    expect(await downloaded[0]!.text()).toContain('# Cuadrilla')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
