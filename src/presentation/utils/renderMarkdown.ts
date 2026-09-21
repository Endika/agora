/**
 * The only place in the app allowed to produce HTML from user input, and therefore the only place
 * with `dangerouslySetInnerHTML`. An allowlist, not a blocklist: anything not named here is gone —
 * scripts, iframes, every `on*` handler, and any URL scheme other than http(s), mailto and #.
 */
const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'del',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'h2',
  'h3',
  'h4',
  'a',
  'img',
  'hr',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
]

/**
 * The parser and the sanitiser are some 40 KB that only a proposal description needs, so they are
 * fetched on demand and then kept: the second description renders without a second download.
 */
let pending: Promise<{
  parse: (markdown: string) => string
  sanitize: (html: string, config: Record<string, unknown>) => string
}> | null = null

function markdownEngine() {
  pending ??= Promise.all([import('marked'), import('dompurify')]).then(
    ([{ marked }, { default: DOMPurify }]) => ({
      parse: (markdown: string) =>
        marked.parse(markdown, { async: false, gfm: true, breaks: true }),
      sanitize: (html: string, config: Record<string, unknown>) => DOMPurify.sanitize(html, config),
    }),
  )
  return pending
}

export async function renderMarkdownAsync(markdown: string): Promise<string> {
  const engine = await markdownEngine()
  return engine.sanitize(engine.parse(markdown), {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'title', 'src', 'alt', 'loading', 'srcset', 'width', 'height'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#)/i,
    ADD_ATTR: ['target', 'rel'],
  })
}
