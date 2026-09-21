import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateAgoraForm } from '@/presentation/components/identity/CreateAgoraForm'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'
import { renderWithBoard } from '../../support/renderWithBoard'

async function fillAndSubmit(agoraName: string, creatorName: string) {
  await userEvent.type(screen.getByLabelText('Nombre del ágora'), agoraName)
  await userEvent.type(screen.getByLabelText('Tu nombre'), creatorName)
  await userEvent.click(screen.getByRole('button', { name: 'Crear el ágora' }))
}

describe('CreateAgoraForm', () => {
  it('offers both ballot modes at once, each with its own consequence, secret checked by default', async () => {
    renderWithBoard(<CreateAgoraForm onCreated={() => {}} />, { slug: null })

    const group = screen.getByRole('group', { name: '¿Cómo se ven los votos?' })
    const secret = screen.getByRole('radio', { name: 'En secreto' })
    const open = screen.getByRole('radio', { name: 'Con tu nombre' })
    expect(group).toContainElement(secret)
    expect(group).toContainElement(open)

    expect(secret).toBeChecked()
    expect(open).not.toBeChecked()

    // Each option's consequence is stated for whoever votes, associated with its own radio, both
    // readable at the same time rather than hidden behind a select.
    expect(secret).toHaveAccessibleDescription(
      'Tu voto no llevará tu nombre nunca, ni siquiera cuando se resuelva la propuesta.',
    )
    expect(open).toHaveAccessibleDescription(
      'Cuando se resuelva la propuesta, tu voto llevará tu nombre.',
    )
  })

  it('creates a secret agora by default, without anyone touching the radios', async () => {
    const repo = new InMemoryBoardRepository()
    let created: string | null = null
    renderWithBoard(<CreateAgoraForm onCreated={(slug) => (created = slug)} />, {
      repo,
      slug: null,
    })

    await fillAndSubmit('Piso de Gros', 'Endika')
    await waitFor(() => expect(created).not.toBeNull())

    const board = await repo.getBoard(created!)
    expect(board.group.ballotOpen).toBe(false)
  })

  it('carries the open choice all the way to createAgora when picked deliberately', async () => {
    const repo = new InMemoryBoardRepository()
    let created: string | null = null
    renderWithBoard(<CreateAgoraForm onCreated={(slug) => (created = slug)} />, {
      repo,
      slug: null,
    })

    await userEvent.click(screen.getByRole('radio', { name: 'Con tu nombre' }))
    await fillAndSubmit('Piso de Gros', 'Endika')
    await waitFor(() => expect(created).not.toBeNull())

    const board = await repo.getBoard(created!)
    expect(board.group.ballotOpen).toBe(true)
  })

  it('lets picking open and then secret again land back on the protected default', async () => {
    const repo = new InMemoryBoardRepository()
    let created: string | null = null
    renderWithBoard(<CreateAgoraForm onCreated={(slug) => (created = slug)} />, {
      repo,
      slug: null,
    })

    await userEvent.click(screen.getByRole('radio', { name: 'Con tu nombre' }))
    await userEvent.click(screen.getByRole('radio', { name: 'En secreto' }))
    await fillAndSubmit('Piso de Gros', 'Endika')
    await waitFor(() => expect(created).not.toBeNull())

    const board = await repo.getBoard(created!)
    expect(board.group.ballotOpen).toBe(false)
  })
})
