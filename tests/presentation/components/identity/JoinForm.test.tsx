import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JoinForm } from '@/presentation/components/identity/JoinForm'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'
import { renderWithBoard } from '../../support/renderWithBoard'

describe('JoinForm', () => {
  it('creates an agora with a name and a pin', async () => {
    const repo = new InMemoryBoardRepository()
    let joined: string | null = null
    renderWithBoard(<JoinForm slug={null} onDone={(slug) => (joined = slug)} />, { repo })

    await userEvent.type(screen.getByLabelText('Nombre del ágora'), 'Cuadrilla')
    await userEvent.type(screen.getByLabelText('Tu nombre'), 'Endika')
    await userEvent.type(screen.getByLabelText('PIN'), '1234')
    await userEvent.click(screen.getByRole('button', { name: 'Crear el ágora' }))

    await waitFor(() => expect(joined).not.toBeNull())
    expect(repo.calls).toContain('createAgora')
  })

  it('refuses a three-digit pin without asking the server', async () => {
    const repo = new InMemoryBoardRepository()
    renderWithBoard(<JoinForm slug={null} onDone={() => {}} />, { repo })

    await userEvent.type(screen.getByLabelText('Tu nombre'), 'Endika')
    await userEvent.type(screen.getByLabelText('PIN'), '123')
    await userEvent.click(screen.getByRole('button', { name: 'Crear el ágora' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/4 a 6 dígitos/)
    expect(repo.calls).toHaveLength(0)
  })

  it('asks for a name before anything else', async () => {
    const repo = new InMemoryBoardRepository()
    renderWithBoard(<JoinForm slug={null} onDone={() => {}} />, { repo })
    await userEvent.type(screen.getByLabelText('PIN'), '1234')
    await userEvent.click(screen.getByRole('button', { name: 'Crear el ágora' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Escribe tu nombre.')
    expect(repo.calls).toHaveLength(0)
  })

  it('points a taken name at pin recovery instead of a raw error', async () => {
    const repo = new InMemoryBoardRepository()
    const { slug } = await repo.createAgora({
      name: 'Cuadrilla',
      creatorName: 'Endika',
      pin: '1234',
    })
    renderWithBoard(<JoinForm slug={slug} onDone={() => {}} />, { repo, slug })

    await userEvent.type(screen.getByLabelText('Tu nombre'), 'Endika')
    await userEvent.type(screen.getByLabelText('PIN'), '1234')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Recupéralo con tu PIN/)
  })

  it('only offers pin recovery when joining an existing agora', () => {
    renderWithBoard(<JoinForm slug={null} onDone={() => {}} onRecover={() => {}} />)
    expect(screen.queryByRole('button', { name: /cambio de móvil/ })).not.toBeInTheDocument()
  })
})
