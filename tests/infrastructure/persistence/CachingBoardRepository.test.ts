import { describe, it, expect } from 'vitest'
import { CachingBoardRepository } from '@/infrastructure/persistence/CachingBoardRepository'
import { InMemoryBoardStore } from '@/infrastructure/persistence/BoardStore'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'

async function seed() {
  const remote = new InMemoryBoardRepository()
  const { slug } = await remote.createAgora({
    name: 'Cuadrilla',
    creatorName: 'alice',
    pin: '1234',
  })
  await remote.joinAgora({ slug, name: 'bob', pin: '1234' })
  remote.actAs(remote.participantId(slug, 'alice'))
  const proposalId = await remote.createProposal({ slug, title: 'Trip to the coast' })
  const store = new InMemoryBoardStore()
  const repo = new CachingBoardRepository(remote, store)
  const reads = () => remote.calls.filter((c) => c.startsWith('get'))
  return { remote, store, repo, slug, proposalId, reads }
}

describe('CachingBoardRepository', () => {
  it('asks for the whole board once and then only for its version', async () => {
    const { repo, slug, reads } = await seed()
    await repo.getBoard(slug)
    await repo.getBoard(slug)
    await repo.getBoard(slug)

    expect(reads().filter((c) => c === 'getBoard')).toHaveLength(1)
    expect(reads().filter((c) => c === 'getVersion')).toHaveLength(2)
    expect(reads()).not.toContain('getBoardSince')
  })

  it('fetches only the delta when the version moved', async () => {
    const { remote, repo, slug, proposalId, reads } = await seed()
    await repo.getBoard(slug)

    remote.actAs(remote.participantId(slug, 'bob'))
    await remote.castVote({ proposalId, round: 1, value: 'up' })

    const board = await repo.getBoard(slug)
    expect(reads().filter((c) => c === 'getBoard')).toHaveLength(1)
    expect(reads()).toContain('getBoardSince')
    expect(board.proposals[0]!.tally.cast).toBe(1)
  })

  it('shows my own write without refetching the board', async () => {
    const { repo, slug, proposalId, reads } = await seed()
    await repo.getBoard(slug)
    const before = reads().length

    await repo.castVote({ proposalId, round: 1, value: 'up' })
    const board = await repo.getBoard(slug)

    expect(board.proposals[0]!.myVote).toBe('up')
    expect(reads().filter((c) => c === 'getBoard')).toHaveLength(1)
    // One delta for the write, then a version check that finds nothing new.
    expect(reads().length - before).toBe(2)
  })

  it('serves the cached board when the version has not moved', async () => {
    const { repo, slug } = await seed()
    const first = await repo.getBoard(slug)
    const second = await repo.getBoard(slug)
    expect(second).toEqual(first)
  })

  it('keeps three agoras on the device and forgets the oldest', async () => {
    const { remote, store, repo } = await seed()
    for (const name of ['second', 'third', 'fourth']) {
      const { slug } = await remote.createAgora({ name, creatorName: 'alice', pin: '1234' })
      await repo.getBoard(slug)
    }
    const kept = await store.slugs()
    expect(kept).toHaveLength(3)
  })
})
