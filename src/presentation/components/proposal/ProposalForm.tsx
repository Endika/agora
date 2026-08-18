import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Money } from '@/domain/value-objects/Money'
import type { Proposal } from '@/domain/entities/Proposal'
import { MarkdownToolbar } from './MarkdownToolbar'
import { MarkdownView } from './MarkdownView'
import { TagInput } from './TagInput'

export interface ProposalDraft {
  title: string
  description: string
  tags: string[]
  deadline: string | null
  estimatedCents: number | null
  links: { toId: string; kind: 'related' | 'supersedes' }[]
}

interface Props {
  others: Proposal[]
  /** Present when editing: the same form, filled in. */
  initial?: Proposal
  onSubmit: (draft: ProposalDraft) => void
  onCancel: () => void
}

export function ProposalForm({ others, initial, onSubmit, onCancel }: Props) {
  const { t } = useTranslation()
  const editing = initial !== undefined
  const description0 = initial?.description ?? ''
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(description0)
  const [tags, setTags] = useState<string[]>(initial?.tags ?? [])
  const [deadline, setDeadline] = useState(initial?.deadline?.slice(0, 10) ?? '')
  const [cost, setCost] = useState(
    initial?.estimatedCents != null ? String(initial.estimatedCents / 100) : '',
  )
  const descriptionField = useRef<HTMLTextAreaElement | null>(null)
  const [linkTo, setLinkTo] = useState('')
  const [linkKind, setLinkKind] = useState<'related' | 'supersedes'>('related')
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const [error, setError] = useState<string | null>(null)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (title.trim().length < 3) {
      setError(t('proposal.titleTooShort'))
      return
    }

    let estimatedCents: number | null = null
    if (cost.trim().length > 0) {
      try {
        estimatedCents = Money.fromEuros(Number(cost.replace(',', '.'))).cents
      } catch {
        setError(t('proposal.costInvalid'))
        return
      }
    }

    onSubmit({
      title: title.trim(),
      description,
      tags,
      // A date input gives a day; the deadline is the end of it, not midnight at its start.
      deadline: deadline ? new Date(`${deadline}T23:59:59`).toISOString() : null,
      estimatedCents,
      links: linkTo ? [{ toId: linkTo, kind: linkKind }] : (initial?.links ?? []),
    })
  }

  const field = { background: 'var(--surface)', borderColor: 'var(--border)' }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <h2 className="text-2xl font-semibold">
        {editing ? t('proposal.editHeading') : t('proposal.new')}
      </h2>

      <div className="grid gap-1">
        <label htmlFor="proposal-title" className="font-medium">
          {t('proposal.title')}
        </label>
        <input
          id="proposal-title"
          aria-describedby="proposal-title-hint"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
          className="min-h-11 min-w-0 rounded-[--radius] border px-3"
          style={field}
        />
        <p id="proposal-title-hint" className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {t('proposal.titleHint')} {title.length}/120
        </p>
      </div>

      <div className="grid gap-1">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="proposal-description" className="font-medium">
            {t('proposal.description')}
          </label>
          <div className="flex gap-2" role="tablist">
            {(['write', 'preview'] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={tab === option}
                onClick={() => setTab(option)}
                className="min-h-11 rounded-full border px-3 text-sm"
                style={{
                  background: tab === option ? 'var(--surface-sunken)' : 'transparent',
                  borderColor: 'var(--border)',
                }}
              >
                {t(`proposal.${option}`)}
              </button>
            ))}
          </div>
        </div>

        {tab === 'write' ? (
          <div className="grid gap-2">
            <MarkdownToolbar
              textarea={descriptionField}
              value={description}
              onChange={setDescription}
            />
            <textarea
              id="proposal-description"
              ref={descriptionField}
              aria-describedby="proposal-description-hint"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={6}
              maxLength={20000}
              className="min-w-0 rounded-[--radius] border p-3"
              style={field}
            />
          </div>
        ) : (
          <div
            className="min-w-0 rounded-[--radius] border p-3"
            style={field}
            data-testid="description-preview"
          >
            <MarkdownView markdown={description} />
          </div>
        )}
        <p id="proposal-description-hint" className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {t('proposal.descriptionHint')}
        </p>
      </div>

      <TagInput tags={tags} onChange={setTags} />

      <div className="grid gap-1">
        <label htmlFor="proposal-deadline" className="font-medium">
          {t('proposal.deadline')}
        </label>
        <input
          id="proposal-deadline"
          type="date"
          aria-describedby="proposal-deadline-hint"
          value={deadline}
          onChange={(event) => setDeadline(event.target.value)}
          className="min-h-11 min-w-0 rounded-[--radius] border px-3"
          style={field}
        />
        <p id="proposal-deadline-hint" className="text-sm" style={{ color: 'var(--warn)' }}>
          {t('proposal.deadlineHint')}
        </p>
      </div>

      <label className="grid gap-1">
        <span className="font-medium">{t('proposal.cost')}</span>
        <input
          value={cost}
          onChange={(event) => setCost(event.target.value)}
          inputMode="decimal"
          className="min-h-11 min-w-0 rounded-[--radius] border px-3"
          style={{ ...field, fontFamily: 'var(--font-data)' }}
        />
      </label>

      {others.length > 0 && (
        <div className="grid gap-1">
          <label htmlFor="proposal-link" className="font-medium">
            {t('proposal.links')}
          </label>
          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
            <select
              value={linkKind}
              onChange={(event) => setLinkKind(event.target.value as 'related' | 'supersedes')}
              aria-label={t('proposal.links')}
              className="min-h-11 min-w-0 rounded-[--radius] border px-2"
              style={field}
            >
              <option value="related">{t('proposal.linkRelated')}</option>
              <option value="supersedes">{t('proposal.linkSupersedes')}</option>
            </select>
            <select
              id="proposal-link"
              value={linkTo}
              onChange={(event) => setLinkTo(event.target.value)}
              className="min-h-11 min-w-0 rounded-[--radius] border px-2"
              style={field}
            >
              <option value="">{t('proposal.linkNone')}</option>
              {others.map((proposal) => (
                <option key={proposal.id} value={proposal.id}>
                  {proposal.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <p role="alert" style={{ color: 'var(--danger)' }}>
        {error ?? ''}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="min-h-11 rounded-[--radius] px-4 font-medium"
          style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
        >
          {editing ? t('proposal.save') : t('proposal.submit')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-[--radius] border px-4"
          style={{ borderColor: 'var(--border)' }}
        >
          {t('common.cancel')}
        </button>
      </div>
    </form>
  )
}
