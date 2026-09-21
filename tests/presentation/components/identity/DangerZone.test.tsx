import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DangerZone } from '@/presentation/components/identity/DangerZone'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'
import { renderWithBoard } from '../../support/renderWithBoard'

describe('DangerZone', () => {
  it('keeps the delete button disabled for a wrong name, but a case difference still enables it', async () => {
    const repo = new InMemoryBoardRepository()
    const { slug } = await repo.createAgora({ name: 'Casa de la playa', creatorName: 'Endika' })
    let deleted = false
    renderWithBoard(
      <DangerZone slug={slug} agoraName="Casa de la playa" onDeleted={() => (deleted = true)} />,
      { repo, slug },
    )

    const submit = screen.getByRole('button', { name: 'Borrar para siempre' })
    expect(submit).toBeDisabled()

    // A genuinely wrong name never enables it, and clicking it while disabled reaches nothing.
    await userEvent.type(screen.getByLabelText(/Escribe el nombre/), 'Casa de la play')
    expect(submit).toBeDisabled()
    await userEvent.click(submit)
    expect(repo.calls).not.toContain('deleteAgora')
    expect(deleted).toBe(false)

    // A case difference alone still enables it: it mirrors deleteAgora's own case-insensitive
    // check, and mobile keyboards auto-capitalise the first letter of a fresh field by default.
    await userEvent.clear(screen.getByLabelText(/Escribe el nombre/))
    await userEvent.type(screen.getByLabelText(/Escribe el nombre/), 'casa de la playa')
    expect(submit).toBeEnabled()

    await userEvent.click(submit)
    await waitFor(() => expect(repo.calls).toContain('deleteAgora'))
    await waitFor(() => expect(deleted).toBe(true))
  })

  it('no monta ninguna región de alerta hasta que hay un error, y la muestra cuando lo hay', async () => {
    const repo = new InMemoryBoardRepository()
    const { slug } = await repo.createAgora({ name: 'Piso Viejo', creatorName: 'Endika' })
    renderWithBoard(
      // The prop lags the real name, so the confirm text matches it but not what the repo holds.
      <DangerZone slug={slug} agoraName="Piso de Gros" onDeleted={() => {}} />,
      { repo, slug },
    )

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/Escribe el nombre/), 'Piso de Gros')
    await userEvent.click(screen.getByRole('button', { name: 'Borrar para siempre' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El nombre no coincide, así que no se ha borrado nada.',
    )
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
