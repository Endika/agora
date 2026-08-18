import { describe, it, expect } from 'vitest'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'

const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length

/**
 * The gate on the egress budget. A regression here is a bill, not a bug report, so it fails CI instead of
 * showing up on the invoice.
 */
describe('egress budget', () => {
  it('keeps a cold board under 60 KB for 8 people and 20 proposals with images', async () => {
    const repo = new InMemoryBoardRepository()
    const { slug } = await repo.createAgora({ name: 'Cuadrilla', creatorName: 'p0' })
    for (let person = 1; person < 8; person++) {
      await repo.addParticipant({ slug, name: `p${person}` })
    }
    const people = Array.from({ length: 8 }, (_, index) => repo.participantId(slug, `p${index}`))

    for (let index = 0; index < 20; index++) {
      repo.actAs(people[index % 8]!)
      const proposalId = await repo.createProposal({
        slug,
        title: `Proposal number ${index}`,
        description: 'Two nights away, one van, and a rough plan for the food.',
        tags: ['viaje', 'casa'],
      })
      for (let image = 0; image < 3; image++) {
        await repo.attachImage({
          id: `i-${index}-${image}`,
          proposalId,
          path: `${slug}/${proposalId}/${image}.webp`,
          thumbPath: `${slug}/${proposalId}/${image}-t.webp`,
          width: 1600,
          height: 1200,
          bytes: 180_000,
        })
      }
      for (const person of people) {
        repo.actAs(person)
        await repo.castVote({ proposalId, round: 1, value: 'up' })
      }
    }

    repo.actAs(people[0]!)
    const board = await repo.getBoard(slug)
    expect(board.proposals).toHaveLength(20)
    expect(bytes(board)).toBeLessThan(60_000)
    // History is fetched on demand, so it must not be riding along with every board read.
    expect(board.history).toEqual([])
  })

  it('keeps the delta after one vote under 2 KB', async () => {
    const repo = new InMemoryBoardRepository()
    const { slug } = await repo.createAgora({ name: 'Cuadrilla', creatorName: 'alice' })
    await repo.addParticipant({ slug, name: 'bob' })
    repo.actAs(repo.participantId(slug, 'alice'))
    const proposalId = await repo.createProposal({ slug, title: 'Trip to the coast' })

    const before = await repo.getBoard(slug)
    await repo.castVote({ proposalId, round: 1, value: 'up' })

    const delta = await repo.getBoardSince(slug, before.version)
    expect(delta.proposals).toHaveLength(1)
    expect(bytes(delta)).toBeLessThan(2_000)
  })
})
