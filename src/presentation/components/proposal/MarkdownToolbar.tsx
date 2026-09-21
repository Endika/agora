import type { ComponentType, RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { BoldIcon, HeadingIcon, ItalicIcon, LinkIcon, ListIcon, QuoteIcon } from './ToolbarIcons'

interface Props {
  textarea: RefObject<HTMLTextAreaElement | null>
  value: string
  onChange: (value: string) => void
}

type Action =
  | { kind: 'wrap'; before: string; after: string; placeholder: string }
  | { kind: 'line'; prefix: string; placeholder: string }

const ACTIONS: { key: string; Icon: ComponentType; action: Action }[] = [
  {
    key: 'heading',
    Icon: HeadingIcon,
    action: { kind: 'line', prefix: '## ', placeholder: 'headingText' },
  },
  {
    key: 'bold',
    Icon: BoldIcon,
    action: { kind: 'wrap', before: '**', after: '**', placeholder: 'bold' },
  },
  {
    key: 'italic',
    Icon: ItalicIcon,
    action: { kind: 'wrap', before: '_', after: '_', placeholder: 'italic' },
  },
  { key: 'list', Icon: ListIcon, action: { kind: 'line', prefix: '- ', placeholder: 'listItem' } },
  { key: 'quote', Icon: QuoteIcon, action: { kind: 'line', prefix: '> ', placeholder: 'quote' } },
  {
    key: 'link',
    Icon: LinkIcon,
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
      {ACTIONS.map(({ key, Icon, action }) => (
        <button
          key={key}
          type="button"
          onClick={() => apply(action, action.placeholder)}
          aria-label={t(`editor.${key}`)}
          title={t(`editor.${key}`)}
          className="grid min-h-11 min-w-11 place-items-center rounded-[--radius] border font-medium"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <Icon />
        </button>
      ))}
    </div>
  )
}
