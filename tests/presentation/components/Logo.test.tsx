import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { render } from '@testing-library/react'
import { Logo } from '@/presentation/components/Logo'

const paths = (svg: string) => [...svg.matchAll(/d="([^"]+)"/g)].map((match) => match[1])

describe('Logo', () => {
  it('draws exactly what the icon file draws', () => {
    // Two files carry the artwork — the component for the header, the SVG for the icon set — so this is
    // the guard that keeps the tab, the launcher and the header showing one drawing.
    const { container } = render(<Logo />)
    const fromComponent = paths(container.innerHTML)
    const fromFile = paths(readFileSync('assets/icon.svg', 'utf8'))

    expect(fromComponent).toEqual(fromFile)
    expect(fromComponent.length).toBe(8)
  })

  it('is decorative: the heading beside it already says Agora', () => {
    const { container } = render(<Logo />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})
