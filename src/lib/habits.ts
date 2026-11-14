import { dateKey, DAY_MS, addDays, parseKey, startOfDay, weekDays } from './dates'
import { HABIT_COLORS, type Habit } from './types'

export function habitColor(h: Habit): string {
  return HABIT_COLORS[Math.abs(h.colorIndex) % HABIT_COLORS.length]
}

export function isDone(h: Habit, key: string): boolean {
  return h.completedDates.includes(key)
}

export function isPartial(h: Habit, key: string): boolean {
  return !isDone(h, key) && (h.progressDates[key] ?? 0) > 0
}

/** Consecutive completed days, counting back from today (yesterday allowed). */
export function computeStreak(h: Habit, today = new Date()): number {
  let cursor = startOfDay(today)
  if (!isDone(h, dateKey(cursor))) cursor = addDays(cursor, -1)
  let streak = 0
  while (isDone(h, dateKey(cursor))) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function computeBestStreak(h: Habit): number {
  const keys = [...h.completedDates].sort()
  let best = 0
  let run = 0
  let prev = 0
  for (const key of keys) {
    const t = parseKey(key).getTime()
    run = prev !== 0 && t - prev === DAY_MS ? run + 1 : 1
    prev = t
    if (run > best) best = run
  }
  return best
}

/** Completion percentage over the trailing window, capped at the habit's age. */
export function completionRate(h: Habit, days = 30, today = new Date()): number {
  const created = startOfDay(new Date(h.loggedAtMillis)).getTime()
  const windowStart = addDays(startOfDay(today), -(days - 1)).getTime()
  const start = Math.max(created, windowStart)
  const total = Math.max(1, Math.round((startOfDay(today).getTime() - start) / DAY_MS) + 1)
  let done = 0
  for (let i = 0; i < total; i += 1) {
    if (isDone(h, dateKey(addDays(startOfDay(today), -i)))) done += 1
  }
  return Math.round((done / total) * 100)
}

export function withComputedStats(h: Habit, today = new Date()): Habit {
  return { ...h, streak: computeStreak(h, today), bestStreak: computeBestStreak(h) }
}

/** Set a day fully done or cleared (heatmap editing). */
export function toggleHabitDay(h: Habit, key: string, done: boolean): Habit {
  const goal = Math.max(1, h.dailyGoal)
  const completed = new Set(h.completedDates)
  const progress = { ...h.progressDates }
  if (done) {
    completed.add(key)
    progress[key] = goal
  } else {
    completed.delete(key)
    delete progress[key]
  }
  return withComputedStats({
    ...h,
    completedDates: [...completed].sort(),
    progressDates: progress,
    lastCompletedAtMillis: done ? Date.now() : h.lastCompletedAtMillis
  })
}

/** Tap-to-log for today: +1, completes at the goal, and a tap when done clears it. */
export function progressHabit(h: Habit, key = dateKey()): Habit {
  const goal = Math.max(1, h.dailyGoal)
  const current = h.progressDates[key] ?? (isDone(h, key) ? goal : 0)
  if (current >= goal) return toggleHabitDay(h, key, false)
  const next = current + 1
  const completed =
    next >= goal ? [...new Set([...h.completedDates, key])].sort() : h.completedDates
  return withComputedStats({
    ...h,
    progressDates: { ...h.progressDates, [key]: next },
    completedDates: completed,
    lastCompletedAtMillis: next >= goal ? Date.now() : h.lastCompletedAtMillis
  })
}

export function totalDone(h: Habit): number {
  return h.completedDates.length
}

export function doneThisWeek(h: Habit, today = new Date()): number {
  return weekDays(today).filter((d) => isDone(h, dateKey(d))).length
}

export function streakLabel(n: number): string {
  if (n <= 0) return 'No streak yet'
  return n === 1 ? '1 day streak' : `${n} day streak`
}
