import { useEffect, useRef, useState } from 'react'
import { useFio } from '../lib/store'
import {
  consumeFinishedTimer, deleteSessionLogs, getTimer, resetTimer, startTimer, stopTimer,
  tickTimer, timerRunning, toggleEmergencyPause, updateSessionLog
} from '../lib/focus'
import { formatTimestampWeb } from '../lib/format'
import { Badge, Card, Dialog, Empty, Modal, ScreenHeader } from '../ui/components'
import { FocusStatsCard, PURPOSE_EMOJI, PURPOSE_LABELS } from '../ui/FocusStats'
import { IconCheck, IconClose, IconPause, IconPlay, IconRefresh, IconStop, IconTimer, IconTrash } from '../ui/icons'
import { SECTION_TYPES, type SectionType, type SessionLog } from '../lib/types'

/**
 * Focus timer — the web twin of the Android TimerLockdownScreen. The
 * countdown is wall-clock based and re-rendered every second by the pulse;
 * closing the page changes nothing — the running session is persisted and
 * resumes (and finishes) by timestamp.
 *
 * Sessions carry a purpose (Study / Leisure / Research) and an optional
 * course, plus free-text details typed at the summary — the same fields the
 * Android build logs into the habit tracker stats and Life Score.
 */
export function FocusScreen() {
  const state = useFio()
  const settings = state.settings
  const ts = getTimer(state)
  const isRunning = timerRunning(ts)

  // One-second pulse: drives the tick (like the Android screen loop).
  const [, setPulse] = useState(0)
  const finishedRef = useRef(false)
  useEffect(() => {
    const id = window.setInterval(() => {
      tickTimer()
      setPulse((p) => p + 1)
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  const [selectedMinutes, setSelectedMinutes] = useState(50)
  const [selectedSection, setSelectedSection] = useState<SectionType>('STUDY')
  const [selectedCourse, setSelectedCourse] = useState('')

  // Summary dialog state: purpose/course stay editable, details are typed here.
  const [summarySection, setSummarySection] = useState<SectionType>('STUDY')
  const [summaryCourse, setSummaryCourse] = useState('')
  const [summaryDetails, setSummaryDetails] = useState('')

  // History: edit + multi-select.
  const [editLog, setEditLog] = useState<SessionLog | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Surface the finish dialog exactly once per completion.
  const showSummary = ts.phase === 'DONE' && ts.finishedStatus !== null && !finishedRef.current
  useEffect(() => {
    if (showSummary) {
      setSummarySection(ts.sectionType ?? 'STUDY')
      setSummaryCourse(ts.courseId ?? '')
      setSummaryDetails('')
    }
    if (!showSummary) finishedRef.current = ts.finishedStatus !== null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSummary, ts.finishedStatus])

  const now = Date.now()
  const displaySeconds = Math.max(0, Math.floor(
    ts.phase === 'FOCUS' ? (ts.focusEndsAt - now) / 1000 :
    ts.phase === 'BREAK' ? (ts.breakEndsAt - now) / 1000 :
    ts.phase === 'EMERGENCY' ? (ts.emergencyEndsAt - now) / 1000 : 0
  ))
  const mins = Math.floor(displaySeconds / 60)
  const secs = displaySeconds % 60
  const timeString = `${`${mins}`.padStart(2, '0')}:${`${secs}`.padStart(2, '0')}`

  const statusText = ts.phase === 'EMERGENCY'
    ? `EMERGENCY PAUSED (${Math.max(0, Math.floor((ts.emergencyEndsAt - now) / 1000))}s left)`
    : ts.phase === 'BREAK' ? 'REST BREAK — free to leave, no strikes'
    : ts.phase === 'FOCUS' ? 'FOCUSING'
    : ts.phase === 'DONE' ? 'SESSION OVER'
    : 'TIMER READY'

  const statusTone = ts.phase === 'EMERGENCY' ? 'warning' : ts.phase === 'BREAK' ? 'info' : ts.phase === 'FOCUS' ? 'accent' : undefined

  const runningCourse = ts.courseId ? state.courses.find((c) => c.id === ts.courseId)?.name : ''
  const newestLog = state.sessionLogs[0]

  const start = () => {
    startTimer(selectedMinutes, settings.breakFrequencyMinutes, settings.breakDurationMinutes, selectedSection, selectedCourse)
    finishedRef.current = false
  }

  const toggleSelected = (id: string) => {
    setSelectedIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])
  }

  const saveSummary = () => {
    if (newestLog) {
      updateSessionLog(newestLog.id, {
        sectionType: summarySection,
        courseId: summaryCourse,
        details: summaryDetails
      })
    }
    consumeFinishedTimer()
    finishedRef.current = true
  }

  return (
    <div className="screen">
      <ScreenHeader
        title="Focus"
        subtitle="One session at a time. It keeps counting even when you leave Fio."
      />

      <Card>
        <div className="timer-status">
          <Badge tone={statusTone}>{statusText}</Badge>
        </div>

        <div className={`timer-circle ${ts.phase === 'BREAK' ? 'break' : ts.phase === 'EMERGENCY' ? 'paused' : ''}`}>
          <div style={{ textAlign: 'center' }}>
            <div className="timer-time">{timeString}</div>
            <div className="timer-sub">{ts.phase === 'BREAK' ? 'Break ends soon' : `${ts.plannedMinutes} min session`}</div>
            {isRunning && (
              <div className="timer-sub" style={{ marginTop: 4 }}>
                {PURPOSE_LABELS[ts.sectionType ?? 'STUDY']}{runningCourse ? ` · ${runningCourse}` : ''}
              </div>
            )}
          </div>
        </div>

        {!isRunning && ts.phase !== 'DONE' && (
          <>
            <div className="field">
              <label>Session length</label>
              <div className="chip-row">
                {[25, 50, 90, 120, 180].map((m) => (
                  <button key={m} className={`chip ${selectedMinutes === m ? 'selected' : ''}`}
                    onClick={() => setSelectedMinutes(m)}>
                    {m}m
                  </button>
                ))}
              </div>
            </div>

            <PurposeCoursePicker
              section={selectedSection}
              course={selectedCourse}
              onSection={(next) => {
                setSelectedSection(next)
                // Keep the course only if it belongs to the new section.
                const stillValid = state.courses.some((c) => c.id === selectedCourse && c.sectionType === next)
                if (!stillValid) setSelectedCourse('')
              }}
              onCourse={setSelectedCourse}
            />

            <div className="btn-row">
              <button className="btn primary" onClick={start}>
                <IconPlay width={16} height={16} /> Start Session
              </button>
            </div>
            <div className="btn-row">
              <button className="btn ghost" onClick={() => { resetTimer(); finishedRef.current = false }}>
                <IconRefresh width={15} height={15} /> Reset Timer
              </button>
            </div>
            <div className="row-sub" style={{ marginTop: 10 }}>
              Scheduled breaks every {settings.breakFrequencyMinutes} min ({settings.breakDurationMinutes} min long).
              Lockdown strikes are an Android feature — on web, focus time is kept honestly by timestamp.
            </div>
          </>
        )}

        {isRunning && (
          <>
            <div className="btn-row">
              <button className="btn" onClick={() => toggleEmergencyPause()}
                disabled={ts.emergencyUsed && ts.phase !== 'EMERGENCY'}>
                <IconPause width={16} height={16} />
                {ts.phase === 'EMERGENCY' ? 'Resume' : ts.emergencyUsed ? 'Pause used' : '1× Pause'}
              </button>
              <button className="btn" onClick={() => { stopTimer(); }}>
                <IconStop width={16} height={16} /> Stop
              </button>
            </div>
            <div className="btn-row">
              <button className="btn ghost" onClick={() => { resetTimer(); finishedRef.current = false }}>
                <IconRefresh width={15} height={15} /> Reset Timer
              </button>
            </div>
          </>
        )}

        {ts.phase === 'DONE' && !showSummary && (
          <div className="btn-row">
            <button className="btn primary" onClick={() => { consumeFinishedTimer(); finishedRef.current = false }}>
              Start again
            </button>
          </div>
        )}
      </Card>

      <FocusStatsCard />

      <Card title={`Session History (${state.sessionLogs.length})`} icon={<IconTimer width={16} height={16} />}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6 }}>
          <button className="text-btn" onClick={() => { setSelectMode(!selectMode); setSelectedIds([]) }}>
            {selectMode ? 'Done' : 'Select'}
          </button>
        </div>

        {selectedIds.length > 0 && (
          <div className="card elevated" style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ flex: 1 }}>{selectedIds.length} selected</strong>
            <button className="text-btn" onClick={() => setSelectedIds(state.sessionLogs.map((l) => l.id))}>All</button>
            <button className="btn danger-text small" onClick={() => {
              if (confirm(`Delete ${selectedIds.length} focus session(s)? This cannot be undone.`)) {
                deleteSessionLogs(selectedIds)
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

        {state.sessionLogs.length === 0 && <Empty>Completed and stopped sessions land here.</Empty>}
        {state.sessionLogs.slice(0, 20).map((log) => {
          const ok = log.status === 'COMPLETED'
          const purpose = log.sectionType ?? 'STUDY'
          const course = log.courseId ? state.courses.find((c) => c.id === log.courseId)?.name : ''
          const isSelected = selectedIds.includes(log.id)
          return (
            <div className="row-item" key={log.id}
              style={{
                cursor: 'pointer',
                borderRadius: 10,
                outline: isSelected ? '2px solid var(--accent-strong)' : undefined
              }}
              onClick={() => {
                if (selectMode) toggleSelected(log.id)
                else setEditLog(log)
              }}>
              <span style={{ fontSize: 18 }}>{PURPOSE_EMOJI[purpose]}</span>
              <div className="row-main">
                <div className="row-title">{log.title}</div>
                <div className="row-sub">
                  {PURPOSE_LABELS[purpose]}{course ? ` · ${course}` : ''}
                </div>
                {log.details && <div className="row-sub">{log.details}</div>}
                <div className="row-sub">
                  Strikes used: {log.strikesUsed}/{log.startingStrikes} · Breaks: {log.breaksTaken} · Logged: {formatTimestampWeb(log.loggedAtMillis)}
                </div>
              </div>
              {isSelected && <IconCheck width={16} height={16} style={{ color: 'var(--accent-strong)' }} />}
              <Badge tone={ok ? 'success' : 'danger'}>{log.actualMinutes}m / {log.plannedMinutes}m</Badge>
            </div>
          )
        })}
      </Card>

      {editLog && <SessionEditModal log={editLog} onClose={() => setEditLog(null)} />}

      {showSummary && ts.finishedStatus && (
        <Dialog
          icon={<span style={{ color: 'var(--success)' }}><IconPlay width={20} height={20} /></span>}
          title={ts.finishedStatus === 'COMPLETED' ? 'Session Finished!' : 'Session Ended'}
          actions={
            <button className="btn primary" onClick={saveSummary}>
              Save &amp; Done
            </button>
          }
        >
          <p>Great work staying in deep focus.</p>
          <div className="card elevated" style={{ marginTop: 10 }}>
            <div>• Time focused: {ts.alreadyFocusedMinutes} min</div>
            <div>• Breaks taken: {ts.breaksTaken}</div>
            <div>• Logged into Study &amp; Life Stats</div>
          </div>
          <div style={{ marginTop: 12, textAlign: 'left' }}>
            <PurposeCoursePicker
              section={summarySection}
              course={summaryCourse}
              onSection={(next) => {
                setSummarySection(next)
                const stillValid = state.courses.some((c) => c.id === summaryCourse && c.sectionType === next)
                if (!stillValid) setSummaryCourse('')
              }}
              onCourse={setSummaryCourse}
            />
            <div className="field">
              <label>Details (saved with this session)</label>
              <textarea className="input" value={summaryDetails}
                placeholder="e.g. Chapter 4 problems, past papers…"
                onChange={(e) => setSummaryDetails(e.target.value)} />
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}

function PurposeCoursePicker({ section, course, onSection, onCourse }: {
  section: SectionType
  course: string
  onSection: (t: SectionType) => void
  onCourse: (id: string) => void
}) {
  const state = useFio()
  const courses = state.courses.filter((c) => c.sectionType === section)
  return (
    <>
      <div className="field">
        <label>Session purpose</label>
        <div className="chip-row">
          {SECTION_TYPES.map((t) => (
            <button key={t} className={`chip ${section === t ? 'selected' : ''}`} onClick={() => onSection(t)}>
              {PURPOSE_EMOJI[t]} {PURPOSE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>
      {courses.length > 0 && (
        <div className="field">
          <label>Course (optional)</label>
          <div className="chip-row">
            <button className={`chip ${course === '' ? 'selected' : ''}`} onClick={() => onCourse('')}>No course</button>
            {courses.map((c) => (
              <button key={c.id} className={`chip ${course === c.id ? 'selected' : ''}`} onClick={() => onCourse(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function SessionEditModal({ log, onClose }: { log: SessionLog; onClose: () => void }) {
  const state = useFio()
  const [section, setSection] = useState<SectionType>(log.sectionType ?? 'STUDY')
  const [course, setCourse] = useState(log.courseId ?? '')
  const [details, setDetails] = useState(log.details ?? '')

  const save = () => {
    updateSessionLog(log.id, { sectionType: section, courseId: course, details })
    onClose()
  }

  return (
    <Modal title="Edit session" onClose={onClose}>
      <div className="row-sub" style={{ marginTop: 0 }}>
        {log.actualMinutes} min · {formatTimestampWeb(log.loggedAtMillis)}
      </div>
      <PurposeCoursePicker
        section={section}
        course={course}
        onSection={(next) => {
          setSection(next)
          const stillValid = state.courses.some((c) => c.id === course && c.sectionType === next)
          if (!stillValid) setCourse('')
        }}
        onCourse={setCourse}
      />
      <div className="field">
        <label>Details</label>
        <textarea className="input" value={details} placeholder="What did you work on?"
          onChange={(e) => setDetails(e.target.value)} />
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </Modal>
  )
}
