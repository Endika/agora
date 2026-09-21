/**
 * The env is validated synchronously so a missing configuration is still a value the composition
 * root can return; only the client code itself — auth and realtime included, neither of which this
 * app uses — is deferred out of the entry chunk.
 */
export function agoraConfig(): { url: string; key: string } {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required')
  return { url, key }
}

/**
 * Agora lives in its own Postgres schema inside a project it shares with another app, so the client
 * is pinned to it. Every call is an RPC: the anon key cannot touch a table.
 */
export async function createAgoraClient() {
  const { url, key } = agoraConfig()
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(url, key, {
    db: { schema: 'agora' },
    auth: { persistSession: false },
  })
}

/** Inferred rather than annotated: the schema is part of the client's type. */
export type AgoraClient = Awaited<ReturnType<typeof createAgoraClient>>
