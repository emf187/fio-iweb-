// One-off: converts scripts/fio-eye.png into a 42x29 brightness grid (base64)
// used by landing.html to render the animated pixel eye on a canvas.
import sharp from 'sharp'
import { readFile, writeFile } from 'node:fs/promises'

const { data, info } = await sharp('scripts/fio-eye.png')
  .trim({ threshold: 8 })
  .resize(42, 29, { fit: 'contain', kernel: 'nearest', background: '#000000' })
  .greyscale()
  .raw()
  .toBuffer({ resolveWithObject: true })

await writeFile('scripts/eye-grid.txt', Buffer.from(data).toString('base64'))
console.log('grid', info.width, 'x', info.height, 'bytes', data.length)
