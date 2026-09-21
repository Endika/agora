import { describe, it, expect } from 'vitest'
import { renderMarkdownAsync } from '@/presentation/utils/renderMarkdown'

describe('renderMarkdownAsync', () => {
  it('strips a script tag (criterion 7)', async () => {
    const html = await renderMarkdownAsync('<script>alert(1)</script>\n\nStill readable.')
    expect(html).not.toContain('<script')
    expect(html).toContain('Still readable.')
  })

  it('never lets a javascript: url reach an href (criterion 7)', async () => {
    const html = await renderMarkdownAsync(
      '[x](javascript:alert(1)) and ![i](https://example.org/i.png)',
    )
    // The scheme may survive as inert text; what must never happen is it being linkable.
    expect(html).not.toMatch(/href\s*=\s*["']?javascript:/i)
    expect(html).toContain('<img')
  })

  it('drops event handlers, iframes and object embeds', async () => {
    const html = await renderMarkdownAsync(
      '<img src=x onerror=alert(1)><iframe src=//e></iframe><object></object>',
    )
    expect(html).not.toMatch(/onerror|iframe|object/i)
  })

  it('keeps the formatting people actually use', async () => {
    const html = await renderMarkdownAsync(
      '## Plan\n\n- one\n- two\n\n**bold** and [a link](https://example.org)',
    )
    expect(html).toContain('<h2')
    expect(html).toContain('<li>')
    expect(html).toContain('<strong>')
    expect(html).toContain('href="https://example.org"')
  })

  it('refuses a data: url, which is the usual way around a scheme allowlist', async () => {
    const html = await renderMarkdownAsync(
      '[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
    )
    expect(html).not.toContain('data:text/html')
  })

  it('escapes html that is not on the allowlist rather than dropping the text', async () => {
    expect(await renderMarkdownAsync('a <b>bold</b> word')).toContain('word')
  })
})
