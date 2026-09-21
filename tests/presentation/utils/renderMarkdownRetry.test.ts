import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(() => {
  vi.doUnmock('marked')
  vi.resetModules()
})

describe('renderMarkdownAsync, when the download fails', () => {
  it('retries instead of losing formatting for the rest of the session', async () => {
    vi.resetModules()
    let attempts = 0
    vi.doMock('marked', async (importOriginal) => {
      attempts += 1
      if (attempts === 1) throw new Error('chunk fetch failed')
      return await importOriginal<typeof import('marked')>()
    })

    const { renderMarkdownAsync } = await import('@/presentation/utils/renderMarkdown')

    await expect(renderMarkdownAsync('## uno')).rejects.toThrow()
    // A latched rejected promise would fail here too, and formatting would be gone until reload.
    await expect(renderMarkdownAsync('## uno')).resolves.toContain('<h2')
    expect(attempts).toBe(2)
  })
})
