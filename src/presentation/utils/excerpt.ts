/**
 * A plain-text taste of a Markdown description, for the list.
 *
 * Not a Markdown renderer and not a sanitiser: it strips the syntax people would otherwise read as noise
 * (`##`, `**`, link brackets, images) and returns text, so the preview can never produce markup.
 */
export function excerpt(markdown: string, max = 140): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*+]\s+/gm, '· ')
    .replace(/[*_`]/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (text.length <= max) return text
  // Cut on a word, not mid-syllable.
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()}…`
}
