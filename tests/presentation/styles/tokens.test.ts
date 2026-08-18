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
})
