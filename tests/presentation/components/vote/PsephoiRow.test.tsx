import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PsephoiRow } from '@/presentation/components/vote/PsephoiRow'

describe('PsephoiRow', () => {
  it('shows one slot per participant, empty for whoever has not voted', () => {
    render(<PsephoiRow participants={4} cast={2} revealed={null} explainSecret={false} />)
    expect(screen.getAllByTestId('pebble-cast')).toHaveLength(2)
    expect(screen.getAllByTestId('pebble-empty')).toHaveLength(2)
  })

  it('carries no sentiment at all while the vote is open', () => {
    const { container } = render(
      <PsephoiRow participants={4} cast={4} revealed={null} explainSecret={false} />,
    )
    expect(container.querySelectorAll('[data-vote]')).toHaveLength(0)
  })

  it('dice en pantalla que el voto es secreto cuando el llamador lo pide, sin duplicarlo por voz', () => {
    render(<PsephoiRow participants={5} cast={2} revealed={null} explainSecret />)
    expect(screen.getByText('Los votos se ven al alcanzar el quórum')).toBeInTheDocument()
    expect(screen.getByRole('img').getAttribute('aria-label')).not.toContain('quórum')
  })

  it('no lo dice si el llamador no lo pide, aunque el voto siga siendo secreto', () => {
    render(<PsephoiRow participants={5} cast={2} revealed={null} explainSecret={false} />)
    expect(screen.queryByText('Los votos se ven al alcanzar el quórum')).toBeNull()
  })

  it('deja de decirlo una vez revelados, y no lo dice dos veces por voz', () => {
    render(<PsephoiRow participants={2} cast={2} revealed={['up', 'down']} explainSecret />)
    expect(screen.queryByText('Los votos se ven al alcanzar el quórum')).toBeNull()
    expect(screen.getByRole('img').getAttribute('aria-label')).not.toContain('quórum')
  })

  it('reveals every pebble once the proposal resolved', () => {
    render(
      <PsephoiRow
        participants={4}
        cast={4}
        revealed={['up', 'abstain', 'abstain', 'abstain']}
        explainSecret={false}
      />,
    )
    const pebbles = screen.getAllByTestId('pebble-cast')
    expect(pebbles[0]).toHaveAttribute('data-vote', 'up')
    expect(pebbles[1]).toHaveAttribute('data-vote', 'abstain')
    expect(screen.queryAllByTestId('pebble-empty')).toHaveLength(0)
  })

  it('tells the three votes apart by shape as well as colour', () => {
    render(
      <PsephoiRow
        participants={3}
        cast={3}
        revealed={['up', 'down', 'abstain']}
        explainSecret={false}
      />,
    )
    const pebbles = screen.getAllByTestId('pebble-cast')
    expect(pebbles[0]).toHaveAttribute('title', 'A favor')
    expect(pebbles[1]).toHaveAttribute('title', 'En contra')
    expect(pebbles[2]).toHaveAttribute('title', 'En blanco')
    // The abstain pebble is a ring, so it can never be mistaken for an unrevealed stone.
    expect(pebbles[2]!.className).toContain('border')
    expect(pebbles[0]!.className).not.toContain('border')
  })

  it('marca tu piedra sin decir por dónde fue', () => {
    render(<PsephoiRow participants={5} cast={3} revealed={null} explainSecret={false} mine />)

    const own = screen.getByTestId('pebble-mine')
    // Presence, never direction: the ring says "yours is in" and nothing else. If this ever
    // carries a vote, the secret ballot is over.
    expect(own).not.toHaveAttribute('data-vote')
    expect(own).not.toHaveAttribute('title')
    expect(own.style.outline).toContain('var(--ink)')
    // And it is stone, exactly like every other pebble in the row.
    const others = screen.getAllByTestId('pebble-cast')
    expect(others).toHaveLength(2)
    for (const other of others) expect(other.style.background).toBe(own.style.background)
    expect(own.style.background).toBe('var(--pebble)')
  })

  it('no marca nada si todavía no has votado', () => {
    render(<PsephoiRow participants={5} cast={3} revealed={null} explainSecret={false} />)
    expect(screen.queryByTestId('pebble-mine')).toBeNull()
    expect(screen.getAllByTestId('pebble-cast')).toHaveLength(3)
  })

  it('deja de señalar tu piedra en cuanto se revelan los votos', () => {
    render(
      <PsephoiRow participants={2} cast={2} revealed={['up', 'down']} explainSecret={false} mine />,
    )
    // With every pebble coloured, pointing at one of them and calling it yours would hand over
    // the answer to anyone looking at the screen.
    expect(screen.queryByTestId('pebble-mine')).toBeNull()
    for (const pebble of screen.getAllByTestId('pebble-cast')) {
      expect(pebble.style.outline).toBe('')
    }
  })

  it('dice también por voz que tu voto ya está dentro, sin decir cuál', () => {
    render(<PsephoiRow participants={5} cast={3} revealed={null} explainSecret={false} mine />)
    const label = screen.getByRole('img').getAttribute('aria-label') ?? ''
    expect(label).toContain('tu voto incluido')
    for (const word of ['favor', 'contra', 'blanco']) expect(label).not.toContain(word)
  })

  it('tu piedra aterriza, y la fila revelada entra escalonada', () => {
    const { unmount } = render(
      <PsephoiRow participants={3} cast={1} revealed={null} explainSecret={false} mine />,
    )
    const own = screen.getByTestId('pebble-mine')
    expect(own).toHaveAttribute('data-motion', 'pebble-land')
    expect(own.style.animation).toContain('pebble-land')
    unmount()

    render(
      <PsephoiRow
        participants={3}
        cast={3}
        revealed={['up', 'down', 'abstain']}
        explainSecret={false}
      />,
    )
    const pebbles = screen.getAllByTestId('pebble-cast')
    for (const pebble of pebbles) {
      expect(pebble).toHaveAttribute('data-motion', 'row-reveal')
      expect(pebble.style.animation).toContain('row-reveal')
    }
    // Staggered, so the row reads as one thing arriving rather than three separate blinks.
    expect(pebbles[0]!.style.animationDelay).toBe('0ms')
    expect(pebbles[2]!.style.animationDelay).toBe('80ms')
  })

  it('las piedras se remontan al revelarse, para que la animación llegue a correr', () => {
    const { rerender } = render(
      <PsephoiRow participants={2} cast={2} revealed={null} explainSecret={false} />,
    )
    const before = screen.getAllByTestId('pebble-cast')[0]!
    rerender(<PsephoiRow participants={2} cast={2} revealed={['up', 'up']} explainSecret={false} />)
    // A CSS animation on a node that never left the DOM never plays. Same position, new node.
    expect(screen.getAllByTestId('pebble-cast')[0]).not.toBe(before)
  })

  it('announces the count for anyone not seeing the pebbles', () => {
    render(<PsephoiRow participants={5} cast={3} revealed={null} explainSecret={false} />)
    expect(screen.getByRole('img')).toHaveAccessibleName(/3.*5/)
  })
})
