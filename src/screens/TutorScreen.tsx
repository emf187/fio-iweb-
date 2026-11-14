import { useMemo, useState } from 'react'
import { useFio, update } from '../lib/store'
import { uid, type TutorSession } from '../lib/types'
import { sendPrompt } from '../lib/ai'
import { Badge, Card, Empty, Markdown, Modal, ScreenHeader, TextField } from '../ui/components'
import { IconAdd, IconCheck, IconClose, IconSchool, IconTrash } from '../ui/icons'
import { formatTimestampWeb } from '../lib/format'

/**
 * Tutor — ask a question, write your own answer, get an AI grade with
 * feedback and weak topics (the Android TutorScreen flow).
 */
let tutorChatWindowStart = Date.now()

const TUTOR_SYSTEM = `You are the Tutor inside the Fio planner. Grade the student's answer to a question honestly.
Reply in clean markdown with exactly these sections:
**Score:** NN/100
**Feedback:** 2-4 sentences on what was right and what was missing.
**Weak topics:** a bullet list of the specific topics to revise (max 5, keep each under 6 words).
**Revision plan:** one concrete next step.`

export function TutorScreen() {
  const state = useFio()
  const [creating, setCreating] = useState(false)
  const [courseId, setCourseId] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const sessions = useMemo(() =>
    [...state.tutorSessions].sort((a, b) => b.loggedAtMillis - a.loggedAtMillis),
  [state.tutorSessions])

  const windowSessions = sessions.filter((s) => s.loggedAtMillis >= tutorChatWindowStart)

  const avg = sessions.length
    ? Math.round(sessions.reduce((sum, s) => sum + s.scorePercentage, 0) / sessions.length)
    : 0

  const weak = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of sessions.slice(0, 10)) {
      for (const t of s.weakTopics) counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [sessions])

  return (
    <div className="screen">
      <ScreenHeader
        title="Tutor"
        subtitle="Answer questions. Get graded. Fix weak spots."
        action={
          <button className="icon-btn" onClick={() => setCreating(true)} aria-label="New tutor session">
            <IconAdd />
          </button>
        }
      />

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconSchool style={{ color: 'var(--accent-strong)' }} width={18} height={18} />
            <strong style={{ fontSize: '1.02rem' }}>Tutor Chat</strong>
          </div>
          <button className="text-btn" onClick={() => { tutorChatWindowStart = Date.now() }}>
            <IconAdd width={14} height={14} /> New chat
          </button>
        </div>
        <div className="row-sub" style={{ marginTop: 2 }}>
          Tutor · {state.courses.find((c) => c.id === courseId)?.name ?? 'All subjects'}
        </div>
        {state.courses.length > 0 && (
          <div className="chip-row" style={{ marginTop: 10 }}>
            <button className={`chip ${courseId === '' ? 'selected' : ''}`} onClick={() => setCourseId('')}>All</button>
            {state.courses.map((c) => (
              <button key={c.id} className={`chip ${courseId === c.id ? 'selected' : ''}`}
                onClick={() => setCourseId(c.id)}>{c.name}</button>
            ))}
          </div>
        )}
      </Card>

      {sessions.length > 0 && (
        <Card title="Performance" icon={<IconSchool width={16} height={16} />}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge tone={avg >= 70 ? 'success' : avg >= 40 ? 'warning' : 'danger'}>Average score {avg}%</Badge>
            <Badge tone="accent">{sessions.length} sessions</Badge>
          </div>
          {weak.length > 0 && (
            <>
              <div className="row-sub" style={{ marginTop: 12, fontWeight: 700 }}>Weak topics to revise</div>
              <div className="chip-row" style={{ marginTop: 8 }}>
                {weak.map(([topic, n]) => (
                  <Badge key={topic} tone="warning">{topic}{n > 1 ? ` ×${n}` : ''}</Badge>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      <Card title="Sessions">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6 }}>
          <button className="text-btn" onClick={() => { setSelectMode(!selectMode); setSelectedIds([]) }}>
            {selectMode ? 'Done' : 'Select'}
          </button>
        </div>

        {selectedIds.length > 0 && (
          <div className="card elevated" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 0 }}>
            <strong style={{ flex: 1 }}>{selectedIds.length} selected</strong>
            <button className="text-btn" onClick={() => setSelectedIds(sessions.map((s) => s.id))}>All</button>
            <button className="btn danger-text small" onClick={() => {
              if (confirm(`Delete ${selectedIds.length} tutor session(s)? This cannot be undone.`)) {
                const drop = new Set(selectedIds)
                update((s) => ({ ...s, tutorSessions: s.tutorSessions.filter((x) => !drop.has(x.id)) }))
                setSelectedIds([])
                setSelectMode(false)
              }
            }}>
              <IconTrash width={15} height={15} /> Delete
            </button>
            <button className="icon-btn" aria-label="Clear selection" onClick={() => setSelectedIds([])}>
              <IconClose width={16} height={16} />
            </button>
          </div>
        )}

        {sessions.length === 0 && <Empty>No tutor sessions yet. Tap + to try a question.</Empty>}
        {(courseId ? windowSessions.filter((s) => s.courseId === courseId) : windowSessions).map((s) => (
          <SessionRow key={s.id} session={s}
            selectMode={selectMode}
            selected={selectedIds.includes(s.id)}
            onToggle={() => setSelectedIds((cur) => cur.includes(s.id) ? cur.filter((x) => x !== s.id) : [...cur, s.id])} />
        ))}
        {courseId && windowSessions.filter((s) => s.courseId === courseId).length === 0 && (
          <Empty>Nothing in this chat window yet.</Empty>
        )}
      </Card>

      {creating && <TutorEditor onClose={() => setCreating(false)} />}
    </div>
  )
}

function SessionRow({ session, selectMode, selected, onToggle }: {
  session: TutorSession
  selectMode: boolean
  selected: boolean
  onToggle: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="row-item" style={{ borderRadius: 10, outline: selected ? '2px solid var(--accent-strong)' : undefined }}>
      <div className="row-main" onClick={() => selectMode ? onToggle() : setOpen(!open)} style={{ cursor: 'pointer' }}>
        <div className="row-title">{session.questionPrompt.length > 60 ? `${session.questionPrompt.slice(0, 60)}…` : session.questionPrompt}</div>
        <div className="row-sub">
          {formatTimestampWeb(session.loggedAtMillis)}
          {session.recommendedRevision ? ` · ${session.recommendedRevision}` : ''}
        </div>
      </div>
      {selected && <IconCheck width={16} height={16} style={{ color: 'var(--accent-strong)' }} />}
      <Badge tone={session.scorePercentage >= 70 ? 'success' : session.scorePercentage >= 40 ? 'warning' : 'danger'}>
        {session.scorePercentage}%
      </Badge>
      {open && !selectMode && (
        <div style={{ marginTop: 10, width: '100%' }}>
          <div className="card elevated">
            <div className="row-sub" style={{ fontWeight: 700 }}>Your answer</div>
            <Markdown text={session.studentAnswer} />
            <div className="divider" />
            <div className="row-sub" style={{ fontWeight: 700 }}>Tutor feedback</div>
            <Markdown text={session.feedback || session.aiGrade} />
          </div>
        </div>
      )}
    </div>
  )
}

function TutorEditor({ onClose }: { onClose: () => void }) {
  const state = useFio()
  const [courseId, setCourseId] = useState(state.courses[0]?.id ?? '')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!question.trim() || !answer.trim() || busy) return
    setBusy(true)
    setError(null)
    const res = await sendPrompt(
      `Question: ${question.trim()}\n\nStudent's answer:\n${answer.trim()}`,
      TUTOR_SYSTEM,
      state.settings
    )
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    const text = res.text
    const scoreMatch = /(\d{1,3})\s*\/\s*100/.exec(text)
    const score = scoreMatch ? Math.min(100, Number(scoreMatch[1])) : 0
    const weakMatch = /weak topics?:?\*?\*?:?\s*([\s\S]*?)(\n\n|$)/i.exec(text)
    const weakTopics = weakMatch
      ? weakMatch[1].split('\n').map((l) => l.replace(/^[-*\d.\s]+/, '').replace(/\*\*/g, '').trim())
          .filter(Boolean).slice(0, 5)
      : []
    const revMatch = /revision plan:?\*?\*?:?\s*([\s\S]*?)(\n\n|$)/i.exec(text)
    const session: TutorSession = {
      id: uid(),
      courseId,
      questionPrompt: question.trim(),
      studentAnswer: answer.trim(),
      aiGrade: text,
      scorePercentage: score,
      feedback: text,
      weakTopics,
      recommendedRevision: revMatch ? revMatch[1].replace(/\*\*/g, '').replace(/\n/g, ' ').trim().slice(0, 140) : '',
      loggedAtMillis: Date.now()
    }
    update((s) => ({ ...s, tutorSessions: [session, ...s.tutorSessions] }))
    onClose()
  }

  return (
    <Modal title="New tutor session" onClose={onClose}>
      {state.courses.length > 0 && (
        <div className="field">
          <label>Course</label>
          <div className="chip-row">
            {state.courses.map((c) => (
              <button key={c.id} className={`chip ${courseId === c.id ? 'selected' : ''}`} onClick={() => setCourseId(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <TextField label="Question" value={question} onChange={setQuestion} multiline placeholder="What did the professor ask, or what do you want to test yourself on?" />
      <TextField label="Your answer" value={answer} onChange={setAnswer} multiline placeholder="Write your best answer — the tutor grades it honestly." />
      {error && <Badge tone="danger">{error}</Badge>}
      <div className="modal-actions">
        <button className="btn primary" onClick={() => void submit()} disabled={busy || !question.trim() || !answer.trim()}>
          {busy ? 'Grading…' : 'Grade my answer'}
        </button>
      </div>
      {state.settings.aiApiKey.trim() === '' && (
        <div className="row-sub" style={{ marginTop: 10 }}>Add your AI key in Settings to enable grading.</div>
      )}
    </Modal>
  )
}
