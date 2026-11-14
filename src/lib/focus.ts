import { getState, update } from './store'
import { INITIAL_TIMER, uid, type SessionLog, type SessionStatus, type TimerState } from './types'

/**
 * Focus timer, web edition. Same model as the Android FocusTimer singleton:
 * remaining time is always recomputed from the wall clock (`endsAt - now`),
 * so a throttled browser tab never corrupts the countdown — the next tick
 * snaps back. The running session lives in the persisted state document, so a
 * reload or app switch resumes correctly.
 *
 * Browser reality (vs Android): no alarm while the tab is fully closed and no
 * lockdown enforcement — the timer still keeps correct time in the
 * background, and finishing while closed is detected on the next visit.
 */

export type { TimerPhase, TimerState } from './types'

export function getTimer(s: { timer?: TimerState }): TimerState {
  return s.timer ?? INITIAL_TIMER
}

export function timerRunning(t: TimerState): boolean {
  return t.phase === 'FOCUS' || t.phase === 'BREAK' || t.phase === 'EMERGENCY'
}

function setTimer(fn: (t: TimerState) => TimerState): void {
  update((s) => ({ ...s, timer: fn(getTimer(s)) }))
}

export function startTimer(minutes: number, breakFreqMinutes: number, breakDurationMinutes: number): void {
  const now = Date.now()
  setTimer(() => ({
    ...INITIAL_TIMER,
    phase: 'FOCUS',
    plannedMinutes: minutes,
    focusEndsAt: now + minutes * 60_000,
    breakFreqMinutes: Math.max(1, breakFreqMinutes),
    breakDurationMinutes: Math.max(1, breakDurationMinutes),
    lastBreakMark: -1
  }))
}

export function tickTimer(now: number = Date.now()): void {
  const s = getTimer(getState())
  if (!timerRunning(s)) return

  if (s.phase === 'FOCUS') {
    const remaining = s.focusEndsAt - now
    const focused = Math.max(0, Math.floor((s.plannedMinutes * 60_000 - remaining) / 60_000))
    if (remaining <= 0) {
      finishTimer('COMPLETED', s.plannedMinutes)
      return
    }
    const elapsedSeconds = s.plannedMinutes * 60 - Math.floor(remaining / 1000)
    const breakDue =
      s.plannedMinutes >= s.breakFreqMinutes &&
      elapsedSeconds > 0 &&
      elapsedSeconds % (s.breakFreqMinutes * 60) === 0 &&
      elapsedSeconds !== s.lastBreakMark &&
      remaining > 5 * 60_000
    if (breakDue) {
      setTimer((c) => ({
        ...c,
        phase: 'BREAK',
        breakEndsAt: now + c.breakDurationMinutes * 60_000,
        alreadyFocusedMinutes: focused,
        lastBreakMark: elapsedSeconds
      }))
    } else if (focused !== s.alreadyFocusedMinutes) {
      setTimer((c) => ({ ...c, alreadyFocusedMinutes: focused }))
    }
  } else if (s.phase === 'BREAK') {
    if (s.breakEndsAt - now <= 0) {
      setTimer((c) => ({ ...c, phase: 'FOCUS', breaksTaken: c.breaksTaken + 1 }))
    }
  } else if (s.phase === 'EMERGENCY') {
    if (s.emergencyEndsAt - now <= 0) {
      setTimer((c) => ({ ...c, phase: 'FOCUS' }))
    }
  }
}

/** One emergency pause per session, 5 minutes, auto-resumes. */
export function toggleEmergencyPause(): void {
  setTimer((cur) => {
    if (cur.phase === 'FOCUS' && !cur.emergencyUsed) {
      return {
        ...cur,
        phase: 'EMERGENCY',
        emergencyEndsAt: Date.now() + 5 * 60_000,
        emergencyUsed: true
      }
    }
    if (cur.phase === 'EMERGENCY') return { ...cur, phase: 'FOCUS' }
    return cur
  })
}

/** Stop pressed by the user: log what happened so far and end. */
export function stopTimer(): void {
  const s = getTimer(getState())
  if (!timerRunning(s)) return
  finishTimer('COMPLETED', Math.max(0, s.alreadyFocusedMinutes))
}

/** Clear everything back to the setup state (no log entry). */
export function resetTimer(): void {
  setTimer(() => ({ ...INITIAL_TIMER }))
}

/** Summary dialog shown once — the screen consumes and clears it. */
export function consumeFinishedTimer(): void {
  setTimer((cur) => {
    if (cur.phase === 'DONE' && cur.finishedStatus) {
      return {
        ...INITIAL_TIMER,
        plannedMinutes: cur.plannedMinutes,
        breakFreqMinutes: cur.breakFreqMinutes,
        breakDurationMinutes: cur.breakDurationMinutes
      }
    }
    return cur
  })
}

function finishTimer(status: SessionStatus, actualMinutes: number): void {
  const cur = getTimer(getState())
  const log: SessionLog = {
    id: uid(),
    title: 'Focus Session',
    plannedMinutes: cur.plannedMinutes,
    actualMinutes,
    isLockdownEnabled: false,
    startingStrikes: 1,
    strikesUsed: 0,
    breaksTaken: cur.breaksTaken,
    status,
    loggedAtMillis: Date.now()
  }
  update((s) => ({
    ...s,
    sessionLogs: [log, ...s.sessionLogs],
    timer: {
      ...getTimer(s),
      phase: 'DONE',
      alreadyFocusedMinutes: actualMinutes,
      finishedStatus: status
    }
  }))
}
