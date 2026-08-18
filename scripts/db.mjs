// Applies supabase/migrations (`migrate`) or runs tests/sql (`test`) against AGORA_DB_URL.
// Plain `pg` on purpose: no Supabase CLI and no Docker beyond the single Postgres container.
import { readdirSync, readFileSync } from 'node:fs'
import { Client } from 'pg'

const mode = process.argv[2]
if (mode !== 'migrate' && mode !== 'test' && mode !== 'bootstrap') {
  console.error('usage: node scripts/db.mjs <bootstrap|migrate|test>')
  process.exit(2)
}

const connectionString = process.env.AGORA_DB_URL
if (!connectionString) {
  console.error('AGORA_DB_URL is not set (see .env.example)')
  process.exit(2)
}

// bootstrap is a single local/CI file; locally the container mounts it as an init script instead.
const dir = { test: 'tests/sql', migrate: 'supabase/migrations', bootstrap: 'supabase' }[mode]
const files =
  mode === 'bootstrap'
    ? ['bootstrap.sql']
    : readdirSync(dir)
        .filter((f) => f.endsWith('.sql'))
        .sort()

// The container accepts connections a moment after `docker run` returns, so retry instead of
// making every caller sleep. A Client that failed to connect cannot be reused, hence a new one
// per attempt.
async function connect() {
  for (let attempt = 1; ; attempt++) {
    const candidate = new Client({ connectionString })
    // A `raise notice 'PASS ...'` is how a SQL test reports success; surface it, don't swallow it.
    candidate.on('notice', (n) => console.log(`  ${n.message}`))
    try {
      await candidate.connect()
      return candidate
    } catch (error) {
      await candidate.end().catch(() => {})
      if (attempt >= 20) throw error
      await new Promise((r) => setTimeout(r, 500))
    }
  }
}

const client = await connect()
// A failing assertion should read like a test failure, not like a stack trace.
process.on('uncaughtException', (error) => {
  console.error(`\n${error.message}`)
  if (error.where) console.error(error.where)
  process.exit(1)
})

try {
  for (const file of files) {
    console.log(`${dir}/${file}`)
    const sql = readFileSync(`${dir}/${file}`, 'utf8')
    if (mode !== 'test') {
      await client.query(sql)
      continue
    }
    // Tests get their isolation from here, not from a `rollback` they might forget: whatever a
    // file writes is discarded, so the suite is repeatable against the same container.
    await client.query('begin')
    try {
      await client.query(sql)
    } finally {
      await client.query('rollback')
    }
  }
} finally {
  await client.end()
}
console.log(`${files.length} file(s) ok`)
