import { addDays, dateKey, DAY_MS } from './dates'
import { completionRate, isDone } from './habits'
import type { FioState } from './types'

export interface ScoreBreakdown {
  overall: number
  /** Points added today: current score minus the score at midnight. */
  trend: number
  habitScore: number
  focusScore: number
  consistency: number
  focusMinutes7: number
  activeHabits: number
  doneToday: number
  habitsToday: number
}

export const SCORE_WEIGHTS = { habits: 0.45, focus: 0.3, consistency: 0.25 }

interface CoreScore {
  overall: number
  habitScore: number
  focusScore: number
  consistency: number
  focusMinutes7: number
}

function coreScore(state: FioState, refDay: Date, maxLogMillis: number): CoreScore {
  const active = state.habits.filter((h) => !h.archived)
  const habitScore = active.length
    ? Math.round(active.reduce((sum, h) => sum + completionRate(h, 30, refDay), 0) / active.length)
    : 0

  const weekAgo = addDays(refDay, -6).getTime()
  const focusMinutes7 = state.sessionLogs
    .filter((s) => s.loggedAtMillis >= weekAgo && s.loggedAtMillis < maxLogMillis)
    .reduce((sum, s) => sum + s.actualMinutes, 0)
  const focusScore = Math.min(100, Math.round((focusMinutes7 / 300) * 100))

  let activeDays = 0
  for (let i = 0; i < 7; i += 1) {
    const key = dateKey(addDays(refDay, -i))
    if (active.some((h) => isDone(h, key) || (h.progressDates[key] ?? 0) > 0)) {
      activeDays += 1
    }
  }
  const consistency = Math.round((activeDays / 7) * 100)

  const overall = Math.round(
    habitScore * SCORE_WEIGHTS.habits +
      focusScore * SCORE_WEIGHTS.focus +
      consistency * SCORE_WEIGHTS.consistency
  )
  return { overall, habitScore, focusScore, consistency, focusMinutes7 }
}

/**
 * Life Score: Habits (30-day completion), Focus (weekly minutes vs a 5-hour
 * target) and Consistency (days with any habit activity this week) — the same
 * weights the Android Progress page uses for its web-visible sections.
 * `trend` is today's added score: the current score minus the same
 * calculation as it stood at midnight, so the Dashboard can show "+N today".
 */
export function computeScore(state: FioState, today = new Date()): ScoreBreakdown {
  const current = coreScore(state, today, Number.POSITIVE_INFINITY)

  const midnight = new Date(today)
  midnight.setHours(0, 0, 0, 0)
  const baseline = coreScore(state, addDays(today, -1), midnight.getTime())
  const trend = current.overall - baseline.overall

  const active = state.habits.filter((h) => !h.archived)
  const todayKey = dateKey(today)
  return {
    overall: current.overall,
    trend,
    habitScore: current.habitScore,
    focusScore: current.focusScore,
    consistency: current.consistency,
    focusMinutes7: current.focusMinutes7,
    activeHabits: active.length,
    doneToday: active.filter((h) => isDone(h, todayKey)).length,
    habitsToday: active.length
  }
}

/** Habit completions per day for the last `days` days, oldest first. */
export function completionSeries(state: FioState, days = 7, today = new Date()) {
  const active = state.habits.filter((h) => !h.archived)
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, -(days - 1) + i)
    const key = dateKey(date)
    const done = active.filter((h) => isDone(h, key)).length
    return {
      date,
      key,
      done,
      partial: active.filter((h) => (h.progressDates[key] ?? 0) > 0 && !isDone(h, key)).length
    }
  })
}

export { DAY_MS }
