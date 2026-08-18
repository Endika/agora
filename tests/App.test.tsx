import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from '@/App'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'
import {
  InMemoryProposalImages,
  InMemoryVisitedAgoras,
} from './presentation/support/renderWithBoard'

describe('App', () => {
  it('opens on the create-an-agora form when there is no agora in the address', () => {
    render(
      <App
        repo={new InMemoryBoardRepository()}
        visited={new InMemoryVisitedAgoras()}
        images={new InMemoryProposalImages()}
      />,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Agora' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear el ágora' })).toBeInTheDocument()
  })

  it('lists the agoras this device has already been in', () => {
    const visited = new InMemoryVisitedAgoras()
    visited.remember('abcd1234', 'Cuadrilla')
    visited.remember('efgh5678', 'Piso')

    render(
      <App
        repo={new InMemoryBoardRepository()}
        visited={visited}
        images={new InMemoryProposalImages()}
      />,
    )

    const list = screen.getByRole('list')
    expect(list).toHaveTextContent('Piso')
    expect(list).toHaveTextContent('Cuadrilla')
  })

  it('shows the app version in the footer', () => {
    render(
      <App
        repo={new InMemoryBoardRepository()}
        visited={new InMemoryVisitedAgoras()}
        images={new InMemoryProposalImages()}
      />,
    )
    expect(screen.getByText(/Versión/)).toBeInTheDocument()
  })
})
