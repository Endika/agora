import { createClient } from '@supabase/supabase-js'

/**
 * Agora lives in its own Postgres schema inside a project it shares with another app, so the client
 * is pinned to it. Every call is an RPC: the anon key cannot touch a table.
 */
export function createAgoraClient() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required')
  return createClient(url, key, {
    db: { schema: 'agora' },
    auth: { persistSession: false },
  })
}

/** Inferred rather than annotated: the schema is part of the client's type. */
export type AgoraClient = ReturnType<typeof createAgoraClient>
