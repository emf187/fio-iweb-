import { useMemo } from 'react'
import { useFio } from '../lib/store'
import { computeScore } from '../lib/score'
import { progressHabit, withComputedStats } from '../lib/habits'
import { update } from '../lib/store'
import { dateKey, formatTime } from '../lib/dates'
import { Badge, Card, CheckDone, Empty, Ring, ScreenHeader, habitColor } from '../ui/components'
import { IconCalendar, IconFlame, IconInsights, IconPlay, IconRepeat, IconTarget } from '../ui/icons'
import type { Screen } from '../appTypes'

export function Dashboard({ go }: { go: (s: Screen) => void }) {
  const state = useFio()
  const todayKey = dateKey()

  const score = useMemo(() => computeScore(state), [state])

  const todayEvents = useMemo(() => {
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    const to = from.getTime() + 86_400_000
    return state.events
      .filter((e) => e.startTimeMillis < to && e.endTimeMillis > from.getTime())
      .sort((a, b) => a.startTimeMillis - b.startTimeMillis)
  }, [state.events])

  const todayTimetable = useMemo(() => {
    const dow = new Date().getDay()
    const iso = dow === 0 ? 7 : dow
    return state.timetable
      .filter((t) => t.dayOfWeek === iso)
      .sort((a, b) => a.startMinutes - b.startMinutes)
  }, [state.timetable])

  const activeHabits = state.habits.filter((h) => !h.archived)
  const focus7 = state.sessionLogs
    .filter((s) => s.loggedAtMillis >= Date.now() - 6 * 86_400_000)
    .reduce((sum, s) => sum + s.actualMinutes, 0)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const name = state.profileName || 'there'

  return (
    <div className="screen">
      <ScreenHeader title={state.profileName || 'Fio'} subtitle={`${greeting}. Here's your day.`} />

      <Card className="elevated">
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Ring percent={score.overall} size={110} stroke={9}>
            <div style={{ textAlign: 'center' }}>
              <div className="stat-big mono-num">{score.overall}</div>
              <div className="stat-label">Life Score</div>
            </div>
          </Ring>
          <div style={{ flex: 1, display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}>
              <span style={{ color: 'var(--text-2)' }}>Added today</span>
              <strong className="mono-num" style={{ color: score.trend >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {score.trend >= 0 ? '+' : ''}{score.trend}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}>
              <span style={{ color: 'var(--text-2)' }}>Habits</span>
              <strong className="mono-num">{score.habitScore}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}>
              <span style={{ color: 'var(--text-2)' }}>Focus</span>
              <strong className="mono-num">{score.focusScore}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}>
              <span style={{ color: 'var(--text-2)' }}>Consistency</span>
              <strong className="mono-num">{score.consistency}</strong>
            </div>
            <button className="text-btn" style={{ padding: '2px 0 0', alignSelf: 'flex-start' }} onClick={() => go('STATS')}>
              <IconInsights width={15} height={15} /> Open Progress
            </button>
          </div>
        </div>
      </Card>

      <Card title="Today's schedule" icon={<IconCalendar width={17} height={17} />}>
        {todayEvents.length === 0 && todayTimetable.length === 0 && (
          <Empty>Nothing scheduled today. Add an event in Calendar or classes in Timetable.</Empty>
        )}
        {todayTimetable.map((t) => (
          <div className="event-card" key={`tt-${t.id}`}>
            <div className="event-time">{minutesLabel(t.startMinutes)}<div style={{ color: 'var(--muted)', fontSize: '0.72rem', fontWeight: 600 }}>Class</div></div>
            <div className="row-main">
              <div className="row-title">{t.title}</div>
              <div className="row-sub">{t.room ? `${t.room} · ` : ''}{minutesLabel(t.startMinutes)}–{minutesLabel(t.endMinutes)}</div>
            </div>
          </div>
        ))}
        {todayEvents.map((e) => {
          const past = e.endTimeMillis < Date.now()
          return (
            <div className="event-card" key={e.id}>
              <div className={`event-time ${past ? 'past' : ''}`}>{formatTime(e.startTimeMillis)}</div>
              <div className="row-main">
                <div className="row-title" style={{ textDecoration: e.isCompleted ? 'line-through' : undefined, opacity: e.isCompleted ? 0.6 : 1 }}>
                  {e.title}
                </div>
                <div className="row-sub">{e.type}{e.courseId ? ` · ${courseName(state, e.courseId)}` : ''} · {formatTime(e.endTimeMillis)}</div>
              </div>
              <Badge tone={e.isCompleted ? 'success' : past ? 'warning' : 'accent'}>
                {e.isCompleted ? 'Done' : past ? 'Past' : 'Upcoming'}
              </Badge>
            </div>
          )
        })}
        {(todayEvents.length > 0 || todayTimetable.length > 0) && (
          <button className="text-btn" style={{ marginTop: 10 }} onClick={() => go('CALENDAR')}>
            Open Calendar
          </button>
        )}
      </Card>

      <Card title="Habits today" icon={<IconRepeat width={17} height={17} />}>
        {activeHabits.length === 0 && <Empty>No habits yet. Create one on the Habits page.</Empty>}
        {activeHabits.map((h0) => {
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
                {complete ? <CheckDone size={30} /> : done > 0 ? `${done}/${goal}` : `${done}/${goal}`}
              </button>
              <div className="row-main">
                <div className="row-title">{h.name}</div>
                <div className="habit-dot-row">
                  {Array.from({ length: goal }, (_, i) => (
                    <span key={i} className={`habit-dot ${i < done ? 'filled' : ''}`} style={i < done ? { background: habitColor(h) } : undefined} />
                  ))}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent-strong)', fontWeight: 700 }}>
                  <IconFlame width={14} height={14} /> {h.streak}
                </div>
                <div className="row-sub">{h.timesPerWeek > 0 ? `${h.timesPerWeek}× / week` : ''}</div>
              </div>
            </div>
          )
        })}
        {activeHabits.length > 0 && (
          <button className="text-btn" style={{ marginTop: 10 }} onClick={() => go('HABITS')}>
            All habits
          </button>
        )}
      </Card>

      <Card title="Focus" icon={<IconPlay width={16} height={16} />}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Ring percent={Math.min(100, (focus7 / 300) * 100)} size={84} stroke={8} color="var(--accent)">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1.05rem' }} className="mono-num">{focus7}m</div>
              <div className="stat-label">this week</div>
            </div>
          </Ring>
          <div style={{ flex: 1 }}>
            <div className="row-sub" style={{ marginTop: 0 }}>
              Focus sessions count toward your score. 5 hours a week is the target.
            </div>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={() => go('TIMER')}>
                <IconPlay width={16} height={16} /> Start session
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Goals" icon={<IconTarget width={16} height={16} />}>
        {state.goals.length === 0 && <Empty>No goals yet — add one in Settings or from the Progress page.</Empty>}
        {state.goals.slice(0, 3).map((g) => (
          <div className="row-item" key={g.id}>
            <div className="row-main">
              <div className="row-title">{g.title}</div>
              <div className="row-sub">{g.category}{g.unit ? ` · ${g.unit}` : ''}</div>
            </div>
            <Badge tone={g.currentValue >= g.targetValue ? 'success' : 'accent'}>
              {g.currentValue}/{g.targetValue}
            </Badge>
          </div>
        ))}
      </Card>
    </div>
  )
}

export function minutesLabel(m: number): string {
  const h = Math.floor(m / 60) % 24
  const mm = m % 60
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${`${mm}`.padStart(2, '0')} ${ampm}`
}

export function courseName(state: { courses: { id: string; name: string }[] }, id: string): string {
  return state.courses.find((c) => c.id === id)?.name ?? 'Course'
}
