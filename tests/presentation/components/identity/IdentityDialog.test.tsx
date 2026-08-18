import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IdentityDialog } from '@/presentation/components/identity/IdentityDialog'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'
import { renderWithBoard } from '../../support/renderWithBoard'

async function agora(names: string[]) {
  const repo = new InMemoryBoardRepository()
  const { slug } = await repo.createAgora({ name: 'Cuadrilla', creatorName: names[0]! })
  for (const name of names.slice(1)) await repo.addParticipant({ slug, name })
  return { repo, slug }
}

describe('IdentityDialog', () => {
  it('asks who you are and lists the names already in the agora', async () => {
    const { repo, slug } = await agora(['Endika', 'Marta'])
    renderWithBoard(<IdentityDialog slug={slug} onIdentified={() => {}} />, { repo, slug })

    expect(await screen.findByRole('heading', { name: '¿Quién eres?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Endika' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Marta' })).toBeInTheDocument()
  })

  it('claims a name with one tap, no pin anywhere', async () => {
    const { repo, slug } = await agora(['Endika', 'Marta'])
    let done = false
    renderWithBoard(<IdentityDialog slug={slug} onIdentified={() => (done = true)} />, {
      repo,
      slug,
    })

    await userEvent.click(await screen.findByRole('button', { name: 'Marta' }))

    await waitFor(() => expect(done).toBe(true))
    expect(repo.calls).toContain('claim')
    expect(screen.queryByLabelText(/PIN/i)).not.toBeInTheDocument()
  })

  it('adds whoever is not on the list', async () => {
    const { repo, slug } = await agora(['Endika'])
    let done = false
    renderWithBoard(<IdentityDialog slug={slug} onIdentified={() => (done = true)} />, {
      repo,
      slug,
    })

    await userEvent.click(await screen.findByRole('button', { name: 'No estoy en la lista' }))
    await userEvent.type(screen.getByLabelText('Tu nombre'), 'Iker')
    await userEvent.click(screen.getByRole('button', { name: 'Añadirme' }))

    await waitFor(() => expect(done).toBe(true))
    expect((await repo.preview(slug)).participants.map((p) => p.name)).toContain('Iker')
  })

  it('sends a name that is already there back to the list', async () => {
    const { repo, slug } = await agora(['Endika'])
    renderWithBoard(<IdentityDialog slug={slug} onIdentified={() => {}} />, { repo, slug })

    await userEvent.click(await screen.findByRole('button', { name: 'No estoy en la lista' }))
    await userEvent.type(screen.getByLabelText('Tu nombre'), 'endika')
    await userEvent.click(screen.getByRole('button', { name: 'Añadirme' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Elígelo en la lista')
  })

  it('refuses an empty name without asking the server', async () => {
    const { repo, slug } = await agora(['Endika'])
    renderWithBoard(<IdentityDialog slug={slug} onIdentified={() => {}} />, { repo, slug })

    await userEvent.click(await screen.findByRole('button', { name: 'No estoy en la lista' }))
    await userEvent.click(screen.getByRole('button', { name: 'Añadirme' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Escribe tu nombre.')
    expect(repo.calls).not.toContain('addParticipant')
  })
})
