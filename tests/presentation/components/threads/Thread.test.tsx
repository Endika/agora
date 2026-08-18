import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThreadList } from '@/presentation/components/threads/ThreadList'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'
import { renderWithBoard } from '../../support/renderWithBoard'

async function threadOn(comments: string[]) {
  const repo = new InMemoryBoardRepository()
  const { slug } = await repo.createAgora({ name: 'Cuadrilla', creatorName: 'alice' })
  await repo.addParticipant({ slug, name: 'bob' })
  const alice = repo.participantId(slug, 'alice')
  const bob = repo.participantId(slug, 'bob')

  repo.actAs(alice)
  const proposalId = await repo.createProposal({ slug, title: 'Paint the hallway' })

  repo.actAs(bob)
  await repo.addThread({ threadId: 't1', proposalId, commentId: 'c0', body: comments[0]! })
  for (const [index, body] of comments.slice(1).entries()) {
    await repo.addComment({ commentId: `c${index + 1}`, threadId: 't1', body })
  }

  const board = await repo.getBoard(slug)
  return { repo, slug, proposalId, alice, bob, board }
}

describe('Thread', () => {
  it('collapses a resolved thread for everyone, and anyone can expand it', async () => {
    const { repo, slug, proposalId, alice, bob, board } = await threadOn(['What colour?'])
    await repo.setThreadResolved({ threadId: 't1', resolved: true })
    const resolved = await repo.getBoard(slug)

    renderWithBoard(
      <ThreadList
        proposalId={proposalId}
        proposalAuthorId={alice}
        threads={resolved.threads}
        participants={board.participants}
        meId={bob}
        slug={slug}
        onChanged={() => {}}
      />,
      { repo, slug },
    )

    const details = screen.getByText('Resuelto').closest('details')!
    expect(details.open).toBe(false)
    expect(within(details).getByText('What colour?')).toBeInTheDocument()

    // Click the disclosure itself: the author's name appears twice, in the summary and on the comment.
    await userEvent.click(details.querySelector('summary')!)
    expect(details.open).toBe(true)
  })

  it('offers resolving to the thread author and the proposal author, and to nobody else', async () => {
    const { repo, slug, proposalId, alice, bob, board } = await threadOn(['What colour?'])
    await repo.addParticipant({ slug, name: 'carol' })
    const carol = repo.participantId(slug, 'carol')
    const fresh = await repo.getBoard(slug)

    const view = (meId: string) =>
      renderWithBoard(
        <ThreadList
          proposalId={proposalId}
          proposalAuthorId={alice}
          threads={fresh.threads}
          participants={board.participants}
          meId={meId}
          slug={slug}
          onChanged={() => {}}
        />,
        { repo, slug },
      )

    const asCarol = view(carol)
    expect(screen.queryByRole('button', { name: 'Marcar como resuelto' })).not.toBeInTheDocument()
    asCarol.unmount()

    view(bob)
    expect(screen.getByRole('button', { name: 'Marcar como resuelto' })).toBeInTheDocument()
  })

  it('fetches the rest of a long thread only when asked', async () => {
    const { repo, slug, proposalId, alice, bob, board } = await threadOn([
      'root',
      'one',
      'two',
      'three',
      'four',
    ])

    renderWithBoard(
      <ThreadList
        proposalId={proposalId}
        proposalAuthorId={alice}
        threads={board.threads}
        participants={board.participants}
        meId={bob}
        slug={slug}
        onChanged={() => {}}
      />,
      { repo, slug },
    )

    // The board carried three; the rest is a separate call, which is the egress budget at work.
    expect(screen.queryByText('four')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ver los 5 comentarios' }))

    expect(await screen.findByText('four')).toBeInTheDocument()
    expect(repo.calls).toContain('threadComments')
  })

  it('opens a thread and replies in one, both with client-made ids', async () => {
    const repo = new InMemoryBoardRepository()
    const { slug } = await repo.createAgora({ name: 'Cuadrilla', creatorName: 'alice' })
    const alice = repo.participantId(slug, 'alice')
    const proposalId = await repo.createProposal({ slug, title: 'Paint the hallway' })

    renderWithBoard(
      <ThreadList
        proposalId={proposalId}
        proposalAuthorId={alice}
        threads={[]}
        participants={[{ id: alice, name: 'alice' }]}
        meId={alice}
        slug={slug}
        onChanged={() => {}}
      />,
      { repo, slug },
    )

    expect(screen.getByText('Todavía no hay comentarios.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Comentar' }))
    await userEvent.type(screen.getByLabelText('Comentar'), '¿De qué color?')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))

    await waitFor(() => expect(repo.calls).toContain('addThread'))
  })

  it('refuses to send an empty comment', async () => {
    const repo = new InMemoryBoardRepository()
    const { slug } = await repo.createAgora({ name: 'Cuadrilla', creatorName: 'alice' })
    const alice = repo.participantId(slug, 'alice')
    const proposalId = await repo.createProposal({ slug, title: 'Paint the hallway' })

    renderWithBoard(
      <ThreadList
        proposalId={proposalId}
        proposalAuthorId={alice}
        threads={[]}
        participants={[{ id: alice, name: 'alice' }]}
        meId={alice}
        slug={slug}
        onChanged={() => {}}
      />,
      { repo, slug },
    )

    await userEvent.click(screen.getByRole('button', { name: 'Comentar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Escribe algo')
    expect(repo.calls).not.toContain('addThread')
  })

  it('makes a url in a comment clickable without producing any html', async () => {
    const { repo, slug, proposalId, alice, bob, board } = await threadOn([
      'mira https://example.org y dime <b>esto</b>',
    ])

    renderWithBoard(
      <ThreadList
        proposalId={proposalId}
        proposalAuthorId={alice}
        threads={board.threads}
        participants={board.participants}
        meId={bob}
        slug={slug}
        onChanged={() => {}}
      />,
      { repo, slug },
    )

    expect(screen.getByRole('link', { name: 'https://example.org' })).toHaveAttribute(
      'href',
      'https://example.org',
    )
    // The tags arrived as text and stayed text.
    expect(screen.getByText(/<b>esto<\/b>/)).toBeInTheDocument()
  })
})
