import { describe, it, expect } from 'vitest'
import { SupabaseBoardRepository } from '@/infrastructure/persistence/SupabaseBoardRepository'
import type { AgoraClient } from '@/infrastructure/persistence/SupabaseClient'

describe('SupabaseBoardRepository', () => {
  it('is usable before its client exists, and calls it once it does', async () => {
    const calls: string[] = []
    let arrive: (client: AgoraClient) => void = () => {}
    const client = new Promise<AgoraClient>((resolve) => {
      arrive = resolve
    })

    // Constructed against a client that has not been downloaded yet: this is what lets the cached
    // board paint before @supabase/supabase-js has arrived.
    const repo = new SupabaseBoardRepository(
      client,
      () => 'device-token',
      () => 'slug1234',
    )
    const pending = repo.getVersion('abcd1234')
    expect(calls).toEqual([])

    arrive({
      rpc: (name: string) => {
        calls.push(name)
        return Promise.resolve({ data: { version: 'v7', proposals: 3 }, error: null })
      },
    } as unknown as AgoraClient)

    expect(await pending).toBe('v7')
    expect(calls).toEqual(['get_board_version'])
  })
})
