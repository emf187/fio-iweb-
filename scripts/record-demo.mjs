// Records the landing.html #solo demo (the animated app phone) straight to a
// video file, using the locally installed Chrome in headless mode.
//
//   node scripts/record-demo.mjs [--seconds 38] [--out ../fio-demo.webm]
//
// One full demo cycle is 6 screens x 5.8s ~= 35s, so the default 38s captures
// a complete loop plus a little tail. Output is WebM (Chrome's screencast
// codec); convert to MP4 with ffmpeg for social uploads.
//
// Requires ffmpeg on PATH (winget install Gyan.FFmpeg) — Chrome's screencast
// encoder shells out to it.
import puppeteer from 'puppeteer-core'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const args = process.argv.slice(2)
const getArg = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const seconds = Number(getArg('--seconds', '38'))
const out = resolve(getArg('--out', '../../fio-demo.webm')) // default: Downloads\fio-demo.webm
const landing = resolve(fileURLToPath(new URL('../landing.html', import.meta.url)))

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--hide-scrollbars', '--force-device-scale-factor=1']
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 })
  // Reload right before recording so the demo cycle starts at screen 1.
  await page.goto(pathToFileURL(landing).href + '#solo', { waitUntil: 'load' })
  await page.evaluate(() => {
    // Deterministic start: reset to the first screen and restart its clock.
    location.hash = '#solo'
  })
  await page.reload({ waitUntil: 'load' })
  await new Promise((r) => setTimeout(r, 1500))

  const recorder = await page.screencast({ path: out })
  console.log(`recording ${seconds}s -> ${out}`)
  await new Promise((r) => setTimeout(r, seconds * 1000))
  await recorder.stop()
  console.log('done')
} finally {
  await browser.close()
}
