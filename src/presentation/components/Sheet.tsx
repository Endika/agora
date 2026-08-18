import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * A full-page sheet for one job at a time. Writing a proposal next to the board it belongs to reads as
 * two things happening at once, so the sheet covers everything and Escape gets you out.
 *
 * Deliberately not a `<dialog>`: this has to scroll on a phone with the keyboard up, and the native
 * modal fights that.
 */
export function Sheet({
  label,
  onClose,
  children,
}: {
  label: string
  onClose: () => void
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const panel = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    panel.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain"
      style={{ background: 'var(--ground)' }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="mx-auto grid max-w-2xl gap-4 px-4 py-6 outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 justify-self-end rounded-[--radius] border px-4"
          style={{ borderColor: 'var(--border)' }}
        >
          {t('common.close')}
        </button>
        {children}
      </div>
    </div>
  )
}
