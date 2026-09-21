import { describe, it, expect, beforeEach } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BoardPage } from '@/presentation/components/board/BoardPage'
import type { VoteValue } from '@/domain/entities/Proposal'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'
import { draftKey, readDraft, writeDraft } from '@/presentation/drafts'
import { renderWithBoard } from '../../support/renderWithBoard'
import { matchMediaMatches } from '../../../support/matchMedia'

/** The one sentence that has to be on screen before anybody taps a vote button. */
const SECRET =
  'Nadie ve tu voto hasta que se alcanza el quórum. Después lo ve todo el grupo, con tu nombre.'
/** And the one that has to be there once it is too late to be warned. */
const SECRET_PAST =
  'Nadie vio estos votos hasta que se alcanzó el quórum. Ahora los ve todo el grupo, con el nombre de quien los puso.'

beforeEach(() => {
  localStorage.clear()
  window.location.hash = ''
})

async function agoraWith(names: string[]) {
  const repo = new InMemoryBoardRepository()
  const { slug } = await repo.createAgora({
    name: 'Cuadrilla',
    creatorName: names[0]!,
  })
  for (const name of names.slice(1)) await repo.addParticipant({ slug, name })
  const as = (name: string) => repo.actAs(repo.participantId(slug, name))
  as(names[0]!)
  return { repo, slug, as }
}

describe('BoardPage', () => {
  it('lists approved proposals first, by backing then by age', async () => {
    const { repo, slug, as } = await agoraWith(['alice', 'bob'])
    const weak = await repo.createProposal({ slug, title: 'Repaint the hallway' })
    const strong = await repo.createProposal({ slug, title: 'Trip to the coast' })
    await repo.createProposal({ slug, title: 'Buy a projector' })

    for (const name of ['alice', 'bob']) {
      as(name)
      await repo.castVote({ proposalId: strong, round: 1, value: 'up' })
    }
    as('alice')
    await repo.castVote({ proposalId: weak, round: 1, value: 'up' })
    as('bob')
    await repo.castVote({ proposalId: weak, round: 1, value: 'abstain' })

    as('alice')
    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titles).toEqual(['Trip to the coast', 'Repaint the hallway', 'Buy a projector'])
  })

  it('names who has not voted yet, and nobody who has, in the proposal detail', async () => {
    const { repo, slug, as } = await agoraWith(['alice', 'bob', 'carol'])
    const id = await repo.createProposal({ slug, title: 'Rent a van' })
    as('alice')
    await repo.castVote({ proposalId: id, round: 1, value: 'up' })

    const board = await repo.getBoard(slug)
    renderWithBoard(
      <BoardPage board={board} route={{ kind: 'proposal', slug, proposalId: id }} />,
      { repo, slug },
    )

    // The list row is still mounted behind the sheet, so the assertion scopes to the dialog.
    const missing = within(screen.getByRole('dialog')).getByTestId('missing-voters')
    expect(missing).toHaveTextContent('bob')
    expect(missing).toHaveTextContent('carol')
    expect(missing).not.toHaveTextContent('alice')
  })

  it('shows counts but no sentiment while the vote is open', async () => {
    const { repo, slug, as } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Buy chairs' })
    as('bob')
    await repo.castVote({ proposalId: id, round: 1, value: 'down' })

    as('alice')
    const board = await repo.getBoard(slug)
    const { container } = renderWithBoard(
      <BoardPage board={board} route={{ kind: 'board', slug }} />,
      { repo, slug },
    )

    expect(screen.getByTestId('missing-voters')).toHaveTextContent('alice')
    expect(container.querySelectorAll('[data-vote]')).toHaveLength(0)
    expect(screen.getAllByTestId('pebble-cast')).toHaveLength(1)
    expect(screen.getAllByTestId('pebble-empty')).toHaveLength(1)
  })

  it('trunca a un nombre y un contador en la tarjeta, en vez de la lista completa', async () => {
    const { repo, slug, as } = await agoraWith(['alice', 'bob', 'carol', 'dave'])
    const id = await repo.createProposal({ slug, title: 'Cambiar el sofá del salón' })
    as('alice')
    await repo.castVote({ proposalId: id, round: 1, value: 'up' })

    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    const missing = screen.getByTestId('missing-voters')
    expect(missing).toHaveTextContent('bob')
    expect(missing).toHaveTextContent('y 2 más')
    // The other two who have not voted are still missing, not spelled out — that's the point.
    expect(missing).not.toHaveTextContent('carol')
    expect(missing).not.toHaveTextContent('dave')
  })

  it('offers reopen and close to the creator of a tie, and to nobody else', async () => {
    const { repo, slug, as } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Paint the hallway' })
    as('alice')
    await repo.castVote({ proposalId: id, round: 1, value: 'up' })
    as('bob')
    await repo.castVote({ proposalId: id, round: 1, value: 'down' })

    const asBob = await repo.getBoard(slug)
    const bobView = renderWithBoard(
      <BoardPage board={asBob} route={{ kind: 'proposal', slug, proposalId: id }} />,
      { repo, slug },
    )
    // The list row is still mounted behind the sheet, so the assertions scope to the dialog.
    const asBobDialog = within(screen.getByRole('dialog'))
    expect(asBobDialog.getByText('En debate')).toBeInTheDocument()
    expect(
      asBobDialog.queryByRole('button', { name: 'Reabrir la votación' }),
    ).not.toBeInTheDocument()
    bobView.unmount()

    as('alice')
    const asAlice = await repo.getBoard(slug)
    renderWithBoard(
      <BoardPage board={asAlice} route={{ kind: 'proposal', slug, proposalId: id }} />,
      { repo, slug },
    )
    const asAliceDialog = within(screen.getByRole('dialog'))
    expect(asAliceDialog.getByRole('button', { name: 'Reabrir la votación' })).toBeInTheDocument()
    expect(asAliceDialog.getByRole('button', { name: 'Cerrar con motivo' })).toBeInTheDocument()
  })

  it('refuses to send a closing reason under ten characters', async () => {
    const { repo, slug, as } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Paint the hallway' })
    as('alice')
    await repo.castVote({ proposalId: id, round: 1, value: 'up' })
    as('bob')
    await repo.castVote({ proposalId: id, round: 1, value: 'down' })
    as('alice')

    const board = await repo.getBoard(slug)
    renderWithBoard(
      <BoardPage board={board} route={{ kind: 'proposal', slug, proposalId: id }} />,
      { repo, slug },
    )

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar con motivo' }))
    await userEvent.type(screen.getByLabelText('Motivo'), 'no vale')
    // "Cerrar" alone would also match the sheet's own close button, which is why the copy is explicit.
    expect(screen.getByRole('button', { name: 'Cerrar la propuesta' })).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Motivo'), ' porque lo hablamos en persona')
    expect(screen.getByRole('button', { name: 'Cerrar la propuesta' })).toBeEnabled()
  })

  it('marcar como hecha sin coste estimado pide confirmación y avisa de que el gasto se congela', async () => {
    const { repo, slug, as } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Alquilar la furgoneta' })
    as('alice')
    await repo.castVote({ proposalId: id, round: 1, value: 'up' })
    as('bob')
    await repo.castVote({ proposalId: id, round: 1, value: 'up' })

    as('alice')
    const board = await repo.getBoard(slug)
    renderWithBoard(
      <BoardPage board={board} route={{ kind: 'proposal', slug, proposalId: id }} />,
      { repo, slug },
    )
    const dialog = within(screen.getByRole('dialog'))

    await userEvent.click(dialog.getByRole('button', { name: 'Marcar como hecha' }))
    expect(dialog.getByText(/el gasto quedará congelado/i)).toBeInTheDocument()
    expect(repo.calls).not.toContain('completeProposal')

    await userEvent.click(dialog.getByRole('button', { name: 'Sí, está hecha' }))
    await waitFor(() => expect(repo.calls).toContain('completeProposal'))
  })

  it('marcar como hecha sin coste se puede cancelar sin ejecutarse', async () => {
    const { repo, slug, as } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Alquilar la furgoneta' })
    as('alice')
    await repo.castVote({ proposalId: id, round: 1, value: 'up' })
    as('bob')
    await repo.castVote({ proposalId: id, round: 1, value: 'up' })

    as('alice')
    const board = await repo.getBoard(slug)
    renderWithBoard(
      <BoardPage board={board} route={{ kind: 'proposal', slug, proposalId: id }} />,
      { repo, slug },
    )
    const dialog = within(screen.getByRole('dialog'))

    await userEvent.click(dialog.getByRole('button', { name: 'Marcar como hecha' }))
    await userEvent.click(dialog.getByRole('button', { name: 'No' }))

    expect(repo.calls).not.toContain('completeProposal')
    expect(dialog.getByRole('button', { name: 'Marcar como hecha' })).toBeInTheDocument()
  })

  it('reabrir pide confirmación', async () => {
    const { repo, slug, as } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Pintar el salón' })
    as('alice')
    await repo.castVote({ proposalId: id, round: 1, value: 'up' })
    as('bob')
    await repo.castVote({ proposalId: id, round: 1, value: 'down' })
    as('alice')

    const board = await repo.getBoard(slug)
    renderWithBoard(
      <BoardPage board={board} route={{ kind: 'proposal', slug, proposalId: id }} />,
      { repo, slug },
    )
    const dialog = within(screen.getByRole('dialog'))

    await userEvent.click(dialog.getByRole('button', { name: 'Reabrir la votación' }))
    expect(repo.calls).not.toContain('reopenProposal')

    await userEvent.click(dialog.getByRole('button', { name: 'Sí, reabrir' }))
    await waitFor(() => expect(repo.calls).toContain('reopenProposal'))
  })

  it('reabrir se puede cancelar sin ejecutarse', async () => {
    const { repo, slug, as } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Pintar el salón' })
    as('alice')
    await repo.castVote({ proposalId: id, round: 1, value: 'up' })
    as('bob')
    await repo.castVote({ proposalId: id, round: 1, value: 'down' })
    as('alice')

    const board = await repo.getBoard(slug)
    renderWithBoard(
      <BoardPage board={board} route={{ kind: 'proposal', slug, proposalId: id }} />,
      { repo, slug },
    )
    const dialog = within(screen.getByRole('dialog'))

    await userEvent.click(dialog.getByRole('button', { name: 'Reabrir la votación' }))
    await userEvent.click(dialog.getByRole('button', { name: 'No' }))

    expect(repo.calls).not.toContain('reopenProposal')
    expect(dialog.getByRole('button', { name: 'Reabrir la votación' })).toBeInTheDocument()
  })

  it('badges and filters what is waiting on my vote', async () => {
    const { repo, slug, as } = await agoraWith(['alice', 'bob'])
    const mine = await repo.createProposal({ slug, title: 'Rent a van' })
    const voted = await repo.createProposal({ slug, title: 'Buy chairs' })
    as('alice')
    await repo.castVote({ proposalId: voted, round: 1, value: 'up' })

    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    // The label lives on the button, not the badge: a span-level aria-label would run together
    // with the button's own text ("Me toca votarTe toca votar 1") in the computed accessible name.
    const pendingButton = screen.getByRole('button', { name: 'Te toca votar 1' })
    expect(pendingButton).not.toHaveAccessibleName(/Me toca votar.+Te toca votar/)
    const badge = screen.getByTestId('pending-mine-badge')
    expect(badge).toHaveTextContent('1')
    // Hidden from the accessibility tree: it is a visual duplicate of a number the button's own
    // label already says, not a second thing to announce.
    expect(badge).toHaveAttribute('aria-hidden', 'true')
    await userEvent.click(pendingButton)

    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titles).toEqual(['Rent a van'])
    expect(mine).toBeTruthy()
  })

  it('sends my vote and shows it as chosen', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Rent a van' })
    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    await userEvent.click(screen.getByRole('button', { name: 'A favor' }))
    await waitFor(() => expect(repo.calls).toContain('castVote'))
    expect(id).toBeTruthy()
  })

  it('gives the unchosen vote buttons a sunken surface and a readable border', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    await repo.createProposal({ slug, title: 'Rent a van' })
    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    const unchosen = screen.getByRole('button', { name: 'A favor' })
    expect(unchosen.style.background).toBe('var(--surface-sunken)')
    expect(unchosen.style.borderColor).toBe('var(--border-control)')
  })

  it('no anuncia el recuento de votos más de una vez a quien usa un lector de pantalla', async () => {
    const { repo, slug, as } = await agoraWith(['alice', 'bob', 'carol'])
    const id = await repo.createProposal({ slug, title: 'Cambiar el sofá del salón' })
    as('alice')
    await repo.castVote({ proposalId: id, round: 1, value: 'up' })

    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    const card = screen.getByRole('article')
    // PsephoiRow (role=img) is the one place the tally is announced; VoteControls
    // (role=group) must name the control instead of restating "N de M".
    const accessibleNames = [
      within(card).getByRole('img').getAttribute('aria-label'),
      within(card).getByRole('group').getAttribute('aria-label'),
    ]
    const tallyMentions = accessibleNames.filter((name) => /\d+ de \d+/.test(name ?? '')).length
    expect(tallyMentions).toBe(1)
  })

  it('el grupo de filtros no se llama como su primer botón', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    const group = screen.getByRole('group', { name: 'Filtrar las propuestas' })
    expect(within(group).getByRole('button', { name: 'Todo' })).toBeInTheDocument()
  })

  it('explica en pantalla que el voto en blanco también cuenta para el quórum', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    await repo.createProposal({ slug, title: 'Rent a van' })
    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    expect(screen.getByText('En blanco también cuenta para el quórum')).toBeInTheDocument()
  })

  it('dice una sola vez, sobre la lista, que el voto es secreto mientras algo sigue abierto', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    await repo.createProposal({ slug, title: 'Rent a van' })
    await repo.createProposal({ slug, title: 'Buy chairs' })
    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    expect(screen.getAllByText(SECRET)).toHaveLength(1)
  })

  it('sin nada abierto el tablón no promete nada, pero sigue explicando la regla en pasado', async () => {
    const { repo, slug, as } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Rent a van' })
    as('alice')
    await repo.castVote({ proposalId: id, round: 1, value: 'up' })
    as('bob')
    await repo.castVote({ proposalId: id, round: 1, value: 'up' })

    as('alice')
    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    // Nothing is open, so there is no promise left to make — but every card on this board now
    // carries names against senses, and going silent left the rule nowhere on screen at all.
    expect(screen.queryByText(SECRET)).toBeNull()
    expect(screen.getByText(SECRET_PAST)).toBeInTheDocument()
  })

  it('un tablón vacío no explica una regla que todavía no se aplica a nada', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    expect(screen.queryByText(SECRET)).toBeNull()
    expect(screen.queryByText(SECRET_PAST)).toBeNull()
  })

  it('la tarjeta de la lista no lleva la frase del secreto, solo el tablón', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    await repo.createProposal({ slug, title: 'Rent a van' })
    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    const card = screen.getByRole('article')
    expect(within(card).queryByText(SECRET)).toBeNull()
    expect(screen.getByText(SECRET)).toBeInTheDocument()
  })

  it('el detalle repite la frase del secreto, porque se puede abrir sin pasar por el tablón', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Rent a van' })
    const board = await repo.getBoard(slug)
    renderWithBoard(
      <BoardPage board={board} route={{ kind: 'proposal', slug, proposalId: id }} />,
      { repo, slug },
    )

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(SECRET)).toBeInTheDocument()
  })

  /** A resolved proposal with a name in each of the three senses, seeded through the real port. */
  async function resolvedWithNames() {
    const names = [
      'Ekin Etxebarria Goikoetxea',
      'Amaia Urrutikoetxea Zabaleta',
      'Maddi Aranburu Olabarrieta',
      'Jon Azpiazu Iturriaga',
      'Iker Bengoetxea Mendizabal',
    ]
    const { repo, slug, as } = await agoraWith(names)
    const id = await repo.createProposal({ slug, title: 'Cambiar el sofá del salón' })
    const senses: VoteValue[] = ['up', 'up', 'up', 'abstain', 'down']
    for (const [index, name] of names.entries()) {
      as(name)
      await repo.castVote({ proposalId: id, round: 1, value: senses[index]! })
    }
    as(names[0]!)
    return { repo, slug, id, names, board: await repo.getBoard(slug) }
  }

  it('una vez resuelta, el tablón dice quién votó qué, agrupado por sentido', async () => {
    const { repo, slug, board } = await resolvedWithNames()
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    const roll = within(screen.getByRole('article')).getByTestId('vote-roll')
    expect(within(roll).getByTestId('roll-up')).toHaveTextContent(
      'A favor: Ekin Etxebarria Goikoetxea, Amaia Urrutikoetxea Zabaleta, Maddi Aranburu Olabarrieta',
    )
    expect(within(roll).getByTestId('roll-abstain')).toHaveTextContent(
      'En blanco: Jon Azpiazu Iturriaga',
    )
    expect(within(roll).getByTestId('roll-down')).toHaveTextContent(
      'En contra: Iker Bengoetxea Mendizabal',
    )
  })

  it('la atribución llega también a la hoja y al panel lateral', async () => {
    for (const wide of [true, false]) {
      const { repo, slug, id, board } = await resolvedWithNames()
      matchMediaMatches(wide)
      const view = renderWithBoard(
        <BoardPage board={board} route={{ kind: 'proposal', slug, proposalId: id }} />,
        { repo, slug },
      )
      const shell = wide
        ? screen.getByRole('complementary', { name: 'Cambiar el sofá del salón' })
        : screen.getByRole('dialog')
      expect(within(shell).getByTestId('roll-down')).toHaveTextContent(
        'En contra: Iker Bengoetxea Mendizabal',
      )
      view.unmount()
    }
  })

  it('una propuesta resuelta abierta por enlace explica la regla, en hoja y en panel', async () => {
    // The finding this fix exists for: arriving cold on a resolved proposal, seeing your own name
    // against a sense, and being told nothing. At 390 px the sheet covers the board, so the
    // board's copy is inert and the sheet is the only thing that can say it.
    for (const wide of [false, true]) {
      const { repo, slug, id, board } = await resolvedWithNames()
      matchMediaMatches(wide)
      const view = renderWithBoard(
        <BoardPage board={board} route={{ kind: 'proposal', slug, proposalId: id }} />,
        { repo, slug },
      )
      const visible = [
        ...screen.queryAllByText(SECRET),
        ...screen.queryAllByText(SECRET_PAST),
      ].filter((node) => !node.closest('[inert]'))
      expect(visible).toHaveLength(1)
      expect(visible[0]).toHaveTextContent(SECRET_PAST)
      view.unmount()
    }
  })

  it('MIENTRAS LA PROPUESTA SIGUE ABIERTA el tablón no pone ni un nombre junto a un sentido', async () => {
    const { repo, slug, as } = await agoraWith(['Ekin', 'Amaia', 'Iker'])
    const id = await repo.createProposal({ slug, title: 'Cambiar el sofá del salón' })
    as('Amaia')
    await repo.castVote({ proposalId: id, round: 1, value: 'down' })

    as('Ekin')
    const board = await repo.getBoard(slug)
    expect(board.proposals[0]!.status).toBe('open')
    const { container } = renderWithBoard(
      <BoardPage board={board} route={{ kind: 'board', slug }} />,
      { repo, slug },
    )

    // Secrecy during the round is the premise of the whole screen. Three ways it could break:
    // a roll rendered early, a coloured pebble, or a pebble you can hover for the answer.
    expect(screen.queryByTestId('vote-roll')).toBeNull()
    expect(container.querySelectorAll('[data-vote]')).toHaveLength(0)
    for (const pebble of screen.getAllByTestId('pebble-cast')) {
      expect(pebble).not.toHaveAttribute('title')
    }

    // And the name of the one person who has voted appears nowhere at all — while somebody who
    // has not is named out loud, which is what stops this test passing on an empty card.
    expect(screen.getByTestId('missing-voters')).toHaveTextContent('Ekin')
    expect(container.textContent).not.toContain('Amaia')
  })

  it('freezes the vote once the proposal is resolved', async () => {
    const { repo, slug, as } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Rent a van' })
    as('alice')
    await repo.castVote({ proposalId: id, round: 1, value: 'up' })
    as('bob')
    await repo.castVote({ proposalId: id, round: 1, value: 'up' })

    as('alice')
    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    expect(screen.getByText('Aprobada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'A favor' })).not.toBeInTheDocument()
    const card = screen.getByRole('article')
    expect(within(card).getAllByTestId('pebble-cast')[0]).toHaveAttribute('data-vote', 'up')
  })
})

describe('BoardPage, the list itself', () => {
  it('shows a taste of the description rather than the whole thing', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    await repo.createProposal({
      slug,
      title: 'Alquilar una furgoneta',
      description:
        '## Plan\n\n- Salimos el viernes y volvemos el domingo por la tarde, con parada para comer\n- Hay que decidir quién conduce cada tramo del viaje y cómo repartimos la gasolina',
    })
    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    // The syntax is gone and the text is cut, so the row stays a row.
    const preview = screen.getByText(/Plan · Salimos el viernes/)
    expect(preview.textContent!.length).toBeLessThan(160)
    expect(preview.textContent).toContain('…')
    expect(screen.queryByText(/^##/)).not.toBeInTheDocument()
  })

  it('the title links into the proposal and the card counts its comments', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Paint the hallway' })
    await repo.addThread({ threadId: 't1', proposalId: id, commentId: 'c1', body: 'root' })
    await repo.addComment({ commentId: 'c2', threadId: 't1', body: 'reply' })

    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    expect(screen.getByRole('link', { name: 'Paint the hallway' })).toHaveAttribute(
      'href',
      `#/g/${slug}/p/${id}`,
    )
    expect(screen.getByText('2 comentarios')).toBeInTheDocument()
    // Singular is singular: "1 comentarios" is what makes an app feel unfinished.
    expect(screen.queryByText('1 comentarios')).not.toBeInTheDocument()
  })

  it('la tarjeta no duplica el enlace al detalle', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    await repo.createProposal({ slug, title: 'Cambiar el sofá del salón' })
    await repo.createProposal({ slug, title: 'Pintar la cocina' })

    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    // queryByRole would throw here, not fail, once the removed link comes back on two cards.
    expect(screen.queryAllByRole('link', { name: 'Ver la propuesta' })).toHaveLength(0)
    expect(screen.getAllByRole('link', { name: 'Cambiar el sofá del salón' })).toHaveLength(1)
  })

  it('says how long the vote has left, in days', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    await repo.createProposal({ slug, title: 'Order the cake', deadline: soon })

    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })
    expect(screen.getByText('Quedan 3 días')).toBeInTheDocument()
  })

  it('keeps comments and the expense out of the list, and shows them in the proposal', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Dinner out', estimatedCents: 6000 })
    await repo.addThread({
      threadId: 't1',
      proposalId: id,
      commentId: 'c1',
      body: 'a comment body',
    })
    const board = await repo.getBoard(slug)

    const list = renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, {
      repo,
      slug,
    })
    expect(screen.queryByText('a comment body')).not.toBeInTheDocument()
    expect(screen.queryByText('Gasto')).not.toBeInTheDocument()
    list.unmount()

    renderWithBoard(
      <BoardPage board={board} route={{ kind: 'proposal', slug, proposalId: id }} />,
      { repo, slug },
    )
    expect(screen.getByText('a comment body')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Gasto' })).toBeInTheDocument()
  })
})

describe('BoardPage, redactar es una ruta y el borrador se queda', () => {
  const dialog = () => within(screen.getByRole('dialog'))

  it('abrir la hoja de redactar lleva la dirección a la ruta de redactar', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    await userEvent.click(screen.getByRole('button', { name: 'Nueva propuesta' }))

    // The address is what the back button undoes, which is the whole point of the sheet being here.
    expect(window.location.hash).toBe(`#/g/${slug}/nueva`)
  })

  it('editar una propuesta también es una ruta', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Rent a van' })
    const board = await repo.getBoard(slug)
    renderWithBoard(
      <BoardPage board={board} route={{ kind: 'proposal', slug, proposalId: id }} />,
      { repo, slug },
    )

    await userEvent.click(dialog().getByRole('button', { name: 'Editar' }))

    expect(window.location.hash).toBe(`#/g/${slug}/p/${id}/editar`)
  })

  it('cerrar la hoja conserva lo escrito, y al volver está ahí', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    const board = await repo.getBoard(slug)
    const first = renderWithBoard(<BoardPage board={board} route={{ kind: 'compose', slug }} />, {
      repo,
      slug,
    })

    await userEvent.type(dialog().getByLabelText('Título'), 'Un sofá nuevo')
    await userEvent.click(dialog().getByRole('button', { name: 'Cerrar' }))
    first.unmount()

    renderWithBoard(<BoardPage board={board} route={{ kind: 'compose', slug }} />, { repo, slug })

    expect(dialog().getByLabelText('Título')).toHaveValue('Un sofá nuevo')
  })

  it('descartar el borrador se pide dos veces y entonces sí lo borra', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    const board = await repo.getBoard(slug)
    const first = renderWithBoard(<BoardPage board={board} route={{ kind: 'compose', slug }} />, {
      repo,
      slug,
    })

    await userEvent.type(dialog().getByLabelText('Título'), 'Un sofá nuevo')
    await userEvent.click(dialog().getByRole('button', { name: 'Descartar el borrador' }))

    // One click asks; it does not throw anything away.
    expect(localStorage.getItem(draftKey(slug))).not.toBeNull()

    await userEvent.click(dialog().getByRole('button', { name: 'Descartar de verdad' }))
    expect(localStorage.getItem(draftKey(slug))).toBeNull()
    first.unmount()

    renderWithBoard(<BoardPage board={board} route={{ kind: 'compose', slug }} />, { repo, slug })
    expect(dialog().getByLabelText('Título')).toHaveValue('')
  })

  it('el borrador de una edición no se mezcla con el de una propuesta nueva', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Rent a van' })
    const board = await repo.getBoard(slug)
    const editView = renderWithBoard(
      <BoardPage board={board} route={{ kind: 'edit', slug, proposalId: id }} />,
      { repo, slug },
    )

    await userEvent.type(dialog().getByLabelText('Título'), ' grande')
    editView.unmount()

    renderWithBoard(<BoardPage board={board} route={{ kind: 'compose', slug }} />, { repo, slug })
    expect(dialog().getByLabelText('Título')).toHaveValue('')
  })
})

describe('BoardPage, salir de una hoja', () => {
  const dialog = () => within(screen.getByRole('dialog'))

  async function withProposal() {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Rent a van' })
    const board = await repo.getBoard(slug)
    return { repo, slug, id, board }
  }

  it('cerrar la hoja de editar devuelve a la propuesta, no a la lista', async () => {
    const { repo, slug, id, board } = await withProposal()
    renderWithBoard(<BoardPage board={board} route={{ kind: 'edit', slug, proposalId: id }} />, {
      repo,
      slug,
    })

    await userEvent.click(dialog().getByRole('button', { name: 'Cerrar' }))

    // You opened this sheet from the proposal you were reading; that is where leaving it puts you.
    expect(window.location.hash).toBe(`#/g/${slug}/p/${id}`)
  })

  it('cancelar la edición también devuelve a la propuesta', async () => {
    const { repo, slug, id, board } = await withProposal()
    renderWithBoard(<BoardPage board={board} route={{ kind: 'edit', slug, proposalId: id }} />, {
      repo,
      slug,
    })

    await userEvent.click(dialog().getByRole('button', { name: 'Cancelar' }))

    expect(window.location.hash).toBe(`#/g/${slug}/p/${id}`)
  })

  it('guardar la edición devuelve a la propuesta y borra su borrador', async () => {
    const { repo, slug, id, board } = await withProposal()
    renderWithBoard(<BoardPage board={board} route={{ kind: 'edit', slug, proposalId: id }} />, {
      repo,
      slug,
    })

    await userEvent.type(dialog().getByLabelText('Título'), ' grande')
    await userEvent.click(dialog().getByRole('button', { name: 'Guardar los cambios' }))

    expect(window.location.hash).toBe(`#/g/${slug}/p/${id}`)
    await waitFor(() => expect(readDraft(draftKey(slug, id))).toBeNull())
  })

  it('abrir una hoja añade un paso atrás y cerrarla no añade otro', async () => {
    const { repo, slug, board } = await withProposal()
    const list = renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, {
      repo,
      slug,
    })

    const beforeOpening = history.length
    await userEvent.click(screen.getByRole('button', { name: 'Nueva propuesta' }))
    expect(history.length).toBe(beforeOpening + 1)
    list.unmount()

    renderWithBoard(<BoardPage board={board} route={{ kind: 'compose', slug }} />, { repo, slug })
    const beforeClosing = history.length
    await userEvent.click(dialog().getByRole('button', { name: 'Cerrar' }))

    // Closing replaces the address. Pushing it would leave a step that walks straight back in.
    expect(window.location.hash).toBe(`#/g/${slug}`)
    expect(history.length).toBe(beforeClosing)
  })
})

describe('BoardPage, el borrador y la escritura que puede fallar', () => {
  const dialog = () => within(screen.getByRole('dialog'))

  it('publicar bien deja el borrador borrado', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'compose', slug }} />, { repo, slug })

    await userEvent.type(dialog().getByLabelText('Título'), 'Un sofá nuevo')
    await userEvent.click(dialog().getByRole('button', { name: 'Publicar la propuesta' }))

    await waitFor(() => expect(repo.calls).toContain('createProposal'))
    await waitFor(() => expect(readDraft(draftKey(slug))).toBeNull())
  })

  it('si la publicación falla, lo escrito sigue en el aparato', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    const board = await repo.getBoard(slug)
    // A real failure through the public port: the agora is gone by the time the write goes out.
    await repo.deleteAgora({ slug, confirmName: 'Cuadrilla' })

    renderWithBoard(<BoardPage board={board} route={{ kind: 'compose', slug }} />, { repo, slug })

    await userEvent.type(dialog().getByLabelText('Título'), 'Un sofá nuevo')
    await userEvent.click(dialog().getByRole('button', { name: 'Publicar la propuesta' }))

    await waitFor(() => expect(repo.calls).toContain('createProposal'))
    // The sheet closed before the write resolved: throwing the words away here loses them for good.
    expect(readDraft(draftKey(slug))?.title).toBe('Un sofá nuevo')
  })

  it('si guardar falla, el borrador de la edición sigue ahí', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Rent a van' })
    const board = await repo.getBoard(slug)
    await repo.deleteAgora({ slug, confirmName: 'Cuadrilla' })

    renderWithBoard(<BoardPage board={board} route={{ kind: 'edit', slug, proposalId: id }} />, {
      repo,
      slug,
    })

    await userEvent.type(dialog().getByLabelText('Título'), ' grande')
    await userEvent.click(dialog().getByRole('button', { name: 'Guardar los cambios' }))

    await waitFor(() => expect(repo.calls).toContain('updateProposal'))
    expect(readDraft(draftKey(slug, id))?.title).toBe('Rent a van grande')
  })

  it('al editar, el borrador interrumpido gana a lo que hay publicado', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Rent a van' })
    const board = await repo.getBoard(slug)
    writeDraft(draftKey(slug, id), {
      title: 'Rent two vans',
      description: 'La grande no cabe',
      tags: [],
      deadline: '',
      cost: '',
    })

    renderWithBoard(<BoardPage board={board} route={{ kind: 'edit', slug, proposalId: id }} />, {
      repo,
      slug,
    })

    // What you were in the middle of writing, not what is published: the published text is one
    // click away in the proposal, the half-written edit exists nowhere else.
    expect(dialog().getByLabelText('Título')).toHaveValue('Rent two vans')
    expect(dialog().getByLabelText('Descripción')).toHaveValue('La grande no cabe')
  })
})

describe('BoardPage, la lectura a dos columnas del escritorio', () => {
  async function openProposal(wide: boolean) {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({
      slug,
      title: 'Cambiar el sofá del salón',
      estimatedCents: 40000,
    })
    const board = await repo.getBoard(slug)
    matchMediaMatches(wide)
    const view = renderWithBoard(
      <BoardPage board={board} route={{ kind: 'proposal', slug, proposalId: id }} />,
      { repo, slug },
    )
    return { ...view, slug, id }
  }

  it('a partir de 1024 px la propuesta abierta es un panel lateral y no un diálogo', async () => {
    await openProposal(true)

    expect(screen.queryByRole('dialog')).toBeNull()
    const panel = screen.getByRole('complementary', { name: 'Cambiar el sofá del salón' })
    expect(within(panel).getByRole('heading', { name: 'Cambiar el sofá del salón' })).toBeVisible()
  })

  it('por debajo de 1024 px sigue siendo la hoja de hoy', async () => {
    await openProposal(false)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByRole('complementary')).toBeNull()
  })

  it('la propuesta abierta está una sola vez, no una por cada forma', async () => {
    await openProposal(true)

    // The CSS-only version of this renders both trees and hides one, which reads the title, the
    // vote and the comment form twice to a screen reader. Level 2 is the detail's own heading;
    // the board card behind it keeps its level 3.
    expect(
      screen.getAllByRole('heading', { level: 2, name: 'Cambiar el sofá del salón' }),
    ).toHaveLength(1)
  })

  it('el panel deja el tablón manejable detrás, cosa que la hoja no hace', async () => {
    await openProposal(true)

    // A side panel is not a modal: the board beside it stays reachable, which is exactly what the
    // sheet's `inert` takes away.
    expect(screen.getByRole('region', { name: 'Cuadrilla' }).closest('[inert]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Nueva propuesta' })).toBeEnabled()
  })

  it('ensanchar la ventana con una propuesta abierta la pasa de hoja a panel', async () => {
    await openProposal(false)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // The window grows under the open proposal. If the hook read the query once and never
    // listened, this stays a dialog for as long as the page lives.
    act(() => matchMediaMatches(true))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(
      screen.getByRole('complementary', { name: 'Cambiar el sofá del salón' }),
    ).toBeInTheDocument()
  })

  it('la tira de filtros lleva la regla que la hace envolver a partir de sm', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    await repo.createProposal({ slug, title: 'Pintar el pasillo', tags: ['obras', 'salón'] })
    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    // jsdom lays nothing out, so this is the one assertion available: from `sm` up the strip stops
    // forcing its own max-content width and wraps instead. The seven widths were measured in a
    // real browser; what this guards is that the rule is still there to measure.
    const strip = screen.getByRole('group', { name: 'Filtrar las propuestas' })
    expect(strip).toHaveClass('sm:min-w-0', 'sm:flex-wrap')
  })

  it('«Volver al tablón» cierra el panel sin apilar un paso atrás', async () => {
    const { slug } = await openProposal(true)

    const panel = screen.getByRole('complementary', { name: 'Cambiar el sofá del salón' })
    const before = history.length
    await userEvent.click(within(panel).getByRole('button', { name: 'Volver al tablón' }))

    expect(window.location.hash).toBe(`#/g/${slug}`)
    expect(history.length).toBe(before)
  })

  it('abrir el panel lleva el foco dentro, no lo deja veinte tabulaciones atrás', async () => {
    await openProposal(true)

    // Non-modal content the reader explicitly asked for: moving focus to it is allowed, and not
    // moving it leaves the panel sixteen-plus tab stops past the card that opened it.
    expect(screen.getByRole('complementary', { name: 'Cambiar el sofá del salón' })).toHaveFocus()
  })

  it('«Volver al tablón» devuelve el foco a la tarjeta, no al body', async () => {
    await openProposal(true)
    const panel = screen.getByRole('complementary', { name: 'Cambiar el sofá del salón' })

    await userEvent.click(within(panel).getByRole('button', { name: 'Volver al tablón' }))

    expect(screen.getByRole('link', { name: 'Cambiar el sofá del salón' })).toHaveFocus()
  })

  it('con el tablón para él solo las tarjetas van a dos columnas, y a una junto al panel', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Pintar el pasillo' })
    await repo.createProposal({ slug, title: 'Comprar un proyector' })
    const board = await repo.getBoard(slug)
    matchMediaMatches(true)

    const closed = renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, {
      repo,
      slug,
    })
    expect(screen.getByRole('list')).toHaveClass('lg:grid-cols-2')
    closed.unmount()

    renderWithBoard(
      <BoardPage board={board} route={{ kind: 'proposal', slug, proposalId: id }} />,
      { repo, slug },
    )
    // The panel takes the second track, so the cards give it back by collapsing to one column.
    expect(screen.getAllByRole('list')[0]).not.toHaveClass('lg:grid-cols-2')
  })

  it('la frase del voto secreto se dice una sola vez en pantalla, sea cual sea la forma', async () => {
    // Counted across the whole document on purpose, minus whatever sits under `inert` — the sheet
    // marks the board inert, so the board's copy is neither seen nor announced while it is up.
    // The board says it once above the list and the detail says it when it covers the board; each
    // copy is right on its own, and it took a screenshot to notice that the side panel put both on
    // screen 300 px apart. A count scoped to one component cannot see that, which is how it got
    // through.
    // Counted across both tenses together: the rule is one thing said once, and a version of this
    // check that only knew the future tense scored a resolved proposal in a sheet as "fine" while
    // it was in fact explaining nothing at all.
    const onScreen = () =>
      [...screen.queryAllByText(SECRET), ...screen.queryAllByText(SECRET_PAST)].filter(
        (node) => !node.closest('[inert]'),
      )

    const panel = await openProposal(true)
    expect(onScreen()).toHaveLength(1)
    panel.unmount()

    const sheet = await openProposal(false)
    expect(onScreen()).toHaveLength(1)
    sheet.unmount()

    const { repo, slug } = await agoraWith(['alice', 'bob'])
    await repo.createProposal({ slug, title: 'Pintar el pasillo' })
    const board = await repo.getBoard(slug)
    matchMediaMatches(true)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })
    expect(onScreen()).toHaveLength(1)
  })

  it('el hilo se lee junto al voto y el dinero después, en el panel y en la hoja', async () => {
    for (const wide of [true, false]) {
      const view = await openProposal(wide)

      const shell = wide
        ? screen.getByRole('complementary', { name: 'Cambiar el sofá del salón' })
        : screen.getByRole('dialog')
      const threads = within(shell).getByRole('region', { name: 'Comentarios' })
      const expense = within(shell).getByRole('region', { name: 'Gasto' })

      // DOCUMENT_POSITION_FOLLOWING: the money comes after the debate, never before it.
      expect(
        threads.compareDocumentPosition(expense) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      view.unmount()
    }
  })
})

describe('BoardPage, el relleno de marca', () => {
  async function board() {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    await repo.createProposal({ slug, title: 'Pintar el pasillo' })
    const snapshot = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={snapshot} route={{ kind: 'board', slug }} />, { repo, slug })
  }

  // --brand under --brand-ink is 3.08:1. The token file has carried --brand-strong for a while;
  // what these two assert is that the call sites actually reach for it, which is the half the
  // token-level contrast test cannot see.
  it('la llamada principal se rellena con --brand-strong', async () => {
    await board()

    expect(screen.getByRole('button', { name: 'Nueva propuesta' })).toHaveStyle({
      background: 'var(--brand-strong)',
    })
  })

  it('el filtro activo también, borde incluido', async () => {
    await board()

    const chip = screen.getByRole('button', { name: 'Todo' })
    expect(chip).toHaveStyle({ background: 'var(--brand-strong)' })
    // Read off the inline style: jsdom resolves no custom property, so a `border-color` shorthand
    // holding a var() comes back empty from getComputedStyle and toHaveStyle cannot see it.
    expect(chip.style.borderColor).toBe('var(--brand-strong)')
  })
})

/**
 * The real repository with a latch on one method. Not a mock: the same class, the same write,
 * doing the same thing — just not yet. Holding a vote in the air is the only way to look at the
 * buttons while it is still in flight, because the in-memory write otherwise lands in the same
 * tick as the click.
 */
class HeldVotes extends InMemoryBoardRepository {
  hold = false
  private open: (() => void) | null = null

  override async castVote(input: {
    proposalId: string
    round: number
    value: VoteValue
  }): Promise<void> {
    if (this.hold) await new Promise<void>((resolve) => (this.open = resolve))
    return super.castVote(input)
  }

  release(): void {
    this.hold = false
    this.open?.()
    this.open = null
  }
}

describe('BoardPage, el momento de votar', () => {
  async function boardWith(repo: InMemoryBoardRepository, title: string) {
    const { slug } = await repo.createAgora({ name: 'Cuadrilla', creatorName: 'alice' })
    await repo.addParticipant({ slug, name: 'bob' })
    repo.actAs(repo.participantId(slug, 'alice'))
    const id = await repo.createProposal({ slug, title })
    return { slug, id, board: await repo.getBoard(slug) }
  }

  it('confirma en voz y en pantalla lo que se acaba de votar', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    await repo.createProposal({ slug, title: 'Alquilar una furgoneta' })
    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    await userEvent.click(screen.getByRole('button', { name: 'A favor' }))

    // role="status" is an aria-live=polite region: it is read out without stealing focus.
    const live = await screen.findByRole('status')
    expect(live).toHaveTextContent('Has votado a favor')
  })

  it('dice qué se votó, no solo que se votó', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    await repo.createProposal({ slug, title: 'Alquilar una furgoneta' })
    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    await userEvent.click(screen.getByRole('button', { name: 'En blanco' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Has votado en blanco')

    await userEvent.click(screen.getByRole('button', { name: 'En contra' }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Has votado en contra'),
    )
  })

  it('no se puede votar dos veces mientras la primera está en vuelo', async () => {
    const repo = new HeldVotes()
    const { slug, board } = await boardWith(repo, 'Alquilar una furgoneta')
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    repo.hold = true
    await userEvent.click(screen.getByRole('button', { name: 'A favor' }))

    for (const name of ['A favor', 'En blanco', 'En contra']) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
    // The second tap of a double tap. It used to land, and cast a second vote.
    await userEvent.click(screen.getByRole('button', { name: 'En contra' }))
    expect(repo.calls.filter((call) => call === 'castVote')).toHaveLength(0)

    await act(async () => {
      repo.release()
    })
    await waitFor(() => expect(screen.getByRole('button', { name: 'En contra' })).toBeEnabled())
    expect(repo.calls.filter((call) => call === 'castVote')).toHaveLength(1)
  })

  it('el voto en vuelo solo apaga los botones de su propia propuesta', async () => {
    const repo = new HeldVotes()
    const { slug } = await boardWith(repo, 'Pintar el pasillo')
    await repo.createProposal({ slug, title: 'Comprar sillas' })
    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    const cards = screen.getAllByRole('article')
    repo.hold = true
    await userEvent.click(within(cards[0]!).getByRole('button', { name: 'A favor' }))

    expect(within(cards[0]!).getByRole('button', { name: 'A favor' })).toBeDisabled()
    expect(within(cards[1]!).getByRole('button', { name: 'A favor' })).toBeEnabled()
    await act(async () => {
      repo.release()
    })
  })

  it('la confirmación se queda en la propuesta que se votó', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    await repo.createProposal({ slug, title: 'Pintar el pasillo' })
    await repo.createProposal({ slug, title: 'Comprar sillas' })
    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    const cards = screen.getAllByRole('article')
    await userEvent.click(within(cards[0]!).getByRole('button', { name: 'A favor' }))

    await waitFor(() =>
      expect(within(cards[0]!).getByRole('status')).toHaveTextContent('Has votado a favor'),
    )
    // The other card keeps its live region — every card has one, always — and says nothing in it.
    // Asserting the region is absent would lock in the very defect this shape exists to avoid.
    expect(within(cards[1]!).getByRole('status')).toHaveTextContent('')
  })

  it('se anuncia una sola vez aunque la propuesta esté en la lista y en el panel a la vez', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Cambiar el sofá del salón' })
    const board = await repo.getBoard(slug)
    matchMediaMatches(true)
    renderWithBoard(
      <BoardPage board={board} route={{ kind: 'proposal', slug, proposalId: id }} />,
      { repo, slug },
    )

    const panel = screen.getByRole('complementary', { name: 'Cambiar el sofá del salón' })
    await userEvent.click(within(panel).getByRole('button', { name: 'A favor' }))

    // Two copies saying the same sentence read it twice into a screen reader. Both regions are
    // there — the card's and the panel's — and only one of them is allowed to have anything in it.
    await waitFor(() =>
      expect(within(panel).getByRole('status')).toHaveTextContent('Has votado a favor'),
    )
    const spoken = screen
      .getAllByRole('status')
      .filter((region) => (region.textContent ?? '').trim().length > 0)
    expect(spoken).toHaveLength(1)
  })

  it('la región que anuncia el voto ya está en la página antes de votar, y vacía', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    await repo.createProposal({ slug, title: 'Alquilar una furgoneta' })
    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    // A live region inserted together with its text is frequently never announced: screen readers
    // watch these nodes for changes, and a node that arrives already full has not changed. The
    // one announcement that would be lost is the first vote, which is the whole point.
    const live = screen.getByRole('status')
    expect(live).toHaveTextContent('')
    // And it stands there at its full height, so the confirmation does not shove the rest of the
    // card down the instant it arrives. The board's own tests measure the rest.
    expect(live).toHaveClass('min-h-5')

    await userEvent.click(screen.getByRole('button', { name: 'A favor' }))
    // The same node, now with something in it: a change, which is what gets read out.
    await waitFor(() => expect(live).toHaveTextContent('Has votado a favor'))
    expect(screen.getByRole('status')).toBe(live)
  })

  it('la tarjeta marca tu piedra en cuanto has votado, y no dice hacia dónde', async () => {
    const { repo, slug, as } = await agoraWith(['alice', 'bob', 'carol'])
    const id = await repo.createProposal({ slug, title: 'Cambiar el sofá del salón' })
    as('alice')
    await repo.castVote({ proposalId: id, round: 1, value: 'down' })
    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    const card = screen.getByRole('article')
    const own = within(card).getByTestId('pebble-mine')
    expect(own).not.toHaveAttribute('data-vote')
    expect(own.style.background).toBe('var(--pebble)')
    // Nothing anywhere on the card leaks the direction while the round is still open.
    expect(card.querySelectorAll('[data-vote]')).toHaveLength(0)
    expect(within(card).getByRole('img').getAttribute('aria-label')).toContain('tu voto incluido')
  })

  it('sin voto propio no hay piedra marcada, aunque otras personas ya hayan votado', async () => {
    const { repo, slug, as } = await agoraWith(['alice', 'bob', 'carol'])
    const id = await repo.createProposal({ slug, title: 'Cambiar el sofá del salón' })
    as('bob')
    await repo.castVote({ proposalId: id, round: 1, value: 'up' })

    as('alice')
    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    expect(screen.queryByTestId('pebble-mine')).toBeNull()
    expect(screen.getAllByTestId('pebble-cast')).toHaveLength(1)
  })
})
