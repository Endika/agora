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

/**
 * The quorum purge, widened so it cannot happen a third time.
 *
 * Twice now a sentence has claimed something happens "at quorum". `agora.resolve_proposal` closes a
 * vote when the whole group has voted **or** when its deadline passes, so every such claim was false
 * on the second path — and the second path is the ordinary one for exactly the proposals whose votes
 * a secret agora withholds. The first purge covered the five `psephoi` sentences; `privacy.visibleOpen`
 * said it too, in all three locales, and nothing caught it.
 *
 * So: no string in any bundle mentions quorum, with one allowlisted exception. The allowlist is the
 * point of the shape — a new mention cannot land silently, it has to be argued for here first.
 */
describe('nadie promete nada "al alcanzar el quórum"', () => {
  /**
   * The one legitimate mention. Abstaining really does count towards `v_cast`, which is what the
   * quorum test in `resolve_proposal` compares, so this sentence is true and is about the thing it
   * names — the *threshold*, not the publishing of anything.
   */
  const ALLOWED = new Set(['psephoi.abstainCounts'])

  for (const [locale, bundle] of [
    ['es', es],
    ['en', en],
    ['eu', eu],
  ] as const) {
    it(`${locale} no lo dice en ninguna clave que no esté en la lista`, () => {
      const offenders = keysOf(bundle)
        .filter((key) => !ALLOWED.has(key))
        .filter((key) => {
          const value = key
            .split('.')
            .reduce<unknown>(
              (node, step) => (node as Record<string, unknown> | undefined)?.[step],
              bundle,
            )
          // One pattern for the three locales: quórum, quorum, quoruma. The accent is the whole
          // reason this is written out — /quor/i does not match «quórum», so the first version of
          // this guard passed the very mutation it exists to catch.
          return typeof value === 'string' && /qu[oó]r/i.test(value)
        })

      expect({ locale, offenders }).toEqual({ locale, offenders: [] })
    })
  }
})

/**
 * The sentence shown over a withheld ballot, in every locale, checked against what is actually on
 * the card beside it.
 *
 * This is the second failure of the same class as the quorum one: a string that was true when it was
 * written and stopped being true when the behaviour under it moved. It was written when an
 * incomplete secret ballot still carried a verdict, so it said «se ve el resultado»; the no-verdict
 * ruling left it promising an outcome directly above a card labelled «En debate», while the privacy
 * notice two screens away said the proposal closes without a decision. Nothing caught it, because
 * the earlier net was looking for one particular word.
 *
 * So this one asserts the claim rather than the wording: there is no decision, and the only number
 * published is how many people voted. A translation that keeps the old shape fails here too.
 */
describe('la frase de la papeleta retenida no promete un resultado que no existe', () => {
  const withheld = {
    es: { has: [/no hay decisión/, /cuántas personas votaron/], hasNot: [/el resultado/] },
    en: { has: [/there is no decision/, /how many people voted/], hasNot: [/the outcome/] },
    eu: { has: [/ez dago erabakirik/, /zenbatek bozkatu duten/], hasNot: [/emaitza/] },
  }

  for (const [locale, { has, hasNot }] of Object.entries(withheld)) {
    it(`${locale} dice que no hay decisión y no menciona ningún resultado`, () => {
      const sentence = i18next.getFixedT(locale)('psephoi.secretForeverWithheld')

      for (const claim of has) expect(sentence).toMatch(claim)
      for (const lie of hasNot) expect(sentence).not.toMatch(lie)
    })
  }
})

/**
 * The two sentences that sit directly above the vote buttons, checked against what the app can
 * actually promise.
 *
 * Both used to open with «Nadie ve tu voto mientras la propuesta está abierta», and the privacy
 * notice in the same app explains that somebody who takes your name on their own device reads your
 * vote as you — there are no passwords, by design. So the absolute was contradicted by the app
 * itself, in the worse of the two places: the notice is opened on purpose, this is read at the
 * moment somebody decides how to vote.
 *
 * The claim is now scoped to the board, which is exactly what the redaction work delivers and what
 * a reader can check. Asserted as the claim and not the wording, so a translation cannot put the
 * absolute back: the sentence has to name the board, and it may not say that nobody sees the vote.
 * The impersonation caveat deliberately does not appear here — repeating it above the buttons would
 * make it louder than the paragraph that qualifies it.
 */
describe('la promesa que está encima de los botones se limita al tablón', () => {
  const scoped = {
    es: { board: /tablón/, absolute: /nadie ve tu voto/i },
    en: { board: /board/, absolute: /nobody sees your vote/i },
    eu: { board: /taulan/, absolute: /inork ez du zure botoa ikusten/i },
  }

  for (const [locale, { board, absolute }] of Object.entries(scoped)) {
    for (const key of ['psephoi.secret', 'psephoi.secretForever'] as const) {
      it(`${locale} · ${key} nombra el tablón y no promete que no lo vea nadie`, () => {
        const sentence = i18next.getFixedT(locale)(key)

        expect(sentence).toMatch(board)
        expect(sentence).not.toMatch(absolute)
      })
    }
  }
})
