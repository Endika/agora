import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { renderMarkdownAsync } from '@/presentation/utils/renderMarkdown'

const CLASSES =
  'grid min-w-0 gap-2 break-words [&_a]:break-all [&_a]:underline [&_h2]:text-xl [&_h3]:text-lg [&_img]:max-w-full [&_li]:ml-4 [&_li]:list-disc [&_pre]:overflow-x-auto'

/**
 * Sanitised at the boundary above; this component only decides how it reads.
 *
 * The parser arrives after first paint, so until anything has been rendered the description is shown
 * as the plain text it already is — readable, and never markup. Once some HTML exists it stays on
 * screen while the next one is produced: the live preview re-renders on every keystroke, and
 * dropping back to raw text between them would flicker once per character.
 */
export function MarkdownView({ markdown }: { markdown: string }) {
  const { t } = useTranslation()
  const [html, setHtml] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    renderMarkdownAsync(markdown)
      .then((rendered) => {
        if (!live) return
        setHtml(rendered)
        setFailed(false)
      })
      .catch((cause: unknown) => {
        // The text is still perfectly readable unformatted, so this degrades rather than crashes —
        // but it says so, instead of leaving someone wondering why their headings went missing.
        console.error('Agora could not load the Markdown renderer:', cause)
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [markdown])

  if (html === null)
    return (
      <div className="grid min-w-0 gap-1">
        <div className={`${CLASSES} whitespace-pre-wrap`}>{markdown}</div>
        {failed && (
          <p role="status" className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            {t('editor.plainFallback')}
          </p>
        )}
      </div>
    )

  return (
    <div
      className={CLASSES}
      // The one sanctioned use in the app: renderMarkdownAsync is the sanitiser.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
