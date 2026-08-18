export type ImageType = 'jpeg' | 'png' | 'webp'

const starts = (bytes: Uint8Array, signature: number[], offset = 0): boolean =>
  signature.every((byte, index) => bytes[offset + index] === byte)

/**
 * What the file actually is, read from its first bytes. Never the extension and never the browser's
 * `Content-Type`: both are whatever the sender says they are, and an SVG renamed to .png is the
 * classic way to smuggle a script into an image slot.
 */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  if (starts(bytes, [0xff, 0xd8, 0xff])) return 'jpeg'
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  // RIFF....WEBP
  if (starts(bytes, [0x52, 0x49, 0x46, 0x46]) && starts(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'webp'
  }
  return null
}
