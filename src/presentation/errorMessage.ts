import type { TFunction } from 'i18next'

/**
 * Server errors are written for whoever reads the logs: English, and about the database. Showing them raw is
 * two failures at once — the wrong language, and a sentence nobody outside this repo can act on.
 *
 * Recognised cases get real copy; anything else gets a plain "that could not be saved", which is honest
 * without being a stack trace in disguise.
 */
const BY_TEXT: { pattern: RegExp; key: string }[] = [
  { pattern: /only the creator/i, key: 'errors.creatorOnly' },
  { pattern: /the vote is closed/i, key: 'errors.voteClosed' },
  { pattern: /stale round/i, key: 'errors.staleRound' },
  { pattern: /name taken/i, key: 'errors.nameTaken' },
  { pattern: /at most 10 images/i, key: 'errors.imageLimit' },
  { pattern: /closing reason|at least 10 characters/i, key: 'errors.closeReason' },
  { pattern: /only an approved proposal/i, key: 'errors.notCompleted' },
  { pattern: /failed to fetch|networkerror|load failed/i, key: 'errors.offline' },
]

export function errorMessage(cause: unknown, t: TFunction): string {
  const message = cause instanceof Error ? cause.message : String(cause)
  const code = (cause as { code?: string }).code

  const byText = BY_TEXT.find((candidate) => candidate.pattern.test(message))
  if (byText) return t(byText.key)

  if (typeof code === 'string' && ['PT400', 'PT403', 'PT404', 'PT409', 'PT429'].includes(code)) {
    return t(`errors.${code}`)
  }

  return t('errors.generic')
}
