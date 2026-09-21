import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { errorMessage } from './errorMessage'

/**
 * Every write goes through here, because a write that fails silently is worse than one that fails: the board
 * just does not change and nobody knows why. What comes back from the server is translated into something a
 * person can act on rather than shown raw.
 *
 * A write that *succeeds* silently is its own problem. `pendingFor` is what stops a second tap landing on a
 * button whose first tap is still in the air, and `doneFor` carries the sentence the caller wants said once
 * the write is safely through.
 *
 * Both are keyed to the request, never to the hook. One of these serves a whole board and the same proposal
 * can be on screen twice, so a single pair of flags belonged to whichever tap was most recent: with a slow
 * first write and a fast second one, a card announced the *other* card's vote out loud, and the first card's
 * buttons came back to life while its write was still in the air. A key each, and every result goes home.
 */
export function useAction() {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const [inFlight, setInFlight] = useState<readonly string[]>([])
  const [done, setDone] = useState<Readonly<Record<string, string>>>({})

  const forget = (key: string) =>
    setDone((current) => {
      if (!(key in current)) return current
      const next = { ...current }
      delete next[key]
      return next
    })

  const run = (
    action: () => Promise<unknown>,
    after?: () => void,
    success?: string,
    key = '',
  ): void => {
    setError(null)
    forget(key)
    setInFlight((keys) => [...keys, key])
    void action()
      .then(() => {
        if (success !== undefined) setDone((current) => ({ ...current, [key]: success }))
        after?.()
      })
      .catch((cause: unknown) => setError(errorMessage(cause, t)))
      // Only this request's own entry, found by value: a second write under the same key must not
      // be cleared by the first one finishing.
      .finally(() =>
        setInFlight((keys) => {
          const at = keys.indexOf(key)
          return at === -1 ? keys : [...keys.slice(0, at), ...keys.slice(at + 1)]
        }),
      )
  }

  return {
    run,
    error,
    /** Whether a write filed under this key is still in the air. */
    pendingFor: (key = '') => inFlight.includes(key),
    /** What the write filed under this key confirmed, once it landed. Null until then. */
    doneFor: (key = '') => done[key] ?? null,
  }
}
