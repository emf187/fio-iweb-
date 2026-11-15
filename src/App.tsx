import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { useFio } from './lib/store'
import { getTimer, timerRunning } from './lib/focus'
import { FioTheme } from './ui/components'
import {
  IconBook, IconCalc, IconCalendar, IconClose, IconHeart, IconHome,
  IconInsights, IconMenu, IconNote, IconPhoto, IconRepeat, IconSchedule,
  IconSchool, IconSettings, IconTimer
} from './ui/icons'
import type { Screen } from './appTypes'
import { Dashboard } from './screens/Dashboard'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { CalendarScreen } from './screens/CalendarScreen'
import { TimetableScreen } from './screens/TimetableScreen'
import { StudyScreen } from './screens/StudyScreen'
import { TutorScreen } from './screens/TutorScreen'
import { CalculatorScreen } from './screens/CalculatorScreen'
import { FocusScreen } from './screens/FocusScreen'
import { NotesScreen } from './screens/NotesScreen'
import { GalleryScreen } from './screens/GalleryScreen'
import { HealthScreen } from './screens/HealthScreen'
import { HabitsScreen } from './screens/HabitsScreen'
import { ProgressScreen } from './screens/ProgressScreen'
import { SettingsScreen } from './screens/SettingsScreen'

/** Drawer order mirrors the Android FioScreen enum exactly. */
const NAV: { id: Screen; label: string; icon: ReactNode }[] = [
  { id: 'DASHBOARD', label: 'Home', icon: <IconHome /> },
  { id: 'CALENDAR', label: 'Calendar', icon: <IconCalendar /> },
  { id: 'TIMETABLE', label: 'Timetable', icon: <IconSchedule /> },
  { id: 'STUDY', label: 'Study', icon: <IconBook /> },
  { id: 'TUTOR', label: 'Tutor', icon: <IconSchool /> },
  { id: 'CALCULATOR', label: 'Calculator', icon: <IconCalc /> },
  { id: 'TIMER', label: 'Focus timer', icon: <IconTimer /> },
  { id: 'NOTES', label: 'Notes', icon: <IconNote /> },
  { id: 'GALLERY', label: 'Gallery', icon: <IconPhoto /> },
  { id: 'HEALTH', label: 'Health', icon: <IconHeart /> },
  { id: 'HABITS', label: 'Habits', icon: <IconRepeat /> },
  { id: 'STATS', label: 'Progress', icon: <IconInsights /> }
]

export function App() {
  const state = useFio()
  const [screen, setScreen] = useState<Screen>('DASHBOARD')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)
  const [, setPulse] = useState(0)

  const updateSW = useMemo(() => registerSW({
    onNeedRefresh: () => setUpdateReady(true)
  }), [])

  // Live focus-timer chip in the top bar (re-render each second while running).
  const ts = getTimer(state)
  const running = timerRunning(ts)
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setPulse((p) => p + 1), 1000)
    return () => window.clearInterval(id)
  }, [running])

  const go = (s: Screen) => {
    setScreen(s)
    setDrawerOpen(false)
    window.scrollTo({ top: 0 })
  }

  const remaining = Math.max(0, Math.floor(
    ts.phase === 'FOCUS' ? (ts.focusEndsAt - Date.now()) / 1000 :
    ts.phase === 'BREAK' ? (ts.breakEndsAt - Date.now()) / 1000 :
    ts.phase === 'EMERGENCY' ? (ts.emergencyEndsAt - Date.now()) / 1000 : 0
  ))
  const chipTime = `${`${Math.floor(remaining / 60)}`.padStart(2, '0')}:${`${remaining % 60}`.padStart(2, '0')}`

  return (
    <FioTheme
      theme={state.settings.theme}
      accent={state.settings.accentColor}
      fontScale={state.settings.fontScale}
      reduceMotion={state.settings.reduceMotion}
    >
      {!state.setupDone ? (
        <OnboardingScreen />
      ) : (
        <div className="app-shell">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <IconMenu />
          </button>
          <span className="topbar-title">Fio</span>
          {running ? (
            <button className="topbar-timer" onClick={() => go('TIMER')} aria-label="Open focus timer">
              {ts.phase === 'FOCUS' ? '' : ts.phase === 'BREAK' ? '☀ ' : '⏸ '}
              {chipTime}
            </button>
          ) : (
            <span className="topbar-spacer" />
          )}
        </header>

        {screen === 'DASHBOARD' && <Dashboard go={go} />}
        {screen === 'CALENDAR' && <CalendarScreen />}
        {screen === 'TIMETABLE' && <TimetableScreen />}
        {screen === 'STUDY' && <StudyScreen />}
        {screen === 'TUTOR' && <TutorScreen />}
        {screen === 'CALCULATOR' && <CalculatorScreen />}
        {screen === 'TIMER' && <FocusScreen />}
        {screen === 'NOTES' && <NotesScreen />}
        {screen === 'GALLERY' && <GalleryScreen />}
        {screen === 'HEALTH' && <HealthScreen />}
        {screen === 'HABITS' && <HabitsScreen />}
        {screen === 'STATS' && <ProgressScreen go={(s) => go(s as Screen)} />}
        {screen === 'SETTINGS' && <SettingsScreen />}

        {drawerOpen && (
          <>
            <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} />
            <nav className="drawer">
              <div className="drawer-profile">
                <h1>{state.profileName || 'Fio'}</h1>
                <p>Your planner, everywhere.</p>
              </div>
              <div className="drawer-section">Menu</div>
              {NAV.map((item) => (
                <button
                  key={item.id}
                  className={`drawer-item ${screen === item.id ? 'active' : ''}`}
                  onClick={() => go(item.id)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
              <div className="drawer-footer">
                <button
                  className={`drawer-item ${screen === 'SETTINGS' ? 'active' : ''}`}
                  onClick={() => go('SETTINGS')}
                >
                  <IconSettings />
                  <span>Settings</span>
                </button>
                <button className="drawer-item" onClick={() => setDrawerOpen(false)}>
                  <IconClose />
                  <span>Close</span>
                </button>
              </div>
            </nav>
          </>
        )}

        {updateReady && (
          <button className="toast" style={{ cursor: 'pointer', border: 'none' }} onClick={() => void updateSW(true)}>
            Update ready — tap to refresh
          </button>
        )}
        </div>
      )}
    </FioTheme>
  )
}
