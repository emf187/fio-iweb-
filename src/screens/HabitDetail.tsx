import { useState } from 'react'
import { useFio, update } from '../lib/store'
import {
  completionRate, computeBestStreak, computeStreak, habitColor,
  isDone, isPartial, progressHabit, toggleHabitDay, totalDone, doneThisWeek
} from '../lib/habits'
import { Bars, Card, Empty, Ring, ScreenHeader } from '../ui/components'
import { habitColor as colorOf } from '../lib/habits'
import { addDays, dateKey, parseKey, startOfDay, weekDays, weekdayShort } from '../lib/dates'
import { Badge, Divider } from '../ui/components'
import { IconBack, IconChart, IconFlame } from '../ui/icons'
import type { Habit } from '../lib/types'

/** Full-screen per-habit stats (the Android HabitDetailScreen equivalent). */
export function HabitDetail({ habitId, onBack }: { habitId: string; onBack: () => void }) {
  const state = useFio()
  const habit = state.habits.find((h) => h.id === habitId)
  const [heatDays, setHeatDays] = useState(120)

  if (!habit) {
    return (
      <div className="screen">
        <ScreenHeader title="Habit" />
        <Empty>Habit not found.</Empty>
        <button className="btn" onClick={onBack} style={{ marginTop: 10 }}>Go back</button>
      </div>
    )
  }

  const today = new Date()
  const streak = computeStreak(habit, today)
  const best = Math.max(habit.bestStreak, computeBestStreak(habit))
  const rate30 = completionRate(habit, 30, today)
  const rate7 = completionRate(habit, 7, today)
  const color = colorOf(habit)

  // 12-week completion curve (rate per trailing 7 days, one point per week).
  const curve = Array.from({ length: 12 }, (_, i) => {
    const end = addDays(today, -(11 - i) * 7)
    return completionRate(habit, 7, end)
  })

  const week = weekDays(today)
  const weekValues = week.map((d) => (isDone(habit, dateKey(d)) ? 1 : 0))
  const weekLabels = week.map((d) => weekdayShort(d).slice(0, 2))

  // Editable heatmap: tap any day in the window to toggle it.
  const heatKeys: string[] = []
  for (let i = heatDays - 1; i >= 0; i--) {
    heatKeys.push(dateKey(addDays(today, -i)))
  }

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <IconBack />
        </button>
        <span style={{ color: 'var(--muted)', fontWeight: 600, fontSize: '0.85rem' }}>Habits</span>
      </div>
      <ScreenHeader
        title={habit.name}
        subtitle={habit.question || habit.description || 'Full statistics for this habit.'}
      />

      <Card className="elevated">
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Ring percent={rate30} size={104} stroke={9} color={color}>
            <div style={{ textAlign: 'center' }}>
              <div className="stat-big mono-num">{rate30}%</div>
              <div className="stat-label">30 days</div>
            </div>
          </Ring>
          <div style={{ display: 'grid', gap: 8, flex: 1, minWidth: 180 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-strong)', fontWeight: 800, fontSize: '1.05rem' }}>
              <IconFlame width={17} height={17} /> {streak} day streak
            </div>
            <div className="row-sub">Best streak: <strong>{best}</strong></div>
            <div className="row-sub">This week: <strong>{doneThisWeek(habit, today)}</strong> / {habit.timesPerWeek > 0 ? habit.timesPerWeek : 7}</div>
            <div className="row-sub">Total completions: <strong>{totalDone(habit)}</strong></div>
            <div className="row-sub">Last 7 days: <strong>{rate7}%</strong></div>
          </div>
        </div>
      </Card>

      <Card title="This week" icon={<IconChart width={16} height={16} />}>
        <Bars values={weekValues.map((v) => v * 100)} labels={weekLabels} color={color} />
      </Card>

      <Card title="12-week completion curve" icon={<IconChart width={16} height={16} />}>
        <Bars values={curve} labels={curve.map((_, i) => `W${i + 1}`)} color={color} />
      </Card>

      <Card
        title="History heatmap"
        icon={<IconChart width={16} height={16} />}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="row-sub" style={{ marginTop: 0 }}>Tap a day to toggle it done.</span>
          <div className="chip-row">
            {[60, 120, 365].map((d) => (
              <button key={d} className={`chip ${heatDays === d ? 'selected' : ''}`} onClick={() => setHeatDays(d)}>
                {d}d
              </button>
            ))}
          </div>
        </div>
        <div className="heat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(22px, 1fr))' }}>
          {heatKeys.map((key) => {
            const done = isDone(habit, key)
            const partial = isPartial(habit, key)
            return (
              <button
                key={key}
                aria-label={`${key} ${done ? 'done' : partial ? 'partial' : 'not done'}`}
                onClick={() => update((s) => ({
                  ...s,
                  habits: s.habits.map((x) => x.id === habit.id ? toggleHabitDay(x, key, !isDone(x, key)) : x)
                }))}
                style={{
                  aspectRatio: 1,
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: done
                    ? color
                    : partial
                      ? `color-mix(in srgb, ${color} 40%, var(--elevated))`
                      : 'var(--elevated)'
                }}
              />
            )
          })}
        </div>
        <Divider />
        <div className="row-sub" style={{ marginTop: 0 }}>
          Window started {formatDate(parseKey(heatKeys[0]))} · goal {habit.dailyGoal}×/day
        </div>
      </Card>
    </div>
  )
}

function formatDate(d: Date): string {
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}
