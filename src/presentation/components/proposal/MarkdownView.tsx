import { useMemo } from 'react'
import { renderMarkdown } from '@/presentation/utils/renderMarkdown'

/** Sanitised at the boundary above; this component only decides how it reads. */
export function MarkdownView({ markdown }: { markdown: string }) {
  const html = useMemo(() => renderMarkdown(markdown), [markdown])
  return (
    <div
      className="grid min-w-0 gap-2 break-words [&_a]:break-all [&_a]:underline [&_h2]:text-xl [&_h3]:text-lg [&_img]:max-w-full [&_li]:ml-4 [&_li]:list-disc [&_pre]:overflow-x-auto"
      // The one sanctioned use in the app: renderMarkdown is the sanitiser.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
