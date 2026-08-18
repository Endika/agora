import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const MAX_TAGS = 12

export function TagInput({
  tags,
  onChange,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')

  const add = () => {
    const tag = draft.trim().toLowerCase().slice(0, 24)
    setDraft('')
    if (!tag || tags.includes(tag) || tags.length >= MAX_TAGS) return
    onChange([...tags, tag])
  }

  return (
    <div className="grid gap-1">
      <label htmlFor="proposal-tags" className="font-medium">
        {t('proposal.tags')}
      </label>
      <input
        id="proposal-tags"
        aria-describedby="proposal-tags-hint"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          // Enter adds a tag; it must not submit the whole proposal by accident.
          event.preventDefault()
          add()
        }}
        className="min-h-11 min-w-0 rounded-[--radius] border px-3"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      />
      <p id="proposal-tags-hint" className="text-sm" style={{ color: 'var(--ink-muted)' }}>
        {t('proposal.tagsHint')}
      </p>
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                onClick={() => onChange(tags.filter((other) => other !== tag))}
                aria-label={t('proposal.tagRemove', { tag })}
                className="min-h-11 rounded-full border px-3"
                style={{ borderColor: 'var(--border)' }}
              >
                #{tag} ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
