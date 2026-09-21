import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { App } from '@/App'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'
import { FakeOnlineDetector } from '@/infrastructure/network/OnlineDetector'
import { InMemoryActionQueue } from '@/infrastructure/sync/IdbActionQueue'
import type { VisitedAgorasStore } from '@/domain/ports/VisitedAgorasStore'
import {
  InMemoryProposalImages,
  InMemoryVisitedAgoras,
} from './presentation/support/renderWithBoard'

beforeEach(() => {
  window.location.hash = ''
  localStorage.clear()
})

const wiring = (visited: VisitedAgorasStore = new InMemoryVisitedAgoras()) => ({
  repo: new InMemoryBoardRepository(),
  visited,
  images: new InMemoryProposalImages(),
  queue: new InMemoryActionQueue(),
  network: new FakeOnlineDetector(),
  replay: () => Promise.resolve(),
})

describe('App', () => {
  it('opens on the create-an-agora form when there is no agora in the address', () => {
    render(<App {...wiring()} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Agora' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear el ágora' })).toBeInTheDocument()
  })

  it('lists the agoras this device has already been in', () => {
    const visited = new InMemoryVisitedAgoras()
    visited.remember('abcd1234', 'Cuadrilla')
    visited.remember('efgh5678', 'Piso')

    render(<App {...wiring(visited)} />)

    const list = screen.getByRole('list')
    expect(list).toHaveTextContent('Piso')
    expect(list).toHaveTextContent('Cuadrilla')
  })

  it('lets an agora be taken off this device without touching the server', async () => {
    const visited = new InMemoryVisitedAgoras()
    visited.remember('abcd1234', 'Cuadrilla')
    visited.remember('efgh5678', 'Piso')
    const { default: userEvent } = await import('@testing-library/user-event')

    render(<App {...wiring(visited)} />)
    await userEvent.click(screen.getByRole('button', { name: 'Quitar Piso de tu lista' }))

    expect(screen.getByRole('list')).not.toHaveTextContent('Piso')
    expect(screen.getByRole('list')).toHaveTextContent('Cuadrilla')
    expect(visited.list().map((entry) => entry.slug)).toEqual(['abcd1234'])
  })

  it('shows the app version and links to the privacy notice', () => {
    render(<App {...wiring()} />)
    expect(screen.getByText(/Versión/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Privacidad' })).toHaveAttribute('href', '#/privacy')
  })
})

describe('App, un enlace que entra directo', () => {
  async function agora() {
    const repo = new InMemoryBoardRepository()
    const { slug } = await repo.createAgora({ name: 'Cuadrilla', creatorName: 'alice' })
    return { repo, slug }
  }

  it('abre la hoja de redactar desde #/g/<slug>/nueva', async () => {
    const { repo, slug } = await agora()
    window.location.hash = `#/g/${slug}/nueva`

    render(<App {...wiring()} repo={repo} />)

    // Every route that names an agora has to load that agora, or a shared link lands on the
    // home screen and the address is a lie.
    expect(await screen.findByRole('dialog', { name: 'Nueva propuesta' })).toBeInTheDocument()
  })

  it('abre la propuesta desde #/g/<slug>/p/<id>', async () => {
    const { repo, slug } = await agora()
    const id = await repo.createProposal({ slug, title: 'Alquilar una furgoneta' })
    window.location.hash = `#/g/${slug}/p/${id}`

    render(<App {...wiring()} repo={repo} />)

    expect(
      await screen.findByRole('dialog', { name: 'Alquilar una furgoneta' }),
    ).toBeInTheDocument()
  })

  it('abre la hoja de editar desde #/g/<slug>/p/<id>/editar', async () => {
    const { repo, slug } = await agora()
    const id = await repo.createProposal({ slug, title: 'Alquilar una furgoneta' })
    window.location.hash = `#/g/${slug}/p/${id}/editar`

    render(<App {...wiring()} repo={repo} />)

    const sheet = await screen.findByRole('dialog', { name: 'Editar la propuesta' })
    expect(within(sheet).getByLabelText('Título')).toHaveValue('Alquilar una furgoneta')
  })
})
