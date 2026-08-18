import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from '@/presentation/components/CrashScreen'

function Explodes(): never {
  throw new Error('boom')
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows a way out instead of a blank screen', () => {
    // React logs the caught error; the test is about what the person sees, not the console.
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <Explodes />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Algo se ha roto')
    expect(screen.getByRole('button', { name: 'Vaciar y recargar' })).toBeInTheDocument()
  })

  it('stays out of the way when nothing is wrong', () => {
    render(
      <ErrorBoundary>
        <p>El tablón</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('El tablón')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
