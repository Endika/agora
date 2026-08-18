import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DangerZone } from '@/presentation/components/identity/DangerZone'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'
import { renderWithBoard } from '../../support/renderWithBoard'

describe('DangerZone', () => {
  it('refuses to delete until the agora name is typed exactly', async () => {
    const repo = new InMemoryBoardRepository()
    const { slug } = await repo.createAgora({ name: 'Casa de la playa', creatorName: 'Endika' })
    let deleted = false
    renderWithBoard(
      <DangerZone slug={slug} agoraName="Casa de la playa" onDeleted={() => (deleted = true)} />,
      { repo, slug },
    )

    expect(screen.getByRole('button', { name: 'Borrar para siempre' })).toBeDisabled()

    await userEvent.type(screen.getByLabelText(/Escribe el nombre/), 'Casa de la play')
    await userEvent.click(screen.getByRole('button', { name: 'Borrar para siempre' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('no coincide')
    expect(deleted).toBe(false)

    await userEvent.type(screen.getByLabelText(/Escribe el nombre/), 'a')
    await userEvent.click(screen.getByRole('button', { name: 'Borrar para siempre' }))
    await waitFor(() => expect(deleted).toBe(true))
  })
})
