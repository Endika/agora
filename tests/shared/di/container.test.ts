import { describe, it, expect, vi, afterEach } from 'vitest'
import 'fake-indexeddb/auto'

afterEach(() => {
  vi.doUnmock('@/infrastructure/persistence/SupabaseClient')
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('buildApp, when the Supabase client cannot be downloaded', () => {
  it('records the failure once, and still hands it to whoever awaits it', async () => {
    vi.resetModules()
    const cause = new Error('chunk fetch failed')
    // The seam the composition root actually uses: `createAgoraClient` is what awaits
    // `import('@supabase/supabase-js')`, so a rejection here is a failed chunk download.
    vi.doMock('@/infrastructure/persistence/SupabaseClient', async (importOriginal) => ({
      ...(await importOriginal<typeof import('@/infrastructure/persistence/SupabaseClient')>()),
      createAgoraClient: () => Promise.reject(cause),
    }))
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
    const recorded = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { buildApp } = await import('@/shared/di/container')
    const wiring = buildApp()
    expect('repo' in wiring, 'a valid env must still wire the app').toBe(true)
    if (!('repo' in wiring)) return

    // Nothing awaits the client on this tick, so without an explicit handler the rejection is an
    // unhandledrejection that no ErrorBoundary and no screen ever sees.
    await vi.waitFor(() => expect(recorded).toHaveBeenCalledTimes(1))
    expect(recorded.mock.calls[0]?.[1]).toBe(cause)

    // Recorded, not swallowed: a real caller gets the same error object, which is how the failure
    // reaches the person looking at the screen.
    await expect(wiring.repo.getVersion('abcd1234')).rejects.toBe(cause)
    expect(recorded).toHaveBeenCalledTimes(1)
  })
})
