import type { Bitmap, ImageCodec } from './compressImage'

interface CanvasBitmap extends Bitmap {
  source: ImageBitmap
}

/**
 * The real codec. `imageOrientation: 'from-image'` applies the EXIF rotation while decoding, and
 * because everything is then re-encoded from a canvas, **every** EXIF block goes with it — including a
 * GPS position nobody meant to publish. No library needed for either half.
 */
export const BrowserImageCodec: ImageCodec = {
  async decode(file: Blob): Promise<Bitmap> {
    const source = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const bitmap: CanvasBitmap = { width: source.width, height: source.height, source }
    return bitmap
  },

  async encode(bitmap: Bitmap, width: number, height: number, quality: number): Promise<Blob> {
    const { source } = bitmap as CanvasBitmap
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('canvas is unavailable')
    context.drawImage(source, 0, 0, width, height)

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('the browser produced no image'))),
        'image/webp',
        quality,
      )
    })
  },
}
