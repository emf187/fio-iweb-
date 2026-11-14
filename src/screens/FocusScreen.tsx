import { useEffect, useRef, useState } from 'react'
import { useFio, update } from '../lib/store'
import {
  consumeFinishedTimer, getTimer, resetTimer, startTimer, stopTimer,
  tickTimer, timerRunning, toggleEmergencyPause
} from '../lib/focus'
import { formatTimestampWeb } from '../lib/format'
import { Badge, Card, Dialog, Empty, ScreenHeader } from '../ui/components'
import { IconPause, IconPlay, IconRefresh, IconStop, IconTimer } from '../ui/icons'

/**
 * Focus timer — the web twin of the Android TimerLockdownScreen. The
 * countdown is wall-clock based and re-rendered every second by the pulse;
 * closing the page changes nothing — the running session is persisted and
 * resumes (and finishes) by timestamp.
 */
export function FocusScreen() {
  const state = useFio()
  const settings = state.settings
  const ts = getTimer(state)
  const isRunning = timerRunning(ts)

  // One-second pulse: drives the tick (like the Android screen loop).
  const [, setPulse] = useState(0)
  const finishedRef = useRef(false)
  useEffect(() => {
    const id = window.setInterval(() => {
      tickTimer()
      setPulse((p) => p + 1)
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  const [selectedMinutes, setSelectedMinutes] = useState(50)

  // Surface the finish dialog exactly once per completion.
  const showSummary = ts.phase === 'DONE' && ts.finishedStatus !== null && !finishedRef.current
  useEffect(() => {
    if (!showSummary) finishedRef.current = ts.finishedStatus !== null
  }, [showSummary, ts.finishedStatus])

  const now = Date.now()
  const displaySeconds = Math.max(0, Math.floor(
    ts.phase === 'FOCUS' ? (ts.focusEndsAt - now) / 1000 :
    ts.phase === 'BREAK' ? (ts.breakEndsAt - now) / 1000 :
    ts.phase === 'EMERGENCY' ? (ts.emergencyEndsAt - now) / 1000 : 0
  ))
  const mins = Math.floor(displaySeconds / 60)
  const secs = displaySeconds % 60
  const timeString = `${`${mins}`.padStart(2, '0')}:${`${secs}`.padStart(2, '0')}`

  const statusText = ts.phase === 'EMERGENCY'
    ? `EMERGENCY PAUSED (${Math.max(0, Math.floor((ts.emergencyEndsAt - now) / 1000))}s left)`
    : ts.phase === 'BREAK' ? 'REST BREAK — free to leave, no strikes'
    : ts.phase === 'FOCUS' ? 'FOCUSING'
    : ts.phase === 'DONE' ? 'SESSION OVER'
    : 'TIMER READY'

  const statusTone = ts.phase === 'EMERGENCY' ? 'warning' : ts.phase === 'BREAK' ? 'info' : ts.phase === 'FOCUS' ? 'accent' : undefined

  const start = () => {
    startTimer(selectedMinutes, settings.breakFrequencyMinutes, settings.breakDurationMinutes)
    finishedRef.current = false
  }

  return (
    <div className="screen">
      <ScreenHeader
        title="Focus"
        subtitle="One session at a time. It keeps counting even when you leave Fio."
      />

      <Card>
        <div className="timer-status">
          <Badge tone={statusTone}>{statusText}</Badge>
        </div>

        <div className={`timer-circle ${ts.phase === 'BREAK' ? 'break' : ts.phase === 'EMERGENCY' ? 'paused' : ''}`}>
          <div style={{ textAlign: 'center' }}>
            <div className="timer-time">{timeString}</div>
            <div className="timer-sub">{ts.phase === 'BREAK' ? 'Break ends soon' : `${ts.plannedMinutes} min session`}</div>
          </div>
        </div>

        {!isRunning && ts.phase !== 'DONE' && (
          <>
            <div className="field">
              <label>Session length</label>
              <div className="chip-row">
                {[25, 50, 90, 120, 180].map((m) => (
                  <button key={m} className={`chip ${selectedMinutes === m ? 'selected' : ''}`}
                    onClick={() => setSelectedMinutes(m)}>
                    {m}m
                  </button>
                ))}
              </div>
            </div>
            <div className="btn-row">
              <button className="btn primary" onClick={start}>
                <IconPlay width={16} height={16} /> Start Session
              </button>
            </div>
            <div className="btn-row">
              <button className="btn ghost" onClick={() => { resetTimer(); finishedRef.current = false }}>
                <IconRefresh width={15} height={15} /> Reset Timer
              </button>
            </div>
            <div className="row-sub" style={{ marginTop: 10 }}>
              Scheduled breaks every {settings.breakFrequencyMinutes} min ({settings.breakDurationMinutes} min long).
              Lockdown strikes are an Android feature — on web, focus time is kept honestly by timestamp.
            </div>
          </>
        )}

        {isRunning && (
          <>
            <div className="btn-row">
              <button className="btn" onClick={() => toggleEmergencyPause()}
                disabled={ts.emergencyUsed && ts.phase !== 'EMERGENCY'}>
                <IconPause width={16} height={16} />
                {ts.phase === 'EMERGENCY' ? 'Resume' : ts.emergencyUsed ? 'Pause used' : '1× Pause'}
              </button>
              <button className="btn" onClick={() => { stopTimer(); }}>
                <IconStop width={16} height={16} /> Stop
              </button>
            </div>
            <div className="btn-row">
              <button className="btn ghost" onClick={() => { resetTimer(); finishedRef.current = false }}>
                <IconRefresh width={15} height={15} /> Reset Timer
              </button>
            </div>
          </>
        )}

        {ts.phase === 'DONE' && !showSummary && (
          <div className="btn-row">
            <button className="btn primary" onClick={() => { consumeFinishedTimer(); finishedRef.current = false }}>
              Start again
            </button>
          </div>
        )}
      </Card>

      <Card title={`Session History (${state.sessionLogs.length})`} icon={<IconTimer width={16} height={16} />}>
        {state.sessionLogs.length === 0 && <Empty>Completed and stopped sessions land here.</Empty>}
        {state.sessionLogs.slice(0, 20).map((log) => {
          const ok = log.status === 'COMPLETED'
          return (
            <div className="row-item" key={log.id}>
              <div className="row-main">
                <div className="row-title">{log.title}</div>
                <div className="row-sub">
                  Strikes used: {log.strikesUsed}/{log.startingStrikes} · Breaks: {log.breaksTaken} · Logged: {formatTimestampWeb(log.loggedAtMillis)}
                </div>
              </div>
              <Badge tone={ok ? 'success' : 'danger'}>{log.actualMinutes}m / {log.plannedMinutes}m</Badge>
            </div>
          )
        })}
      </Card>

      {showSummary && ts.finishedStatus && (
        <Dialog
          icon={<span style={{ color: 'var(--success)' }}><IconPlay width={20} height={20} /></span>}
          title="Session Finished!"
          actions={
            <button className="btn primary" onClick={() => { consumeFinishedTimer(); finishedRef.current = true }}>
              Done
            </button>
          }
        >
          <p>Great work staying in deep focus.</p>
          <div className="card elevated" style={{ marginTop: 10 }}>
            <div>• Time focused: {ts.alreadyFocusedMinutes} min</div>
            <div>• Breaks taken: {ts.breaksTaken}</div>
            <div>• Logged into Study &amp; Life Stats</div>
          </div>
        </Dialog>
      )}
    </div>
  )
}
