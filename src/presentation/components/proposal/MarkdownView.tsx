import { useEffect, useState } from 'react'
import { renderMarkdownAsync } from '@/presentation/utils/renderMarkdown'

const CLASSES =
  'grid min-w-0 gap-2 break-words [&_a]:break-all [&_a]:underline [&_h2]:text-xl [&_h3]:text-lg [&_img]:max-w-full [&_li]:ml-4 [&_li]:list-disc [&_pre]:overflow-x-auto'

/**
 * Sanitised at the boundary above; this component only decides how it reads.
 *
 * The parser arrives after first paint, so until it does the description is shown as the plain text
 * it already is — readable, and never markup. The rendered HTML is kept together with the source it
 * came from, so a new description falls back to plain text instead of showing the previous one.
 */
export function MarkdownView({ markdown }: { markdown: string }) {
  const [rendered, setRendered] = useState<{ source: string; html: string } | null>(null)

  useEffect(() => {
    let live = true
    renderMarkdownAsync(markdown)
      .then((html) => {
        if (live) setRendered({ source: markdown, html })
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [markdown])

  if (rendered?.source !== markdown)
    return <div className={`${CLASSES} whitespace-pre-wrap`}>{markdown}</div>

  return (
    <div
      className={CLASSES}
      // The one sanctioned use in the app: renderMarkdownAsync is the sanitiser.
      dangerouslySetInnerHTML={{ __html: rendered.html }}
    />
  )
}
