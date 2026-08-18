import { useTranslation } from 'react-i18next'
import { deadlineState } from '@/domain/services/Deadline'

/** How long the vote has left, in the words people use. Amber when it is the last day. */
export function DeadlineChip({ deadline, now }: { deadline: string | null; now?: string }) {
  const { t } = useTranslation()
  const state = deadlineState(deadline, now ?? new Date().toISOString())

  const label =
    state.kind === 'none'
      ? t('deadline.none')
      : state.kind === 'passed'
        ? t('deadline.passed')
        : state.kind === 'today'
          ? t('deadline.today')
          : state.days === 1
            ? t('deadline.oneDay')
            : t('deadline.days', { count: state.days })

  const urgent = state.kind === 'today' || (state.kind === 'days' && state.days <= 2)

  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs"
      style={{
        background: 'var(--surface-sunken)',
        color: urgent ? 'var(--warn)' : 'var(--ink-muted)',
      }}
    >
      {label}
    </span>
  )
}
