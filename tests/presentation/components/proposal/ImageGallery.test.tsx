import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { ImageGallery } from '@/presentation/components/proposal/ImageGallery'
import { renderWithBoard } from '../../support/renderWithBoard'

describe('ImageGallery', () => {
  it('shows the thumbnail and links to the full image', () => {
    renderWithBoard(
      <ImageGallery
        images={[
          {
            id: 'i1',
            path: 'slug/p1/i1.webp',
            thumbPath: 'slug/p1/i1-t.webp',
            width: 1600,
            height: 1200,
            position: 0,
          },
        ]}
      />,
    )

    const image = screen.getByAltText('Imagen 1 de la propuesta')
    // The list must never download the full-size object: that is the egress budget.
    expect(image).toHaveAttribute('src', 'https://images.test/slug/p1/i1-t.webp')
    expect(image).toHaveAttribute('loading', 'lazy')
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://images.test/slug/p1/i1.webp')
  })

  it('renders nothing when a proposal has no images', () => {
    const { container } = renderWithBoard(<ImageGallery images={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
