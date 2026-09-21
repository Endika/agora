import { describe, it, expect } from 'vitest'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'

async function seedAgora(names: string[], ballotOpen = true) {
  const repo = new InMemoryBoardRepository()
  const { slug } = await repo.createAgora({
    name: 'Cuadrilla',
    creatorName: names[0]!,
    ballotOpen,
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

  // The mode only bites once the round is over: before quorum nobody's sense is out in either
  // agora, so a secret agora that never resolves proves nothing.
  it('reveals the senses but never the voters once a secret agora resolves', async () => {
    const { repo, slug, proposalId, as } = await seedAgora(['alice', 'bob'], false)
    await repo.castVote({ proposalId, round: 1, value: 'up' })
    as('bob')
    await repo.castVote({ proposalId, round: 1, value: 'up' })

    const board = await repo.getBoard(slug)
    const proposal = board.proposals[0]!
    expect(proposal.status).toBe('approved')
    expect(proposal.votesRevealed).toBe(true)
    expect(proposal.votes).toHaveLength(2)
    expect(proposal.votes!.map((vote) => vote.value)).toEqual(['up', 'up'])
    expect(proposal.votes!.every((vote) => vote.participantId === undefined)).toBe(true)
    for (const person of board.participants) {
      expect(JSON.stringify(proposal.votes)).not.toContain(person.id)
    }
  })

  it('names every voter once an open agora resolves', async () => {
    const { repo, slug, proposalId, as } = await seedAgora(['alice', 'bob'])
    await repo.castVote({ proposalId, round: 1, value: 'up' })
    as('bob')
    await repo.castVote({ proposalId, round: 1, value: 'down' })
    as('alice')
    await repo.reopenProposal(proposalId)
    await repo.castVote({ proposalId, round: 2, value: 'up' })
    as('bob')
    await repo.castVote({ proposalId, round: 2, value: 'up' })

    const board = await repo.getBoard(slug)
    const votes = board.proposals[0]!.votes!
    expect(votes).toHaveLength(2)
    expect(votes.map((vote) => vote.participantId).sort()).toEqual(
      board.participants.map((person) => person.id).sort(),
    )
  })

  it('will not let an open secret round be differenced into who voted what', async () => {
    // The attack the running tally made possible: `pending` names who has not voted, so a breakdown
    // that moves between two reads names the voter and the sense together. The fake mirrors the
    // redaction `board_json` does, because a screen test that passed on a breakdown the server never
    // sends would prove nothing. The assertion is indistinguishability: an `up` and a `down` cast in
    // two identical secret agoras have to look the same from outside.
    const seen: string[] = []
    for (const value of ['up', 'down', 'abstain'] as const) {
      const { repo, slug, proposalId, as } = await seedAgora(['alice', 'bob', 'carol'], false)
      as('bob')
      await repo.castVote({ proposalId, round: 1, value })
      as('alice')
      const proposal = (await repo.getBoard(slug)).proposals[0]!
      expect(proposal.status).toBe('open')
      // The count is public — it is what `pending` already implies — and it must survive the fix.
      expect(proposal.tally.cast).toBe(1)
      expect(proposal.pending).toHaveLength(2)
      seen.push(JSON.stringify(proposal.tally))
    }
    expect(new Set(seen).size).toBe(1)
  })

  it('publishes the real breakdown in a secret agora once the round is over', async () => {
    // The redaction lasts exactly as long as the round it protects.
    const { repo, slug, proposalId, as } = await seedAgora(['alice', 'bob', 'carol'], false)
    for (const name of ['alice', 'bob', 'carol']) {
      as(name)
      await repo.castVote({ proposalId, round: 1, value: name === 'carol' ? 'down' : 'up' })
    }
    const proposal = (await repo.getBoard(slug)).proposals[0]!
    expect(proposal.status).not.toBe('open')
    expect(proposal.tally).toEqual({ up: 2, down: 1, abstain: 0, cast: 3, net: 1 })
  })

  it('still shows an open agora its round developing, sense by sense', async () => {
    // The control. An open ballot publishes the names on resolution anyway, so watching the count
    // move is the feature there, not a leak — and the redaction must not reach it.
    const { repo, slug, proposalId, as } = await seedAgora(['alice', 'bob', 'carol'], true)
    as('bob')
    await repo.castVote({ proposalId, round: 1, value: 'down' })
    as('alice')
    const proposal = (await repo.getBoard(slug)).proposals[0]!
    expect(proposal.status).toBe('open')
    expect(proposal.tally).toEqual({ up: 0, down: 1, abstain: 0, cast: 1, net: -1 })
  })

  it('carries the ballot mode on the agora, whichever it is', async () => {
    const open = await seedAgora(['alice', 'bob'])
    const secret = await seedAgora(['alice', 'bob'], false)
    expect((await open.repo.getBoard(open.slug)).group.ballotOpen).toBe(true)
    expect((await secret.repo.getBoard(secret.slug)).group.ballotOpen).toBe(false)
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
      ballotOpen: true,
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
      ballotOpen: true,
    })

    const preview = await repo.preview(slug)
    expect(preview.participants).toEqual([{ id: participantId, name: 'alice' }])

    await expect(repo.claim({ slug, participantId })).resolves.toMatchObject({ participantId })
    await expect(repo.addParticipant({ slug, name: 'Alice' })).rejects.toThrow(/name taken/)
  })

  it('deletes an agora only when its name is typed out', async () => {
    const repo = new InMemoryBoardRepository()
    const { slug } = await repo.createAgora({
      name: 'Casa de la playa',
      creatorName: 'alice',
      ballotOpen: true,
    })

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
