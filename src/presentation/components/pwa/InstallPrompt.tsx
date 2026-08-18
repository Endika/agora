import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED = 'agora:installDismissed'

// Optional call: a runtime without matchMedia must not take the whole app down over a banner.
const isStandalone = (): boolean =>
  window.matchMedia?.('(display-mode: standalone)').matches === true ||
  (window.navigator as unknown as { standalone?: boolean }).standalone === true

const isIos = (): boolean => /iphone|ipad|ipod/i.test(window.navigator.userAgent)

/**
 * Browsers barely offer to install a PWA on their own any more — Chrome keeps trimming its own banner and
 * iOS Safari has never had one. So the app asks: the real prompt where `beforeinstallprompt` exists, and
 * the Share → Add to Home Screen instruction on iOS, where installing cannot be triggered by code.
 *
 * Dismissing sticks, because being nagged by a board you use every week is worse than not installing it.
 */
export function InstallPrompt() {
  const { t } = useTranslation()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED) === 'true')

  useEffect(() => {
    if (isStandalone()) return
    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  const dismiss = () => {
    setDismissed(true)
    localStorage.setItem(DISMISSED, 'true')
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    dismiss()
  }

  if (dismissed || isStandalone()) return null
  const iosOnly = deferred === null && isIos()
  if (deferred === null && !iosOnly) return null

  return (
    <aside
      className="flex flex-wrap items-center gap-3 rounded-[--radius] border p-3 text-sm"
      style={{ background: 'var(--surface)', borderColor: 'var(--brand)' }}
    >
      <span className="min-w-0 flex-1">{iosOnly ? t('install.iosHint') : t('install.title')}</span>
      {!iosOnly && (
        <button
          type="button"
          onClick={() => void install()}
          className="min-h-11 rounded-[--radius] px-4 font-medium"
          style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
        >
          {t('install.button')}
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        className="min-h-11 rounded-[--radius] border px-3"
        style={{ borderColor: 'var(--border)' }}
      >
        {t('install.dismiss')}
      </button>
    </aside>
  )
}
