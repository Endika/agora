import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProposalForm } from '@/presentation/components/proposal/ProposalForm'
import { makeProposal } from '../../../domain/support/makeProposal'

describe('ProposalForm', () => {
  it('publishes a proposal with its tags and estimated cost in cents', async () => {
    const onSubmit = vi.fn()
    render(<ProposalForm others={[]} onSubmit={onSubmit} onCancel={() => {}} />)

    await userEvent.type(screen.getByLabelText('Título'), 'Trip to the coast')
    await userEvent.type(screen.getByLabelText('Descripción'), '## Plan\n\n- a van')
    await userEvent.type(screen.getByLabelText('Etiquetas'), 'viaje{Enter}casa{Enter}')
    await userEvent.type(screen.getByLabelText('Coste estimado (€)'), '120,50')
    await userEvent.click(screen.getByRole('button', { name: 'Publicar la propuesta' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Trip to the coast',
        tags: ['viaje', 'casa'],
        estimatedCents: 12050,
      }),
    )
  })

  it('refuses a title under three characters without calling back', async () => {
    const onSubmit = vi.fn()
    render(<ProposalForm others={[]} onSubmit={onSubmit} onCancel={() => {}} />)

    await userEvent.type(screen.getByLabelText('Título'), 'ab')
    await userEvent.click(screen.getByRole('button', { name: 'Publicar la propuesta' }))

    expect(screen.getByRole('alert')).toHaveTextContent('al menos 3 caracteres')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('refuses a cost with three decimals', async () => {
    const onSubmit = vi.fn()
    render(<ProposalForm others={[]} onSubmit={onSubmit} onCancel={() => {}} />)

    await userEvent.type(screen.getByLabelText('Título'), 'Buy chairs')
    await userEvent.type(screen.getByLabelText('Coste estimado (€)'), '10,005')
    await userEvent.click(screen.getByRole('button', { name: 'Publicar la propuesta' }))

    expect(screen.getByRole('alert')).toHaveTextContent('dos decimales')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('previews the description as sanitised html, script and all', async () => {
    render(<ProposalForm others={[]} onSubmit={() => {}} onCancel={() => {}} />)

    await userEvent.type(screen.getByLabelText('Descripción'), '## Plan <script>alert(1)</script>')
    await userEvent.click(screen.getByRole('tab', { name: 'Vista previa' }))

    const preview = screen.getByTestId('description-preview')
    expect(preview.querySelector('h2')).not.toBeNull()
    expect(preview.querySelector('script')).toBeNull()
  })

  it('adds a tag with Enter without submitting the form', async () => {
    const onSubmit = vi.fn()
    render(<ProposalForm others={[]} onSubmit={onSubmit} onCancel={() => {}} />)

    await userEvent.type(screen.getByLabelText('Título'), 'Buy chairs')
    await userEvent.type(screen.getByLabelText('Etiquetas'), 'casa{Enter}')

    expect(screen.getByRole('button', { name: 'Quitar la etiqueta casa' })).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('offers a relation only when there is another proposal to point at', async () => {
    const { unmount } = render(<ProposalForm others={[]} onSubmit={() => {}} onCancel={() => {}} />)
    expect(screen.queryByLabelText('Relación con otra propuesta')).not.toBeInTheDocument()
    unmount()

    render(
      <ProposalForm
        others={[makeProposal({ id: 'p1', title: 'Rent a big van' })]}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    )
    expect(screen.getByRole('option', { name: 'Rent a big van' })).toBeInTheDocument()
  })
})
