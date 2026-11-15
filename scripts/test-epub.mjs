// Smoke test: build a minimal EPUB with fflate, run the same spine-parsing +
// strip logic as src/lib/docs.ts, and check deriveChunks parity.
import * as fflate from 'fflate'

const dec = new TextDecoder('utf-8')

function stripHtml(html) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\s*(br|\/p|\/div|\/h[1-6]|\/li)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractEpubText(bytes) {
  const files = fflate.unzipSync(bytes)
  const container = files['META-INF/container.xml']
  let opfPath = container ? ((dec.decode(container).match(/full-path="([^"]+)"/) ?? [])[1] ?? '') : ''
  let order = []
  if (opfPath && files[opfPath]) {
    const opf = dec.decode(files[opfPath])
    const base = opfPath.includes('/') ? opfPath.replace(/\/[^/]*$/, '/') : ''
    const manifest = new Map()
    for (const m of opf.matchAll(/<item\b[^>]*>/g)) {
      const id = m[0].match(/\bid="([^"]+)"/)?.[1]
      const href = m[0].match(/\bhref="([^"]+)"/)?.[1]
      if (id && href && /xhtml|html|xml/i.test(m[0])) manifest.set(id, href)
    }
    for (const m of opf.matchAll(/<itemref\b[^>]*>/g)) {
      const idref = m[0].match(/\bidref="([^"]+)"/)?.[1]
      const href = idref ? manifest.get(idref) : undefined
      if (href) order.push(base + href)
    }
  }
  if (order.length === 0) order = Object.keys(files).filter((n) => /\.x?html?$/i.test(n)).sort()
  const parts = []
  for (const name of order) {
    const entry = files[name] ?? files[decodeURIComponent(name)]
    if (!entry) continue
    const text = stripHtml(dec.decode(entry))
    if (text) parts.push(text)
  }
  return parts.join('\n\n')
}

// --- synthetic EPUB: OEBPS/content.opf, spine out of manifest order on purpose
const chapter1 = '<html><head><style>p{color:red}</style></head><body><h1>Chapter One</h1><p>First &amp; foremost.</p><p>Line&#39;s with <b>entities</b> &mdash; ok &lt;here&gt;.</p><script>alert("no")</script></body></html>'
const chapter2 = '<html><body><p>Chapter two begins</p><br><p>after a break</p></body></html>'
const zip = {
  'mimetype': new TextEncoder().encode('application/epub+zip'),
  'META-INF/container.xml': new TextEncoder().encode(
    '<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
  ),
  'OEBPS/content.opf': new TextEncoder().encode(
    '<?xml version="1.0"?><package><manifest>' +
    '<item id="c2" href="chap2.xhtml" media-type="application/xhtml+xml"/>' +
    '<item id="c1" href="chap1.xhtml" media-type="application/xhtml+xml"/>' +
    '</manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>'
  ),
  'OEBPS/chap1.xhtml': new TextEncoder().encode(chapter1),
  'OEBPS/chap2.xhtml': new TextEncoder().encode(chapter2)
}
const epubBytes = fflate.zipSync(zip)

const text = extractEpubText(epubBytes)
console.log('--- extracted text ---')
console.log(text)
console.log('--- assertions ---')
const ok =
  text.includes('Chapter One') &&
  text.includes("First & foremost.") &&
  text.includes("Line's with") &&
  text.includes('entities') &&
  text.includes('<here>') &&
  !text.includes('alert') &&
  !text.includes('color:red') &&
  text.indexOf('Chapter One') < text.indexOf('Chapter two begins')
console.log(ok ? 'PASS: spine order + strip + entities + script/style removal' : 'FAIL')

// --- deriveChunks parity with Android chunked(600)
function deriveChunks(title, content, chunkSize = 600) {
  if (!content.trim()) return []
  const chunks = []
  for (let i = 0; i < content.length; i += chunkSize) {
    const n = chunks.length + 1
    chunks.push({ id: `chunk_${n}`, title: `${title} - Part ${n}`, text: content.slice(i, i + chunkSize) })
  }
  return chunks
}
const ch = deriveChunks('Big Book', 'x'.repeat(1450))
console.log(ch.length === 3 && ch[0].id === 'chunk_1' && ch[0].text.length === 600 && ch[2].text.length === 250
  ? 'PASS: chunks 1450 chars → 3 pieces (600/600/250), ids chunk_N'
  : 'FAIL: chunk derivation mismatch')
