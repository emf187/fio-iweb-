import { useMemo, useState } from 'react'
import { useFio, update } from '../lib/store'
import { EVENT_TYPES, uid, type EventType, type ScheduleEvent } from '../lib/types'
import { formatTime, isSameDay, monthGrid, weekdayNarrow } from '../lib/dates'
import { Badge, Card, Empty, Modal, ScreenHeader, TextField } from '../ui/components'
import { IconAdd, IconCalendar, IconCheck, IconTrash } from '../ui/icons'
import { minutesLabel, courseName } from './Dashboard'

type CalScreen = 'MONTH' | 'DAY'

export function CalendarScreen() {
  const state = useFio()
  const [cursor, setCursor] = useState(new Date())
  const [selected, setSelected] = useState(new Date())
  const [view, setView] = useState<CalScreen>('MONTH')
  const [editing, setEditing] = useState<ScheduleEvent | null>(null)
  const [creating, setCreating] = useState(false)

  const grid = useMemo(() => monthGrid(cursor), [cursor])

  const eventsFor = (d: Date) =>
    state.events
      .filter((e) => e.startTimeMillis < endOfDay(d) && e.endTimeMillis > startOfDayMs(d))
      .sort((a, b) => a.startTimeMillis - b.startTimeMillis)

  const dayEvents = eventsFor(selected)
  const monthLabel = cursor.toLocaleDateString([], { month: 'long', year: 'numeric' })

  const shiftMonth = (n: number) => {
    const c = new Date(cursor.getFullYear(), cursor.getMonth() + n, 1)
    setCursor(c)
  }

  return (
    <div className="screen">
      <ScreenHeader
        title="Calendar"
        subtitle="Tap a day to see or add events."
        action={
          <button className="icon-btn" onClick={() => { setCreating(true); setView('DAY') }} aria-label="Add event">
            <IconAdd />
          </button>
        }
      />

      <Card>
        <div className="cal-head">
          <button className="text-btn" onClick={() => shiftMonth(-1)}>‹ Prev</button>
          <span className="cal-title">{monthLabel}</span>
          <button className="text-btn" onClick={() => shiftMonth(1)}>Next ›</button>
        </div>
        <div className="cal-grid">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <span key={d} className="cal-dow">{d}</span>
          ))}
          {grid.map((d) => {
            const key = d.getTime()
            const dayEventsSmall = eventsFor(d)
            return (
              <button
                key={key}
                className={`cal-day
                  ${d.getMonth() !== cursor.getMonth() ? 'out' : ''}
                  ${isSameDay(d, new Date()) ? 'today' : ''}
                  ${isSameDay(d, selected) ? 'selected' : ''}`}
                onClick={() => { setSelected(d); setView('DAY') }}
              >
                {d.getDate()}
                {dayEventsSmall.length > 0 && <span className="cal-dot" />}
              </button>
            )
          })}
        </div>
      </Card>

      {view === 'DAY' && (
        <Card
          title={selected.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
          icon={<IconCalendar width={16} height={16} />}
        >
          {dayEvents.length === 0 && <Empty>Nothing on this day.</Empty>}
          {dayEvents.map((e) => {
            const past = e.endTimeMillis < Date.now()
            return (
              <div className="event-card" key={e.id}>
                <div className={`event-time ${past ? 'past' : ''}`}>
                  {formatTime(e.startTimeMillis)}
                  <div style={{ color: 'var(--muted)', fontSize: '0.72rem', fontWeight: 600 }}>{formatTime(e.endTimeMillis)}</div>
                </div>
                <div className="row-main" onClick={() => setEditing(e)}>
                  <div className="row-title" style={{ textDecoration: e.isCompleted ? 'line-through' : undefined, opacity: e.isCompleted ? 0.6 : 1 }}>
                    {e.title}
                  </div>
                  <div className="row-sub">
                    {e.type}{e.courseId ? ` · ${courseName(state, e.courseId)}` : ''}
                    {e.description ? ` · ${e.description}` : ''}
                  </div>
                </div>
                {!e.isCompleted && !past && (
                  <button className="icon-btn" aria-label="Mark done"
                    onClick={() => update((s) => ({
                      ...s,
                      events: s.events.map((x) => x.id === e.id ? { ...x, isCompleted: true } : x)
                    }))}>
                    <IconCheck />
                  </button>
                )}
                {e.isCompleted && <Badge tone="success">Done</Badge>}
              </div>
            )
          })}
          <div className="btn-row">
            <button className="btn primary" onClick={() => setCreating(true)}>
              <IconAdd width={16} height={16} /> Add event
            </button>
          </div>
        </Card>
      )}

      {(creating || editing) && (
        <EventEditor
          event={editing}
          defaultDay={selected}
          onClose={() => { setCreating(false); setEditing(null) }}
        />
      )}
    </div>
  )
}

function startOfDayMs(d: Date): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

function endOfDay(d: Date): number {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x.getTime()
}

function toTimeInput(ms: number): string {
  const d = new Date(ms)
  return `${`${d.getHours()}`.padStart(2, '0')}:${`${d.getMinutes()}`.padStart(2, '0')}`
}

function EventEditor({ event, defaultDay, onClose }: {
  event: ScheduleEvent | null
  defaultDay: Date
  onClose: () => void
}) {
  const state = useFio()
  const day = event ? new Date(event.startTimeMillis) : defaultDay
  const [title, setTitle] = useState(event?.title ?? '')
  const [desc, setDesc] = useState(event?.description ?? '')
  const [type, setType] = useState<EventType>(event?.type ?? 'STUDY')
  const [courseId, setCourseId] = useState(event?.courseId ?? '')
  const [dayIso, setDayIso] = useState(`${day.getFullYear()}-${`${day.getMonth() + 1}`.padStart(2, '0')}-${`${day.getDate()}`.padStart(2, '0')}`)
  const [startT, setStartT] = useState(toTimeInput(event?.startTimeMillis ?? Date.now()))
  const [endT, setEndT] = useState(toTimeInput(event?.endTimeMillis ?? Date.now() + 3_600_000))

  const save = () => {
    if (!title.trim()) return
    const [y, m, d] = dayIso.split('-').map(Number)
    const [sh, sm] = startT.split(':').map(Number)
    const [eh, em] = endT.split(':').map(Number)
    const startMs = new Date(y, (m || 1) - 1, d || 1, sh || 0, sm || 0).getTime()
    let endMs = new Date(y, (m || 1) - 1, d || 1, eh || 0, em || 0).getTime()
    if (endMs <= startMs) endMs = startMs + 3_600_000
    if (event) {
      update((s) => ({
        ...s,
        events: s.events.map((x) => x.id === event.id
          ? { ...x, title: title.trim(), description: desc, type, courseId, startTimeMillis: startMs, endTimeMillis: endMs, editedAtMillis: Date.now() }
          : x)
      }))
    } else {
      const e: ScheduleEvent = {
        id: uid(), title: title.trim(), description: desc, startTimeMillis: startMs,
        endTimeMillis: endMs, type, courseId, isCompleted: false,
        loggedAtMillis: Date.now(), editedAtMillis: -1
      }
      update((s) => ({ ...s, events: [...s.events, e] }))
    }
    onClose()
  }

  const remove = () => {
    if (!event) return
    update((s) => ({ ...s, events: s.events.filter((x) => x.id !== event.id) }))
    onClose()
  }

  return (
    <Modal title={event ? 'Edit event' : 'New event'} onClose={onClose}>
      <TextField label="Title" value={title} onChange={setTitle} placeholder="e.g. Study session" />
      <div className="field">
        <label>Type</label>
        <div className="chip-row">
          {EVENT_TYPES.map((t) => (
            <button key={t} className={`chip ${type === t ? 'selected' : ''}`} onClick={() => setType(t)}>{t}</button>
          ))}
        </div>
      </div>
      {state.courses.length > 0 && (
        <div className="field">
          <label>Course</label>
          <div className="chip-row">
            <button className={`chip ${courseId === '' ? 'selected' : ''}`} onClick={() => setCourseId('')}>None</button>
            {state.courses.map((c) => (
              <button key={c.id} className={`chip ${courseId === c.id ? 'selected' : ''}`} onClick={() => setCourseId(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div className="field">
          <label>Date</label>
          <input className="input" type="date" value={dayIso} onChange={(e) => setDayIso(e.target.value)} />
        </div>
        <div className="field">
          <label>Start</label>
          <input className="input" type="time" value={startT} onChange={(e) => setStartT(e.target.value)} />
        </div>
        <div className="field">
          <label>End</label>
          <input className="input" type="time" value={endT} onChange={(e) => setEndT(e.target.value)} />
        </div>
      </div>
      <TextField label="Notes" value={desc} onChange={setDesc} multiline placeholder="Optional details" />
      <div className="modal-actions">
        {event && (
          <button className="btn danger-text" onClick={remove}><IconTrash width={16} height={16} /> Delete</button>
        )}
        <button className="btn primary" onClick={save} disabled={!title.trim()}>Save</button>
      </div>
    </Modal>
  )
}

export { minutesLabel }
