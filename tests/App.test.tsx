import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from '@/App'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'
import { FakeOnlineDetector } from '@/infrastructure/network/OnlineDetector'
import { InMemoryActionQueue } from '@/infrastructure/sync/IdbActionQueue'
import type { VisitedAgorasStore } from '@/domain/ports/VisitedAgorasStore'
import {
  InMemoryProposalImages,
  InMemoryVisitedAgoras,
} from './presentation/support/renderWithBoard'

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

  it('shows the app version in the footer', () => {
    render(<App {...wiring()} />)
    expect(screen.getByText(/Versión/)).toBeInTheDocument()
  })
})
