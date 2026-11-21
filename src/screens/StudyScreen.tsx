import { useEffect, useMemo, useRef, useState } from 'react'
import { useFio, update } from '../lib/store'
import { uid, type ChatMessage, type DocumentItem, type Flashcard } from '../lib/types'
import { sendPrompt } from '../lib/ai'
import { importBook, deleteBookFile } from '../lib/docs'
import { getDoc } from '../lib/db'
import { Badge, Card, Empty, Markdown, Modal, ScreenHeader, TextField } from '../ui/components'
import { IconAdd, IconBook, IconSend, IconTrash } from '../ui/icons'
import { BookReader } from '../ui/BookReader'
import { formatTimeWeb, formatTimestampWeb } from '../lib/format'

/**
 * Wingman — the Study Companion chat. Same window model as the Android app:
 * a fresh chat window starts when the app opens (and on "New chat"), the Chat
 * tab shows the current window, History shows everything for the course.
 * Per-file module state survives in-app navigation, resets on cold start.
 */
let studyChatWindowStart = Date.now()

const STUDY_SYSTEM = `You are Wingman, the study companion inside the Fio planner.
You help the student understand their courses, plan study sessions, make flashcards and stay motivated.
Be concrete and practical. Use clean markdown: short paragraphs, bold key terms, bullet lists for steps.`

export function StudyScreen() {
  const state = useFio()
  const [tab, setTab] = useState<0 | 1>(0)
  const [courseId, setCourseId] = useState<string>('')
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [flashMode, setFlashMode] = useState(false)
  const [cardEditing, setCardEditing] = useState<Flashcard | null>(null)
  const [cardCreating, setCardCreating] = useState(false)
  const [readingDoc, setReadingDoc] = useState<DocumentItem | null>(null)
  const [importingBooks, setImportingBooks] = useState(false)
  const [bookNote, setBookNote] = useState('')
  const [missingFiles, setMissingFiles] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)

  const effectiveCourse = courseId || state.courses[0]?.id || ''

  const courseChat = useMemo(() =>
    state.chat
      .filter((m) => m.channel === 'STUDY' && m.courseId === effectiveCourse)
      .sort((a, b) => a.timestampMillis - b.timestampMillis),
  [state.chat, effectiveCourse])

  const courseDocs = useMemo(() =>
    state.documents
      .filter((d) => d.courseId === effectiveCourse)
      .sort((a, b) => b.lastAccessedMillis - a.lastAccessedMillis),
  [state.documents, effectiveCourse])

  const windowMessages = courseChat.filter((m) => m.timestampMillis >= studyChatWindowStart)

  // Which books still have their original PDF/EPUB on this device. Books
  // restored from a JSON backup only carry extracted text — show them as
  // "Text only" so they are not mistaken for corrupted files. Re-checked when
  // the reader closes, since attaching a file happens inside it.
  useEffect(() => {
    let alive = true
    void (async () => {
      const missing = new Set<string>()
      for (const d of courseDocs) {
        if (d.format !== 'PDF' && d.format !== 'EPUB') continue
        if (!(await getDoc(d.id))) missing.add(d.id)
      }
      if (alive) setMissingFiles(missing)
    })()
    return () => { alive = false }
  }, [courseDocs, readingDoc])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [windowMessages.length, busy])

  const send = async () => {
    const text = input.trim()
    if (!text || busy || !effectiveCourse) return
    setInput('')
    const userMsg: ChatMessage = {
      id: uid(), sender: 'USER', text, courseId: effectiveCourse,
      channel: 'STUDY', imagePath: '', aiImagePaths: [], timestampMillis: Date.now()
    }
    update((s) => ({ ...s, chat: [...s.chat, userMsg] }))
    setBusy(true)
    const history = [...courseChat, userMsg]
      .slice(-12)
      .map((m) => ({ role: m.sender === 'USER' ? 'user' as const : 'assistant' as const, content: m.text }))
    const course = state.courses.find((c) => c.id === effectiveCourse)
    const res = await sendPrompt(text, STUDY_SYSTEM, state.settings, {
      tone: `Course context: ${course ? `${course.name} (${course.sectionType})` : 'general'}. Respond in clean markdown, concise and clear.`
    })
    setBusy(false)
    if (res.ok) {
      const aiMsg: ChatMessage = {
        id: uid(), sender: 'WINGMAN', text: res.text, courseId: effectiveCourse,
        channel: 'STUDY', imagePath: '', aiImagePaths: [], timestampMillis: Date.now()
      }
      update((s) => ({ ...s, chat: [...s.chat, aiMsg] }))
    } else {
      const errMsg: ChatMessage = {
        id: uid(), sender: 'WINGMAN', text: res.error, courseId: effectiveCourse,
        channel: 'STUDY', imagePath: '', aiImagePaths: [], timestampMillis: Date.now()
      }
      update((s) => ({ ...s, chat: [...s.chat, errMsg] }))
    }
  }

  const newChat = () => {
    studyChatWindowStart = Date.now()
    setTab(0)
  }

  const cards = state.flashcards.filter((f) => f.courseId === effectiveCourse)

  // Import course books (PDF/EPUB/TXT/MD) into the selected course.
  // Snapshot the picked files first — clearing input.value empties the live
  // FileList, which silently imported nothing before.
  const importFiles = async (picked: File[]) => {
    if (picked.length === 0 || !effectiveCourse) return
    setImportingBooks(true)
    setBookNote('')
    const added: DocumentItem[] = []
    let failed = 0
    for (const file of picked) {
      try {
        added.push(await importBook(effectiveCourse, file))
      } catch {
        failed += 1
      }
    }
    if (added.length > 0) update((s) => ({ ...s, documents: [...s.documents, ...added] }))
    setImportingBooks(false)
    if (added.length === 0) setBookNote('Import failed — the file could not be read')
    else if (failed > 0) setBookNote(`Imported ${added.length} · ${failed} failed`)
    else setBookNote(`Imported ${added.length} book${added.length === 1 ? '' : 's'}`)
  }

  const removeDoc = (d: DocumentItem) => {
    void deleteBookFile(d.id)
    update((s) => ({ ...s, documents: s.documents.filter((x) => x.id !== d.id) }))
  }

  if (flashMode) {
    return <FlashcardReview cards={cards} courseName={courseLabel(state, effectiveCourse)} onBack={() => setFlashMode(false)} />
  }

  if (readingDoc) {
    return <BookReader doc={readingDoc} onBack={() => setReadingDoc(null)} />
  }

  return (
    <div className="screen">
      <ScreenHeader
        title="Study"
        subtitle="Wingman · your study companion"
      />

      {state.courses.length === 0 ? (
        <Card>
          <Empty>No courses yet. Add one below to start chatting with Wingman.</Empty>
          <CourseAdder onAdded={() => {}} />
        </Card>
      ) : (
        <>
          {state.courses.length > 1 && (
            <Card>
              <div className="chip-row">
                {state.courses.map((c) => (
                  <button key={c.id} className={`chip ${effectiveCourse === c.id ? 'selected' : ''}`}
                    onClick={() => setCourseId(c.id)}>
                    {c.name}
                  </button>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <IconBook style={{ color: 'var(--accent-strong)', flexShrink: 0 }} width={18} height={18} />
                <strong style={{ fontSize: '1.02rem' }}>Wingman Chat</strong>
              </div>
              <button className="text-btn" onClick={newChat}>
                <IconAdd width={14} height={14} /> New chat
              </button>
            </div>
            <div className="row-sub" style={{ marginTop: 2 }}>
              Wingman · {courseLabel(state, effectiveCourse)}
            </div>

            <div className="tab-pills">
              <button className={`tab-pill ${tab === 0 ? 'active' : ''}`} onClick={() => setTab(0)}>Chat</button>
              <button className={`tab-pill ${tab === 1 ? 'active' : ''}`} onClick={() => setTab(1)}>
                History ({courseChat.length})
              </button>
            </div>

            {tab === 0 ? (
              <>
                <div className="chat-scroll" ref={scrollRef} style={{ maxHeight: '46dvh', overflowY: 'auto' }}>
                  {windowMessages.length === 0 && (
                    <Empty>New chat — ask your first question.</Empty>
                  )}
                  {windowMessages.map((m) => (
                    <Bubble key={m.id} msg={m} />
                  ))}
                  {busy && <span className="typing">Wingman is thinking…</span>}
                </div>
                <div className="chat-input-bar">
                  <input
                    className="input"
                    placeholder={state.settings.aiApiKey ? 'Ask Wingman anything…' : 'Add your AI key in Settings first'}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void send() }}
                  />
                  <button className="send-btn" onClick={() => void send()} disabled={!input.trim() || busy} aria-label="Send">
                    <IconSend width={18} height={18} />
                  </button>
                </div>
              </>
            ) : (
              <div className="chat-scroll" style={{ maxHeight: '46dvh', overflowY: 'auto', paddingTop: 10 }}>
                {courseChat.length === 0 && <Empty>No saved messages yet.</Empty>}
                {grouped(courseChat).map(([label, msgs]) => (
                  <div key={label}>
                    <div className="row-sub" style={{ margin: '8px 0 6px', fontWeight: 700 }}>{label}</div>
                    {msgs.map((m) => <Bubble key={m.id} msg={m} />)}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card
            title={`Flashcards (${cards.length})`}
            icon={<IconBook width={16} height={16} />}
          >
            {cards.length === 0 && <Empty>No cards for this course yet.</Empty>}
            {cards.slice(0, 8).map((f) => (
              <div className="row-item" key={f.id}>
                <div className="row-main" onClick={() => setCardEditing(f)} style={{ cursor: 'pointer' }}>
                  <div className="row-title">{f.front}</div>
                  <div className="row-sub">{f.timesReviewed} reviews · {f.correctCount} correct</div>
                </div>
              </div>
            ))}
            <div className="btn-row">
              <button className="btn" onClick={() => setCardCreating(true)}>
                <IconAdd width={15} height={15} /> Add card
              </button>
              {cards.length > 0 && (
                <button className="btn primary" onClick={() => setFlashMode(true)}>Review</button>
              )}
            </div>
          </Card>

          <Card
            title={`Books (${courseDocs.length})`}
            icon={<IconBook width={16} height={16} />}
          >
            {courseDocs.length === 0 && (
              <Empty>No books for this course yet. Import PDF, EPUB, TXT or MD files.</Empty>
            )}
            {courseDocs.map((d) => (
              <div className="row-item" key={d.id}>
                <div className="row-main" onClick={() => setReadingDoc(d)} style={{ cursor: 'pointer' }}>
                  <div className="row-title" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {d.title}
                    {missingFiles.has(d.id) && <Badge tone="warning">Text only</Badge>}
                  </div>
                  <div className="row-sub">
                    {d.format} · {d.readingProgressPercent}% read
                    {missingFiles.has(d.id) ? ' · original file missing — open to attach it' : ''}
                  </div>
                  <div style={{ height: 4, marginTop: 6, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ width: `${d.readingProgressPercent}%`, height: '100%', background: 'var(--accent-strong)' }} />
                  </div>
                </div>
                <button
                  className="icon-btn"
                  aria-label="Delete book"
                  onClick={() => {
                    if (confirm(`Delete "${d.title}"? Its original file is removed from this device too.`)) removeDoc(d)
                  }}
                >
                  <IconTrash width={16} height={16} />
                </button>
              </div>
            ))}
            <div className="btn-row">
              <label className="btn" style={{ cursor: 'pointer', opacity: importingBooks ? 0.6 : 1 }}>
                <IconAdd width={15} height={15} /> {importingBooks ? 'Importing…' : 'Import books'}
                <input
                  type="file"
                  accept=".pdf,.epub,.txt,.md,.markdown,application/pdf,application/epub+zip,text/plain,text/markdown"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => { void importFiles(Array.from(e.target.files ?? [])); e.target.value = '' }}
                />
              </label>
            </div>
            {bookNote && <div className="row-sub" style={{ textAlign: 'center' }}>{bookNote}</div>}
          </Card>

          <CourseAdder onAdded={() => {}} />
        </>
      )}

      {(cardCreating || cardEditing) && (
        <FlashcardEditor
          courseId={effectiveCourse}
          card={cardEditing}
          onClose={() => { setCardCreating(false); setCardEditing(null) }}
        />
      )}
    </div>
  )
}

function Bubble({ msg }: { msg: ChatMessage }) {
  const user = msg.sender === 'USER'
  return (
    <div className={`bubble ${user ? 'user' : 'ai'}`}>
      {user ? msg.text : <Markdown text={msg.text} />}
      <span className="bubble-time">{formatTimeWeb(msg.timestampMillis)}</span>
    </div>
  )
}

function grouped(msgs: ChatMessage[]): [string, ChatMessage[]][] {
  const out: [string, ChatMessage[]][] = []
  for (const m of msgs) {
    const label = new Date(m.timestampMillis).toLocaleDateString([], { month: 'short', day: 'numeric' })
    const last = out[out.length - 1]
    if (last && last[0] === label) last[1].push(m)
    else out.push([label, [m]])
  }
  return out
}

function courseLabel(state: { courses: { id: string; name: string }[] }, id: string): string {
  return state.courses.find((c) => c.id === id)?.name ?? 'No subject selected'
}

function CourseAdder({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState('')
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button className="text-btn" style={{ marginTop: 8 }} onClick={() => setOpen(true)}>
        <IconAdd width={14} height={14} /> Add a course
      </button>
    )
  }
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <TextField label="Course name" value={name} onChange={setName} placeholder="e.g. GET 511" />
      <div className="modal-actions" style={{ marginTop: 10 }}>
        <button className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
        <button className="btn primary" disabled={!name.trim()} onClick={() => {
          update((s) => ({
            ...s,
            courses: [...s.courses, { id: uid(), name: name.trim(), sectionType: 'STUDY' as const, description: '', createdAtMillis: Date.now() }]
          }))
          setName('')
          setOpen(false)
          onAdded()
        }}>Add</button>
      </div>
    </div>
  )
}

function FlashcardEditor({ courseId, card, onClose }: { courseId: string; card: Flashcard | null; onClose: () => void }) {
  const [front, setFront] = useState(card?.front ?? '')
  const [back, setBack] = useState(card?.back ?? '')
  const save = () => {
    if (!front.trim() || !back.trim()) return
    if (card) {
      update((s) => ({
        ...s,
        flashcards: s.flashcards.map((x) => x.id === card.id ? { ...x, front: front.trim(), back: back.trim() } : x)
      }))
    } else {
      const f: Flashcard = {
        id: uid(), courseId, front: front.trim(), back: back.trim(),
        timesReviewed: 0, correctCount: 0, lastReviewedMillis: -1
      }
      update((s) => ({ ...s, flashcards: [...s.flashcards, f] }))
    }
    onClose()
  }
  const remove = () => {
    if (!card) return
    update((s) => ({ ...s, flashcards: s.flashcards.filter((x) => x.id !== card.id) }))
    onClose()
  }
  return (
    <Modal title={card ? 'Edit card' : 'New flashcard'} onClose={onClose}>
      <TextField label="Front (question)" value={front} onChange={setFront} multiline />
      <TextField label="Back (answer)" value={back} onChange={setBack} multiline />
      <div className="modal-actions">
        {card && <button className="btn danger-text" onClick={remove}>Delete</button>}
        <button className="btn primary" onClick={save} disabled={!front.trim() || !back.trim()}>Save</button>
      </div>
    </Modal>
  )
}

function FlashcardReview({ cards, courseName, onBack }: { cards: Flashcard[]; courseName: string; onBack: () => void }) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const card = cards[index]

  const grade = (correct: boolean) => {
    update((s) => ({
      ...s,
      flashcards: s.flashcards.map((x) => x.id === card.id
        ? { ...x, timesReviewed: x.timesReviewed + 1, correctCount: x.correctCount + (correct ? 1 : 0), lastReviewedMillis: Date.now() }
        : x)
    }))
    setFlipped(false)
    setIndex((i) => i + 1)
  }

  if (!card) {
    return (
      <div className="screen">
        <ScreenHeader title="Review" subtitle={courseName} />
        <Card>
          <Empty>Review complete. {cards.length} cards studied.</Empty>
          <div className="btn-row">
            <button className="btn primary" onClick={() => { setIndex(0); onBack() }}>Done</button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <button className="icon-btn" onClick={onBack} aria-label="Back">‹</button>
        <span style={{ color: 'var(--muted)', fontWeight: 600, fontSize: '0.85rem' }}>Review · {courseName}</span>
      </div>
      <ScreenHeader title={`Card ${index + 1} of ${cards.length}`} subtitle={flipped ? 'How did you do?' : 'Think, then flip.'} />
      <Card className="elevated" style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        {flipped
          ? <Markdown text={card.back} />
          : <strong style={{ fontSize: '1.15rem' }}>{card.front}</strong>}
      </Card>
      <div className="btn-row">
        {!flipped ? (
          <button className="btn primary" onClick={() => setFlipped(true)}>Flip card</button>
        ) : (
          <>
            <button className="btn danger-text" onClick={() => grade(false)}>Wrong</button>
            <button className="btn primary" onClick={() => grade(true)}>Correct</button>
          </>
        )}
      </div>
      {card.timesReviewed > 0 && (
        <div style={{ marginTop: 12 }}>
          <Badge tone="info">{card.timesReviewed} reviews · {card.correctCount} correct · last {formatTimestampWeb(card.lastReviewedMillis)}</Badge>
        </div>
      )}
    </div>
  )
}
