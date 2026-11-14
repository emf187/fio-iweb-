import { useState } from 'react'
import { useFio, update } from '../lib/store'
import {
  progressHabit, withComputedStats, habitColor, doneThisWeek, completionRate
} from '../lib/habits'
import { HABIT_COLORS, uid, type Habit } from '../lib/types'
import { Badge, Card, Empty, Modal, ScreenHeader, Switch, TextField, NumberField } from '../ui/components'
import { IconAdd, IconChart, IconFlame, IconRepeat, IconTrash } from '../ui/icons'
import { dateKey } from '../lib/dates'
import { HabitDetail } from './HabitDetail'
import { FocusStatsCard } from '../ui/FocusStats'

export function HabitsScreen() {
  const state = useFio()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Habit | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  if (detailId) {
    return <HabitDetail habitId={detailId} onBack={() => setDetailId(null)} />
  }

  const active = state.habits.filter((h) => !h.archived)
  const archived = state.habits.filter((h) => h.archived)
  const todayKey = dateKey()
  const doneToday = active.filter((h) => h.completedDates.includes(todayKey)).length
  const bestStreak = active.reduce((m, h) => Math.max(m, withComputedStats(h).bestStreak), 0)

  return (
    <div className="screen">
      <ScreenHeader
        title="Habits"
        subtitle="Small daily wins. Tap to log, long-press to edit."
        action={
          <button className="icon-btn" onClick={() => setCreating(true)} aria-label="New habit">
            <IconAdd />
          </button>
        }
      />

      <Card className="elevated">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconRepeat style={{ color: 'var(--accent-strong)' }} />
            <strong style={{ fontSize: '1.15rem' }}>Today</strong>
          </div>
          <button className="btn primary small" onClick={() => setCreating(true)}>
            <IconAdd width={15} height={15} /> New Habit
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Badge tone={doneToday >= active.length && active.length > 0 ? 'success' : 'accent'}>
            {doneToday} of {active.length} done today
          </Badge>
          {bestStreak > 0 && <Badge tone="warning">Best streak {bestStreak}</Badge>}
        </div>

        {active.length === 0 && <Empty>No habits yet. Create your first one.</Empty>}
        {active.map((h0) => {
          const h = withComputedStats(h0)
          const goal = Math.max(1, h.dailyGoal)
          const done = h.progressDates[todayKey] ?? 0
          const complete = h.completedDates.includes(todayKey)
          return (
            <div className="row-item" key={h.id}>
              <button
                className={`habit-circle ${complete ? 'done' : done > 0 ? 'partial' : ''}`}
                style={complete || done > 0 ? { borderColor: habitColor(h) } : undefined}
                onClick={() => update((s) => ({
                  ...s,
                  habits: s.habits.map((x) => (x.id === h.id ? progressHabit(x) : x))
                }))}
                aria-label={`Log ${h.name}`}
              >
                {complete ? '✓' : `${done}/${goal}`}
              </button>
              <div className="row-main">
                <div className="row-title">{h.name}</div>
                <div className="habit-dot-row">
                  {Array.from({ length: goal }, (_, i) => (
                    <span key={i} className={`habit-dot ${i < done ? 'filled' : ''}`}
                      style={i < done ? { background: habitColor(h) } : undefined} />
                  ))}
                </div>
                <div className="row-sub">
                  {h.question ? h.question : ''}{h.question ? ' · ' : ''}{doneThisWeek(h)}× this week · {completionRate(h, 30)}% (30d)
                </div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent-strong)', fontWeight: 700 }}>
                  <IconFlame width={14} height={14} /> {h.streak}
                </div>
                <div style={{ display: 'flex', gap: 2 }}>
                  <button className="icon-btn" style={{ width: 32, height: 32 }} aria-label="Stats"
                    onClick={() => setDetailId(h.id)}>
                    <IconChart width={17} height={17} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </Card>

      {/* Focus timer stats — same card as the Focus screen; feeds Life Score. */}
      <FocusStatsCard />

      {archived.length > 0 && (
        <Card title={`Archived (${archived.length})`} icon={<IconChart width={16} height={16} />}>
          {archived.map((h) => (
            <div className="row-item" key={h.id}>
              <div className="row-main">
                <div className="row-title" style={{ opacity: 0.7 }}>{h.name}</div>
                <div className="row-sub">{h.completedDates.length} total completions</div>
              </div>
              <button className="text-btn" onClick={() => update((s) => ({
                ...s,
                habits: s.habits.map((x) => x.id === h.id ? { ...x, archived: false } : x)
              }))}>
                Restore
              </button>
              <button className="icon-btn" aria-label="Delete" onClick={() => {
                if (confirm(`Delete "${h.name}" and its history? This cannot be undone.`)) {
                  update((s) => ({ ...s, habits: s.habits.filter((x) => x.id !== h.id) }))
                }
              }}>
                <IconTrash width={18} height={18} />
              </button>
            </div>
          ))}
        </Card>
      )}

      <div className="row-sub" style={{ marginTop: 14, padding: '0 6px' }}>
        Tap a habit when you do it · tap the chart icon for full stats · long-press to edit is desktop-right-click on web: use the chart page for editing.
      </div>

      {(creating || editing) && (
        <HabitEditor habit={editing} onClose={() => { setCreating(false); setEditing(null) }} />
      )}
    </div>
  )
}

function HabitEditor({ habit, onClose }: { habit: Habit | null; onClose: () => void }) {
  const [name, setName] = useState(habit?.name ?? '')
  const [question, setQuestion] = useState(habit?.question ?? '')
  const [description, setDescription] = useState(habit?.description ?? '')
  const [dailyGoal, setDailyGoal] = useState(habit?.dailyGoal ?? 1)
  const [timesPerWeek, setTimesPerWeek] = useState(habit?.timesPerWeek ?? 0)
  const [colorIndex, setColorIndex] = useState(habit?.colorIndex ?? 0)

  const save = () => {
    if (!name.trim()) return
    if (habit) {
      update((s) => ({
        ...s,
        habits: s.habits.map((x) => x.id === habit.id
          ? { ...x, name: name.trim(), question, description, dailyGoal: Math.max(1, dailyGoal), timesPerWeek: Math.max(0, timesPerWeek), colorIndex }
          : x)
      }))
    } else {
      const h: Habit = {
        id: uid(), name: name.trim(), question, description,
        frequencyDays: 1, dailyGoal: Math.max(1, dailyGoal),
        streak: 0, bestStreak: 0, completedDates: [], progressDates: {},
        colorIndex, reminderMinutes: -1, timesPerWeek: Math.max(0, timesPerWeek),
        archived: false, loggedAtMillis: Date.now(), lastCompletedAtMillis: -1
      }
      update((s) => ({ ...s, habits: [...s.habits, h] }))
    }
    onClose()
  }

  return (
    <Modal title={habit ? 'Edit habit' : 'New habit'} onClose={onClose}>
      <TextField label="Name" value={name} onChange={setName} placeholder="e.g. Read 20 pages" />
      <TextField label="Daily question" value={question} onChange={setQuestion}
        placeholder="e.g. Did you read today?" maxLength={60} />
      <TextField label="Description" value={description} onChange={setDescription} multiline placeholder="Optional" />
      <NumberField label="Daily goal" value={dailyGoal} onChange={setDailyGoal} min={1} max={20}
        suffix="How many taps a day complete this habit." />
      <NumberField label="Times per week" value={timesPerWeek} onChange={setTimesPerWeek} min={0} max={7}
        suffix="0 = every day." />
      <div className="field">
        <label>Color</label>
        <div className="chip-row">
          {HABIT_COLORS.map((c, i) => (
            <button key={c} type="button" aria-label={`Color ${i + 1}`}
              onClick={() => setColorIndex(i)}
              style={{
                width: 32, height: 32, borderRadius: 10, background: c, cursor: 'pointer',
                border: colorIndex === i ? '2.5px solid var(--text)' : 'none', opacity: colorIndex === i ? 1 : 0.8
              }} />
          ))}
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn primary" onClick={save} disabled={!name.trim()}>Save</button>
      </div>
    </Modal>
  )
}
