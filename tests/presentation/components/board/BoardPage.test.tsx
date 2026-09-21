import { describe, it, expect, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BoardPage } from '@/presentation/components/board/BoardPage'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'
import { draftKey, readDraft, writeDraft } from '@/presentation/drafts'
import { renderWithBoard } from '../../support/renderWithBoard'

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

  it('names who has not voted yet, and nobody who has', async () => {
    const { repo, slug, as } = await agoraWith(['alice', 'bob', 'carol'])
    const id = await repo.createProposal({ slug, title: 'Rent a van' })
    as('alice')
    await repo.castVote({ proposalId: id, round: 1, value: 'up' })

    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    const missing = screen.getByTestId('missing-voters')
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

    expect(screen.getByText(/1 de 2 han votado/)).toBeInTheDocument()
    expect(container.querySelectorAll('[data-vote]')).toHaveLength(0)
    expect(screen.getAllByTestId('pebble-cast')).toHaveLength(1)
    expect(screen.getAllByTestId('pebble-empty')).toHaveLength(1)
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

    expect(screen.getByTestId('pending-mine-badge')).toHaveTextContent('1')
    await userEvent.click(screen.getByRole('button', { name: /Me toca votar/ }))

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

  it('links into the proposal and counts its comments', async () => {
    const { repo, slug } = await agoraWith(['alice', 'bob'])
    const id = await repo.createProposal({ slug, title: 'Paint the hallway' })
    await repo.addThread({ threadId: 't1', proposalId: id, commentId: 'c1', body: 'root' })
    await repo.addComment({ commentId: 'c2', threadId: 't1', body: 'reply' })

    const board = await repo.getBoard(slug)
    renderWithBoard(<BoardPage board={board} route={{ kind: 'board', slug }} />, { repo, slug })

    expect(screen.getByRole('link', { name: 'Ver la propuesta' })).toHaveAttribute(
      'href',
      `#/g/${slug}/p/${id}`,
    )
    expect(screen.getByText('2 comentarios')).toBeInTheDocument()
    // Singular is singular: "1 comentarios" is what makes an app feel unfinished.
    expect(screen.queryByText('1 comentarios')).not.toBeInTheDocument()
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
