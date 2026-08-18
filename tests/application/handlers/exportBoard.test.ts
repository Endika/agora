import { describe, it, expect } from 'vitest'
import { exportBoard, exportFilename } from '@/application/handlers/exportBoard'
import type { BoardSnapshot } from '@/domain/repositories/BoardRepository'
import { makeProposal, votes } from '../../domain/support/makeProposal'

const board: BoardSnapshot = {
  version: '2026-09-01T10:00:00.000Z',
  group: { id: 'g', slug: 'abcd1234', name: 'Cuadrilla del barrio' },
  me: { id: 'p1', name: 'Endika' },
  participants: [
    { id: 'p1', name: 'Endika' },
    { id: 'p2', name: 'Marta' },
  ],
  proposals: [
    makeProposal({
      id: 'pr1',
      title: 'Trip to the coast',
      description: 'Two nights, one van.',
      tags: ['viaje'],
      status: 'approved',
      tally: votes(2, 0, 1),
      estimatedCents: 12000,
      createdBy: 'p1',
    }),
    makeProposal({ id: 'pr2', title: 'Buy a projector', status: 'open' }),
  ],
  threads: [
    {
      id: 't1',
      proposalId: 'pr1',
      authorId: 'p2',
      resolvedAt: '2026-09-02T10:00:00.000Z',
      resolvedBy: 'p1',
      createdAt: '2026-09-01T11:00:00.000Z',
      commentCount: 4,
      comments: [
        {
          id: 'c1',
          authorId: 'p2',
          body: '¿Qué fin de semana?',
          createdAt: '2026-09-01T11:00:00.000Z',
        },
      ],
    },
  ],
  history: [],
}

const labels = {
  status: (status: string) => ({ approved: 'Aprobada', open: 'En votación' })[status] ?? status,
  tally: (t: { up: number; down: number; abstain: number }) => `${t.up} / ${t.down} / ${t.abstain}`,
}

describe('exportBoard', () => {
  it('writes markdown a person can read', () => {
    const md = exportBoard(board, 'md', labels)
    expect(md).toContain('# Cuadrilla del barrio')
    expect(md).toContain('## Trip to the coast')
    expect(md).toContain('**Aprobada** · 2 / 0 / 1')
    expect(md).toContain('Two nights, one van.')
    expect(md).toContain('#viaje')
    expect(md).toContain('120.00 €')
    expect(md).toContain('- **Marta:** ¿Qué fin de semana?')
  })

  it('says how many comments it did not have rather than pretending', () => {
    // The snapshot only carries three per thread, so the export must not imply the thread was that short.
    expect(exportBoard(board, 'md', labels)).toContain('- …3')
  })

  it('keeps the spec order: approved before open', () => {
    const md = exportBoard(board, 'md', labels)
    expect(md.indexOf('Trip to the coast')).toBeLessThan(md.indexOf('Buy a projector'))
  })

  it('exports json that parses back to the same proposals', () => {
    const parsed = JSON.parse(exportBoard(board, 'json', labels)) as BoardSnapshot
    expect(parsed.proposals.map((proposal) => proposal.id)).toEqual(['pr1', 'pr2'])
    expect(parsed.group.slug).toBe('abcd1234')
  })

  it('names the file after the agora and the day', () => {
    expect(exportFilename(board, 'md', '2026-09-03')).toBe('cuadrilla-del-barrio-2026-09-03.md')
  })

  it('falls back to the slug when the name has nothing filename-safe in it', () => {
    const odd = { ...board, group: { ...board.group, name: '¿¡...!?' } }
    expect(exportFilename(odd, 'json', '2026-09-03')).toBe('abcd1234-2026-09-03.json')
  })
})
