import { useTranslation } from 'react-i18next'

export type Filter = { kind: 'all' } | { kind: 'pending-mine' } | { kind: 'tag'; tag: string }

/**
 * A horizontally scrollable strip: the *strip* scrolls, never the page. That is the difference
 * between a filter row and a horizontal-overflow bug at 320 px.
 */
export function BoardFilters({
  tags,
  pendingMine,
  filter,
  onChange,
}: {
  tags: string[]
  pendingMine: number
  filter: Filter
  onChange: (filter: Filter) => void
}) {
  const { t } = useTranslation()

  const chip = (active: boolean) => ({
    background: active ? 'var(--brand)' : 'var(--surface)',
    color: active ? 'var(--brand-ink)' : 'var(--ink)',
    borderColor: active ? 'var(--brand)' : 'var(--border)',
  })

  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <div className="flex min-w-max gap-2" role="group" aria-label={t('board.filterAll')}>
        <button
          type="button"
          onClick={() => onChange({ kind: 'all' })}
          aria-pressed={filter.kind === 'all'}
          className="min-h-11 whitespace-nowrap rounded-full border px-4"
          style={chip(filter.kind === 'all')}
        >
          {t('board.filterAll')}
        </button>

        <button
          type="button"
          onClick={() => onChange({ kind: 'pending-mine' })}
          aria-pressed={filter.kind === 'pending-mine'}
          className="min-h-11 whitespace-nowrap rounded-full border px-4"
          style={chip(filter.kind === 'pending-mine')}
        >
          {t('board.filterPendingMine')}
          {pendingMine > 0 && (
            <span data-testid="pending-mine-badge" style={{ fontFamily: 'var(--font-data)' }}>
              {' '}
              {pendingMine}
            </span>
          )}
        </button>

        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onChange({ kind: 'tag', tag })}
            aria-pressed={filter.kind === 'tag' && filter.tag === tag}
            className="min-h-11 whitespace-nowrap rounded-full border px-4"
            style={chip(filter.kind === 'tag' && filter.tag === tag)}
          >
            #{tag}
          </button>
        ))}
      </div>
    </div>
  )
}
