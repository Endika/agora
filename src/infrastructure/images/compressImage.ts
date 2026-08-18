import { sniffImageType } from './sniffImageType'

/** The longest side of the image kept for the detail view, and of the thumbnail for the list. */
export const FULL_MAX_SIDE = 1600
export const THUMB_MAX_SIDE = 400
export const FULL_MAX_BYTES = 200 * 1024
export const THUMB_MAX_BYTES = 30 * 1024

const QUALITIES = [0.8, 0.7, 0.6, 0.5]

export interface Bitmap {
  width: number
  height: number
}

/**
 * The two operations that need a browser, kept behind an interface so the pipeline itself can be
 * tested: jsdom has no canvas.
 */
export interface ImageCodec {
  /** Must apply EXIF orientation while decoding. */
  decode(file: Blob): Promise<Bitmap>
  /** Re-encodes to WebP at the given size, which is what drops every EXIF block including GPS. */
  encode(bitmap: Bitmap, width: number, height: number, quality: number): Promise<Blob>
}

export interface PreparedImage {
  blob: Blob
  width: number
  height: number
}

export interface PreparedPair {
  full: PreparedImage
  thumb: PreparedImage
}

function fit(bitmap: Bitmap, maxSide: number): { width: number; height: number } {
  const longest = Math.max(bitmap.width, bitmap.height)
  if (longest <= maxSide) return { width: bitmap.width, height: bitmap.height }
  const scale = maxSide / longest
  return { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) }
}

async function encodeUnder(
  codec: ImageCodec,
  bitmap: Bitmap,
  maxSide: number,
  maxBytes: number,
): Promise<PreparedImage> {
  const { width, height } = fit(bitmap, maxSide)
  let last: Blob | null = null
  for (const quality of QUALITIES) {
    const blob = await codec.encode(bitmap, width, height, quality)
    last = blob
    if (blob.size <= maxBytes) return { blob, width, height }
  }
  throw Object.assign(new Error('image too large'), { code: 'IMAGE_TOO_LARGE', bytes: last?.size })
}

/**
 * Compress in the client, before anything is uploaded: the free tier's wall is egress, and a phone
 * photo is 4 MB. Two sizes come out — the list only ever loads the thumbnail, which is the difference
 * between ~500 MB and ~50 MB of egress a month.
 *
 * Re-encoding from a decoded bitmap is also what strips the metadata: a GPS position embedded in a
 * holiday photo is personal data nobody meant to share.
 */
export async function compressImage(file: Blob, codec: ImageCodec): Promise<PreparedPair> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  if (sniffImageType(head) === null) {
    throw Object.assign(new Error('not an image we accept'), { code: 'IMAGE_TYPE' })
  }

  const bitmap = await codec.decode(file)
  const full = await encodeUnder(codec, bitmap, FULL_MAX_SIDE, FULL_MAX_BYTES)
  const thumb = await encodeUnder(codec, bitmap, THUMB_MAX_SIDE, THUMB_MAX_BYTES)
  return { full, thumb }
}
