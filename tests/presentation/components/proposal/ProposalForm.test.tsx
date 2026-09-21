import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProposalForm } from '@/presentation/components/proposal/ProposalForm'
import { makeProposal } from '../../../domain/support/makeProposal'
import { readDraft, writeDraft } from '@/presentation/drafts'
import { renderWithBoard } from '../../support/renderWithBoard'

// The form keeps a draft per key; a fresh key and a clean store keep these tests independent.
const KEY = 'agora:draft:proposalform'
beforeEach(() => localStorage.clear())

describe('ProposalForm', () => {
  it('publishes a proposal with its tags and estimated cost in cents', async () => {
    const onSubmit = vi.fn()
    renderWithBoard(
      <ProposalForm others={[]} draftKey={KEY} onSubmit={onSubmit} onCancel={() => {}} />,
    )

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
    renderWithBoard(
      <ProposalForm others={[]} draftKey={KEY} onSubmit={onSubmit} onCancel={() => {}} />,
    )

    await userEvent.type(screen.getByLabelText('Título'), 'ab')
    await userEvent.click(screen.getByRole('button', { name: 'Publicar la propuesta' }))

    expect(await screen.findByText('El título necesita al menos 3 caracteres.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('refuses a cost with three decimals', async () => {
    const onSubmit = vi.fn()
    renderWithBoard(
      <ProposalForm others={[]} draftKey={KEY} onSubmit={onSubmit} onCancel={() => {}} />,
    )

    await userEvent.type(screen.getByLabelText('Título'), 'Buy chairs')
    await userEvent.type(screen.getByLabelText('Coste estimado (€)'), '10,005')
    await userEvent.click(screen.getByRole('button', { name: 'Publicar la propuesta' }))

    expect(
      await screen.findByText('El coste va en euros, con dos decimales como mucho.'),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('previews the description as sanitised html, script and all', async () => {
    renderWithBoard(
      <ProposalForm others={[]} draftKey={KEY} onSubmit={() => {}} onCancel={() => {}} />,
    )

    await userEvent.type(screen.getByLabelText('Descripción'), '## Plan <script>alert(1)</script>')
    await userEvent.click(screen.getByRole('tab', { name: 'Vista previa' }))

    const preview = screen.getByTestId('description-preview')
    expect(preview.querySelector('h2')).not.toBeNull()
    expect(preview.querySelector('script')).toBeNull()
  })

  it('adds a tag with Enter without submitting the form', async () => {
    const onSubmit = vi.fn()
    renderWithBoard(
      <ProposalForm others={[]} draftKey={KEY} onSubmit={onSubmit} onCancel={() => {}} />,
    )

    await userEvent.type(screen.getByLabelText('Título'), 'Buy chairs')
    await userEvent.type(screen.getByLabelText('Etiquetas'), 'casa{Enter}')

    expect(screen.getByRole('button', { name: 'Quitar la etiqueta casa' })).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('offers a relation only when there is another proposal to point at', async () => {
    const { unmount } = renderWithBoard(
      <ProposalForm others={[]} draftKey={KEY} onSubmit={() => {}} onCancel={() => {}} />,
    )
    expect(screen.queryByLabelText('Relación con otra propuesta')).not.toBeInTheDocument()
    unmount()

    renderWithBoard(
      <ProposalForm
        others={[makeProposal({ id: 'p1', title: 'Rent a big van' })]}
        draftKey={KEY}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    )
    expect(screen.getByRole('option', { name: 'Rent a big van' })).toBeInTheDocument()
  })
})

describe('ProposalForm, el borrador', () => {
  it('guarda lo escrito según se escribe, sin esperar a publicar', async () => {
    renderWithBoard(
      <ProposalForm others={[]} draftKey={KEY} onSubmit={() => {}} onCancel={() => {}} />,
    )

    await userEvent.type(screen.getByLabelText('Título'), 'Un sofá nuevo')

    expect(readDraft(KEY)?.title).toBe('Un sofá nuevo')
  })

  it('avisa de lo que ha recuperado y no finge conservar las imágenes', () => {
    writeDraft(KEY, {
      title: 'Un sofá nuevo',
      description: 'El de ahora está hundido',
      tags: ['casa'],
      deadline: '',
      cost: '749',
    })

    renderWithBoard(
      <ProposalForm others={[]} draftKey={KEY} onSubmit={() => {}} onCancel={() => {}} />,
    )

    expect(screen.getByLabelText('Título')).toHaveValue('Un sofá nuevo')
    expect(screen.getByLabelText('Descripción')).toHaveValue('El de ahora está hundido')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Hemos recuperado lo que estabas escribiendo',
    )
    // The Blobs and the object URL never survived the store, so the form must not claim otherwise.
    expect(screen.queryByAltText('Imagen 1 de la propuesta')).not.toBeInTheDocument()
  })

  it('publicar deja el borrador borrado, no colgando para la siguiente propuesta', async () => {
    renderWithBoard(
      <ProposalForm others={[]} draftKey={KEY} onSubmit={() => {}} onCancel={() => {}} />,
    )

    await userEvent.type(screen.getByLabelText('Título'), 'Un sofá nuevo')
    await userEvent.click(screen.getByRole('button', { name: 'Publicar la propuesta' }))

    expect(readDraft(KEY)).toBeNull()
  })

  it('seguir escribiendo desarma la confirmación de descartar', async () => {
    renderWithBoard(
      <ProposalForm others={[]} draftKey={KEY} onSubmit={() => {}} onCancel={() => {}} />,
    )

    await userEvent.type(screen.getByLabelText('Título'), 'Un sofá nuevo')
    await userEvent.click(screen.getByRole('button', { name: 'Descartar el borrador' }))
    await userEvent.type(screen.getByLabelText('Título'), ' y grande')

    expect(screen.queryByRole('button', { name: 'Descartar de verdad' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descartar el borrador' })).toBeInTheDocument()
  })

  it('no guarda un borrador de una propuesta que se abre para editar y no se toca', () => {
    renderWithBoard(
      <ProposalForm
        others={[]}
        draftKey={KEY}
        initial={makeProposal({ id: 'p1', title: 'Rent a van' })}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    )

    expect(readDraft(KEY)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Descartar el borrador' })).not.toBeInTheDocument()
  })
})

describe('ProposalForm, editing', () => {
  it('opens filled in and saves the changes', async () => {
    const onSubmit = vi.fn()
    const existing = makeProposal({
      id: 'p1',
      title: 'Rent a van',
      description: 'The big one',
      tags: ['viaje'],
      estimatedCents: 12050,
    })

    renderWithBoard(
      <ProposalForm
        others={[]}
        draftKey={KEY}
        initial={existing}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    )

    expect(screen.getByLabelText('Título')).toHaveValue('Rent a van')
    expect(screen.getByLabelText('Descripción')).toHaveValue('The big one')
    expect(screen.getByLabelText('Coste estimado (€)')).toHaveValue('120.5')
    expect(screen.getByRole('button', { name: 'Quitar la etiqueta viaje' })).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Título'))
    await userEvent.type(screen.getByLabelText('Título'), 'Rent two vans')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar los cambios' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: 'Rent two vans' }))
  })
})

describe('MarkdownToolbar', () => {
  it('writes the syntax so nobody has to know it', async () => {
    renderWithBoard(
      <ProposalForm others={[]} draftKey={KEY} onSubmit={() => {}} onCancel={() => {}} />,
    )
    const description = screen.getByLabelText('Descripción')

    await userEvent.click(screen.getByRole('button', { name: 'Encabezado' }))
    expect(description).toHaveValue('## Un encabezado')
  })

  it('wraps whatever is selected instead of inserting a placeholder', async () => {
    renderWithBoard(
      <ProposalForm others={[]} draftKey={KEY} onSubmit={() => {}} onCancel={() => {}} />,
    )
    const description = screen.getByLabelText('Descripción') as HTMLTextAreaElement

    await userEvent.type(description, 'una furgoneta grande')
    description.setSelectionRange(4, 13)
    await userEvent.click(screen.getByRole('button', { name: 'Negrita' }))

    expect(description).toHaveValue('una **furgoneta** grande')
  })

  it('offers a link button, so [](url) is never something to memorise', async () => {
    renderWithBoard(
      <ProposalForm others={[]} draftKey={KEY} onSubmit={() => {}} onCancel={() => {}} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Enlace' }))
    expect(screen.getByLabelText('Descripción')).toHaveValue('[texto del enlace](https://)')
  })
})
