import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from '@/App'
import { exportBoard } from '@/application/handlers/exportBoard'
import type { BoardSnapshot } from '@/domain/repositories/BoardRepository'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'
import { FakeOnlineDetector } from '@/infrastructure/network/OnlineDetector'
import { InMemoryActionQueue } from '@/infrastructure/sync/IdbActionQueue'
import {
  InMemoryProposalImages,
  InMemoryVisitedAgoras,
} from './presentation/support/renderWithBoard'

/**
 * The invariant the whole feature rests on: in a secret agora a name never appears next to a vote
 * value. Not while the round is open, not after it resolves, not in the DOM, not in the
 * accessibility tree, not in an attribute, not in the export.
 *
 * It is tested by sweeping rather than by naming the places it could break, because the places are
 * exactly what a future change moves. Two traps a narrower version falls into, both of them real:
 *
 *  1. A grep for a participant id over the payload proves nothing. `shares`, `payments`,
 *     `pending`, `myVote` and the history carry participant ids in *both* modes and are supposed
 *     to — the association the mode is about is the one between a person and a *sense*, and only
 *     that one. So the sweep asks a narrower question: of everything on screen that carries a vote
 *     sense, does any of it also carry a name?
 *  2. A secret agora whose proposal never resolves proves nothing either. Before quorum there is
 *     no attribution to leak in either mode, so the seeded agora resolves, and the open-mode
 *     control below publishes a roll of names over the very same fixture.
 */

/** Everything that says "a vote went this way", in the rendered copy and in the raw attributes. */
const SENSES = [/a favor/i, /en contra/i, /en blanco/i, /\bup\b/, /\bdown\b/, /\babstain\b/]

/**
 * Every element is judged on what it carries *itself* — its own text nodes and every attribute
 * value — and then on every name anywhere beneath it. An ancestor of the whole board holds both a
 * sense and a name and is innocent; the `<li>` that reads `A favor: alice` is not, and neither is
 * a `data-vote="up"` sitting on a node whose title is somebody's name.
 */
function attributionLeaks(root: HTMLElement, names: string[]): string[] {
  const leaks: string[] = []
  for (const element of root.querySelectorAll('*')) {
    const own = [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? '')
      .join(' ')
    const attributes = [...element.attributes].map((attr) => `${attr.name}="${attr.value}"`)
    const local = [own, ...attributes].join(' ')
    if (!SENSES.some((sense) => sense.test(local))) continue

    const beneath = element.textContent ?? ''
    for (const name of names) {
      if (local.includes(name) || beneath.includes(name)) {
        leaks.push(`<${element.tagName.toLowerCase()}> ${local.trim()} → ${name}`)
      }
    }
  }
  return leaks
}

const wiring = (repo: InMemoryBoardRepository) => ({
  repo,
  visited: new InMemoryVisitedAgoras(),
  images: new InMemoryProposalImages(),
  queue: new InMemoryActionQueue(),
  network: new FakeOnlineDetector(),
  replay: () => Promise.resolve(),
})

/** Three people, one proposal resolved with two senses in it, and one still open. */
async function agora(ballotOpen: boolean) {
  const repo = new InMemoryBoardRepository()
  const { slug } = await repo.createAgora({ name: 'Cuadrilla', creatorName: 'alice', ballotOpen })
  await repo.addParticipant({ slug, name: 'bob' })
  await repo.addParticipant({ slug, name: 'carol' })
  const as = (name: string) => repo.actAs(repo.participantId(slug, name))

  as('alice')
  const resolved = await repo.createProposal({ slug, title: 'Alquilar una furgoneta' })
  const running = await repo.createProposal({ slug, title: 'Comprar un proyector' })

  for (const [name, value] of [
    ['alice', 'up'],
    ['bob', 'up'],
    ['carol', 'down'],
  ] as const) {
    as(name)
    await repo.castVote({ proposalId: resolved, round: 1, value })
  }
  as('alice')
  await repo.castVote({ proposalId: running, round: 1, value: 'up' })

  const names = ['alice', 'bob', 'carol']
  return { repo, slug, resolved, running, names }
}

beforeEach(() => {
  window.location.hash = ''
  localStorage.clear()
})

describe('el invariante: en un ágora secreta ningún nombre aparece junto a un voto', () => {
  it('ni en el tablón, con una propuesta resuelta y otra abierta a la vez', async () => {
    const { repo, slug, names } = await agora(false)
    window.location.hash = `#/g/${slug}`

    render(<App {...wiring(repo)} />)
    await screen.findByRole('heading', { level: 3, name: 'Alquilar una furgoneta' })

    // The roll is the only place the app ever publishes attribution, and it is not here.
    expect(screen.queryByTestId('vote-roll')).toBeNull()
    expect(screen.queryByRole('list', { name: 'Quién votó qué' })).toBeNull()
    expect(screen.queryByLabelText('Quién votó qué')).toBeNull()
    // And nothing else grew one: no element carrying a sense carries a name as well.
    expect(attributionLeaks(document.body, names)).toEqual([])
  })

  it('ni en la hoja de la propuesta resuelta, que es donde se publicaría', async () => {
    const { repo, slug, resolved, names } = await agora(false)
    window.location.hash = `#/g/${slug}/p/${resolved}`

    render(<App {...wiring(repo)} />)
    const sheet = await screen.findByRole('dialog', { name: 'Alquilar una furgoneta' })

    // The colours are there — the round is over and the row says so — and the names are not.
    expect(sheet.querySelectorAll('[data-vote]').length).toBe(3)
    expect(screen.queryByTestId('vote-roll')).toBeNull()
    expect(attributionLeaks(document.body, names)).toEqual([])
  })

  it('ni en la exportación, en ninguno de los dos formatos', async () => {
    const { repo, slug, names } = await agora(false)
    const board = await repo.getBoard(slug)
    const history = await repo.history({ slug })
    const labels = {
      status: (status: string) => status,
      tally: (t: { up: number; down: number; abstain: number }) =>
        `${t.up} / ${t.down} / ${t.abstain}`,
      castOnly: (cast: number) => `${cast} votos emitidos`,
    }

    const json = JSON.parse(exportBoard(board, 'json', labels, history)) as BoardSnapshot
    const cast = json.proposals.flatMap((proposal) => proposal.votes ?? [])
    expect(cast).toHaveLength(3)
    for (const vote of cast) expect(Object.keys(vote)).toEqual(['value'])

    const md = exportBoard(board, 'md', labels, history)
    for (const sense of SENSES) expect(md).not.toMatch(sense)
    for (const name of names)
      expect(md.split('\n').filter((line) => line.includes(name))).toEqual(['alice · bob · carol'])
  })

  it('y en un ágora abierta el mismo tablón sí publica los nombres, o esto no probaría nada', async () => {
    // The control. Same fixture, same sweep, opposite mode: the roll is on screen with the names
    // in it, so a sweep that comes back clean above is the feature working and not the screen
    // being empty.
    const { repo, slug, names } = await agora(true)
    window.location.hash = `#/g/${slug}`

    render(<App {...wiring(repo)} />)
    await screen.findByRole('heading', { level: 3, name: 'Alquilar una furgoneta' })

    const roll = screen.getByTestId('vote-roll')
    expect(roll).toHaveTextContent('A favor: alice, bob')
    expect(roll).toHaveTextContent('En contra: carol')
    // The sweep sees all three of them, on the roll rows and nowhere else: it detects the leak it
    // is looking for, which is the only thing that makes its silence above worth anything.
    const leaks = attributionLeaks(document.body, names)
    expect(leaks.map((leak) => leak.split(' → ')[1])).toEqual(['alice', 'bob', 'carol'])
    expect(leaks.every((leak) => leak.includes('data-testid="roll-'))).toBe(true)
  })
})
