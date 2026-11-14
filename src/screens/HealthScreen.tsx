import { useEffect, useMemo, useState } from 'react'
import { useFio, update } from '../lib/store'
import { uid, type SleepEntry, type SleepType } from '../lib/types'
import { Badge, Bars, Card, Empty, Modal, ScreenHeader, TextField } from '../ui/components'
import { IconBed, IconHeart, IconMeal, IconTarget, IconTrash } from '../ui/icons'
import { formatTimeWeb, formatDateWeb } from '../lib/format'
import { addDays, dateKey } from '../lib/dates'

const HOUR_MS = 3_600_000

export function HealthScreen() {
  const state = useFio()
  const [now, setNow] = useState(Date.now())
  const [manualOpen, setManualOpen] = useState(false)
  const [mealEdit, setMealEdit] = useState<string | null>(null)

  // Live "sleeping for…" ticker while a sleep is in progress.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  const tick = now

  const sleeping = state.pendingSleepStart > 0
  const sleepTarget = state.settings.sleepTargetHours || 8
  const mealTarget = state.settings.mealTargetCount || 3

  // Night sleeps (naps tracked separately), newest first.
  const nights = useMemo(() =>
    state.sleepLogs.filter((s) => s.type === 'NIGHT').sort((a, b) => b.startTimeMillis - a.startTimeMillis),
  [state.sleepLogs])
  const naps = useMemo(() =>
    state.sleepLogs.filter((s) => s.type === 'NAP').sort((a, b) => b.startTimeMillis - a.startTimeMillis),
  [state.sleepLogs])

  const lastNight = nights[0]
  const lastNightHours = lastNight ? (lastNight.endTimeMillis - lastNight.startTimeMillis) / HOUR_MS : null

  const weekAgo = addDays(new Date(), -7).getTime()
  const weekNights = nights.filter((s) => s.startTimeMillis >= weekAgo)
  const avgWeek = weekNights.length
    ? weekNights.reduce((sum, s) => sum + (s.endTimeMillis - s.startTimeMillis) / HOUR_MS, 0) / weekNights.length
    : null

  const weekBars = useMemo(() => {
    const out: { label: string; hours: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = addDays(new Date(), -i)
      const from = d.getTime()
      const to = from + 86_400_000
      // Nights that overlap this calendar day count their overlapping portion.
      let hours = 0
      for (const s of state.sleepLogs) {
        if (s.type !== 'NIGHT') continue
        const overlap = Math.max(0, Math.min(s.endTimeMillis, to) - Math.max(s.startTimeMillis, from))
        hours += overlap / HOUR_MS
      }
      out.push({ label: d.toLocaleDateString([], { weekday: 'narrow' }), hours })
    }
    return out
  }, [state.sleepLogs])

  const meals = useMemo(() =>
    [...state.mealLogs].sort((a, b) => b.timestampMillis - a.timestampMillis),
  [state.mealLogs])

  const lastMeal = meals[0]
  const hoursSinceMeal = lastMeal ? (tick - lastMeal.timestampMillis) / HOUR_MS : null
  const todayKey = dateKey()
  const mealsToday = meals.filter((m) => dateKey(new Date(m.timestampMillis)) === todayKey).length

  const startSleep = () => {
    update((s) => ({ ...s, pendingSleepStart: Date.now() }))
  }

  const wakeUp = () => {
    update((s) => {
      if (s.pendingSleepStart <= 0) return s
      const entry: SleepEntry = {
        id: uid(), type: 'NIGHT',
        startTimeMillis: s.pendingSleepStart, endTimeMillis: Date.now(),
        qualityRating: 4, loggedAtMillis: Date.now(), editedAtMillis: -1
      }
      return { ...s, sleepLogs: [entry, ...s.sleepLogs], pendingSleepStart: 0 }
    })
  }

  const discardSleep = () => {
    update((s) => ({ ...s, pendingSleepStart: 0 }))
  }

  const deleteSleep = (id: string) => {
    update((s) => ({ ...s, sleepLogs: s.sleepLogs.filter((x) => x.id !== id) }))
  }

  const logMeal = () => {
    update((s) => ({
      ...s,
      mealLogs: [{
        id: uid(), timestampMillis: Date.now(), note: 'Meal',
        loggedAtMillis: Date.now(), editedAtMillis: -1
      }, ...s.mealLogs]
    }))
  }

  const adjustMeal = (id: string, hoursAgo: number) => {
    const newTime = Date.now() - hoursAgo * HOUR_MS
    update((s) => ({
      ...s,
      mealLogs: s.mealLogs.map((m) => m.id === id ? { ...m, timestampMillis: newTime, editedAtMillis: Date.now() } : m)
    }))
  }

  const deleteMeal = (id: string) => {
    update((s) => ({ ...s, mealLogs: s.mealLogs.filter((x) => x.id !== id) }))
  }

  return (
    <div className="screen">
      <ScreenHeader title="Health" subtitle="Sleep, meals and recovery, logged simply." />

      {sleeping ? (
        <Card className="elevated">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconBed style={{ color: 'var(--info)' }} />
            <div className="row-main">
              <div className="row-title">Sleeping…</div>
              <div className="row-sub">
                Started {formatTimeWeb(state.pendingSleepStart)} ·
                {` ${((tick - state.pendingSleepStart) / HOUR_MS).toFixed(1)}h so far`}
              </div>
            </div>
          </div>
          <div className="btn-row">
            <button className="btn primary" onClick={wakeUp}>I'm awake</button>
            <button className="btn ghost" onClick={discardSleep}>Discard</button>
          </div>
        </Card>
      ) : (
        <Card className="elevated">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <IconBed style={{ color: 'var(--accent-strong)' }} />
              <div>
                <div className="row-title">Sleep tracking</div>
                <div className="row-sub">Tap when you go to bed — Fio remembers, even offline.</div>
              </div>
            </div>
          </div>
          <div className="btn-row">
            <button className="btn primary" onClick={startSleep}>Start sleep</button>
            <button className="btn ghost" onClick={() => setManualOpen(true)}>Log manually</button>
          </div>
        </Card>
      )}

      <Card title="Sleep summary" icon={<IconHeart width={16} height={16} />}>
        <div className="stat-grid">
          <div>
            <div className="stat-big mono-num">{lastNightHours !== null ? lastNightHours.toFixed(1) : '—'}</div>
            <div className="stat-label">Last night (hours)</div>
          </div>
          <div>
            <div className="stat-big mono-num">{avgWeek !== null ? avgWeek.toFixed(1) : '—'}</div>
            <div className="stat-label">7-day average</div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Badge tone={lastNightHours !== null && lastNightHours >= sleepTarget ? 'success' : 'warning'}>
            <IconTarget width={12} height={12} /> Target {sleepTarget}h · {lastNightHours !== null && lastNightHours >= sleepTarget ? 'on track' : 'below target'}
          </Badge>
        </div>
        <div style={{ marginTop: 14 }}>
          <Bars values={weekBars.map((b) => b.hours)} labels={weekBars.map((b) => b.label)} color="var(--info)" />
        </div>
        {naps.length > 0 && (
          <div className="row-sub" style={{ marginTop: 10 }}>
            {naps.length} nap{naps.length === 1 ? '' : 's'} logged in total.
          </div>
        )}
      </Card>

      <Card title="Sleep history" icon={<IconBed width={16} height={16} />}>
        {state.sleepLogs.length === 0 && <Empty>No sleep logged yet.</Empty>}
        {state.sleepLogs.slice(0, 15).map((s) => {
          const hours = (s.endTimeMillis - s.startTimeMillis) / HOUR_MS
          return (
            <div className="row-item" key={s.id}>
              <div className="row-main">
                <div className="row-title">{s.type === 'NIGHT' ? 'Night sleep' : 'Afternoon nap'}</div>
                <div className="row-sub">
                  {formatDateWeb(s.startTimeMillis)} · {formatTimeWeb(s.startTimeMillis)}–{formatTimeWeb(s.endTimeMillis)}
                </div>
              </div>
              <Badge tone={s.type === 'NIGHT' ? 'accent' : 'info'}>{hours.toFixed(1)}h</Badge>
              <button className="icon-btn" aria-label="Delete" onClick={() => deleteSleep(s.id)}>
                <IconTrash width={17} height={17} />
              </button>
            </div>
          )
        })}
      </Card>

      <Card title="Meals" icon={<IconMeal width={16} height={16} />}>
        <div className="stat-grid">
          <div>
            <div className="stat-big mono-num">{mealsToday}/{mealTarget}</div>
            <div className="stat-label">Meals today</div>
          </div>
          <div>
            <div className="stat-big mono-num">{hoursSinceMeal !== null ? `${hoursSinceMeal.toFixed(1)}h` : '—'}</div>
            <div className="stat-label">Since last meal</div>
          </div>
        </div>
        <div className="btn-row">
          <button className="btn primary" onClick={logMeal}>I ate just now</button>
        </div>
        {meals.length === 0 && <Empty>No meals logged yet.</Empty>}
        {meals.slice(0, 10).map((m) => (
          <div className="row-item" key={m.id}>
            <div className="row-main">
              <div className="row-title">{formatTimeWeb(m.timestampMillis)}</div>
              <div className="row-sub">{formatDateWeb(m.timestampMillis)} · {((tick - m.timestampMillis) / HOUR_MS).toFixed(1)}h ago</div>
            </div>
            <button className="text-btn" onClick={() => setMealEdit(m.id)}>Adjust</button>
            <button className="icon-btn" aria-label="Delete meal" onClick={() => deleteMeal(m.id)}>
              <IconTrash width={17} height={17} />
            </button>
          </div>
        ))}
      </Card>

      {manualOpen && (
        <ManualSleepDialog
          onClose={() => setManualOpen(false)}
          onSave={(type, hours) => {
            const end = Date.now()
            const entry: SleepEntry = {
              id: uid(), type,
              startTimeMillis: end - hours * HOUR_MS, endTimeMillis: end,
              qualityRating: 4, loggedAtMillis: Date.now(), editedAtMillis: -1
            }
            update((s) => ({ ...s, sleepLogs: [entry, ...s.sleepLogs] }))
            setManualOpen(false)
          }}
        />
      )}

      {mealEdit && (
        <MealAdjustDialog
          onClose={() => setMealEdit(null)}
          onSave={(hoursAgo) => { adjustMeal(mealEdit, hoursAgo); setMealEdit(null) }}
        />
      )}
    </div>
  )
}

function ManualSleepDialog({ onClose, onSave }: {
  onClose: () => void
  onSave: (type: SleepType, hours: number) => void
}) {
  const [type, setType] = useState<SleepType>('NIGHT')
  const [hours, setHours] = useState('8.0')
  const parsed = Number(hours) || 0
  return (
    <Modal title="Log Sleep / Nap" onClose={onClose}>
      <div className="field">
        <label>Type</label>
        <div className="chip-row">
          <button className={`chip ${type === 'NIGHT' ? 'selected' : ''}`} onClick={() => setType('NIGHT')}>
            Night Sleep
          </button>
          <button className={`chip ${type === 'NAP' ? 'selected' : ''}`} onClick={() => setType('NAP')}>
            Afternoon Nap
          </button>
        </div>
      </div>
      <TextField label="Hours Slept" value={hours} onChange={setHours} type="number" placeholder="8.0" />
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={parsed <= 0 || parsed > 24} onClick={() => onSave(type, parsed)}>
          Save Sleep Log
        </button>
      </div>
    </Modal>
  )
}

function MealAdjustDialog({ onClose, onSave }: {
  onClose: () => void
  onSave: (hoursAgo: number) => void
}) {
  const [hoursAgo, setHoursAgo] = useState('1')
  const parsed = Number(hoursAgo) || 0
  return (
    <Modal title="Adjust Meal Timestamp" onClose={onClose}>
      <div className="row-sub" style={{ marginTop: 0 }}>
        If you forgot to log at the exact moment, specify how many hours ago it was eaten:
      </div>
      <TextField label="Hours ago" value={hoursAgo} onChange={setHoursAgo} type="number" />
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={parsed < 0} onClick={() => onSave(parsed)}>Save</button>
      </div>
    </Modal>
  )
}
