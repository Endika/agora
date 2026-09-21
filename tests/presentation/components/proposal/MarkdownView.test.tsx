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
})
