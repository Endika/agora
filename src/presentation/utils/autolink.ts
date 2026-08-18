export type TextPart = { kind: 'text'; text: string } | { kind: 'link'; url: string }

const URL_PATTERN = /https?:\/\/[^\s<>"')]+/g

/**
 * Comments are plain text with links detected, not Markdown: the spec keeps the sanitiser surface small
 * and nobody needs a table in a comment.
 *
 * This returns *parts*, not HTML, so the component renders React nodes and no escaping question ever
 * arises — there is no second place in the app producing HTML from what people type.
 */
export function autolink(text: string): TextPart[] {
  const parts: TextPart[] = []
  let at = 0
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index
    if (start > at) parts.push({ kind: 'text', text: text.slice(at, start) })
    parts.push({ kind: 'link', url: match[0] })
    at = start + match[0].length
  }
  if (at < text.length) parts.push({ kind: 'text', text: text.slice(at) })
  return parts
}
