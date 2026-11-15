#!/usr/bin/env node
/**
 * analyze-audio.mjs — beat-drop finder for soundtracking the demo videos.
 *
 * Decodes any audio file ffmpeg can read into a dB envelope, estimates the
 * tempo, maps the track's structure, and ranks the energy jumps — the "drops"
 * a transition can land on. `--plan` turns the strongest drops into exact
 * timings plus copy-paste commands for record-demo.mjs and the merge step.
 *
 *   node scripts/analyze-audio.mjs <audio-file>
 *   node scripts/analyze-audio.mjs <audio-file> --plan [--start 20.6]
 *   node scripts/analyze-audio.mjs <audio-file> --json
 *   npm run audio -- <audio-file>
 *
 * Options
 *   --window <ms>   envelope resolution                 (default 50)
 *   --top <n>       how many drops to list              (default 16)
 *   --plan          print cut timings + record/merge commands
 *   --start <s>     music cue-in for --plan             (default: 6.5s before the first drop)
 *   --phone <s>     phone footage length for --plan     (default 32.5)
 *   --json          machine-readable output
 *   --help
 *
 * Requires ffmpeg on PATH (winget install Gyan.FFmpeg) — the same dependency
 * the recorder needs, because Chrome's screencast encoder shells out to it.
 *
 * Standalone home: https://github.com/emf187/audio-skimmer
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const SR = 22050 // decode rate: plenty for an envelope, keeps memory small
const FLOOR_DB = -90

// ---------------------------------------------------------------- arguments
const opts = { window: 50, top: 16, plan: false, json: false, start: null, phone: 32.5 }
const files = []

for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]
  if (a === '--help' || a === '-h') usage()
  else if (a === '--plan') opts.plan = true
  else if (a === '--json') opts.json = true
  else if (a === '--window') opts.window = num(process.argv[++i], '--window')
  else if (a === '--top') opts.top = Math.max(1, Math.round(num(process.argv[++i], '--top')))
  else if (a === '--start') opts.start = num(process.argv[++i], '--start')
  else if (a === '--phone') opts.phone = num(process.argv[++i], '--phone')
  else if (a.startsWith('--')) fail(`unknown option ${a} (try --help)`)
  else files.push(a)
}

if (files.length !== 1) usage(1)
const input = resolve(files[0])
if (!existsSync(input)) fail(`file not found: ${input}`)

function num(raw, flag) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) fail(`${flag} needs a positive number (got "${raw ?? ''}")`)
  return n
}

function usage(exitCode = 0) {
  console.log(`analyze-audio — find the beat drops in a track

  node scripts/analyze-audio.mjs <audio-file> [options]

Options
  --window <ms>   envelope resolution (default 50)
  --top <n>       drops to list (default 16)
  --plan          print transition timings + record/merge commands
  --start <s>     music cue-in for --plan (default: 6.5s before the first drop)
  --phone <s>     phone footage length for --plan (default 32.5)
  --json          machine-readable output
  --help

Needs ffmpeg on PATH:  winget install Gyan.FFmpeg`)
  process.exit(exitCode)
}

function fail(message) {
  console.error(`analyze-audio: ${message}`)
  process.exit(1)
}

// ----------------------------------------------------------------- decoding
/** Decode the file to mono 16-bit PCM at SR and return it as one Buffer. */
function decode(file) {
  return new Promise((ok, bad) => {
    const ff = spawn('ffmpeg', [
      '-v', 'error', '-i', file,
      '-f', 's16le', '-ac', '1', '-ar', String(SR), '-'
    ], { stdio: ['ignore', 'pipe', 'pipe'] })

    const chunks = []
    let err = ''
    ff.stdout.on('data', (c) => chunks.push(c))
    ff.stderr.on('data', (c) => { err += c.toString() })
    ff.on('error', (e) => bad(new Error(
      e.code === 'ENOENT'
        ? 'ffmpeg not found on PATH — install it with: winget install Gyan.FFmpeg'
        : e.message
    )))
    ff.on('close', (code) => {
      if (code === 0) ok(Buffer.concat(chunks))
      else bad(new Error(err.trim() || `ffmpeg exited with code ${code}`))
    })
  })
}

// ---------------------------------------------------------------- envelope
/** Windowed RMS in dB, one entry per `ms` of audio. */
function envelope(pcm, ms) {
  const win = Math.max(1, Math.round(SR * ms / 1000))
  const env = []
  for (let off = 0; off + 2 <= pcm.length; off += win * 2) {
    const end = Math.min(off + win * 2, pcm.length)
    let sum = 0
    let n = 0
    for (let i = off; i + 1 < end; i += 2) {
      const s = pcm.readInt16LE(i) / 32768
      sum += s * s
      n++
    }
    const rms = Math.sqrt(sum / Math.max(1, n))
    env.push({ t: off / 2 / SR, db: Math.max(FLOOR_DB, 20 * Math.log10(Math.max(rms, 1e-6))) })
  }
  return env
}

/**
 * Rise over the previous half second. Comparing against a fixed lookback
 * rather than the previous window keeps a single drum hit from looking like a
 * drop — only sustained jumps score high.
 */
function onsets(env, step) {
  const back = Math.max(1, Math.round(0.5 / step))
  return env.map((e, i) => ({
    t: e.t,
    db: e.db,
    rise: e.db - env[Math.max(0, i - back)].db
  }))
}

// ------------------------------------------------------------------- tempo
/** Autocorrelation of positive onset strength over 50–200 BPM lags. */
function tempo(on, step) {
  let best = { lag: 0, score: -1 }
  for (let lag = Math.max(2, Math.round(0.3 / step)); lag <= Math.round(1.2 / step); lag++) {
    let score = 0
    for (let i = lag; i < on.length; i++) score += Math.max(0, on[i].rise) * Math.max(0, on[i - lag].rise)
    if (score > best.score) best = { lag, score }
  }
  const beat = best.lag * step
  return beat > 0 ? { bpm: 60 / beat, beat } : null
}

// ------------------------------------------------------------------- drops
/** Strongest rises, greedily thinned so one musical event lists once. */
function findDrops(on, top) {
  const peaks = on.filter((x) => x.rise >= 5).sort((a, b) => b.rise - a.rise)
  const picked = []
  for (const p of peaks) {
    if (picked.every((q) => Math.abs(q.t - p.t) >= 0.5)) picked.push(p)
    if (picked.length >= top) break
  }
  return picked.sort((a, b) => a.t - b.t)
}

/** Mean level per block of `size` seconds — the track's shape at a glance. */
function structure(env, size = 4) {
  const blocks = []
  for (let t = 0; t < env.at(-1).t; t += size) {
    const win = env.filter((e) => e.t >= t && e.t < t + size)
    blocks.push({ t, db: win.reduce((a, e) => a + e.db, 0) / Math.max(1, win.length) })
  }
  return blocks
}

/**
 * Musical events, not raw transients: a roll-in and the hit it leads into are
 * one event. Merge onsets within `gap` seconds, keeping the loudest moment as
 * the impact time and the strongest rise as the event's strength.
 */
function cluster(drops, gap = 1.4) {
  const out = []
  for (const d of [...drops].sort((a, b) => a.t - b.t)) {
    const last = out.at(-1)
    if (last && d.t - last.t <= gap) {
      last.rise = Math.max(last.rise, d.rise)
      if (d.db > last.db) { last.db = d.db; last.t = d.t }
    } else {
      out.push({ ...d })
    }
  }
  return out
}

// ------------------------------------------------------------------ output
const meter = (db) => {
  const n = Math.max(0, Math.min(12, Math.round(((db + 60) / 60) * 12)))
  return '█'.repeat(n) + '░'.repeat(12 - n)
}
const pad = (n, width) => String(n).padStart(width)

function report(env, on, bpmInfo, drops, blocks) {
  const span = env.at(-1).t
  console.log(`\n${input}`)
  console.log(`${span.toFixed(2)}s of audio · ${(env.length / span || 0).toFixed(0)} windows/s`)
  if (bpmInfo) {
    const half = bpmInfo.bpm < 65 ? ' (half-time feel)' : ''
    console.log(`tempo ≈ ${bpmInfo.bpm.toFixed(1)} BPM${half} · beat every ${bpmInfo.beat.toFixed(3)}s`)
  }

  console.log('\nstructure (4s blocks, mean level)')
  let line = ''
  for (const b of blocks) {
    line += ` ${pad(b.t, 3)}s ${pad(b.db.toFixed(0), 3)} ${meter(b.db)} `
    if (line.length > 150) { console.log(line); line = '' }
  }
  if (line) console.log(line)

  console.log('\ndrops (rise over the previous half second)')
  for (const d of drops) {
    console.log(`  ${d.t.toFixed(2).padStart(7)}s  +${d.rise.toFixed(1).padStart(4)} dB  ${meter(d.db)}`)
  }
  console.log('')
}

/**
 * Turn the strongest drops into a three-transition cut and print the exact
 * commands. Close pairs (roll-in + hit) resolve to the stronger one so the
 * cut lands on the hit, not the fill before it.
 */
function plan(drops, songFile) {
  const events = cluster(drops)
  const best = (from, to) => events
    .filter((d) => d.t >= from && d.t <= to)
    .sort((a, b) => b.rise - a.rise)[0]

  const d1 = best(8, 40)
  if (!d1) fail('no drops found in the 8–40s range — try --start with a manual cue-in')
  const d2 = best(d1.t + 4, d1.t + 12)
  // The platforms card holds 2.5–6.5s, so its exit is the next accent in
  // that window — not the strongest one anywhere nearby.
  const d3 = best((d2 ?? d1).t + 2.5, (d2 ?? d1).t + 6.5)
  if (!d2 || !d3) fail('could not find three well-spaced drops — pass a different track or edit the plan by hand')

  const start = opts.start ?? Math.max(0, d1.t - 6.5)
  const p2 = Math.round((d1.t - start) * 1000)
  const p3 = Math.round((d2.t - start) * 1000)
  const clipDur = +(d3.t - start).toFixed(2)
  const fade = 1 // xfade duration
  const offset = +(clipDur - fade).toFixed(2)
  const total = +(offset + opts.phone).toFixed(2)

  console.log('cut plan')
  console.log(`  music cue-in ${start.toFixed(2)}s`)
  console.log(`  0.00–${(p2 / 1000).toFixed(2)}s`.padEnd(18) + `eye + name        (drop at ${d1.t.toFixed(2)}s)`)
  console.log(`  ${(p2 / 1000).toFixed(2)}–${(p3 / 1000).toFixed(2)}s`.padEnd(18) + `API key steps     (accent at ${d2.t.toFixed(2)}s)`)
  console.log(`  ${(p3 / 1000).toFixed(2)}–${offset.toFixed(2)}s`.padEnd(18) + `platforms card    (hit at ${d3.t.toFixed(2)}s)`)
  console.log(`  ${offset.toFixed(2)}–${clipDur.toFixed(2)}s`.padEnd(18) + 'dissolve into the phone')
  console.log(`  ${clipDur.toFixed(2)}–${total.toFixed(2)}s`.padEnd(18) + `phone UI · total ${total.toFixed(2)}s`)

  const clipSecs = (clipDur + 0.22).toFixed(2)
  const phoneSecs = Math.ceil(opts.phone + 3.5)
  console.log('\n1) record the clip')
  console.log(`   node scripts/record-demo.mjs --hash clip --seconds ${clipSecs} --pre 400 --p2 ${p2} --p3 ${p3} --out $env:TEMP\\fio-clip.webm`)
  console.log('\n2) record the phone (skip if you already have a capture)')
  console.log(`   node scripts/record-demo.mjs --hash solo --seconds ${phoneSecs} --out $env:TEMP\\fio-phone.webm`)
  console.log('\n3) merge + soundtrack')
  console.log(
    `   ffmpeg -y -i "$env:TEMP\\fio-clip.webm" -i "$env:TEMP\\fio-phone.webm" -ss ${start.toFixed(2)} -i "${songFile}" ` +
    `-filter_complex "[0:v]fps=30,trim=0:${clipDur},setpts=PTS-STARTPTS[a];[1:v]fps=30,trim=0:${opts.phone},setpts=PTS-STARTPTS[b];` +
    `[a][b]xfade=transition=fade:duration=${fade}:offset=${offset},format=yuv420p[vv];` +
    `[vv]fade=t=out:st=${(total - 1).toFixed(2)}:d=1.0[vout];` +
    `[2:a]afade=t=in:st=0:d=0.5,afade=t=out:st=${(total - 2).toFixed(2)}:d=2.0[aud]" ` +
    `-map "[vout]" -map "[aud]" -t ${total} -c:v libx264 -preset medium -crf 20 -c:a aac -b:a 192k -movflags +faststart out.mp4`
  )
  console.log('')
}

// -------------------------------------------------------------------- main
const pcm = await decode(input).catch((e) => fail(e.message))
const step = opts.window / 1000
const env = envelope(pcm, opts.window)
if (env.length < 10) fail('the decoded audio was too short to analyze')

const on = onsets(env, step)
const bpmInfo = tempo(on, step)
const drops = findDrops(on, opts.top)
const blocks = structure(env)

if (opts.json) {
  console.log(JSON.stringify({
    file: input,
    duration: +env.at(-1).t.toFixed(2),
    tempo: bpmInfo && { bpm: +bpmInfo.bpm.toFixed(1), beat: +bpmInfo.beat.toFixed(3) },
    drops: drops.map((d) => ({ t: +d.t.toFixed(2), rise: +d.rise.toFixed(1), db: +d.db.toFixed(1) })),
    blocks: blocks.map((b) => ({ t: b.t, meanDb: +b.db.toFixed(1) }))
  }, null, 2))
} else {
  report(env, on, bpmInfo, drops, blocks)
  if (opts.plan) plan(drops, input)
}
