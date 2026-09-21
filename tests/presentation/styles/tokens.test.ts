import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

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

/** Reads a token from a specific block, so light and dark are checked separately. */
function token(name: string, block: 'light' | 'dark'): string {
  const source =
    block === 'light'
      ? css.slice(0, css.indexOf('@media (prefers-color-scheme: dark)'))
      : css.slice(css.indexOf(":root[data-theme='dark']"))
  const match = source.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))
  if (!match) throw new Error(`token --${name} not found in the ${block} block`)
  return match[1]!
}

/**
 * Strips CSS block comments so a brace, or a stale declaration left in a hand-sync note such as
 * "was --danger: #e9594c;", can never be read as live CSS.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '')
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

  it('the still forms move nothing: opacity only, no transform', () => {
    for (const name of ['pebble-land-still', 'row-reveal-still']) {
      const frames = ruleBody(css, `@keyframes ${name}`)
      expect(frames).toContain('opacity')
      expect(frames).not.toContain('transform')
    }
  })
})
