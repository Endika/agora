import { describe, it, expect } from 'vitest'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'

async function seedAgora(names: string[]) {
  const repo = new InMemoryBoardRepository()
  const { slug } = await repo.createAgora({
    name: 'Cuadrilla',
    creatorName: names[0]!,
  })
  for (const name of names.slice(1)) await repo.addParticipant({ slug, name })
  repo.actAs(repo.participantId(slug, names[0]!))
  const proposalId = await repo.createProposal({ slug, title: 'Trip to the coast' })
  return {
    repo,
    slug,
    proposalId,
    as: (name: string) => repo.actAs(repo.participantId(slug, name)),
  }
}

describe('InMemoryBoardRepository', () => {
  it('replaces a vote instead of adding one, however many times it is replayed', async () => {
    const { repo, slug, proposalId } = await seedAgora(['alice', 'bob', 'carol', 'dave'])
    await repo.castVote({ proposalId, round: 1, value: 'up' })
    await repo.castVote({ proposalId, round: 1, value: 'down' })
    await repo.castVote({ proposalId, round: 1, value: 'down' })

    const board = await repo.getBoard(slug)
    expect(board.proposals[0]!.tally.cast).toBe(1)
    expect(board.proposals[0]!.myVote).toBe('down')
  })

  it('approves on 1 up and 3 abstain, abstentions counting only for quorum', async () => {
    const { repo, slug, proposalId, as } = await seedAgora(['alice', 'bob', 'carol', 'dave'])
    await repo.castVote({ proposalId, round: 1, value: 'up' })
    for (const name of ['bob', 'carol', 'dave']) {
      as(name)
      await repo.castVote({ proposalId, round: 1, value: 'abstain' })
    }
    const board = await repo.getBoard(slug)
    expect(board.proposals[0]!.status).toBe('approved')
    expect(board.proposals[0]!.tally).toMatchObject({ up: 1, abstain: 3, net: 1, cast: 4 })
  })

  it('never reveals another vote before quorum, and reveals every one after', async () => {
    const { repo, slug, proposalId, as } = await seedAgora(['alice', 'bob'])
    as('bob')
    await repo.castVote({ proposalId, round: 1, value: 'down' })

    as('alice')
    const hidden = await repo.getBoard(slug)
    expect(hidden.proposals[0]!.votes).toBeNull()
    expect(hidden.proposals[0]!.votesRevealed).toBe(false)
    expect(hidden.proposals[0]!.tally.cast).toBe(1)
    expect(hidden.proposals[0]!.myVote).toBeNull()
    expect(JSON.stringify(hidden)).not.toContain('"value"')
    expect(hidden.proposals[0]!.pending).toHaveLength(1)

    await repo.castVote({ proposalId, round: 1, value: 'down' })
    const revealed = await repo.getBoard(slug)
    expect(revealed.proposals[0]!.status).toBe('rejected')
    expect(revealed.proposals[0]!.votes).toHaveLength(2)
  })

  it('keeps the earlier round when the creator reopens a tie', async () => {
    const { repo, slug, proposalId, as } = await seedAgora(['alice', 'bob'])
    await repo.castVote({ proposalId, round: 1, value: 'up' })
    as('bob')
    await repo.castVote({ proposalId, round: 1, value: 'down' })
    expect((await repo.getBoard(slug)).proposals[0]!.status).toBe('debating')

    await expect(repo.reopenProposal(proposalId)).rejects.toThrow(/creator/)
    as('alice')
    await repo.reopenProposal(proposalId)

    const board = await repo.getBoard(slug)
    expect(board.proposals[0]!.round).toBe(2)
    expect(board.proposals[0]!.status).toBe('open')
    expect(board.proposals[0]!.tally.cast).toBe(0)
  })

  it('refuses a closing reason under 10 characters', async () => {
    const { repo, proposalId, as } = await seedAgora(['alice', 'bob'])
    await repo.castVote({ proposalId, round: 1, value: 'up' })
    as('bob')
    await repo.castVote({ proposalId, round: 1, value: 'down' })
    as('alice')
    await expect(repo.closeProposal({ proposalId, reason: 'too short' })).rejects.toThrow(/10/)
  })

  it('resolves a passed deadline on the next read, with nobody else voting', async () => {
    const repo = new InMemoryBoardRepository()
    const { slug } = await repo.createAgora({
      name: 'Cuadrilla',
      creatorName: 'alice',
    })
    await repo.addParticipant({ slug, name: 'bob' })
    repo.actAs(repo.participantId(slug, 'alice'))
    const proposalId = await repo.createProposal({
      slug,
      title: 'Order the cake',
      deadline: '2020-01-01T00:00:00.000Z',
    })
    await repo.castVote({ proposalId, round: 1, value: 'up' })
    expect((await repo.getBoard(slug)).proposals[0]!.status).toBe('approved')
  })

  it('lets a name be claimed from another device, and refuses one that is taken', async () => {
    const repo = new InMemoryBoardRepository()
    const { slug, participantId } = await repo.createAgora({
      name: 'Cuadrilla',
      creatorName: 'alice',
    })

    const preview = await repo.preview(slug)
    expect(preview.participants).toEqual([{ id: participantId, name: 'alice' }])

    await expect(repo.claim({ slug, participantId })).resolves.toMatchObject({ participantId })
    await expect(repo.addParticipant({ slug, name: 'Alice' })).rejects.toThrow(/name taken/)
  })

  it('deletes an agora only when its name is typed out', async () => {
    const repo = new InMemoryBoardRepository()
    const { slug } = await repo.createAgora({ name: 'Casa de la playa', creatorName: 'alice' })

    await expect(repo.deleteAgora({ slug, confirmName: 'casa de la play' })).resolves.toEqual({
      ok: false,
      error: 'name_mismatch',
    })
    await expect(repo.deleteAgora({ slug, confirmName: '  Casa de la Playa ' })).resolves.toEqual({
      ok: true,
    })
  })

  it('caps a thread preview at three comments while reporting the real count', async () => {
    const { repo, slug, proposalId } = await seedAgora(['alice', 'bob'])
    await repo.addThread({ threadId: 't1', proposalId, commentId: 'c1', body: 'first' })
    for (const id of ['c2', 'c3', 'c4']) {
      await repo.addComment({ commentId: id, threadId: 't1', body: id })
    }
    const board = await repo.getBoard(slug)
    expect(board.threads[0]!.commentCount).toBe(4)
    expect(board.threads[0]!.comments).toHaveLength(3)
  })
})
