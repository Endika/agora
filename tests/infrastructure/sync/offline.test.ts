import { describe, it, expect } from 'vitest'
import { InMemoryActionQueue } from '@/infrastructure/sync/IdbActionQueue'
import { QueuingBoardRepository } from '@/infrastructure/sync/QueuingBoardRepository'
import { QueueReplayer } from '@/infrastructure/sync/QueueReplayer'
import { FakeOnlineDetector } from '@/infrastructure/network/OnlineDetector'
import { CachingBoardRepository } from '@/infrastructure/persistence/CachingBoardRepository'
import { InMemoryBoardStore } from '@/infrastructure/persistence/BoardStore'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'

async function agora() {
  const remote = new InMemoryBoardRepository()
  const { slug } = await remote.createAgora({
    name: 'Cuadrilla',
    creatorName: 'alice',
    ballotOpen: true,
  })
  await remote.addParticipant({ slug, name: 'bob' })
  remote.actAs(remote.participantId(slug, 'alice'))
  const proposalId = await remote.createProposal({ slug, title: 'Trip to the coast' })

  const queue = new InMemoryActionQueue()
  const network = new FakeOnlineDetector()
  const repo = new QueuingBoardRepository(remote, queue, network)
  const replayer = new QueueReplayer(remote, queue)
  return { remote, queue, network, repo, replayer, slug, proposalId }
}

describe('voting offline', () => {
  it('keeps the vote and sends it exactly once, however many times the queue is replayed', async () => {
    const { remote, queue, network, repo, replayer, slug, proposalId } = await agora()

    network.goOffline()
    await repo.castVote({ proposalId, round: 1, value: 'up' })
    expect(await queue.pending()).toHaveLength(1)
    expect((await remote.getBoard(slug)).proposals[0]!.tally.cast).toBe(0)

    network.goOnline()
    await replayer.run()
    await replayer.run() // the duplicate replay criterion 12 is about

    const board = await remote.getBoard(slug)
    expect(board.proposals[0]!.tally.cast).toBe(1)
    expect(board.proposals[0]!.myVote).toBe('up')
    expect(await queue.pending()).toHaveLength(0)
  })

  it('queues a write when the request fails even though the browser thinks it is online', async () => {
    const { queue, repo, proposalId } = await agora()
    // navigator.onLine lies on captive portals and flaky mobile data; the failed request is the real signal.
    const broken = new QueuingBoardRepository(
      {
        castVote: () => Promise.reject(new Error('Failed to fetch')),
      } as unknown as InMemoryBoardRepository,
      queue,
      new FakeOnlineDetector(),
    )
    await broken.castVote({ proposalId, round: 1, value: 'up' })
    expect(await queue.pending()).toHaveLength(1)
    expect(repo).toBeDefined()
  })

  it('sets a refusal aside instead of retrying it for ever', async () => {
    const { queue, network, repo, replayer, proposalId } = await agora()

    network.goOffline()
    await repo.castVote({ proposalId, round: 9, value: 'up' })
    network.goOnline()

    // Round 9 does not exist: the server refuses, and that is final.
    const result = await replayer.run()
    expect(result.failed).toBe(1)
    expect(await queue.pending()).toHaveLength(0)
    expect((await queue.failed())[0]!.reason).toMatch(/stale round/)
  })

  it('replays in the order things were done', async () => {
    const { network, repo, replayer, remote, slug, proposalId } = await agora()

    network.goOffline()
    await repo.addThread({ threadId: 't1', proposalId, commentId: 'c1', body: 'first' })
    await repo.addComment({ commentId: 'c2', threadId: 't1', body: 'second' })
    network.goOnline()

    await replayer.run()
    const board = await remote.getBoard(slug)
    expect(board.threads[0]!.comments.map((comment) => comment.body)).toEqual(['first', 'second'])
  })

  it('does not pretend a proposal was created offline', async () => {
    const { network, repo, slug } = await agora()
    network.goOffline()
    // Creating needs an id back from the server: queueing it would be a lie the UI cannot keep.
    await expect(repo.createProposal({ slug, title: 'Rent a van' })).resolves.toBeTruthy()
  })
})

describe('writing offline through the whole stack', () => {
  async function stack() {
    const { remote, queue, network, repo: queuing, slug, proposalId } = await agora()
    const store = new InMemoryBoardStore()
    const repo = new CachingBoardRepository(queuing, store)
    await repo.getBoard(slug)
    return { remote, queue, network, repo, store, slug, proposalId }
  }

  it('queues votes, threads and expense shares without failing on the refresh after them', async () => {
    const { remote, queue, network, repo, store, slug, proposalId } = await stack()
    const before = await store.load(slug)
    const offline = () => Promise.reject(new TypeError('Failed to fetch'))
    remote.getBoardSince = offline
    remote.getVersion = offline

    network.goOffline()
    await expect(repo.castVote({ proposalId, round: 1, value: 'up' })).resolves.toBeUndefined()
    await expect(
      repo.addThread({ threadId: 't1', proposalId, commentId: 'c1', body: 'first' }),
    ).resolves.toBeUndefined()
    await expect(repo.setExpenseShare({ proposalId, optedIn: true })).resolves.toBeUndefined()

    expect((await queue.pending()).map((entry) => entry.action.kind)).toEqual([
      'castVote',
      'addThread',
      'setExpenseShare',
    ])
    expect(await store.load(slug)).toEqual(before)
  })

  it('still reports a refusal from the refresh after a write', async () => {
    const { remote, repo, proposalId } = await stack()
    remote.getBoardSince = () =>
      Promise.reject(Object.assign(new Error('unknown participant'), { code: 'PT403' }))

    await expect(repo.castVote({ proposalId, round: 1, value: 'up' })).rejects.toMatchObject({
      code: 'PT403',
    })
  })
})

describe('reading offline', () => {
  it('opens the board from the device when the network is gone', async () => {
    const remote = new InMemoryBoardRepository()
    const { slug } = await remote.createAgora({
      name: 'Cuadrilla',
      creatorName: 'alice',
      ballotOpen: true,
    })
    await remote.createProposal({ slug, title: 'Trip to the coast' })

    const store = new InMemoryBoardStore()
    const cached = new CachingBoardRepository(remote, store)
    await cached.getBoard(slug)

    // Every call now fails, the way it does with no coverage.
    const offline = new CachingBoardRepository(
      {
        getVersion: () => Promise.reject(new Error('Failed to fetch')),
        getBoardSince: () => Promise.reject(new Error('Failed to fetch')),
        getBoard: () => Promise.reject(new Error('Failed to fetch')),
      } as unknown as InMemoryBoardRepository,
      store,
    )

    const board = await offline.getBoard(slug)
    expect(board.proposals[0]!.title).toBe('Trip to the coast')
  })
})
