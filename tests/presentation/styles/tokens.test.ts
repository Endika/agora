import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { LANDING_MS } from '@/presentation/components/vote/PsephoiRow'

const ROW_SOURCE = 'src/presentation/components/vote/PsephoiRow.tsx'

/** The first `<n>ms` in a declaration, as a number. */
function duration(declaration: string): number {
  const match = declaration.match(/(\d+(?:\.\d+)?)ms/)
  if (!match) throw new Error(`no duration in ${JSON.stringify(declaration)}`)
  return Number(match[1])
}

/**
 * Anything that *sets* the attribute, in either form it can be written in: `'data-motion': 'x'`
 * inside an object spread, or a bare `data-motion="x"` on a JSX tag. Matching only the first is
 * how the second would have walked past the check below.
 */
const SETS_DATA_MOTION = /["']data-motion["']\s*:|\bdata-motion\s*=/

/** Every literal value either form assigns. An expression value matches `SETS_DATA_MOTION` only. */
function motionValues(source: string): string[] {
  const pattern = /(?:["']data-motion["']\s*:|\bdata-motion\s*=)\s*["']([a-z-]+)["']/g
  return [...source.matchAll(pattern)].map((match) => match[1]!)
}

/** WCAG 2.x relative luminance and contrast ratio, straight from the spec. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

const css = readFileSync('src/presentation/styles/tokens.css', 'utf8')

/**
 * Strips CSS block comments so a brace, or a stale declaration left in a hand-sync note such as
 * "was --danger: #e9594c;", can never be read as live CSS.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '')
}

/**
 * Reads a token from a specific block of some stylesheet, so light and dark are checked
 * separately. Comments go first — `declarations()` already stripped them and this did not, so a
 * commented-out `--x: …` sitting above the live one was the value every contrast assertion in
 * this file would have been handed.
 */
function tokenIn(source: string, name: string, block: 'light' | 'dark'): string {
  const stripped = stripComments(source)
  const scope =
    block === 'light'
      ? stripped.slice(0, stripped.indexOf('@media (prefers-color-scheme: dark)'))
      : stripped.slice(stripped.indexOf(":root[data-theme='dark']"))
  const match = scope.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))
  if (!match) throw new Error(`token --${name} not found in the ${block} block`)
  return match[1]!
}

/** The same, against the real stylesheet. */
function token(name: string, block: 'light' | 'dark'): string {
  return tokenIn(css, name, block)
}

/** The token the focus ring is actually painted with, read out of the rule rather than assumed. */
function focusRingToken(): string {
  const match = stripComments(css).match(/:focus-visible\s*\{[^}]*outline:[^;]*var\(--([a-z-]+)\)/)
  if (!match) throw new Error('no :focus-visible outline in a var() to check')
  return match[1]!
}

/**
 * Extracts the declaration body of the rule/at-rule that opens at `marker`, matching braces over
 * comment-stripped text — so a brace inside a comment can't end the body early — so nested rules
 * (like the `@media` inside `:root:not([data-theme='light'])`) don't spill out either.
 */
function ruleBody(source: string, marker: string): string {
  const stripped = stripComments(source)
  const markerIndex = stripped.indexOf(marker)
  if (markerIndex === -1) throw new Error(`marker ${JSON.stringify(marker)} not found`)
  const openIndex = stripped.indexOf('{', markerIndex)
  let depth = 0
  for (let i = openIndex; i < stripped.length; i++) {
    if (stripped[i] === '{') depth++
    else if (stripped[i] === '}') {
      depth--
      if (depth === 0) return stripped.slice(openIndex + 1, i)
    }
  }
  throw new Error(`unbalanced braces after ${JSON.stringify(marker)}`)
}

/** Parses every `--token: value;` declaration in a rule body into a name → value map, comments stripped first. */
function declarations(body: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const match of stripComments(body).matchAll(/--([a-z0-9-]+):\s*([^;]+);/gi)) {
    map.set(match[1]!, match[2]!.trim())
  }
  return map
}

describe('design tokens', () => {
  it('meets AA for body text on both grounds', () => {
    expect(contrast(token('ink', 'light'), token('ground', 'light'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(token('ink', 'dark'), token('ground', 'dark'))).toBeGreaterThanOrEqual(4.5)
  })

  it('meets AA for muted text, which is where contrast usually slips', () => {
    expect(contrast(token('ink-muted', 'light'), token('ground', 'light'))).toBeGreaterThanOrEqual(
      4.5,
    )
    expect(contrast(token('ink-muted', 'dark'), token('ground', 'dark'))).toBeGreaterThanOrEqual(
      4.5,
    )
  })

  it('keeps the vote colours distinguishable from the ground as UI components (3:1)', () => {
    for (const vote of ['vote-up', 'vote-down', 'vote-abstain']) {
      expect(contrast(token(vote, 'light'), token('ground', 'light'))).toBeGreaterThanOrEqual(3)
      expect(contrast(token(vote, 'dark'), token('ground', 'dark'))).toBeGreaterThanOrEqual(3)
    }
  })

  it('never paints a vote with the brand or the danger colour', () => {
    const brand = token('brand', 'light')
    const danger = token('danger', 'light')
    for (const vote of ['vote-up', 'vote-down', 'vote-abstain']) {
      expect(token(vote, 'light')).not.toBe(brand)
      expect(token(vote, 'light')).not.toBe(danger)
    }
  })

  const SMALL_TEXT = [
    ['warn', 'surface'],
    ['warn', 'surface-sunken'],
    ['warn', 'ground'],
    ['pos', 'surface'],
    ['pos', 'surface-sunken'],
    ['pos', 'ground'],
    ['danger', 'surface'],
    ['danger', 'surface-sunken'],
    ['danger', 'ground'],
  ] as const

  it('los colores de estado pasan AA como texto pequeño sobre las tres superficies', () => {
    for (const block of ['light', 'dark'] as const) {
      for (const [ink, bg] of SMALL_TEXT) {
        expect(contrast(token(ink, block), token(bg, block))).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  const FILLS = ['brand-strong', 'danger', 'pos', 'vote-up', 'vote-down', 'vote-abstain'] as const

  it('todo relleno de color lleva encima un texto que pasa AA', () => {
    for (const block of ['light', 'dark'] as const) {
      for (const fill of FILLS) {
        expect(contrast(token('on-fill', block), token(fill, block))).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('el relleno de marca pasa AA con la tinta que le ponen encima los componentes', () => {
    // The fills test above pairs every fill with --on-fill; the brand fill ships with --brand-ink
    // on it. Checking only the first pairing is how --brand survived at 3.08:1 in thirteen places.
    for (const block of ['light', 'dark'] as const) {
      expect(
        contrast(token('brand-ink', block), token('brand-strong', block)),
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('los delimitadores de control y las piedras vacías pasan 3:1', () => {
    for (const block of ['light', 'dark'] as const) {
      for (const bg of ['surface', 'surface-sunken', 'ground'] as const) {
        expect(contrast(token('border-control', block), token(bg, block))).toBeGreaterThanOrEqual(3)
      }
      expect(
        contrast(token('pebble-empty', block), token('surface', block)),
      ).toBeGreaterThanOrEqual(3)
    }
    // The ruling that lifted --border-control out of 3.0035: an edge that clears 3:1 in the fourth
    // decimal has not passed, it has rounded. The dark empty pebble sat at 3.0070 on --surface —
    // the faintest pairing the dashed ring has — and gets held to the same bar the border got.
    expect(
      contrast(token('pebble-empty', 'dark'), token('surface', 'dark')),
    ).toBeGreaterThanOrEqual(3.5)
  })

  it('el anillo de foco se distingue de las tres superficies (WCAG 1.4.11)', () => {
    // Read out of the `:focus-visible` rule, not named here: the ring spent twelve axe-clean runs
    // painted in --brand, which is 2.42:1 on --surface-sunken in light. axe has no rule for the
    // contrast of a focus indicator, so nothing but this can catch it going back.
    const ring = focusRingToken()
    for (const block of ['light', 'dark'] as const) {
      for (const bg of ['ground', 'surface', 'surface-sunken'] as const) {
        expect(contrast(token(ring, block), token(bg, block))).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('el voto a favor no es el mismo color que el saldo positivo', () => {
    for (const block of ['light', 'dark'] as const) {
      expect(token('vote-up', block)).not.toBe(token('pos', block))
    }
  })

  it('los dos bloques oscuros — @media y [data-theme] — coinciden token a token', () => {
    const mediaBlock = declarations(ruleBody(css, '@media (prefers-color-scheme: dark)'))
    const explicitBlock = declarations(ruleBody(css, ":root[data-theme='dark']"))

    expect(mediaBlock.size).toBeGreaterThan(0)
    expect(new Set(mediaBlock.keys())).toEqual(new Set(explicitBlock.keys()))
    for (const [name, value] of mediaBlock) {
      expect(explicitBlock.get(name)).toBe(value)
    }
  })
})

describe('css parsing helpers', () => {
  it('a hand-sync note in a comment cannot mask a real value change', () => {
    const map = declarations('--danger: #ff0000; /* was --danger: #e9594c; before the fix */')
    expect(map.get('danger')).toBe('#ff0000')
  })

  it('a commented-out declaration is not read as a live token', () => {
    const map = declarations('--pos: #2b7255; /* --ghost: #ff00ff; retired */')
    expect(map.has('ghost')).toBe(false)
    expect(map.get('pos')).toBe('#2b7255')
  })

  it('a brace inside a comment cannot truncate the rule body', () => {
    const body = ruleBody(':root { /* mismatched } brace */ --a: #111111; --b: #222222; }', ':root')
    expect(declarations(body)).toEqual(
      new Map([
        ['a', '#111111'],
        ['b', '#222222'],
      ]),
    )
  })

  it('una declaración comentada no se lee como el valor vivo de un token', () => {
    // `declarations()` stripped comments and `token()` did not, so a note left above a live
    // declaration — the ordinary way somebody records what a value used to be — would have been
    // read as the token, and every contrast assertion in this file would have checked the wrong
    // colour while staying green.
    const sheet = `
      :root { /* --pos: #ff0000; retired */ --pos: #2b7255; }
      @media (prefers-color-scheme: dark) { --pos: #5cb891; }
      :root[data-theme='dark'] { /* --pos: #00ff00; */ --pos: #5cb891; }
    `
    expect(tokenIn(sheet, 'pos', 'light')).toBe('#2b7255')
    expect(tokenIn(sheet, 'pos', 'dark')).toBe('#5cb891')
  })

  it('parses a normal balanced rule cleanly', () => {
    const body = ruleBody(':root { --a: #111111; --b: #222222; }', ':root')
    expect(declarations(body)).toEqual(
      new Map([
        ['a', '#111111'],
        ['b', '#222222'],
      ]),
    )
  })
})

describe('motion under prefers-reduced-motion', () => {
  const reduce = ruleBody(css, '@media (prefers-reduced-motion: reduce)')

  it('the two animations that carry meaning define both a moving and a still form', () => {
    for (const name of ['pebble-land', 'row-reveal']) {
      expect(css).toContain(`@keyframes ${name} {`)
      expect(css).toContain(`@keyframes ${name}-still {`)
    }
  })

  it('the blanket that flattens motion lets anything marked data-motion through', () => {
    // The whole point: `*, *::before, *::after { animation-duration: 0.01ms !important }` would
    // reach inside the pebble row and delete the only feedback casting a vote has.
    expect(reduce).toContain('*:not([data-motion])')
    expect(stripComments(reduce)).not.toMatch(/(^|[\s,])\*\s*(,|\{)/)
  })

  it('and replaces the movement with a fade instead of with nothing', () => {
    const land = ruleBody(reduce, "[data-motion='pebble-land']")
    const row = ruleBody(reduce, "[data-motion='row-reveal']")
    // Not `animation: none`: the state change still has to be seen happening.
    for (const body of [land, row]) {
      expect(body).not.toContain('none')
      expect(body).toContain('!important')
      expect(body).toMatch(/\d+ms/)
    }
    expect(land).toContain('pebble-land-still')
    expect(row).toContain('row-reveal-still')
  })

  it('el temporizador que retira la animación dura más que las dos formas del aterrizaje', () => {
    // LANDING_MS exists only to outlast the landing, and nothing tied the two together. Pushing
    // either keyframe past it would cut the animation off mid-flight in a real browser and no
    // test would notice, because jsdom never animates anything.
    const moving = duration(readFileSync(ROW_SOURCE, 'utf8').match(/pebble-land \d+ms/)![0])
    const still = duration(ruleBody(reduce, "[data-motion='pebble-land']"))
    // 260 ms is `row-reveal-still`, on a different element, and never gates this timer.
    expect(duration(ruleBody(reduce, "[data-motion='row-reveal']"))).not.toBe(still)

    expect(moving).toBeGreaterThan(0)
    expect(still).toBeGreaterThan(0)
    expect(LANDING_MS).toBeGreaterThan(moving)
    expect(LANDING_MS).toBeGreaterThan(still)
  })

  it('the still forms move nothing: opacity only, no transform', () => {
    for (const name of ['pebble-land-still', 'row-reveal-still']) {
      const frames = ruleBody(css, `@keyframes ${name}`)
      expect(frames).toContain('opacity')
      expect(frames).not.toContain('transform')
    }
  })
})

describe('the reduced-motion escape hatch stays small', () => {
  function sources(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? sources(`${dir}/${entry.name}`)
        : /\.tsx?$/.test(entry.name)
          ? [`${dir}/${entry.name}`]
          : [],
    )
  }

  it('only the pebble row may opt out, and only for its two animations', () => {
    // `*:not([data-motion])` is a hole in the blanket that flattens motion. It is meant for the
    // two moments that carry information; anything else reaching for it is reaching for an
    // exemption from somebody's stated preference, and should have to argue for it here first.
    const users = sources('src').filter((file) => SETS_DATA_MOTION.test(readFileSync(file, 'utf8')))
    expect(users).toEqual([ROW_SOURCE])

    const values = motionValues(readFileSync(users[0]!, 'utf8'))
    expect(new Set(values)).toEqual(new Set(['pebble-land', 'row-reveal']))
  })

  it('el guardia ve también el atributo suelto, no solo el de la propagación', () => {
    // The row writes it as `{...{ 'data-motion': 'row-reveal' }}`, and the guard used to match
    // that quoted spelling literally — so a plain `data-motion="…"` on any other tag in `src`
    // would have claimed the exemption without ever being counted here.
    expect(SETS_DATA_MOTION.test(`<span data-motion="row-reveal" />`)).toBe(true)
    expect(SETS_DATA_MOTION.test(`{...{ 'data-motion': 'pebble-land' }}`)).toBe(true)
    expect(SETS_DATA_MOTION.test(`{...{ "data-motion": "pebble-land" }}`)).toBe(true)
    // Reading the attribute, or naming something after it, is not claiming the exemption.
    expect(SETS_DATA_MOTION.test(`<span className="data-motion-ish" />`)).toBe(false)

    expect(motionValues(`<span data-motion="row-reveal" />`)).toEqual(['row-reveal'])
    expect(motionValues(`{...{ 'data-motion': 'pebble-land' }}`)).toEqual(['pebble-land'])
  })
})
