// Embeds the four Gallery demo tiles into landing.html as inline SVG
// "study photos" (paper, ink, whiteboard, exam sheet — drawn to read like
// real saved pictures at thumbnail size). Idempotent: skips if already
// embedded. Run: node scripts/gen-gallery.mjs
import { readFile, writeFile } from 'node:fs/promises'

const uri = (svg) => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)

// Shared photo feel: soft vignette so flat art reads like a snapshot.
const vignette =
  '<defs><radialGradient id="vg" cx="50%" cy="42%" r="80%">' +
  '<stop offset="0.55" stop-color="#000" stop-opacity="0"/>' +
  '<stop offset="1" stop-color="#000" stop-opacity="0.22"/>' +
  '</radialGradient></defs><rect width="220" height="220" fill="url(#vg)"/>'

const svgHeart =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220">' +
  '<rect width="220" height="220" fill="#f5efdf"/>' +
  '<g stroke="#e6dcc2" stroke-width="1">' +
  Array.from({ length: 10 }, (_, i) => `<line x1="14" y1="${30 + i * 19}" x2="206" y2="${30 + i * 19}"/>`).join('') +
  '</g>' +
  '<line x1="34" y1="10" x2="34" y2="212" stroke="#e26d5c" stroke-width="1.4" opacity="0.7"/>' +
  '<path d="M112 158 C 50 114, 62 50, 112 84 C 162 50, 174 114, 112 158 Z" fill="#c0392b"/>' +
  '<path d="M112 84 C 102 64, 124 56, 132 66 L 134 50" stroke="#8e2b20" stroke-width="7" fill="none" stroke-linecap="round"/>' +
  '<path d="M96 100 L 74 88 M128 104 L 152 96" stroke="#8e2b20" stroke-width="5" stroke-linecap="round"/>' +
  '<g stroke="#57534e" stroke-width="1" font-family="Segoe UI, sans-serif" font-size="9" fill="#57534e">' +
  '<line x1="150" y1="60" x2="184" y2="52"/><text x="158" y="48">aorta</text>' +
  '<line x1="80" y1="128" x2="46" y2="140"/><text x="22" y="150">left</text>' +
  '</g>' +
  '<text x="132" y="176" font-family="Segoe UI, sans-serif" font-size="10" fill="#7c6f5a" font-style="italic">Fig. 4 — circulation</text>' +
  vignette + '</svg>'

const svgNotes =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220">' +
  '<rect width="220" height="220" fill="#fffdf6"/>' +
  '<g stroke="#dce4f0" stroke-width="1">' +
  Array.from({ length: 10 }, (_, i) => `<line x1="10" y1="${34 + i * 19}" x2="210" y2="${34 + i * 19}"/>`).join('') +
  '</g>' +
  '<line x1="30" y1="8" x2="30" y2="214" stroke="#f0a5a0" stroke-width="1.4" opacity="0.8"/>' +
  '<text x="40" y="62" font-family="Comic Sans MS, Segoe Script, cursive" font-size="15" fill="#1d4ed8">∫ x² dx = x³/3 + C</text>' +
  '<path d="M40 72 q 30 6 96 2" stroke="#1d4ed8" stroke-width="1.6" fill="none"/>' +
  '<text x="40" y="104" font-family="Comic Sans MS, Segoe Script, cursive" font-size="12" fill="#312e81">area under curve →</text>' +
  '<path d="M40 118 q 44 -8 88 -2 q 30 4 52 -4" stroke="#312e81" stroke-width="1.4" fill="none"/>' +
  '<g stroke="#334155" stroke-width="1.2" fill="none">' +
  '<path d="M140 150 h 52 M148 142 v 58"/>' +
  '<path d="M148 196 C 160 168, 176 158, 190 150"/>' +
  '</g>' +
  '<path d="M40 148 q 26 -10 52 0 t 52 0" stroke="#1d4ed8" stroke-width="1.4" fill="none"/>' +
  vignette + '</svg>'

const svgBoard =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220">' +
  '<rect width="220" height="220" fill="#d7dde5"/>' +
  '<rect x="10" y="10" width="200" height="176" rx="6" fill="#f2f5f9" stroke="#aab3bf" stroke-width="5"/>' +
  '<rect x="70" y="192" width="80" height="7" rx="3.5" fill="#9aa3ae"/>' +
  '<text x="22" y="46" font-family="Segoe UI, sans-serif" font-weight="600" font-size="13" fill="#2563eb">fib(n) = fib(n−1) + fib(n−2)</text>' +
  '<text x="22" y="80" font-family="Segoe UI, sans-serif" font-weight="700" font-size="15" fill="#111827">O(2ⁿ) → O(n)</text>' +
  '<path d="M22 88 H 132" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round"/>' +
  '<g stroke="#334155" stroke-width="1.3">' +
  '<path d="M96 108 L 68 132 M96 108 L 124 132 M68 132 L 52 156 M68 132 L 84 156 M124 132 L 108 156 M124 132 L 140 156"/>' +
  '</g>' +
  '<g fill="#fff" stroke="#334155" stroke-width="1.3" font-family="Segoe UI, sans-serif" font-size="9" fill-opacity="1">' +
  '<circle cx="96" cy="106" r="9"/><text x="92" y="109" stroke="none" fill="#334155">n</text>' +
  '<circle cx="68" cy="134" r="9"/><text x="64" y="137" stroke="none" fill="#334155">n-1</text>' +
  '<circle cx="124" cy="134" r="9"/><text x="120" y="137" stroke="none" fill="#334155">n-2</text>' +
  '<circle cx="52" cy="158" r="8"/>' +
  '<circle cx="84" cy="158" r="8"/>' +
  '<circle cx="108" cy="158" r="8"/>' +
  '<circle cx="140" cy="158" r="8"/>' +
  '</g>' +
  '<circle cx="192" cy="24" r="5" fill="#94a3b8"/>' +
  vignette + '</svg>'

const svgExam =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220">' +
  '<rect width="220" height="220" fill="#e9e2d3"/>' +
  '<g transform="rotate(-3 110 110)">' +
  '<rect x="40" y="24" width="150" height="176" rx="3" fill="#000" opacity="0.12"/>' +
  '<rect x="36" y="20" width="150" height="176" rx="3" fill="#fff" stroke="#d8d4cb"/>' +
  '<rect x="46" y="30" width="130" height="15" rx="2" fill="#1f2937"/>' +
  '<text x="52" y="41" font-family="Segoe UI, sans-serif" font-weight="700" font-size="8.5" fill="#fff" letter-spacing="1">PAST PAPER · UNIT 4</text>' +
  '<g fill="#c9cdd4">' +
  '<rect x="46" y="56" width="118" height="5" rx="2.5"/>' +
  '<rect x="46" y="66" width="96" height="5" rx="2.5"/>' +
  '<rect x="46" y="76" width="110" height="5" rx="2.5"/>' +
  '</g>' +
  '<g stroke="#64748b" stroke-width="1.2" fill="none">' +
  '<circle cx="52" cy="98" r="5"/><circle cx="52" cy="116" r="5"/>' +
  '<circle cx="52" cy="134" r="5"/>' +
  '</g>' +
  '<circle cx="52" cy="134" r="5" fill="#16a34a"/>' +
  '<path d="M49.5 134 l 2 2.5 l 4 -5" stroke="#fff" stroke-width="1.4" fill="none"/>' +
  '<g fill="#c9cdd4">' +
  '<rect x="62" y="95" width="84" height="5" rx="2.5"/>' +
  '<rect x="62" y="113" width="70" height="5" rx="2.5"/>' +
  '<rect x="62" y="131" width="90" height="5" rx="2.5"/>' +
  '</g>' +
  '<path d="M46 156 q 40 -6 120 0" stroke="#94a3b8" stroke-width="1" fill="none" opacity="0.6"/>' +
  '</g>' +
  '<g transform="rotate(9 110 196)">' +
  '<rect x="52" y="190" width="118" height="10" rx="5" fill="#f59e0b"/>' +
  '<rect x="52" y="190" width="12" height="10" rx="4" fill="#f472b6"/>' +
  '<path d="M170 190 l 14 5 l -14 5 Z" fill="#e7e5e4"/>' +
  '<path d="M181 193.5 l 3 1.5 l -3 1.5 Z" fill="#57534e"/>' +
  '</g>' +
  vignette + '</svg>'

const uris = [uri(svgHeart), uri(svgNotes), uri(svgBoard), uri(svgExam)]

let html = await readFile('landing.html', 'utf8')
if (!html.includes('__GAL1__')) {
  console.log('landing.html already has gallery tiles embedded — nothing to do')
} else {
  for (let i = 0; i < 4; i++) html = html.replaceAll(`__GAL${i + 1}__`, uris[i])
  await writeFile('landing.html', html)
  console.log('embedded 4 SVG study tiles into landing.html')
}
