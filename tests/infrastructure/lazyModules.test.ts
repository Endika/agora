import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SRC = resolve(import.meta.dirname, '../../src')

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.tsx?$/.test(entry) ? [path] : []
  })
}

/**
 * The four packages that must never be in the entry chunk: the Supabase client, the Markdown parser
 * and its sanitiser, and the QR encoder. None of them is needed to paint the cached board, and a
 * top-level `import` of any of them would put all of it back in front of the first paint.
 */
const DEFERRED = ['@supabase/supabase-js', 'marked', 'dompurify', 'qrcode']

describe('the packages kept out of the entry chunk', () => {
  const files = sources(SRC).map((path) => [path, readFileSync(path, 'utf8')] as const)

  for (const pkg of DEFERRED) {
    it(`only reaches ${pkg} through a dynamic import()`, () => {
      const statik = files
        .filter(([, code]) =>
          new RegExp(`^\\s*import\\s[^\\n]*?from\\s+['"]${pkg}['"]`, 'm').test(code),
        )
        .map(([path]) => path)
      expect(statik).toEqual([])

      const dynamic = files.filter(([, code]) =>
        new RegExp(`import\\(\\s*['"]${pkg}['"]\\s*\\)`).test(code),
      )
      expect(dynamic.length).toBeGreaterThan(0)
    })
  }
})
