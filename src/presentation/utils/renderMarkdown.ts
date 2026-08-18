import DOMPurify from 'dompurify'
import { marked } from 'marked'

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

export function renderMarkdown(markdown: string): string {
  const html = marked.parse(markdown, { async: false, gfm: true, breaks: true })
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'title', 'src', 'alt', 'loading', 'srcset', 'width', 'height'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#)/i,
    ADD_ATTR: ['target', 'rel'],
  })
}
