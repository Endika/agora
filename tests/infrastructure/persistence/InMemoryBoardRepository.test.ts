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

  it('no deja emparejar una lectura abierta con la del cierre para poner nombre a un voto', async () => {
    // The two-read attack, which one read cannot show. While the round is open the board names who
    // has *not* voted — on screen, to everybody — so one glance during the deadline window hands an
    // observer the voter set. If the deadline then resolves a partial ballot and the reveal arrives,
    // those values belong to exactly those names. Four people and two voters, so that the voter set
    // is a proper subset and the pairing is a real inference rather than arithmetic anybody could do.
    const repo = new InMemoryBoardRepository()
    const { slug } = await repo.createAgora({
      name: 'Cuadrilla',
      creatorName: 'alice',
      ballotOpen: false,
    })
    for (const name of ['bob', 'carol', 'dave']) await repo.addParticipant({ slug, name })
    const as = (name: string) => repo.actAs(repo.participantId(slug, name))

    as('alice')
    const proposalId = await repo.createProposal({ slug, title: 'Alquilar una furgoneta' })
    await repo.castVote({ proposalId, round: 1, value: 'up' })
    as('bob')
    await repo.castVote({ proposalId, round: 1, value: 'up' })

    // READ ONE, mid-round: this is the half an observer keeps.
    as('carol')
    const during = (await repo.getBoard(slug)).proposals[0]!
    expect(during.status).toBe('open')
    const known = 4 - during.pending.length
    expect(known).toBe(2) // alice and bob, by name, straight off the card

    // The deadline is aged after the votes: casting resolves on the way out, so a proposal born
    // past its deadline would close on the first vote and never carry two.
    await repo.updateProposal({ proposalId, deadline: '2020-01-01T00:00:00.000Z' })

    // READ TWO, after it resolves on the deadline with a partial ballot.
    const after = (await repo.getBoard(slug)).proposals[0]!
    expect(after.status).not.toBe('open')

    // The join has to have nothing to join: no values at all while a proper subset is named.
    expect(after.votes).toBeNull()
    expect(after.tally).toEqual({ up: 0, down: 0, abstain: 0, cast: 2, net: 0 })
    // And the outcome and the count are still published, because that is the part that is not a leak.
    expect(after.tally.cast).toBe(2)
  })

  it('pero una papeleta completa sí se publica: el quórum es lo que no deja nada que restar', async () => {
    // The other side of the same rule. When everybody voted, the voter set is the whole group and
    // there is no subtraction to do, so the reveal happens exactly as before.
    const { repo, slug, proposalId, as } = await seedAgora(['alice', 'bob', 'carol'], false)
    for (const name of ['alice', 'bob', 'carol']) {
      as(name)
      await repo.castVote({ proposalId, round: 1, value: name === 'carol' ? 'down' : 'up' })
    }
    const proposal = (await repo.getBoard(slug)).proposals[0]!

    expect(proposal.votesRevealed).toBe(true)
    expect(proposal.votes).toHaveLength(3)
    expect(proposal.tally).toEqual({ up: 2, down: 1, abstain: 0, cast: 3, net: 1 })
    // Unattributed, as ever.
    for (const vote of proposal.votes!) expect(Object.keys(vote)).toEqual(['value'])
  })

  it('y el cierre por plazo no nombra a nadie por la resta, con reveal o sin él', async () => {
    // Round 3's guarantee, kept: `participants` minus `pending` must not name a voter once the
    // proposal is over. This is a field check on `pending` written as the subtraction it defends
    // against — it is not shape-independent, and a different safe fix (publishing the whole
    // participant list) would fail it.
    const repo = new InMemoryBoardRepository()
    const { slug } = await repo.createAgora({
      name: 'Cuadrilla',
      creatorName: 'alice',
      ballotOpen: false,
    })
    for (const name of ['bob', 'carol', 'dave']) await repo.addParticipant({ slug, name })
    const as = (name: string) => repo.actAs(repo.participantId(slug, name))

    as('alice')
    const proposalId = await repo.createProposal({ slug, title: 'Pintar el pasillo' })
    await repo.castVote({ proposalId, round: 1, value: 'down' })
    await repo.updateProposal({ proposalId, deadline: '2020-01-01T00:00:00.000Z' })

    as('carol')
    const board = await repo.getBoard(slug)
    const proposal = board.proposals[0]!
    expect(proposal.status).not.toBe('open')
    expect(board.participants.length - proposal.pending.length).toBe(board.participants.length)
  })

  it('but a secret agora still says who has to vote while nothing has been revealed', async () => {
    // The feature the fix must not reach back into: during the round `pending` is what unblocks a
    // stalled vote, and nothing has been revealed to pair it with.
    const { repo, slug, proposalId, as } = await seedAgora(['alice', 'bob', 'carol'], false)
    as('bob')
    await repo.castVote({ proposalId, round: 1, value: 'up' })
    as('alice')
    const proposal = (await repo.getBoard(slug)).proposals[0]!

    expect(proposal.status).toBe('open')
    expect(proposal.votes).toBeNull()
    expect(proposal.pending).toHaveLength(2)
  })

  it('y un ágora abierta sigue nombrando a quien dejó pasar el plazo sin votar', async () => {
    // The control. There the names are published beside the votes anyway, so the list is not a leak
    // and stays: if this ever went empty too, the fix would have been over-applied.
    const repo = new InMemoryBoardRepository()
    const { slug } = await repo.createAgora({
      name: 'Cuadrilla',
      creatorName: 'alice',
      ballotOpen: true,
    })
    for (const name of ['bob', 'carol']) await repo.addParticipant({ slug, name })
    const as = (name: string) => repo.actAs(repo.participantId(slug, name))

    as('alice')
    const proposalId = await repo.createProposal({ slug, title: 'Alquilar una furgoneta' })
    await repo.castVote({ proposalId, round: 1, value: 'up' })
    as('bob')
    await repo.castVote({ proposalId, round: 1, value: 'up' })
    await repo.updateProposal({ proposalId, deadline: '2020-01-01T00:00:00.000Z' })

    as('carol')
    const proposal = (await repo.getBoard(slug)).proposals[0]!
    expect(proposal.status).not.toBe('open')
    expect(proposal.pending).toHaveLength(1)
    expect(proposal.votes?.every((vote) => 'participantId' in vote)).toBe(true)
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
