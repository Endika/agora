import { describe, it, expect } from 'vitest'
import { publicUrl } from '@/infrastructure/images/publicUrl'

describe('publicUrl', () => {
  it('construye la misma URL que getPublicUrl', () => {
    expect(publicUrl('https://abc.supabase.co', 'demoag01/p1/img.webp')).toBe(
      'https://abc.supabase.co/storage/v1/object/public/agora-images/demoag01/p1/img.webp',
    )
  })

  it('tolera una barra final en la URL del proyecto', () => {
    expect(publicUrl('https://abc.supabase.co/', 'a.webp')).toBe(
      'https://abc.supabase.co/storage/v1/object/public/agora-images/a.webp',
    )
  })
})
