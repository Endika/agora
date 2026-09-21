import { describe, it, expect, onTestFinished, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
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

  it('tu piedra aterriza cuando llega, y la fila revelada entra escalonada', () => {
    const { rerender, unmount } = render(
      <PsephoiRow participants={3} cast={0} revealed={null} explainSecret={false} />,
    )
    rerender(<PsephoiRow participants={3} cast={1} revealed={null} explainSecret={false} mine />)

    const own = screen.getByTestId('pebble-mine')
    expect(own).toHaveAttribute('data-motion', 'pebble-land')
    // Pinned: 180 ms is a landing, 4 s is a distraction nobody asked for.
    expect(own.style.animation).toBe('pebble-land 180ms ease-out both')
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

  it('tu piedra es siempre la primera, y no se mueve cuando votan las demás personas', () => {
    const { rerender } = render(
      <PsephoiRow participants={5} cast={1} revealed={null} explainSecret={false} mine />,
    )
    const row = screen.getByRole('img')
    const position = () =>
      [...row.children].findIndex((el) => el.matches('[data-testid="pebble-mine"]'))
    expect(position()).toBe(0)

    // Three more people vote. The ring stays where it is: there is no person-to-pebble mapping,
    // and a marker that migrates while you watch invents one.
    for (const cast of [2, 3, 4]) {
      rerender(
        <PsephoiRow participants={5} cast={cast} revealed={null} explainSecret={false} mine />,
      )
      expect(position()).toBe(0)
    }
  })

  it('la ceremonia es de tu voto: no se repite porque vote otra persona', () => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })

    const { rerender } = render(
      <PsephoiRow participants={5} cast={0} revealed={null} explainSecret={false} />,
    )
    rerender(<PsephoiRow participants={5} cast={1} revealed={null} explainSecret={false} mine />)
    expect(screen.getByTestId('pebble-mine')).toHaveAttribute('data-motion', 'pebble-land')

    const settled = screen.getByTestId('pebble-mine')
    act(() => vi.advanceTimersByTime(500))
    expect(settled).not.toHaveAttribute('data-motion')

    // Somebody else votes. Nothing of yours happened, so nothing of yours animates.
    rerender(<PsephoiRow participants={5} cast={2} revealed={null} explainSecret={false} mine />)
    rerender(<PsephoiRow participants={5} cast={3} revealed={null} explainSecret={false} mine />)
    const own = screen.getByTestId('pebble-mine')
    // The very same node, too: a remount would restart the animation on its own.
    expect(own).toBe(settled)
    expect(own).not.toHaveAttribute('data-motion')
    expect(own.style.animation).toBe('')
    // The ring itself stays on, of course. It is the movement that is over, not the fact.
    expect(own.style.outline).toContain('var(--ink)')
  })

  it('un voto que ya estaba puesto no vuelve a aterrizar al abrir el tablón', () => {
    render(<PsephoiRow participants={5} cast={3} revealed={null} explainSecret={false} mine />)
    const own = screen.getByTestId('pebble-mine')
    expect(own).not.toHaveAttribute('data-motion')
    expect(own.style.animation).toBe('')
    expect(own.style.outline).toContain('var(--ink)')
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
