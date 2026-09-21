import { describe, it, expect } from 'vitest'
import { SupabaseProposalImages } from '@/infrastructure/images/SupabaseProposalImages'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'
import type { AgoraClient } from '@/infrastructure/persistence/SupabaseClient'

/**
 * A client that cannot be used. Reaching for it is the failure: the Supabase module is downloaded
 * lazily, so anything that runs during render has to work without it.
 */
const unusableClient = new Proxy(
  {},
  {
    get() {
      throw new Error('urlFor reached for the Supabase client')
    },
  },
) as unknown as Promise<AgoraClient>

describe('SupabaseProposalImages.urlFor', () => {
  it('builds the public URL without touching the client', () => {
    const images = new SupabaseProposalImages(
      unusableClient,
      new InMemoryBoardRepository(),
      'https://abc.supabase.co',
    )

    expect(images.urlFor('demoag01/p1/img.webp')).toBe(
      'https://abc.supabase.co/storage/v1/object/public/agora-images/demoag01/p1/img.webp',
    )
  })
})
