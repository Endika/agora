// Renders assets/icon.svg into the PWA icon set, so the PNGs are reproducible from source instead
// of being opaque binaries in the repo.
import { readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const svg = readFileSync('assets/icon.svg')

const outputs = [
  { file: 'public/icon-192.png', size: 192 },
  { file: 'public/icon-512.png', size: 512 },
  { file: 'public/apple-touch-icon.png', size: 180 },
]

for (const { file, size } of outputs) {
  await sharp(svg).resize(size, size).png().toFile(file)
  console.log(`${file} ${size}x${size}`)
}

// Maskable needs ~10% safe-area padding: Android crops it to a circle.
const inner = Math.round(512 * 0.8)
const padded = await sharp(svg)
  .resize(inner, inner)
  .extend({
    top: (512 - inner) / 2,
    bottom: (512 - inner) / 2,
    left: (512 - inner) / 2,
    right: (512 - inner) / 2,
    background: '#151A18',
  })
  .png()
  .toBuffer()
writeFileSync('public/icon-maskable-512.png', padded)
console.log('public/icon-maskable-512.png 512x512 (maskable)')

// favicon.ico: a 32px PNG payload is accepted by every current browser.
const ico = await sharp(svg).resize(32, 32).png().toBuffer()
writeFileSync('public/favicon.ico', ico)
console.log('public/favicon.ico 32x32')
