import { useTranslation } from 'react-i18next'
import type { VisitedAgora } from '@/domain/ports/VisitedAgorasStore'

/**
 * Everywhere this device has been. Rows, not fields: a coral spine down the left, the name in the
 * display face and a chevron, so it reads as something to tap rather than something to type in.
 */
export function AgoraList({
  agoras,
  onOpen,
  onForget,
}: {
  agoras: VisitedAgora[]
  onOpen: (slug: string) => void
  /** Local only: forgetting an agora removes it from this device's list, never from the server. */
  onForget: (slug: string) => void
}) {
  const { t } = useTranslation()
  if (agoras.length === 0) return null

  return (
    <section className="grid gap-3" aria-labelledby="your-agoras">
      <h2 id="your-agoras" className="text-2xl font-semibold">
        {t('home.yourAgoras')}
      </h2>
      <ul className="grid gap-2">
        {agoras.map((agora) => (
          <li key={agora.slug} className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={() => onOpen(agora.slug)}
              className="group flex min-h-14 flex-1 items-center gap-3 overflow-hidden rounded-[--radius] border pr-3 text-left transition-colors"
              style={{ background: 'var(--surface-sunken)', borderColor: 'var(--border)' }}
            >
              <span
                aria-hidden="true"
                className="h-full w-1.5 self-stretch"
                style={{ background: 'var(--brand)' }}
              />
              <span
                className="min-w-0 flex-1 truncate py-3 text-lg font-semibold"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {agora.name}
              </span>
              <span aria-hidden="true" className="text-xl" style={{ color: 'var(--brand)' }}>
                ›
              </span>
            </button>
            <button
              type="button"
              onClick={() => onForget(agora.slug)}
              aria-label={t('home.forget', { name: agora.name })}
              className="min-h-14 rounded-[--radius] border px-3"
              style={{ borderColor: 'var(--border)', color: 'var(--ink-muted)' }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
