import { useTranslation } from 'react-i18next'
import type { VisitedAgora } from '@/domain/ports/VisitedAgorasStore'

/** Everywhere this device has been. One tap back in, no link needed. */
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
    <section className="grid gap-2" aria-labelledby="your-agoras">
      <h2 id="your-agoras" className="text-2xl font-semibold">
        {t('home.yourAgoras')}
      </h2>
      <ul className="grid gap-2">
        {agoras.map((agora) => (
          <li key={agora.slug}>
            <button
              type="button"
              onClick={() => onOpen(agora.slug)}
              className="min-h-11 w-full rounded-[--radius] border px-4 text-left font-medium"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              {agora.name}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
