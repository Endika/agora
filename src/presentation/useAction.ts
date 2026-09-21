import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { errorMessage } from './errorMessage'

/**
 * Every write goes through here, because a write that fails silently is worse than one that fails: the board
 * just does not change and nobody knows why. What comes back from the server is translated into something a
 * person can act on rather than shown raw.
 *
 * A write that *succeeds* silently is its own problem. `pending` is what stops a second tap landing on a
 * button whose first tap is still in the air, and `done` carries the sentence the caller wants said once the
 * write is safely through.
 */
export function useAction() {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const run = (action: () => Promise<unknown>, after?: () => void, success?: string): void => {
    setError(null)
    setDone(null)
    setPending(true)
    void action()
      .then(() => {
        if (success !== undefined) setDone(success)
        after?.()
      })
      .catch((cause: unknown) => setError(errorMessage(cause, t)))
      .finally(() => setPending(false))
  }

  return { run, error, pending, done }
}
