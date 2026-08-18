import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  textarea: RefObject<HTMLTextAreaElement | null>
  value: string
  onChange: (value: string) => void
}

type Action =
  | { kind: 'wrap'; before: string; after: string; placeholder: string }
  | { kind: 'line'; prefix: string; placeholder: string }

const ACTIONS: { key: string; label: string; action: Action }[] = [
  {
    key: 'heading',
    label: '##',
    action: { kind: 'line', prefix: '## ', placeholder: 'headingText' },
  },
  {
    key: 'bold',
    label: 'B',
    action: { kind: 'wrap', before: '**', after: '**', placeholder: 'bold' },
  },
  {
    key: 'italic',
    label: 'I',
    action: { kind: 'wrap', before: '_', after: '_', placeholder: 'italic' },
  },
  { key: 'list', label: '•', action: { kind: 'line', prefix: '- ', placeholder: 'listItem' } },
  { key: 'quote', label: '❝', action: { kind: 'line', prefix: '> ', placeholder: 'quote' } },
  {
    key: 'link',
    label: '🔗',
    action: { kind: 'wrap', before: '[', after: '](https://)', placeholder: 'linkText' },
  },
]

/**
 * Nobody should have to know that a heading is `##`. The buttons write the syntax around whatever is
 * selected — or around a placeholder they then leave selected, so the next keystroke replaces it.
 *
 * The textarea stays the source of truth: this is an editor aid, not a rich-text editor pretending the
 * text is not Markdown.
 */
export function MarkdownToolbar({ textarea, value, onChange }: Props) {
  const { t } = useTranslation()

  const apply = (action: Action, placeholderKey: string) => {
    const field = textarea.current
    if (!field) return

    const start = field.selectionStart
    const end = field.selectionEnd
    const selected = value.slice(start, end)
    const placeholder = t(`editor.${placeholderKey}`)
    const text = selected.length > 0 ? selected : placeholder

    let next: string
    let selectionStart: number
    if (action.kind === 'wrap') {
      next = value.slice(0, start) + action.before + text + action.after + value.slice(end)
      selectionStart = start + action.before.length
    } else {
      // A line prefix belongs at the beginning of the line the cursor is on, not mid-word.
      const lineStart = value.lastIndexOf('\n', start - 1) + 1
      const padding = lineStart === start || value[start - 1] === '\n' ? '' : '\n'
      next = value.slice(0, start) + padding + action.prefix + text + value.slice(end)
      selectionStart = start + padding.length + action.prefix.length
    }

    onChange(next)
    // Leave the placeholder selected so typing replaces it straight away.
    requestAnimationFrame(() => {
      field.focus()
      field.setSelectionRange(selectionStart, selectionStart + text.length)
    })
  }

  return (
    <div className="-mx-1 flex flex-wrap gap-1" role="group" aria-label={t('editor.toolbar')}>
      {ACTIONS.map(({ key, label, action }) => (
        <button
          key={key}
          type="button"
          onClick={() => apply(action, action.placeholder)}
          aria-label={t(`editor.${key}`)}
          title={t(`editor.${key}`)}
          className="min-h-11 min-w-11 rounded-[--radius] border font-medium"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
