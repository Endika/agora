import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProposalForm } from '@/presentation/components/proposal/ProposalForm'
import { InMemoryProposalImages, renderWithBoard } from '../../support/renderWithBoard'

const photo = (name: string, bytes = 2048) =>
  new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' })

describe('ImagePicker', () => {
  it('compresses a picked photo before anything is uploaded', async () => {
    const images = new InMemoryProposalImages()
    let draft: { images: unknown[] } | null = null
    renderWithBoard(
      <ProposalForm others={[]} onSubmit={(d) => (draft = d)} onCancel={() => {}} />,
      { images },
    )

    await userEvent.upload(screen.getByLabelText('Añadir imagen'), photo('beach.jpg'))
    expect(await screen.findByAltText('Imagen 1 de la propuesta')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Título'), 'Trip to the coast')
    await userEvent.click(screen.getByRole('button', { name: 'Publicar la propuesta' }))

    expect(draft!.images).toHaveLength(1)
  })

  it('says so plainly when an image will not fit', async () => {
    const images = new InMemoryProposalImages()
    images.rejectWith = 'IMAGE_TOO_LARGE'
    renderWithBoard(<ProposalForm others={[]} onSubmit={() => {}} onCancel={() => {}} />, {
      images,
    })

    await userEvent.upload(screen.getByLabelText('Añadir imagen'), photo('huge.jpg'))
    expect(await screen.findByText(/no baja de 200 KB/)).toBeInTheDocument()
  })

  it('refuses a file that is not a jpg, png or webp', async () => {
    const images = new InMemoryProposalImages()
    images.rejectWith = 'IMAGE_TYPE'
    renderWithBoard(<ProposalForm others={[]} onSubmit={() => {}} onCancel={() => {}} />, {
      images,
    })

    await userEvent.upload(screen.getByLabelText('Añadir imagen'), photo('drawing.svg'))
    expect(await screen.findByText('Solo JPG, PNG o WebP.')).toBeInTheDocument()
  })

  it('lets a picked image be taken back out', async () => {
    renderWithBoard(<ProposalForm others={[]} onSubmit={() => {}} onCancel={() => {}} />)

    await userEvent.upload(screen.getByLabelText('Añadir imagen'), photo('beach.jpg'))
    await userEvent.click(await screen.findByRole('button', { name: 'Quitar la imagen 1' }))

    expect(screen.queryByAltText('Imagen 1 de la propuesta')).not.toBeInTheDocument()
  })
})
