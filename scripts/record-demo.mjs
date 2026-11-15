// Records the landing.html #solo demo (the animated app phone) straight to a
// video file, using the locally installed Chrome in headless mode.
//
//   node scripts/record-demo.mjs [--seconds 38] [--hash solo|clip] [--p2 ms] [--p3 ms] [--out ../fio-demo.webm]
//
// #solo (default) records the phone demo cycle. #clip records the short
// brand clip — eye + name blink, API key steps, platforms card — whose
// timeline is armed via window.__startClip() right before capture
// (--pre is the settle delay after reload, in ms).
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
const hash = getArg('--hash', 'solo')
const pre = Number(getArg('--pre', '1500'))
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
  await page.goto(pathToFileURL(landing).href + '#' + hash, { waitUntil: 'load' })
  await page.evaluate((h) => { location.hash = '#' + h }, hash)
  await page.reload({ waitUntil: 'load' })
  await new Promise((r) => setTimeout(r, pre))
  // Clip mode drives its own timeline — arm it right before capture so the
  // recording catches the very first frame of the fade-in.
  if (hash === 'clip') {
    // Timings in ms — lets the music's drops drive the transitions.
    const p2 = Number(getArg('--p2', '5000'))
    const p3 = Number(getArg('--p3', '11500'))
    await page.evaluate((a, b) => window.__startClip?.({ p2: a, p3: b }), p2, p3)
  }

  const recorder = await page.screencast({ path: out })
  console.log(`recording ${seconds}s -> ${out}`)
  await new Promise((r) => setTimeout(r, seconds * 1000))
  await recorder.stop()
  console.log('done')
} finally {
  await browser.close()
}
