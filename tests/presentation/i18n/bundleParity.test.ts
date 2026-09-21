import { describe, expect, it } from 'vitest'
import en from '@/presentation/i18n/en.json'
import es from '@/presentation/i18n/es.json'
import eu from '@/presentation/i18n/eu.json'

/**
 * Every key, flattened to the dotted path `t()` is called with, so that a nested branch added to
 * one bundle and forgotten in another is a missing key and not a missing subtree.
 */
function keysOf(bundle: unknown, prefix = ''): string[] {
  if (typeof bundle !== 'object' || bundle === null) return [prefix]
  return Object.entries(bundle).flatMap(([key, value]) =>
    keysOf(value, prefix === '' ? key : `${prefix}.${key}`),
  )
}

/**
 * Spanish is the fallback language, so it is the one a missing key would silently fall back *to*:
 * an English or Basque reader would get a Spanish sentence with no warning anywhere. Which is the
 * whole reason this is a test and not a habit — the constraint has been in the spec since the
 * first task and was checked by hand five times, once per task, which is five chances to forget.
 *
 * Compared as sets in both directions, never by count: two bundles can hold the same number of
 * keys and disagree about which, and that is exactly what a rename in one file looks like.
 */
describe('los tres bundles dicen las mismas cosas', () => {
  const spanish = new Set(keysOf(es))

  for (const [locale, bundle] of [
    ['en', en],
    ['eu', eu],
  ] as const) {
    it(`${locale} tiene exactamente las claves de es, ni una más ni una menos`, () => {
      const other = new Set(keysOf(bundle))

      // Both lists in one expectation: a failure names the keys instead of only counting them.
      expect({
        locale,
        missing: [...spanish].filter((key) => !other.has(key)).sort(),
        extra: [...other].filter((key) => !spanish.has(key)).sort(),
      }).toEqual({ locale, missing: [], extra: [] })
    })
  }

  it('y ninguna de ellas se queda sin traducir', () => {
    // A key present but empty passes a set comparison and renders as nothing on screen, which is
    // the same hole reached from the other side.
    const blank = Object.entries({ es, en, eu }).flatMap(([locale, bundle]) =>
      keysOf(bundle)
        .filter((key) => {
          const value = key
            .split('.')
            .reduce<unknown>(
              (node, step) => (node as Record<string, unknown> | undefined)?.[step],
              bundle,
            )
          return typeof value !== 'string' || value.trim() === ''
        })
        .map((key) => `${locale}:${key}`),
    )

    expect(blank).toEqual([])
  })
})
