/**
 * Generates PWA icon PNGs from public/icons/icon.svg using sharp:
 *   icon-192.png, icon-512.png, maskable-512.png (extra padding, solid bg),
 *   apple-touch-icon.png (180, no transparency).
 * Run: npm run icons
 */
import { mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const iconsDir = join(here, '..', 'public', 'icons')
const svgPath = join(iconsDir, 'icon.svg')

await mkdir(iconsDir, { recursive: true })
const svg = await readFile(svgPath)

await sharp(svg, { density: 300 }).resize(192, 192).png().toFile(join(iconsDir, 'icon-192.png'))
await sharp(svg, { density: 300 }).resize(512, 512).png().toFile(join(iconsDir, 'icon-512.png'))

// Maskable: the safe zone is the inner 80% — render the full-bleed canvas on a
// solid background so any launcher mask keeps the mark visible.
const maskable = await sharp(svg, { density: 300 })
  .resize(420, 420)
  .png()
  .toBuffer()
await sharp({
  create: { width: 512, height: 512, channels: 4, background: { r: 0x0b, g: 0x0b, b: 0x0c, alpha: 1 } }
})
  .composite([{ input: maskable, gravity: 'centre' }])
  .png()
  .toFile(join(iconsDir, 'maskable-512.png'))

// Apple touch icon: opaque background, 180px.
const square = await sharp(svg, { density: 300 }).resize(180, 180).png().toBuffer()
await sharp({
  create: { width: 180, height: 180, channels: 4, background: { r: 0x0b, g: 0x0b, b: 0x0c, alpha: 1 } }
})
  .composite([{ input: square, gravity: 'centre' }])
  .png()
  .toFile(join(iconsDir, 'apple-touch-icon.png'))

console.log('Icons written to public/icons')
