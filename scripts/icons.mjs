/**
 * Generates the PWA icon set from the Android app's pixel eye
 * (scripts/fio-eye.png — white pixel-art eye on transparency).
 *
 * Outputs (public/icons):
 *   icon.svg            favicon — rounded dark tile with the eye embedded
 *   icon-192.png        manifest icon
 *   icon-512.png        manifest icon
 *   maskable-512.png    full-bleed safe-zone version for launcher masks
 *   apple-touch-icon.png 180px, opaque (iOS home screen)
 *
 * Run: npm run icons
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const iconsDir = join(here, '..', 'public', 'icons')
const eyePath = join(here, 'fio-eye.png')
const BG = '#0B0B0C'

await mkdir(iconsDir, { recursive: true })

// Trim the transparent padding so the eye itself fills the tile.
const trimmed = await sharp(await readFile(eyePath))
  .trim({ threshold: 8 })
  .png()
  .toBuffer()

// Pixel art must scale with nearest-neighbour to stay crisp.
async function mark(size, ratio) {
  const target = Math.max(8, Math.round(size * ratio))
  return sharp(trimmed)
    .resize(target, target, {
      fit: 'contain',
      kernel: 'nearest',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer()
}

async function tile(size, ratio, radius) {
  const eye = await mark(size, ratio)
  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<rect width="${size}" height="${size}" rx="${radius}" fill="${BG}"/></svg>`
  )
  return sharp(bg).composite([{ input: eye, gravity: 'center' }]).png().toBuffer()
}

await writeFile(join(iconsDir, 'icon-192.png'), await tile(192, 0.55, 44))
await writeFile(join(iconsDir, 'icon-512.png'), await tile(512, 0.55, 112))
// Maskable: keep the mark inside the central safe zone so any mask keeps it visible.
await writeFile(join(iconsDir, 'maskable-512.png'), await tile(512, 0.44, 0))
await writeFile(join(iconsDir, 'apple-touch-icon.png'), await tile(180, 0.55, 0))

// Favicon: the eye embedded in a rounded tile so it renders without extra files.
const faviconB64 = (await mark(320, 1)).toString('base64')
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
  `<rect width="512" height="512" rx="112" fill="${BG}"/>` +
  `<image href="data:image/png;base64,${faviconB64}" x="96" y="96" width="320" height="320" image-rendering="pixelated"/>` +
  `</svg>`
await writeFile(join(iconsDir, 'icon.svg'), svg)

console.log('Icons written to public/icons (pixel eye)')
