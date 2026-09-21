import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DangerZone } from '@/presentation/components/identity/DangerZone'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'
import { renderWithBoard } from '../../support/renderWithBoard'

describe('DangerZone', () => {
  it('keeps the delete button disabled until the agora name matches exactly', async () => {
    const repo = new InMemoryBoardRepository()
    const { slug } = await repo.createAgora({ name: 'Casa de la playa', creatorName: 'Endika' })
    let deleted = false
    renderWithBoard(
      <DangerZone slug={slug} agoraName="Casa de la playa" onDeleted={() => (deleted = true)} />,
      { repo, slug },
    )

    const submit = screen.getByRole('button', { name: 'Borrar para siempre' })
    expect(submit).toBeDisabled()

    // A partial match never enables it, and clicking it while disabled reaches nothing.
    await userEvent.type(screen.getByLabelText(/Escribe el nombre/), 'Casa de la play')
    expect(submit).toBeDisabled()
    await userEvent.click(submit)
    expect(repo.calls).not.toContain('deleteAgora')
    expect(deleted).toBe(false)

    // The match is case-sensitive: the repository itself is lenient on case, but the button is not.
    await userEvent.clear(screen.getByLabelText(/Escribe el nombre/))
    await userEvent.type(screen.getByLabelText(/Escribe el nombre/), 'casa de la playa')
    expect(submit).toBeDisabled()

    await userEvent.clear(screen.getByLabelText(/Escribe el nombre/))
    await userEvent.type(screen.getByLabelText(/Escribe el nombre/), 'Casa de la playa')
    expect(submit).toBeEnabled()

    await userEvent.click(submit)
    await waitFor(() => expect(repo.calls).toContain('deleteAgora'))
    await waitFor(() => expect(deleted).toBe(true))
  })

  it('el botón de borrar solo se habilita cuando el nombre coincide', async () => {
    const repo = new InMemoryBoardRepository()
    const { slug } = await repo.createAgora({ name: 'Piso de Gros', creatorName: 'Endika' })
    renderWithBoard(<DangerZone slug={slug} agoraName="Piso de Gros" onDeleted={() => {}} />, {
      repo,
      slug,
    })
    const submit = screen.getByRole('button', { name: 'Borrar para siempre' })
    expect(submit).toBeDisabled()

    await userEvent.type(screen.getByLabelText(/nombre/i), 'Piso de')
    expect(submit).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/nombre/i), ' Gros')
    expect(submit).toBeEnabled()
  })
})
