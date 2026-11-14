import { useState } from 'react'
import { useFio, update } from '../lib/store'
import { uid, type TimetableItem } from '../lib/types'
import { Badge, Card, Empty, Modal, ScreenHeader, Switch, TextField } from '../ui/components'
import { IconAdd, IconSchedule, IconTrash } from '../ui/icons'
import { minutesLabel } from './Dashboard'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function TimetableScreen() {
  const state = useFio()
  const [selectedDay, setSelectedDay] = useState(() => {
    const dow = new Date().getDay()
    return dow === 0 ? 7 : dow
  })
  const [editing, setEditing] = useState<TimetableItem | null>(null)
  const [creating, setCreating] = useState(false)

  const dayPeriods = state.timetable
    .filter((p) => p.dayOfWeek === selectedDay)
    .sort((a, b) => a.startMinutes - b.startMinutes)

  const weekTotal = state.timetable.reduce((sum, p) => sum + (p.endMinutes - p.startMinutes), 0)

  return (
    <div className="screen">
      <ScreenHeader
        title="Timetable"
        subtitle={`Your repeating weekly classes · ${Math.round(weekTotal / 60)}h per week`}
        action={
          <button className="icon-btn" onClick={() => setCreating(true)} aria-label="Add class">
            <IconAdd />
          </button>
        }
      />

      <Card>
        <div className="tt-day-pills">
          {DAY_LABELS.map((label, i) => (
            <button key={label} className={`tt-day-pill ${selectedDay === i + 1 ? 'active' : ''}`}
              onClick={() => setSelectedDay(i + 1)}>
              {label}
            </button>
          ))}
        </div>

        {dayPeriods.length === 0 && (
          <Empty>Nothing on {DAY_LABELS[selectedDay - 1]} yet.</Empty>
        )}
        {dayPeriods.map((p) => (
          <div className="event-card" key={p.id}>
            <div className="event-time">
              {minutesLabel(p.startMinutes)}
              <div style={{ color: 'var(--muted)', fontSize: '0.72rem', fontWeight: 600 }}>{minutesLabel(p.endMinutes)}</div>
            </div>
            <div className="row-main" onClick={() => setEditing(p)}>
              <div className="row-title">{p.title}</div>
              <div className="row-sub">
                {p.room ? `${p.room} · ` : ''}{p.details}
              </div>
            </div>
            {p.alarmEnabled && <Badge tone="warning">Alarm</Badge>}
          </div>
        ))}

        <div className="btn-row">
          <button className="btn primary" onClick={() => setCreating(true)}>
            <IconAdd width={16} height={16} /> Add class
          </button>
        </div>
      </Card>

      <Card title="Full week" icon={<IconSchedule width={16} height={16} />}>
        {[1, 2, 3, 4, 5, 6, 7].map((day) => {
          const periods = state.timetable.filter((p) => p.dayOfWeek === day).sort((a, b) => a.startMinutes - b.startMinutes)
          if (periods.length === 0) return null
          return (
            <div key={day} style={{ marginBottom: 10 }}>
              <div className="row-sub" style={{ marginBottom: 4, fontWeight: 700, color: 'var(--text-2)' }}>{DAY_LABELS[day - 1]}</div>
              {periods.map((p) => (
                <div key={p.id} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--accent-strong)', fontWeight: 650, width: 130, flexShrink: 0 }}>
                    {minutesLabel(p.startMinutes)}–{minutesLabel(p.endMinutes)}
                  </span>
                  <span>{p.title}</span>
                </div>
              ))}
            </div>
          )
        })}
        {state.timetable.length === 0 && <Empty>No classes yet.</Empty>}
      </Card>

      {(creating || editing) && (
        <PeriodEditor
          period={editing}
          defaultDay={selectedDay}
          onClose={() => { setCreating(false); setEditing(null) }}
        />
      )}
    </div>
  )
}

function toTimeInput(min: number): string {
  const h = `${Math.floor(min / 60) % 24}`.padStart(2, '0')
  const m = `${min % 60}`.padStart(2, '0')
  return `${h}:${m}`
}

function PeriodEditor({ period, defaultDay, onClose }: {
  period: TimetableItem | null
  defaultDay: number
  onClose: () => void
}) {
  const [title, setTitle] = useState(period?.title ?? '')
  const [room, setRoom] = useState(period?.room ?? '')
  const [details, setDetails] = useState(period?.details ?? '')
  const [day, setDay] = useState(period?.dayOfWeek ?? defaultDay)
  const [alarm, setAlarm] = useState(period?.alarmEnabled ?? false)
  const [startT, setStartT] = useState(toTimeInput(period?.startMinutes ?? 9 * 60))
  const [endT, setEndT] = useState(toTimeInput(period?.endMinutes ?? 10 * 60))

  const save = () => {
    if (!title.trim()) return
    const [sh, sm] = startT.split(':').map(Number)
    const [eh, em] = endT.split(':').map(Number)
    const startMinutes = (sh || 0) * 60 + (sm || 0)
    let endMinutes = (eh || 0) * 60 + (em || 0)
    if (endMinutes <= startMinutes) endMinutes = Math.min(24 * 60, startMinutes + 60)
    if (period) {
      update((s) => ({
        ...s,
        timetable: s.timetable.map((x) => x.id === period.id
          ? { ...x, title: title.trim(), room, details, dayOfWeek: day, startMinutes, endMinutes, alarmEnabled: alarm }
          : x)
      }))
    } else {
      const p: TimetableItem = {
        id: uid(), title: title.trim(), room, details,
        dayOfWeek: day, startMinutes, endMinutes, alarmEnabled: alarm
      }
      update((s) => ({ ...s, timetable: [...s.timetable, p] }))
    }
    onClose()
  }

  const remove = () => {
    if (!period) return
    update((s) => ({ ...s, timetable: s.timetable.filter((x) => x.id !== period.id) }))
    onClose()
  }

  return (
    <Modal title={period ? 'Edit class' : 'New class'} onClose={onClose}>
      <TextField label="Subject" value={title} onChange={setTitle} placeholder="e.g. Mathematics" />
      <div className="field">
        <label>Day</label>
        <div className="chip-row">
          {DAY_LABELS.map((label, i) => (
            <button key={label} className={`chip ${day === i + 1 ? 'selected' : ''}`} onClick={() => setDay(i + 1)}>{label}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="field">
          <label>Start</label>
          <input className="input" type="time" value={startT} onChange={(e) => setStartT(e.target.value)} />
        </div>
        <div className="field">
          <label>End</label>
          <input className="input" type="time" value={endT} onChange={(e) => setEndT(e.target.value)} />
        </div>
      </div>
      <TextField label="Room" value={room} onChange={setRoom} placeholder="Optional" />
      <TextField label="Details" value={details} onChange={setDetails} multiline placeholder="Optional" />
      <div className="switch-row">
        <div>
          <div className="label">Class alarm</div>
          <div className="hint">Reminders are Android-only for now — the time is kept in backups.</div>
        </div>
        <Switch checked={alarm} onChange={setAlarm} />
      </div>
      <div className="modal-actions">
        {period && (
          <button className="btn danger-text" onClick={remove}><IconTrash width={16} height={16} /> Delete</button>
        )}
        <button className="btn primary" onClick={save} disabled={!title.trim()}>Save</button>
      </div>
    </Modal>
  )
}
