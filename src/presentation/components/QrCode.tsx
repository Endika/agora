import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/**
 * Rendered as an SVG data URI rather than onto a canvas: it works without a canvas, scales to any
 * size, and keeps the app's one `dangerouslySetInnerHTML` reserved for the Markdown sanitiser.
 */
export function QrCode({ value, label }: { value: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    QRCode.toString(value, { type: 'svg', margin: 1 })
      .then((svg) => {
        if (live) setSrc(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`)
      })
      .catch(() => setSrc(null))
    return () => {
      live = false
    }
  }, [value])

  if (!src) return null
  return (
    <img
      src={src}
      alt={label}
      width={192}
      height={192}
      className="rounded-[--radius] bg-white p-2"
      style={{ background: '#ffffff' }}
    />
  )
}
