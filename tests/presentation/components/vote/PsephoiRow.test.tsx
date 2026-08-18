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

  it('announces the count for anyone not seeing the pebbles', () => {
    render(<PsephoiRow participants={5} cast={3} revealed={null} />)
    expect(screen.getByRole('img')).toHaveAccessibleName(/3.*5/)
  })
})
