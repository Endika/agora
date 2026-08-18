// Criterion 6 cannot be proven in jsdom: there is no canvas. This runs the same contract against a
// real photo with sharp — under 200 KB, longest side 1600, and no EXIF left, GPS included.
//
//   npm run verify:image -- path/to/photo.jpg
import { stat } from 'node:fs/promises'
import sharp from 'sharp'

const file = process.argv[2]
if (!file) {
  console.error('usage: node scripts/verify-image.mjs <image>')
  process.exit(2)
}

const original = await stat(file)
const source = sharp(file, { failOn: 'none' }).rotate() // rotate() applies the EXIF orientation
const meta = await source.metadata()

let quality = 0.8
let output = null
// The floor matches QUALITIES in compressImage.ts: below 0.5 the app refuses instead.
while (quality >= 0.5) {
  output = await source
    .clone()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: Math.round(quality * 100) })
    .toBuffer()
  if (output.length <= 200 * 1024) break
  if (quality <= 0.5) break
  quality = Number((quality - 0.1).toFixed(1))
}

const out = await sharp(output).metadata()
const longest = Math.max(out.width, out.height)
const problems = []
if (output.length > 200 * 1024) problems.push(`still ${Math.round(output.length / 1024)} KB`)
if (longest > 1600) problems.push(`longest side ${longest}`)
if (out.exif) problems.push('EXIF survived')

console.log(
  `in  ${Math.round(original.size / 1024)} KB ${meta.width}x${meta.height}\n` +
    `out ${Math.round(output.length / 1024)} KB ${out.width}x${out.height} quality ${quality} ` +
    `${out.exif ? 'exif:present' : 'no-exif'}`,
)

if (problems.length > 0) {
  console.error(`FAIL: ${problems.join(', ')}`)
  process.exit(1)
}
console.log('OK')
