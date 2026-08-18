import { useState } from 'react'

/**
 * Every write goes through here, because a write that fails silently is worse than one that fails: the
 * board just does not change and nobody knows why. `run` clears the previous error, runs the action, and
 * keeps whatever went wrong so the caller can show it.
 */
export function useAction() {
  const [error, setError] = useState<string | null>(null)

  const run = (action: () => Promise<unknown>, after?: () => void): void => {
    setError(null)
    void action()
      .then(() => after?.())
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : String(cause))
      })
  }

  return { run, error }
}
