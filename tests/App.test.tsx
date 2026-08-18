import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { App } from '@/App'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'
import { render } from '@testing-library/react'

describe('App', () => {
  it('opens on the create-an-agora form when there is no agora in the address', () => {
    render(<App repo={new InMemoryBoardRepository()} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Agora' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear el ágora' })).toBeInTheDocument()
  })
})
