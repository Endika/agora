import { describe, it, expect } from 'vitest'
import { compressImage, type Bitmap, type ImageCodec } from '@/infrastructure/images/compressImage'

const JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0]

function jpeg(width: number, height: number): Blob {
  return new Blob([new Uint8Array([...JPEG_HEAD, ...new Array(64).fill(0)])], {
    type: 'image/jpeg',
  })
}

/** An in-memory codec: no canvas, and the byte count is a function we control. */
function fakeCodec(bytesAt: (quality: number, width: number) => number, bitmap: Bitmap) {
  const encodes: { width: number; quality: number }[] = []
  const codec: ImageCodec = {
    decode: async () => bitmap,
    encode: async (_bitmap, width, height, quality) => {
      encodes.push({ width, quality })
      return new Blob([new Uint8Array(bytesAt(quality, width))], { type: 'image/webp' })
    },
  }
  return { codec, encodes }
}

describe('compressImage', () => {
  it('caps the longest side at 1600 and keeps the aspect ratio', async () => {
    // Bytes scale with the width, the way a real encoder behaves: the thumbnail has to fit too.
    const { codec } = fakeCodec((_q, width) => width * 60, { width: 4000, height: 3000 })
    const { full } = await compressImage(jpeg(4000, 3000), codec)
    expect(full.width).toBe(1600)
    expect(full.height).toBe(1200)
  })

  it('produces a thumbnail the list can afford', async () => {
    const { codec } = fakeCodec((_q, width) => (width > 400 ? 150_000 : 20_000), {
      width: 4000,
      height: 3000,
    })
    const { thumb } = await compressImage(jpeg(4000, 3000), codec)
    expect(thumb.width).toBe(400)
    expect(thumb.blob.size).toBeLessThanOrEqual(30 * 1024)
  })

  it('steps the quality down and then gives up, instead of uploading 900 KB', async () => {
    const { codec, encodes } = fakeCodec((quality) => Math.round(900_000 * quality), {
      width: 2000,
      height: 2000,
    })
    await expect(compressImage(jpeg(2000, 2000), codec)).rejects.toThrow(/too large/i)
    expect(encodes.map((e) => e.quality)).toEqual([0.8, 0.7, 0.6, 0.5])
  })

  it('leaves a small image alone rather than upscaling it', async () => {
    const { codec } = fakeCodec(() => 20_000, { width: 320, height: 200 })
    // 320 px is under both caps, so both sizes come out at the original dimensions.
    const { full } = await compressImage(jpeg(320, 200), codec)
    expect(full.width).toBe(320)
    expect(full.height).toBe(200)
  })

  it('refuses anything that is not really an image', async () => {
    const { codec } = fakeCodec(() => 1000, { width: 10, height: 10 })
    const svg = new Blob([new Uint8Array([0x3c, 0x73, 0x76, 0x67])], { type: 'image/png' })
    await expect(compressImage(svg, codec)).rejects.toThrow(/not an image/i)
  })
})
