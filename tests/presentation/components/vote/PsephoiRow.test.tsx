import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PsephoiRow } from '@/presentation/components/vote/PsephoiRow'

describe('PsephoiRow', () => {
  it('shows one slot per participant, empty for whoever has not voted', () => {
    render(<PsephoiRow participants={4} cast={2} revealed={null} />)
    expect(screen.getAllByTestId('pebble-cast')).toHaveLength(2)
    expect(screen.getAllByTestId('pebble-empty')).toHaveLength(2)
  })

  it('carries no sentiment at all while the vote is open', () => {
    const { container } = render(<PsephoiRow participants={4} cast={4} revealed={null} />)
    expect(container.querySelectorAll('[data-vote]')).toHaveLength(0)
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('quórum')
  })

  it('reveals every pebble once the proposal resolved', () => {
    render(
      <PsephoiRow participants={4} cast={4} revealed={['up', 'abstain', 'abstain', 'abstain']} />,
    )
    const pebbles = screen.getAllByTestId('pebble-cast')
    expect(pebbles[0]).toHaveAttribute('data-vote', 'up')
    expect(pebbles[1]).toHaveAttribute('data-vote', 'abstain')
    expect(screen.queryAllByTestId('pebble-empty')).toHaveLength(0)
  })

  it('tells the three votes apart by shape as well as colour', () => {
    render(<PsephoiRow participants={3} cast={3} revealed={['up', 'down', 'abstain']} />)
    const pebbles = screen.getAllByTestId('pebble-cast')
    expect(pebbles[0]).toHaveAttribute('title', 'A favor')
    expect(pebbles[1]).toHaveAttribute('title', 'En contra')
    expect(pebbles[2]).toHaveAttribute('title', 'En blanco')
    // The abstain pebble is a ring, so it can never be mistaken for an unrevealed stone.
    expect(pebbles[2]!.className).toContain('border')
    expect(pebbles[0]!.className).not.toContain('border')
  })

  it('announces the count for anyone not seeing the pebbles', () => {
    render(<PsephoiRow participants={5} cast={3} revealed={null} />)
    expect(screen.getByRole('img')).toHaveAccessibleName(/3.*5/)
  })
})
