import { useTranslation } from 'react-i18next'
import type { VisitedAgora } from '@/domain/ports/VisitedAgorasStore'

/**
 * Everywhere this device has been. Rows, not fields: a coral spine down the left, the name in the
 * display face and a chevron, so it reads as something to tap rather than something to type in.
 */
export function AgoraList({
  agoras,
  onOpen,
}: {
  agoras: VisitedAgora[]
  onOpen: (slug: string) => void
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
          <li key={agora.slug}>
            <button
              type="button"
              onClick={() => onOpen(agora.slug)}
              className="group flex min-h-14 w-full items-center gap-3 overflow-hidden rounded-[--radius] border pr-3 text-left transition-colors"
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
          </li>
        ))}
      </ul>
    </section>
  )
}
