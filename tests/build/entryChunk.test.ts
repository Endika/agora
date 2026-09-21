import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { build } from 'vite'
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')

/**
 * The four packages that must not be downloaded before the app can paint: the Supabase client, the
 * Markdown parser and its sanitiser, and the QR encoder.
 *
 * This asserts the built output rather than the source, because the property is a property of the
 * bundle. A source grep misses it in several ways — a Prettier-wrapped multi-line import,
 * `export … from`, a bare `import 'pkg'`, a subpath like `dompurify/purify.js` — and it also fails
 * on an `import type`, which costs no bytes at all. What the browser downloads is the only thing
 * worth asserting.
 *
 * **What this does not catch:** a top-level `await import('pkg')` in an eagerly evaluated module.
 * Rolldown leaves that as a dynamic import in the output, so the chunk gets no `modulepreload` and
 * no static reference and never enters the `eager` set below — yet the browser still has to fetch
 * and await it before the app can paint. Recognising that shape in already-transformed output is
 * fragile, and a detector that works only sometimes is how a guard like this rots, so the gap is
 * written down here instead of half-covered. If you are adding a top-level `await import()`, this
 * test will not stop you and nothing else will either.
 */
const DEFERRED = ['@supabase/supabase-js', 'marked', 'dompurify', 'qrcode']

interface Bundle {
  /** What the browser fetches before it can run the app: the entry plus everything preloaded. */
  eager: Set<string>
  all: Set<string>
  packagesIn: (chunk: string) => Set<string>
}

let bundle: Bundle
let previousEnv: Record<string, string | undefined> = {}

beforeAll(async () => {
  const outDir = mkdtempSync(join(tmpdir(), 'agora-entry-chunk-'))
  // Without these, `import.meta.env.VITE_SUPABASE_URL` folds to undefined, `agoraConfig` throws
  // unconditionally and rolldown shakes the whole Supabase client out of the build — which would
  // make this test pass for the wrong reason.
  previousEnv = {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
  }
  process.env.VITE_SUPABASE_URL = 'https://guard.supabase.co'
  process.env.VITE_SUPABASE_ANON_KEY = 'guard-anon-key'

  await build({
    root: ROOT,
    configFile: resolve(ROOT, 'vite.config.ts'),
    logLevel: 'silent',
    build: { outDir, emptyOutDir: true, sourcemap: true, write: true },
  })

  const assets = join(outDir, 'assets')
  const html = readFileSync(join(outDir, 'index.html'), 'utf8')
  const read = (chunk: string) => readFileSync(join(assets, chunk), 'utf8')

  const entry = /<script[^>]*type="module"[^>]*src="([^"]+)"/.exec(html)?.[1]
  expect(entry, 'the built index.html must load a module entry').toBeTruthy()

  const eager = new Set<string>([basename(entry!)])
  for (const [, href] of html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g)) {
    eager.add(basename(href!))
  }

  // Everything reachable from those by a *static* import is downloaded just as eagerly, preload
  // link or not. `import("./x.js")` is not, and that is the whole point of the change.
  for (const chunk of eager) {
    const code = read(chunk)
    for (const [, spec] of [
      ...code.matchAll(/(?:^|[;\s}])import\s*["'](\.\/[^"']+\.js)["']/g),
      ...code.matchAll(/\bfrom\s*["'](\.\/[^"']+\.js)["']/g),
    ]) {
      eager.add(basename(spec!))
    }
  }

  const all = new Set(readdirSync(assets).filter((file) => file.endsWith('.js')))

  // A chunk's sourcemap names every module that went into it, so which package is where is a fact
  // the build states, rather than something this test guesses from minified identifiers.
  const packagesIn = (chunk: string) => {
    let map: { sources: string[] }
    try {
      map = JSON.parse(read(`${chunk}.map`)) as { sources: string[] }
    } catch {
      // Rolldown's runtime shim ships without a map. Nothing can hide in it, and this assertion is
      // what says so rather than assuming it: no library fits in four kilobytes of unminified glue.
      expect(read(chunk).length, `${chunk} has no sourcemap to attribute`).toBeLessThan(4096)
      return new Set<string>()
    }
    const packages = new Set<string>()
    for (const source of map.sources) {
      const named = /node_modules\/(@[^/]+\/[^/]+|[^@/][^/]*)\//.exec(source)
      if (named) packages.add(named[1]!)
    }
    return packages
  }

  bundle = { eager, all, packagesIn }
}, 180_000)

describe('the entry chunk', () => {
  for (const pkg of DEFERRED) {
    it(`does not download ${pkg} before the app can paint`, () => {
      const guilty = [...bundle.eager].filter((chunk) => bundle.packagesIn(chunk).has(pkg))
      expect(guilty, `${pkg} is in a chunk the browser fetches eagerly`).toEqual([])
    })

    it(`still ships ${pkg}, in a chunk of its own`, () => {
      // Otherwise deleting the feature outright would satisfy the assertion above.
      const lazy = [...bundle.all].filter((chunk) => bundle.packagesIn(chunk).has(pkg))
      expect(lazy.length, `${pkg} is not in the build at all`).toBeGreaterThan(0)
    })
  }
})

// Restored rather than left set: today every test file gets its own worker, but the suite is
// already being nudged towards `isolate: false`, and on that day a leaked VITE_* here would quietly
// configure every other file in the worker.
afterAll(() => {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})
