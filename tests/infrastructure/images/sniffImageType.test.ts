import { describe, it, expect } from 'vitest'
import { sniffImageType } from '@/infrastructure/images/sniffImageType'

const bytes = (...values: number[]) => new Uint8Array(values)

describe('sniffImageType', () => {
  it('reads the real type from the first bytes', () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg')
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('png')
    expect(sniffImageType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe(
      'webp',
    )
  })

  it('refuses an svg, whatever the file is called', () => {
    expect(sniffImageType(bytes(0x3c, 0x73, 0x76, 0x67))).toBeNull()
  })

  it('refuses a RIFF container that is not WEBP, like a wav', () => {
    expect(
      sniffImageType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45)),
    ).toBeNull()
  })
})
