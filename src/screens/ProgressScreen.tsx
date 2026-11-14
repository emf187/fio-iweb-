import { useMemo, useState } from 'react'
import { useFio, update } from '../lib/store'
import { computeScore, completionSeries, SCORE_WEIGHTS } from '../lib/score'
import { completionRate, withComputedStats, isDone } from '../lib/habits'
import { sendPrompt } from '../lib/ai'
import { Markdown, Badge, Card, Empty, Ring, ScreenHeader, habitColor } from '../ui/components'
import { IconChart, IconInsights, IconRefresh } from '../ui/icons'
import { dateKey, weekdayShort } from '../lib/dates'
import { HabitDetail } from './HabitDetail'

export function ProgressScreen({ go }: { go: (s: string) => void }) {
  const state = useFio()
  const score = useMemo(() => computeScore(state), [state])
  const series = useMemo(() => completionSeries(state, 7), [state])
  const [openHabit, setOpenHabit] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [review, setReview] = useState<string | null>(null)
  const [reviewLoading, setReviewLoading] = useState(false)

  const selected = state.habitStatsSelection
    .split(',').map((s) => s.trim()).filter(Boolean)
    .map((id) => state.habits.find((h) => h.id === id))
    .filter((h): h is NonNullable<typeof h> => Boolean(h))
    .slice(0, 3)

  if (openHabit) {
    return <HabitDetail habitId={openHabit} onBack={() => setOpenHabit(null)} />
  }

  const generateReview = async () => {
    setReviewLoading(true)
    setReview(null)
    const todayKey = dateKey()
    const active = state.habits.filter((h) => !h.archived)
    const lines = active.map((h) => {
      const w = withComputedStats(h)
      return `- ${h.name}: ${isDone(h, todayKey) ? 'done today' : 'not done today'}, ${w.streak}-day streak, ${completionRate(h, 30)}% over 30 days`
    })
    const prompt = [
      `My name is ${state.profileName || 'a student'}.`,
      `Life score today: overall ${score.overall} (habits ${score.habitScore}, focus ${score.focusScore}, consistency ${score.consistency}).`,
      `Focus minutes this week: ${score.focusMinutes7}.`,
      `Habit status:`,
      ...lines,
      `Write a short, encouraging weekly review (max 120 words): what is going well, what to fix next week. Use clean markdown with a bold lead line.`
    ].join('\n')
    const res = await sendPrompt(prompt,
      'You are Fio, a warm, practical study-and-life coach. Keep it short and concrete.',
      state.settings)
    setReviewLoading(false)
    if (res.ok) setReview(res.text)
    else setReview(`Could not reach the AI: ${res.error}`)
  }

  return (
    <div className="screen">
      <ScreenHeader title="Progress" subtitle="Your life score and habit momentum." />

      <Card className="elevated">
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Ring percent={score.overall} size={130} stroke={10}>
            <div style={{ textAlign: 'center' }}>
              <div className="stat-big mono-num" style={{ fontSize: '2.1rem' }}>{score.overall}</div>
              <div className="stat-label">out of 100</div>
            </div>
          </Ring>
          <div style={{ flex: 1, display: 'grid', gap: 10 }}>
            {[
              { label: 'Habits', value: score.habitScore, weight: SCORE_WEIGHTS.habits },
              { label: 'Focus', value: score.focusScore, weight: SCORE_WEIGHTS.focus },
              { label: 'Consistency', value: score.consistency, weight: SCORE_WEIGHTS.consistency }
            ].map((row) => (
              <div key={row.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-2)' }}>{row.label} <span style={{ color: 'var(--muted)' }}>· {Math.round(row.weight * 100)}%</span></span>
                  <strong className="mono-num">{row.value}</strong>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--elevated)' }}>
                  <div style={{ width: `${row.value}%`, height: '100%', borderRadius: 3, background: 'var(--accent-strong)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <Badge tone="accent">{score.doneToday}/{score.habitsToday} habits today</Badge>
          <Badge tone="info">{score.focusMinutes7} focus min this week</Badge>
        </div>
      </Card>

      <Card title="Last 7 days" icon={<IconChart width={16} height={16} />}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 110, paddingTop: 6 }}>
          {series.map((d) => {
            const max = Math.max(1, score.habitsToday)
            return (
              <div key={d.key} className="bar-col" style={{ height: '100%' }}>
                <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: '100%', width: '100%', justifyContent: 'center' }}>
                  <div className="bar-fill" style={{ width: '58%', height: `${(d.done / max) * 100}%` }} />
                  <div className="bar-fill" style={{ width: '28%', height: `${(d.partial / max) * 100}%`, background: 'var(--muted)', opacity: 0.5 }} />
                </div>
                <span className="bar-label">{weekdayShort(d.date).slice(0, 2)}</span>
              </div>
            )
          })}
        </div>
        <div className="row-sub" style={{ marginTop: 8 }}>Green = fully done, grey = partial progress.</div>
      </Card>

      <Card
        title="Featured habit stats"
        icon={<IconInsights width={16} height={16} />}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span className="row-sub" style={{ marginTop: 0 }}>Up to 3 habits shown here.</span>
          <button className="text-btn" onClick={() => setPicking(true)}>
            {selected.length === 0 ? 'Choose habits' : 'Change'}
          </button>
        </div>
        {selected.length === 0 && <Empty>Pick up to 3 habits to feature their 30-day stats here.</Empty>}
        {selected.map((h) => {
          const w = withComputedStats(h)
          const rate = completionRate(h, 30)
          return (
            <div className="row-item" key={h.id}>
              <span style={{
                width: 12, height: 12, borderRadius: 4, background: habitColor(h), flexShrink: 0
              }} />
              <div className="row-main">
                <div className="row-title">{h.name}</div>
                <div className="row-sub">{w.streak} day streak · {rate}% / 30d · best {Math.max(w.bestStreak, 0)}</div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--elevated)', marginTop: 6 }}>
                  <div style={{ width: `${rate}%`, height: '100%', borderRadius: 3, background: habitColor(h) }} />
                </div>
              </div>
              <button className="text-btn" onClick={() => setOpenHabit(h.id)}>Stats</button>
            </div>
          )
        })}
      </Card>

      <Card title="Weekly review" icon={<IconRefresh width={16} height={16} />}>
        {state.settings.aiApiKey.trim() === '' ? (
          <Empty>Add your AI key in Settings to get an automatic weekly review.</Empty>
        ) : review === null ? (
          <div className="btn-row" style={{ marginTop: 0 }}>
            <button className="btn primary" onClick={generateReview} disabled={reviewLoading}>
              {reviewLoading ? 'Thinking…' : 'Generate review'}
            </button>
          </div>
        ) : (
          <Markdown text={review} />
        )}
      </Card>

      {picking && (
        <HabitPicker
          selectedIds={selected.map((h) => h.id)}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}

function HabitPicker({ selectedIds, onClose }: { selectedIds: string[]; onClose: () => void }) {
  const state = useFio()
  const active = state.habits.filter((h) => !h.archived)
  const toggle = (id: string) => {
    const has = selectedIds.includes(id)
    let next = has ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]
    next = next.slice(0, 3)
    update((s) => ({ ...s, habitStatsSelection: next.join(',') }))
  }
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Choose habit stats</h3>
        <div className="dialog-text">Up to 3 habits are featured on the Progress page.</div>
        <div style={{ margin: '12px 0' }}>
          {active.length === 0 && <Empty>No active habits yet.</Empty>}
          {active.map((h) => (
            <label key={h.id} className="row-item" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={selectedIds.includes(h.id)} onChange={() => toggle(h.id)} />
              <div className="row-main">
                <div className="row-title">{h.name}</div>
              </div>
            </label>
          ))}
        </div>
        <div className="dialog-actions">
          <button className="btn primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
