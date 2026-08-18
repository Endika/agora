import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { errorMessage } from './errorMessage'

/**
 * Every write goes through here, because a write that fails silently is worse than one that fails: the board
 * just does not change and nobody knows why. What comes back from the server is translated into something a
 * person can act on rather than shown raw.
 */
export function useAction() {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)

  const run = (action: () => Promise<unknown>, after?: () => void): void => {
    setError(null)
    void action()
      .then(() => after?.())
      .catch((cause: unknown) => setError(errorMessage(cause, t)))
  }

  return { run, error }
}
