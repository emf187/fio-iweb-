import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { Book as EpubBook, Rendition as EpubRendition } from 'epubjs'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'
import { update } from '../lib/store'
import type { DocumentItem } from '../lib/types'
import { detectFormat, extractText, pdfWorkerUrl, type BookFormat } from '../lib/docs'
import { getDoc, putDoc } from '../lib/db'
import { Empty, Markdown } from './components'
import { IconBack } from './icons'

/**
 * In-browser course-book reader — the web mirror of Android's embedded reader.
 * PDF pages render on canvas (pdf.js), EPUB uses epub.js paginated flow, and
 * TXT/MD is a scroll view. Progress saves back to the DocumentItem exactly like
 * Android: readingProgressPercent + lastReadPosition (PDF: zero-based page,
 * EPUB: ‰, TXT/MD: 0-100). Books restored from a backup come without the
 * original file — those fall back to the extracted text, and the missing-file
 * notice offers re-attaching the file onto the same book (progress and
 * highlights survive).
 */

type Progress = (lastReadPosition: number, percent: number) => void

export function BookReader({ doc, onBack }: { doc: DocumentItem; onBack: () => void }) {
  const [bytes, setBytes] = useState<Blob | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [attachNote, setAttachNote] = useState('')

  useEffect(() => {
    let alive = true
    setLoaded(false)
    void getDoc(doc.id).then((b) => {
      if (alive) {
        setBytes(b)
        setLoaded(true)
      }
    })
    return () => { alive = false }
  }, [doc.id])

  const saveProgress = useCallback<Progress>((lastReadPosition, percent) => {
    update((s) => ({
      ...s,
      documents: s.documents.map((d) => d.id === doc.id
        ? { ...d, readingProgressPercent: percent, lastReadPosition, lastAccessedMillis: Date.now() }
        : d)
    }))
  }, [doc.id])

  /**
   * Restores the original file onto this existing book — for one that arrived
   * from a backup without it. Nothing else changes: id, reading progress and
   * highlights stay; only the bytes come back (and text if the backup had none).
   */
  const attachFile = useCallback(async (file: File) => {
    const picked = detectFormat(file.name, file.type)
    if (picked !== doc.format) {
      setAttachNote(`That file is a ${picked} — this book needs its original .${doc.format.toLowerCase()} file`)
      return
    }
    try {
      // Fill in extracted text when the backup carried none, so AI keeps working.
      if (!doc.content?.trim()) {
        const text = await extractText(doc.format as BookFormat, new Uint8Array(await file.arrayBuffer()))
        if (text) {
          update((s) => ({
            ...s,
            documents: s.documents.map((d) => d.id === doc.id ? { ...d, content: text } : d)
          }))
        }
      }
      await putDoc(doc.id, file)
      setBytes(file)
      setAttachNote('')
    } catch {
      setAttachNote('Could not store that file — try again')
    }
  }, [doc.id, doc.format, doc.content])

  if (!loaded) {
    return (
      <div className="screen">
        <ReaderHeader doc={doc} onBack={onBack} percent={doc.readingProgressPercent} />
        <Empty>Loading book…</Empty>
      </div>
    )
  }

  const missingFile = !bytes && (doc.format === 'PDF' || doc.format === 'EPUB')
  const canAttach = missingFile || (!bytes && doc.content !== undefined && !doc.content.trim())

  let body: ReactNode
  if (doc.format === 'PDF' && bytes) {
    body = <PdfReader doc={doc} bytes={bytes} onProgress={saveProgress} onBack={onBack} />
  } else if (doc.format === 'EPUB' && bytes) {
    body = <EpubReader doc={doc} bytes={bytes} onProgress={saveProgress} />
  } else {
    body = (
      <TextReader
        doc={doc}
        onProgress={saveProgress}
        missingFile={missingFile}
        onAttach={canAttach ? attachFile : undefined}
        attachNote={attachNote}
      />
    )
  }

  return (
    <div className="screen">
      <ReaderHeader doc={doc} onBack={onBack} percent={doc.readingProgressPercent} />
      {body}
    </div>
  )
}

function ReaderHeader({ doc, onBack, percent }: { doc: DocumentItem; onBack: () => void; percent: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      <button className="icon-btn" onClick={onBack} aria-label="Back to course">
        <IconBack width={18} height={18} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {doc.title}
        </div>
        <div className="row-sub">{doc.format} · {percent}% read</div>
      </div>
      <div style={{ width: 64, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ width: `${percent}%`, height: '100%', background: 'var(--accent-strong)' }} />
      </div>
    </div>
  )
}

// ------------------------------------------------- PDF (pdf.js, full screen)

/**
 * The PDF reader takes over the whole screen: a slim bar on top (back + title +
 * page), the page filling everything in between, controls pinned at the bottom.
 * A fixed inset-0 overlay is used instead of the Fullscreen API so it works on
 * iPhone Safari too, which doesn't allow element.requestFullscreen.
 */
function PdfReader({ doc, bytes, onProgress, onBack }: { doc: DocumentItem; bytes: Blob; onProgress: Progress; onBack: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [page, setPage] = useState(doc.lastReadPosition + 1)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    let task: PDFDocumentLoadingTask | null = null
    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
        const buf = await bytes.arrayBuffer()
        task = pdfjs.getDocument({ data: new Uint8Array(buf) })
        const opened = await task.promise
        if (!alive) { void task.destroy(); return }
        setPdf(opened)
        setNumPages(opened.numPages)
      } catch {
        if (alive) setFailed(true)
      }
    })()
    return () => {
      alive = false
      if (task) void task.destroy()
    }
  }, [bytes])

  // Render the current page, fit to the container width.
  useEffect(() => {
    if (!pdf || !canvasRef.current || numPages === 0) return
    const current = Math.min(Math.max(1, page), numPages)
    let alive = true
    void (async () => {
      const canvas = canvasRef.current
      if (!canvas || !alive) return
      const pdfPage = await pdf.getPage(current)
      if (!alive || !canvas.isConnected) return
      const scaleOne = pdfPage.getViewport({ scale: 1 })
      const availW = Math.max(200, (canvas.parentElement?.clientWidth ?? 340) - 12)
      const scale = Math.min(availW / scaleOne.width, 2.5)
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const viewport = pdfPage.getViewport({ scale: scale * dpr })
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      canvas.style.width = `${Math.floor(scaleOne.width * scale)}px`
      canvas.style.height = `${Math.floor(scaleOne.height * scale)}px`
      const ctx = canvas.getContext('2d')
      if (!ctx || !alive) return
      await pdfPage.render({ canvas, viewport }).promise
    })()
    return () => { alive = false }
  }, [pdf, page, numPages])

  // Persist reading position on every page change.
  useEffect(() => {
    if (numPages === 0) return
    const current = Math.min(Math.max(1, page), numPages)
    onProgress(current - 1, Math.round((current / numPages) * 100))
  }, [page, numPages, onProgress])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setPage((p) => Math.max(1, p - 1))
      if (e.key === 'ArrowRight') setPage((p) => p + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const overlay: CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 55, background: 'var(--background)',
    display: 'flex', flexDirection: 'column'
  }

  const topBar = (status: string) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      padding: 'calc(10px + env(safe-area-inset-top)) 12px 8px',
      borderBottom: '1px solid var(--border)'
    }}>
      <button className="icon-btn" onClick={onBack} aria-label="Back to course">
        <IconBack width={18} height={18} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {doc.title}
        </div>
        <div className="row-sub">{status}</div>
      </div>
    </div>
  )

  if (failed) {
    return (
      <div style={overlay}>
        {topBar('Couldn\u2019t open this PDF')}
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 24 }}>
          <Empty>This PDF couldn't be opened in the browser. Try re-importing the file.</Empty>
        </div>
      </div>
    )
  }

  const clamped = numPages === 0 ? Math.max(1, page) : Math.min(Math.max(1, page), numPages)
  const percent = numPages === 0 ? 0 : Math.round((clamped / numPages) * 100)

  return (
    <div style={overlay}>
      {topBar(numPages === 0 ? 'Opening…' : `Page ${clamped} of ${numPages}`)}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex',
        justifyContent: 'center', alignItems: 'flex-start',
        background: 'var(--elevated)', padding: 6
      }}>
        <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 6, background: '#fff' }} />
      </div>
      <div style={{
        flexShrink: 0, padding: '8px 12px calc(10px + env(safe-area-inset-bottom))',
        borderTop: '1px solid var(--border)'
      }}>
        <div className="btn-row" style={{ marginTop: 0, alignItems: 'center' }}>
          <button className="btn" disabled={clamped <= 1} onClick={() => setPage(clamped - 1)}>‹ Prev</button>
          <input
            type="range" min={1} max={Math.max(1, numPages)} value={clamped}
            onChange={(e) => setPage(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent)' }}
            aria-label="Page"
          />
          <button className="btn" disabled={numPages === 0 || clamped >= numPages} onClick={() => setPage(clamped + 1)}>Next ›</button>
        </div>
        <div className="row-sub" style={{ textAlign: 'center', marginTop: 4 }}>
          {numPages === 0 ? '' : `${percent}% · arrow keys work too`}
        </div>
      </div>
    </div>
  )
}

// --------------------------------------------------------------- EPUB (epub.js)

function EpubReader({ doc, bytes, onProgress }: { doc: DocumentItem; bytes: Blob; onProgress: Progress }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const renditionRef = useRef<EpubRendition | null>(null)
  const resumeRef = useRef(doc.lastReadPosition)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [percent, setPercent] = useState(Math.round((doc.lastReadPosition || 0) / 10))

  useEffect(() => {
    let alive = true
    let book: EpubBook | null = null
    void (async () => {
      try {
        const ePub = (await import('epubjs')).default
        const host = hostRef.current
        if (!host || !alive) return
        const buf = await bytes.arrayBuffer()
        book = ePub(buf)
        const rendition = book.renderTo(host, { width: '100%', height: '100%', flow: 'paginated', spread: 'none' })
        renditionRef.current = rendition
        rendition.themes.fontSize('104%')
        await rendition.display()
        if (!alive) return
        setReady(true)
        // Locations make percentage progress (and ‰ resume) possible; build
        // them in the background so the book opens instantly.
        void book.ready.then(async () => {
          try { await book?.locations.generate(1024) } catch { /* large book — progress just stays coarse */ }
          if (!alive) return
          const resume = resumeRef.current
          if (resume > 0 && resume < 1000 && renditionRef.current) {
            try { await renditionRef.current.display(book!.locations.cfiFromPercentage(resume / 1000)) } catch { /* start from the beginning */ }
          }
        })
        rendition.on('relocated', (loc: { start?: { percentage?: number } } | undefined) => {
          const p = loc?.start?.percentage ?? 0
          if (!Number.isFinite(p) || p <= 0) return
          setPercent(Math.round(p * 100))
          onProgress(Math.round(p * 1000), Math.round(p * 100))
        })
      } catch {
        if (alive) setFailed(true)
      }
    })()
    return () => {
      alive = false
      try { renditionRef.current?.destroy() } catch { /* ignore */ }
      try { book?.destroy() } catch { /* ignore */ }
      renditionRef.current = null
    }
  }, [bytes, onProgress])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') void renditionRef.current?.prev()
      if (e.key === 'ArrowRight') void renditionRef.current?.next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (failed) {
    return <Empty>This EPUB couldn't be opened in the browser. Try re-importing the file.</Empty>
  }

  return (
    <>
      <div style={{
        height: '58dvh', background: '#fdfcf8', borderRadius: 14, overflow: 'hidden',
        border: '1px solid var(--border)', position: 'relative'
      }}>
        <div ref={hostRef} style={{ width: '100%', height: '100%' }} />
        {!ready && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="row-sub">Opening book…</span>
          </div>
        )}
      </div>
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button className="btn" disabled={!ready} onClick={() => void renditionRef.current?.prev()}>‹ Previous</button>
        <button className="btn" disabled={!ready} onClick={() => void renditionRef.current?.next()}>Next ›</button>
      </div>
      <div className="row-sub" style={{ textAlign: 'center', marginTop: 6 }}>{percent}% · arrow keys work too</div>
    </>
  )
}

// ------------------------------------------------------ TXT / MD (+ fallbacks)

const ACCEPT_FOR: Record<string, string> = {
  PDF: '.pdf',
  EPUB: '.epub',
  MD: '.md,.markdown,.txt',
  TXT: '.txt,.md'
}

function TextReader({
  doc,
  onProgress,
  missingFile,
  onAttach,
  attachNote
}: {
  doc: DocumentItem
  onProgress: Progress
  missingFile: boolean
  onAttach?: (file: File) => void
  attachNote: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastSaved = useRef(doc.lastReadPosition)
  const content = doc.content ?? ''
  // TXT/MD progress is a 0-100 scroll percent; PDF/EPUB fallbacks keep their
  // own units, so only resume the scroll position for TXT/MD.
  const resumable = doc.format === 'TXT' || doc.format === 'MD'

  useEffect(() => {
    if (!resumable || lastSaved.current <= 0) return
    const raf = requestAnimationFrame(() => {
      const el = scrollRef.current
      if (el && el.scrollHeight > el.clientHeight) {
        el.scrollTop = (el.scrollHeight - el.clientHeight) * (Math.min(100, lastSaved.current) / 100)
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [resumable, content])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el || el.scrollHeight <= el.clientHeight) return
    const pct = Math.min(100, Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100))
    if (pct !== lastSaved.current) {
      lastSaved.current = pct
      onProgress(pct, pct)
    }
  }

  const showNotice = missingFile || (!content.trim() && onAttach)

  return (
    <>
      {showNotice && (
        <div style={{ marginBottom: 8 }}>
          <Empty>
            {missingFile
              ? <>The original {doc.format} file isn't on this device — books restored from a backup come
                without the file. Showing the extracted text instead; attach the file below to get the
                full reader back (progress and highlights are kept).</>
              : <>No readable text was extracted from this file — attach the original file to fill
                this book in.</>}
          </Empty>
          {onAttach && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
              <label className="btn" style={{ cursor: 'pointer' }}>
                Attach the original .{doc.format.toLowerCase()} file
                <input
                  type="file"
                  accept={ACCEPT_FOR[doc.format] ?? ''}
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) onAttach(file)
                    e.currentTarget.value = ''
                  }}
                />
              </label>
              {attachNote && <div className="row-sub" style={{ color: 'var(--warning, #d33)' }}>{attachNote}</div>}
            </div>
          )}
        </div>
      )}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        style={{
          height: missingFile ? '50dvh' : '58dvh', overflowY: 'auto', background: 'var(--elevated)',
          borderRadius: 14, padding: '14px 16px', lineHeight: 1.65, fontSize: '0.95rem'
        }}
      >
        {content ? (
          doc.format === 'MD' ? <Markdown text={content} /> : <div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>
        ) : (
          !showNotice && <Empty>No readable text was extracted from this file.</Empty>
        )}
      </div>
      <div className="row-sub" style={{ textAlign: 'center', marginTop: 6 }}>{doc.readingProgressPercent}% read</div>
    </>
  )
}
