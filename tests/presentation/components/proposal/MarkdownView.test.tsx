import { describe, it, expect } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MarkdownView } from '@/presentation/components/proposal/MarkdownView'

describe('MarkdownView', () => {
  it('reads as plain text until the parser arrives, then as html', async () => {
    const { container } = render(<MarkdownView markdown={'## Plan\n\n**hoy**'} />)

    // The parser and the sanitiser are fetched on demand, so nothing is markup yet.
    expect(container.querySelector('h2')).toBeNull()
    expect(container.textContent).toContain('## Plan')

    await waitFor(() => expect(container.querySelector('h2')).not.toBeNull())
    expect(container.querySelector('h2')?.textContent).toBe('Plan')
    expect(container.querySelector('strong')?.textContent).toBe('hoy')
    expect(container.textContent).not.toContain('## Plan')
  })

  it('keeps the last html on screen while the next one is produced', async () => {
    const { container, rerender } = render(<MarkdownView markdown="## Uno" />)
    await waitFor(() => expect(container.querySelector('h2')?.textContent).toBe('Uno'))

    // The live preview re-renders on every keystroke. Falling back to raw text between them would
    // flicker once per character, so the previous html stays until the next one is ready.
    rerender(<MarkdownView markdown="## Dos" />)
    expect(container.querySelector('h2')).not.toBeNull()
    expect(container.textContent).not.toContain('## Dos')

    await waitFor(() => expect(container.querySelector('h2')?.textContent).toBe('Dos'))
  })
})
