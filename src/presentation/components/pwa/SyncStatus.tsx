import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActionQueue, FailedEntry } from '@/domain/ports/ActionQueue'
import type { OnlineDetector } from '@/domain/ports/OnlineDetector'

interface Props {
  queue: ActionQueue
  network: OnlineDetector
  /** Called when the connection comes back, so the queue is drained and the board refreshed. */
  onReconnect: () => Promise<void>
}

/**
 * What the app owes the network, said out loud. A queued vote that nobody mentions is indistinguishable
 * from a vote that was lost, which is the failure mode this exists to prevent.
 */
export function SyncStatus({ queue, network, onReconnect }: Props) {
  const { t } = useTranslation()
  const [online, setOnline] = useState(() => network.isOnline())
  const [pending, setPending] = useState(0)
  const [failed, setFailed] = useState<FailedEntry[]>([])

  useEffect(() => {
    let live = true
    const refresh = async () => {
      const [waiting, broken] = await Promise.all([queue.pending(), queue.failed()])
      if (!live) return
      setPending(waiting.length)
      setFailed(broken)
    }

    const onChange = () => {
      const nowOnline = network.isOnline()
      setOnline(nowOnline)
      void (nowOnline ? onReconnect().then(refresh) : refresh())
    }

    void refresh()
    const stop = network.onChange(onChange)
    const timer = setInterval(() => void refresh(), 5000)
    return () => {
      live = false
      stop()
      clearInterval(timer)
    }
  }, [queue, network, onReconnect])

  if (online && pending === 0 && failed.length === 0) return null

  return (
    <div className="grid gap-2" aria-live="polite">
      {!online && (
        <p
          className="rounded-[--radius] px-3 py-2 text-sm"
          style={{ background: 'var(--surface-sunken)', color: 'var(--warn)' }}
        >
          {t('sync.offline')}
        </p>
      )}

      {pending > 0 && (
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {t('sync.pending', { count: pending })}
        </p>
      )}

      {failed.length > 0 && (
        <div
          role="alert"
          className="grid gap-2 rounded-[--radius] border p-3 text-sm"
          style={{ borderColor: 'var(--danger)' }}
        >
          <p style={{ color: 'var(--danger)' }}>{t('sync.failed', { count: failed.length })}</p>
          <p style={{ color: 'var(--ink-muted)' }}>{t('sync.failedExplain')}</p>
          <button
            type="button"
            onClick={() => {
              void Promise.all(failed.map((entry) => queue.forgetFailed(entry.id))).then(() =>
                setFailed([]),
              )
            }}
            className="min-h-11 justify-self-start rounded-[--radius] border px-3"
            style={{ borderColor: 'var(--border)' }}
          >
            {t('sync.dismissFailed')}
          </button>
        </div>
      )}
    </div>
  )
}
