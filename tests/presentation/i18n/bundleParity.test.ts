import { describe, expect, it } from 'vitest'
import i18next from 'i18next'
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

/**
 * A plural key is the one kind of key the parity test above cannot vouch for: `castOnly_one` and
 * `castOnly_other` are present in all three bundles and neither is blank, and `t('export.castOnly')`
 * would still print the raw key if the suffixes were spelled the way i18next does not expect for a
 * locale. Nothing else catches it either — every export test hands in a written label, and no test
 * renders `ExportButtons` — so the export would carry the string `export.castOnly` into a document
 * somebody keeps, with the suite green. Resolved here through the initialised instance the app uses,
 * at the three counts that exercise both forms.
 */
describe('el recuento de la exportación se resuelve de verdad en los tres idiomas', () => {
  const expected = {
    es: ['0 votos emitidos', '1 voto emitido', '2 votos emitidos'],
    en: ['0 votes cast', '1 vote cast', '2 votes cast'],
    eu: ['0 boto emanda', 'boto 1 emanda', '2 boto emanda'],
  }

  for (const [locale, counts] of Object.entries(expected)) {
    it(`${locale} dice el número y nunca la clave`, () => {
      const t = i18next.getFixedT(locale)
      for (const [count, text] of counts.entries()) {
        expect(t('export.castOnly', { count })).toBe(text)
        // The failure this guards is not a wrong word, it is the raw key reaching the document.
        expect(t('export.castOnly', { count })).not.toContain('castOnly')
      }
    })
  }
})
