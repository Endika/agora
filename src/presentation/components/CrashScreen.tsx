import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * The floor under everything: a component that throws must not leave a blank screen.
 *
 * It happened — a cached board from an older deploy was missing a field the new code read, React unmounted
 * the tree, and the app was a dark rectangle. The cache validates itself now, but the class of problem
 * deserves a net: say what happened, and offer the one action that actually recovers it.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Agora crashed:', error, info.componentStack)
  }

  render() {
    return this.state.failed ? <CrashScreen /> : this.props.children
  }
}

async function clearAndReload(): Promise<void> {
  try {
    // Whatever this device cached is the usual suspect; the agora itself is on the server.
    await Promise.all([
      indexedDB.deleteDatabase('agora'),
      indexedDB.deleteDatabase('agora-queue'),
      caches?.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
    ])
  } finally {
    window.location.reload()
  }
}

export function CrashScreen() {
  const { t } = useTranslation()
  return (
    <main className="mx-auto grid max-w-2xl gap-4 px-4 py-10" role="alert">
      <h1 className="text-3xl font-semibold">{t('crash.heading')}</h1>
      <p style={{ color: 'var(--ink-muted)' }}>{t('crash.explain')}</p>
      <button
        type="button"
        onClick={() => void clearAndReload()}
        className="min-h-11 justify-self-start rounded-[--radius] px-4 font-medium"
        style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
      >
        {t('crash.reload')}
      </button>
    </main>
  )
}
