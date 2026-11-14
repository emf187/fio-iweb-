import { useMemo } from 'react'
import { useFio } from '../lib/store'
import { addDays } from '../lib/dates'
import { SECTION_TYPES, type SectionType } from '../lib/types'
import { Badge, Bars, Card } from './components'
import { IconInsights } from './icons'

/**
 * Shared Focus statistics for web: totals, a 7-day minutes graph, and the
 * Study / Leisure / Research split. Used on the Focus screen (below setup)
 * and in the Habits tracker section, exactly like the Android build.
 */

export const PURPOSE_LABELS: Record<SectionType, string> = {
  STUDY: 'Study',
  LEISURE: 'Leisure',
  RESEARCH: 'Research'
}

export const PURPOSE_EMOJI: Record<SectionType, string> = {
  STUDY: '📖',
  LEISURE: '🎮',
  RESEARCH: '🔬'
}

export function purposeColor(type: SectionType): string {
  if (type === 'STUDY') return 'var(--accent-strong)'
  if (type === 'LEISURE') return 'var(--info)'
  return 'var(--warning)'
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function FocusStatsCard() {
  const state = useFio()
  const logs = state.sessionLogs

  const week = useMemo(() => {
    const base = new Date()
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(base, -6 + i)
      const start = new Date(day)
      start.setHours(0, 0, 0, 0)
      const end = start.getTime() + 86_400_000
      const minutes = logs
        .filter((l) => l.loggedAtMillis >= start.getTime() && l.loggedAtMillis < end)
        .reduce((sum, l) => sum + l.actualMinutes, 0)
      return { minutes, label: DAY_LETTERS[day.getDay()] }
    })
  }, [logs])

  const total = logs.reduce((sum, l) => sum + l.actualMinutes, 0)
  const weekTotal = week.reduce((sum, d) => sum + d.minutes, 0)
  const avg = logs.length ? Math.round(total / logs.length) : 0

  const purposes = SECTION_TYPES.map((type) => ({
    type,
    minutes: logs
      .filter((l) => (l.sectionType ?? 'STUDY') === type)
      .reduce((sum, l) => sum + l.actualMinutes, 0)
  }))

  return (
    <Card title="Focus Stats" icon={<IconInsights width={17} height={17} />}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6 }}>
        <Badge tone="accent">{total}m total</Badge>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 6 }}>
        {[
          ['This week', `${weekTotal}m`],
          ['Sessions', `${logs.length}`],
          ['Avg / session', logs.length ? `${avg}m` : '—']
        ].map(([label, value]) => (
          <div key={label} className="card elevated" style={{ marginTop: 0, padding: '10px 6px', textAlign: 'center' }}>
            <div className="mono-num" style={{ fontWeight: 800, fontSize: '1.05rem' }}>{value}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        <Bars values={week.map((d) => d.minutes)} labels={week.map((d) => d.label)} />
      </div>

      {total === 0 ? (
        <div className="row-sub" style={{ marginTop: 12 }}>
          Start a session to see your Study / Leisure / Research split.
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          {purposes.map(({ type, minutes }) => {
            const share = total > 0 ? (minutes / total) * 100 : 0
            return (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: '0.8rem' }}>
                <span style={{ width: 78, flexShrink: 0 }}>
                  {PURPOSE_EMOJI[type]} {PURPOSE_LABELS[type]}
                </span>
                <div style={{ flex: 1, height: 6, background: 'var(--elevated)', borderRadius: 3 }}>
                  <div style={{ width: `${share}%`, height: 6, background: purposeColor(type), borderRadius: 3 }} />
                </div>
                <span className="mono-num" style={{ color: 'var(--muted)' }}>{minutes}m</span>
              </div>
            )
          })}
        </div>
      )}

      <div className="row-sub" style={{ marginTop: 12 }}>
        Focus minutes feed your Study stats and Life Score.
      </div>
    </Card>
  )
}
