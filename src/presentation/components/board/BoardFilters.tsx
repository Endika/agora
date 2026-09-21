import { useTranslation } from 'react-i18next'

export type Filter = { kind: 'all' } | { kind: 'pending-mine' } | { kind: 'tag'; tag: string }

/**
 * A horizontally scrollable strip: the *strip* scrolls, never the page. That is the difference
 * between a filter row and a horizontal-overflow bug at 320 px. Once there is room — `sm` and up —
 * the chips wrap onto a second line instead, because a scrollbar you never need is a filter you
 * cannot see.
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

  // --brand-strong, not --brand: this fill carries text, and --brand under --brand-ink is 3.08:1.
  const chip = (active: boolean) => ({
    background: active ? 'var(--brand-strong)' : 'var(--surface)',
    color: active ? 'var(--brand-ink)' : 'var(--ink)',
    borderColor: active ? 'var(--brand-strong)' : 'var(--border)',
  })

  return (
    /* min-w-0 is the fix: without it this grid item refuses to shrink below its content and the *page*
       scrolls sideways instead of the strip. */
    <div className="-mx-4 min-w-0 overflow-x-auto px-4">
      <div
        className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap"
        role="group"
        aria-label={t('board.filterHeading')}
      >
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
          aria-label={
            pendingMine > 0 ? t('board.countPendingMine', { count: pendingMine }) : undefined
          }
          className="min-h-11 whitespace-nowrap rounded-full border px-4"
          style={chip(filter.kind === 'pending-mine')}
        >
          {t('board.filterPendingMine')}
          {pendingMine > 0 && (
            <span
              data-testid="pending-mine-badge"
              aria-hidden="true"
              style={{ fontFamily: 'var(--font-data)' }}
            >
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
