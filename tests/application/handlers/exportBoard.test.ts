import { describe, it, expect } from 'vitest'
import { exportBoard, exportFilename } from '@/application/handlers/exportBoard'
import type { BoardSnapshot, HistoryEntry } from '@/domain/repositories/BoardRepository'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'
import { makeProposal, votes } from '../../domain/support/makeProposal'

const board: BoardSnapshot = {
  version: '2026-09-01T10:00:00.000Z',
  group: { id: 'g', slug: 'abcd1234', name: 'Cuadrilla del barrio', ballotOpen: true },
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
  // The bundle's `export.castOnly`, spelled out: a count of people, never a sense.
  castOnly: (cast: number) => `${cast} ${cast === 1 ? 'voto emitido' : 'votos emitidos'}`,
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

/**
 * The JSON export is `JSON.stringify` of the snapshot, so it inherits whatever the server sent —
 * including, in a secret agora, the absence of the voter. That is a good property and a fragile
 * one: it holds because of a decision taken two layers below, so it is asserted here rather than
 * reasoned about, in both modes, through the repository that replicates what `get_board` sends.
 */
describe('exportBoard y el modo de voto del ágora', () => {
  async function resolvedAgora(ballotOpen: boolean) {
    const repo = new InMemoryBoardRepository()
    const { slug } = await repo.createAgora({ name: 'Cuadrilla', creatorName: 'alice', ballotOpen })
    await repo.addParticipant({ slug, name: 'bob' })
    const as = (name: string) => repo.actAs(repo.participantId(slug, name))

    as('alice')
    const proposalId = await repo.createProposal({ slug, title: 'Alquilar una furgoneta' })
    await repo.castVote({ proposalId, round: 1, value: 'up' })
    as('bob')
    await repo.castVote({ proposalId, round: 1, value: 'down' })

    as('alice')
    const board = await repo.getBoard(slug)
    const history = await repo.history({ slug })
    const names = board.participants.map((participant) => participant.name)
    return { repo, slug, board, history, names }
  }

  /** The same agora with the round still running: one of three has voted, so nothing has resolved. */
  async function openRoundAgora(ballotOpen: boolean) {
    const repo = new InMemoryBoardRepository()
    const { slug } = await repo.createAgora({ name: 'Cuadrilla', creatorName: 'alice', ballotOpen })
    for (const name of ['bob', 'carol']) await repo.addParticipant({ slug, name })

    repo.actAs(repo.participantId(slug, 'alice'))
    const proposalId = await repo.createProposal({ slug, title: 'Alquilar una furgoneta' })
    repo.actAs(repo.participantId(slug, 'bob'))
    await repo.castVote({ proposalId, round: 1, value: 'up' })

    repo.actAs(repo.participantId(slug, 'alice'))
    const board = await repo.getBoard(slug)
    if (board.proposals[0]!.status !== 'open') throw new Error('the fixture resolved too early')
    return { repo, slug, board, history: await repo.history({ slug }) }
  }

  /** What the screen passes in: the same labels `ExportButtons` reads out of the bundle. */
  const spanish = {
    status: (status: string) => ({ debating: 'En debate' })[status] ?? status,
    tally: labels.tally,
    castOnly: labels.castOnly,
  }

  const castVotes = (snapshot: BoardSnapshot) =>
    snapshot.proposals.flatMap((proposal) => proposal.votes ?? [])

  it('en un ágora secreta el JSON no lleva participantId en ningún voto', async () => {
    const { board, history } = await resolvedAgora(false)

    const parsed = JSON.parse(exportBoard(board, 'json', spanish, history)) as BoardSnapshot
    const cast = castVotes(parsed)

    // Without this the rest passes on an export that simply has no votes in it.
    expect(cast).toHaveLength(2)
    for (const vote of cast) {
      expect(Object.keys(vote)).toEqual(['value'])
      expect('participantId' in vote).toBe(false)
    }
  })

  it('y en un ágora abierta sí lo lleva, que es lo que hace valer la prueba anterior', async () => {
    const { board, history, repo, slug } = await resolvedAgora(true)

    const parsed = JSON.parse(exportBoard(board, 'json', spanish, history)) as BoardSnapshot
    const cast = castVotes(parsed)

    expect(cast).toHaveLength(2)
    expect(cast.map((vote) => vote.participantId).sort()).toEqual(
      [repo.participantId(slug, 'alice'), repo.participantId(slug, 'bob')].sort(),
    )
  })

  it('lo que se va del JSON secreto es el votante, no todo identificador', async () => {
    // A grep for an id over the whole payload proves nothing in either direction: `myVote`,
    // `pending`, `shares`, `payments` and the history carry participant ids in both modes and are
    // supposed to. The export is only allowed to lose the one association the mode is about.
    const { board, history, repo, slug } = await resolvedAgora(false)
    const alice = repo.participantId(slug, 'alice')

    const parsed = JSON.parse(exportBoard(board, 'json', spanish, history)) as BoardSnapshot

    expect(parsed.me.id).toBe(alice)
    expect(parsed.proposals[0]!.myVote).toBe('up')
    expect((parsed.history as HistoryEntry[]).map((entry) => entry.participantId)).toContain(alice)
    expect(exportBoard(board, 'json', spanish, history)).toContain(alice)
  })

  it('no inventa un desglose que el servidor no ha mandado, y no lo hace con ceros', async () => {
    // The export is the one artefact somebody keeps, so "0 / 0 / 0" while two people have voted is
    // a false statement in a document, not a display quirk. It is false *because* of the redaction:
    // a secret agora sends no breakdown while the round is open, and the three senses arrive as
    // zeros. The count is the true part of that payload, so the count is what is printed.
    const { board, history } = await openRoundAgora(false)
    const md = exportBoard(board, 'md', spanish, history)

    expect(md).toContain('**open** · 1 voto emitido')
    // And not the zeroes in any arrangement a reader could take for senses.
    expect(md).not.toContain('0 / 0 / 0')
    expect(md).not.toMatch(/\b0 \/ 0\b/)
    // The line says how many voted and stops there; it must not name a sense in any language.
    const summary = md.split('\n').find((line) => line.startsWith('**open**'))!
    for (const sense of [
      /a favor/i,
      /en contra/i,
      /en blanco/i,
      /\bup\b/,
      /\bdown\b/,
      /\babstain\b/,
    ])
      expect(summary).not.toMatch(sense)
  })

  it('pero en cuanto la propuesta se resuelve publica el desglose real, también en secreto', async () => {
    // The redaction lasts exactly as long as the round: at resolution the senses are public in
    // both modes, so the export goes back to the breakdown and the count line disappears.
    const { board, history } = await resolvedAgora(false)
    const md = exportBoard(board, 'md', spanish, history)

    expect(md).toContain('**En debate** · 1 / 1 / 0')
    expect(md).not.toContain('votos emitidos')
  })

  it('y en un ágora abierta el desglose se imprime siempre, con la ronda abierta o cerrada', async () => {
    // The control, on both states. An open ballot publishes the names at resolution anyway, so its
    // running breakdown is the feature — and the redaction must not reach it from either side.
    const during = await openRoundAgora(true)
    expect(exportBoard(during.board, 'md', spanish, during.history)).toContain(
      '**open** · 1 / 0 / 0',
    )

    const after = await resolvedAgora(true)
    const md = exportBoard(after.board, 'md', spanish, after.history)
    expect(md).toContain('**En debate** · 1 / 1 / 0')
    expect(md).not.toContain('votos emitidos')
  })

  it('sigue lo que trae la carga útil, no una segunda copia de la regla', async () => {
    // The redaction rule is written in three uncoupled places — `board_json`, the fake and this
    // handler — and un-redacting any one of them leaves the other two green, because each decides
    // for itself from `ballotOpen` and `votesRevealed`. This test is the coupling: it reads the
    // decision off the *payload* instead of re-deriving it, so the producer and the consumer cannot
    // drift apart in silence. A real tally has `cast = up + down + abstain`, so three zeroes with
    // votes cast is not a tally at all — it is a breakdown the server withheld, and that is legible
    // from the payload alone with no knowledge of why.
    let withheldSeen = 0
    let breakdownSeen = 0

    for (const fixture of [
      await openRoundAgora(false),
      await resolvedAgora(false),
      await openRoundAgora(true),
      await resolvedAgora(true),
    ]) {
      const md = exportBoard(fixture.board, 'md', spanish, fixture.history)
      const proposal = fixture.board.proposals[0]!
      const t = proposal.tally
      const withheld = t.cast > 0 && t.up === 0 && t.down === 0 && t.abstain === 0
      const summary = md.split('\n').find((line) => line.startsWith('**'))!

      if (withheld) {
        withheldSeen += 1
        expect(summary).toBe(`**${spanish.status(proposal.status)}** · ${spanish.castOnly(t.cast)}`)
      } else {
        breakdownSeen += 1
        expect(summary).toBe(`**${spanish.status(proposal.status)}** · ${spanish.tally(t)}`)
      }
    }

    // Or the whole thing could pass by never reaching one of the two branches.
    expect({ withheldSeen, breakdownSeen }).toEqual({ withheldSeen: 1, breakdownSeen: 3 })
  })

  it('el Markdown no lleva ni un voto, en ninguno de los dos modos', async () => {
    // Markdown carries the tally and nothing else, which is why it is safe in both modes. Asserted
    // so that adding a per-vote line later cannot go in quietly, on the mode where it would leak.
    for (const ballotOpen of [true, false]) {
      const { board, history, names } = await resolvedAgora(ballotOpen)
      const md = exportBoard(board, 'md', spanish, history)

      expect(md).toContain('**En debate** · 1 / 1 / 0')
      for (const sense of [
        /a favor/i,
        /en contra/i,
        /en blanco/i,
        /\bup\b/,
        /\bdown\b/,
        /\babstain\b/,
      ])
        expect(md).not.toMatch(sense)
      // Names appear once, on the roster line, and nowhere near a vote.
      for (const name of names)
        expect(md.split('\n').filter((line) => line.includes(name))).toEqual([names.join(' · ')])
    }
  })
})
