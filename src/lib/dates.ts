export const DAY_MS = 86_400_000

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function dateKey(d: Date | number = new Date()): string {
  const x = typeof d === 'number' ? new Date(d) : d
  const y = x.getFullYear()
  const m = `${x.getMonth() + 1}`.padStart(2, '0')
  const day = `${x.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Monday-based start of the week. */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d)
  const wd = (x.getDay() + 6) % 7
  return addDays(x, -wd)
}

/** Seven days beginning Monday. */
export function weekDays(today: Date): Date[] {
  const start = startOfWeek(today)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function formatDayLong(d: Date): string {
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
}

export function formatDayShort(d: Date): string {
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

export function formatMonth(d: Date): string {
  return d.toLocaleDateString([], { month: 'long', year: 'numeric' })
}

export function weekdayNarrow(d: Date): string {
  return d.toLocaleDateString([], { weekday: 'narrow' })
}

export function weekdayShort(d: Date): string {
  return d.toLocaleDateString([], { weekday: 'short' })
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function monthGrid(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const start = startOfWeek(first)
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}
