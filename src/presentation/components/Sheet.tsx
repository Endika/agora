import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

/**
 * A full-page sheet for one job at a time. It is portalled to <body> so the rest of the page can be
 * marked `inert`: a dialog that declares aria-modal and leaves the background reachable tells a
 * screen reader a lie it cannot recover from.
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
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Deliberately `[]`: every call site passes a fresh inline `onClose`, so depending on it would
  // re-run this effect (un-inert, refocus) on every parent re-render, yanking focus out of
  // whatever the user is typing in. `onCloseRef` gives the handlers below the current callback
  // without the effect needing to know it changed.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const background = [...document.body.children].filter(
      (node) => node !== panel.current?.parentElement,
    )
    for (const node of background) node.setAttribute('inert', '')
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const host = panel.current
      if (!host) return
      const stops = [...host.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (stops.length === 0) {
        event.preventDefault()
        host.focus()
        return
      }
      const first = stops[0]!
      const last = stops[stops.length - 1]!
      const active = document.activeElement
      if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && (active === first || active === host)) {
        event.preventDefault()
        last.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      for (const node of background) node.removeAttribute('inert')
      document.body.style.overflow = previousOverflow
      opener?.focus?.()
    }
  }, [])

  return createPortal(
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
          className="min-h-11 justify-self-end rounded-(--radius) border px-4"
          style={{ borderColor: 'var(--border-control)' }}
        >
          {t('common.close')}
        </button>
        {children}
      </div>
    </div>,
    document.body,
  )
}
