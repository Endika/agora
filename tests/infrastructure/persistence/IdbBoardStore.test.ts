import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { IdbBoardStore } from '@/infrastructure/persistence/IdbBoardStore'
import type { BoardSnapshot } from '@/domain/repositories/BoardRepository'
import { makeProposal } from '../../domain/support/makeProposal'

const board = (): BoardSnapshot => ({
  version: '2026-09-01T10:00:00.000Z',
  group: { id: 'g', slug: 'abcd1234', name: 'Cuadrilla' },
  me: { id: 'p1', name: 'Endika' },
  participants: [{ id: 'p1', name: 'Endika' }],
  proposals: [makeProposal({ id: 'pr1' })],
  threads: [],
  history: [],
})

describe('IdbBoardStore', () => {
  let store: IdbBoardStore

  beforeEach(() => {
    store = new IdbBoardStore()
  })

  it('gives back what it was given', async () => {
    await store.save('abcd1234', board())
    expect((await store.load('abcd1234'))?.proposals[0]!.id).toBe('pr1')
  })

  it('throws away a snapshot the app can no longer read', async () => {
    // Exactly the shape stored before payments existed: the field the new code reads is simply missing.
    const stale = board()
    const proposal = { ...stale.proposals[0]! } as Record<string, unknown>
    delete proposal.payments
    proposal.liquidations = []
    await store.save('efgh5678', { ...stale, proposals: [proposal] } as unknown as BoardSnapshot)

    // Rather than handing the app something that will crash it, the store admits it has nothing.
    expect(await store.load('efgh5678')).toBeNull()
    // And it is gone, so it cannot fail twice.
    expect(await store.slugs()).not.toContain('efgh5678')
  })
})
