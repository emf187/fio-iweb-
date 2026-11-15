import * as fflate from 'fflate'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { deleteDoc, getDoc, putDoc } from './db'
import { uid, type DocumentItem } from './types'

/**
 * Course books — the web mirror of Android's StudyDocument feature.
 *
 * The original file (PDF/EPUB/TXT/MD) lives in IndexedDB, exactly like gallery
 * photo blobs; the extracted text lives on the DocumentItem in app state, which
 * is what backups carry (never the original bytes — same split as Android).
 * `lastReadPosition` conventions mirror the reader:
 *   PDF → zero-based page index, EPUB → ‰ (percent × 1000), TXT/MD → 0-100.
 */

export type BookFormat = 'PDF' | 'EPUB' | 'MD' | 'TXT'

/** URL of the pdf.js worker, built by Vite as a hashed asset. */
export const pdfWorkerUrl = workerUrl

export function detectFormat(name: string, mime: string): BookFormat {
  const ext = (name.toLowerCase().split('.').pop() ?? '').trim()
  if (ext === 'pdf' || mime === 'application/pdf') return 'PDF'
  if (ext === 'epub' || mime === 'application/epub+zip') return 'EPUB'
  if (ext === 'md' || ext === 'markdown' || mime === 'text/markdown') return 'MD'
  return 'TXT'
}

function mimeFor(format: BookFormat): string {
  switch (format) {
    case 'PDF': return 'application/pdf'
    case 'EPUB': return 'application/epub+zip'
    case 'MD': return 'text/markdown'
    default: return 'text/plain'
  }
}

const MAX_TEXT_CHARS = 500_000

/**
 * Extracts the plain text a book contributes to app state (AI context,
 * text-mode reading, backups). Original bytes are never modified.
 */
export async function extractText(format: BookFormat, bytes: Uint8Array): Promise<string> {
  try {
    switch (format) {
      case 'TXT':
      case 'MD':
        return new TextDecoder('utf-8').decode(bytes)
      case 'PDF':
        return await extractPdfText(bytes)
      case 'EPUB':
        return extractEpubText(bytes)
    }
  } catch {
    return '' // unreadable file — the reader still keeps the original
  }
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  // Pass a copy: getDocument may transfer the buffer to its worker.
  const task = pdfjs.getDocument({ data: bytes.slice() })
  const pdf = await task.promise
  const pages: string[] = []
  let total = 0
  try {
    const maxPages = Math.min(pdf.numPages, 400)
    for (let i = 1; i <= maxPages && total < MAX_TEXT_CHARS; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const text = content.items
        .map((item) => (item as { str?: string }).str ?? '')
        .join(' ')
        .replace(/[ \t]+/g, ' ')
        .trim()
      if (text) pages.push(text)
      total += text.length
    }
  } finally {
    void task.destroy()
  }
  return pages.join('\n\n')
}

/** Reads an EPUB in spine order and strips it down to plain text. */
function extractEpubText(bytes: Uint8Array): string {
  const files = fflate.unzipSync(bytes)
  const dec = new TextDecoder('utf-8')

  // META-INF/container.xml → OPF package path → spine order.
  const container = files['META-INF/container.xml']
  let opfPath = container ? ((dec.decode(container).match(/full-path="([^"]+)"/) ?? [])[1] ?? '') : ''
  let order: string[] = []
  if (opfPath && files[opfPath]) {
    const opf = dec.decode(files[opfPath])
    const base = opfPath.includes('/') ? opfPath.replace(/\/[^/]*$/, '/') : ''
    const manifest = new Map<string, string>()
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
  if (order.length === 0) {
    order = Object.keys(files).filter((n) => /\.x?html?$/i.test(n)).sort()
  }

  const parts: string[] = []
  let total = 0
  for (const name of order) {
    const entry = files[name] ?? files[decodeURIComponent(name)]
    if (!entry) continue
    const text = stripHtml(dec.decode(entry))
    if (text) {
      parts.push(text)
      total += text.length
    }
    if (total >= MAX_TEXT_CHARS) break
  }
  return parts.join('\n\n')
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\s*(br|\/p|\/div|\/h[1-6]|\/li)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Imports a course book: stores the original file, returns the state item. */
export async function importBook(courseId: string, file: File): Promise<DocumentItem> {
  const format = detectFormat(file.name, file.type)
  const bytes = new Uint8Array(await file.arrayBuffer())
  const title = file.name.replace(/\.[^.]+$/, '').trim() || file.name
  const content = await extractText(format, bytes)
  const now = Date.now()
  const id = uid()
  await putDoc(id, new Blob([bytes], { type: mimeFor(format) }))
  return {
    id,
    courseId,
    title,
    author: '',
    format,
    content,
    readingProgressPercent: 0,
    lastReadPosition: 0,
    loggedAtMillis: now,
    lastAccessedMillis: now,
    highlights: []
  }
}

/** Removes the stored original file for a deleted book. */
export async function deleteBookFile(id: string): Promise<void> {
  await deleteDoc(id)
}

/**
 * Builds the small AI-context chunks for a document from its full text —
 * mirrors Android's deriveDocumentChunks (600-char pieces, ids "chunk_N").
 * Kept derived (never persisted, never exported) so storage stays lean.
 */
export function deriveChunks(
  title: string,
  content: string,
  chunkSize = 600
): { id: string; title: string; text: string }[] {
  if (!content.trim()) return []
  const chunks: { id: string; title: string; text: string }[] = []
  for (let i = 0; i < content.length; i += chunkSize) {
    const n = chunks.length + 1
    chunks.push({ id: `chunk_${n}`, title: `${title} - Part ${n}`, text: content.slice(i, i + chunkSize) })
  }
  return chunks
}

/** Loads the stored original file for a book, if this device has it. */
export async function loadBookFile(id: string): Promise<Blob | null> {
  return getDoc(id)
}
