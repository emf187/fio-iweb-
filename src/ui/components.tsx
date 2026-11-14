import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { renderMarkdown } from '../lib/markdown'
import { cssVarsFor, themeById } from '../lib/themes'
import { HABIT_COLORS, type Habit } from '../lib/types'
import { IconCheck, IconClose } from './icons'

/** Theme provider: applies the Fio settings (theme, accent, font scale) to CSS variables. */
export function FioTheme({ children, theme, accent, fontScale, reduceMotion }: {
  children: ReactNode
  theme: string
  accent?: string
  fontScale: number
  reduceMotion: boolean
}) {
  useEffect(() => {
    const vars = cssVarsFor(theme, accent ?? 'MINT', fontScale)
    const root = document.documentElement
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
    const p = themeById(theme)
    root.dataset.theme = p.light ? 'light' : 'dark'
    root.style.colorScheme = p.light ? 'light' : 'dark'
    document.body.style.background = 'var(--bg)'
    document.body.style.color = 'var(--text)'
  }, [theme, accent, fontScale])

  return (
    <div data-reduce={reduceMotion ? 'true' : undefined}>
      {children}
    </div>
  )
}

/**
 * Scoped theme preview: applies the palette to its own subtree only (custom
 * properties inherit), never touching the app's :root values.
 */
export function PreviewTheme({ theme, accent, children }: {
  theme: string
  accent?: string
  children: ReactNode
}) {
  const style = cssVarsFor(theme, accent ?? 'MINT', 0.85) as unknown as CSSProperties
  return <div style={style}>{children}</div>
}

export function ScreenHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="screen-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Card({ title, icon, children, className, style }: {
  title?: string
  icon?: ReactNode
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <section className={`card ${className ?? ''}`} style={style}>
      {title && (
        <h2 className="card-title">{icon}{title}</h2>
      )}
      {children}
    </section>
  )
}

export function Badge({ children, tone }: { children: ReactNode; tone?: 'accent' | 'danger' | 'warning' | 'info' | 'success' }) {
  return <span className={`badge ${tone ?? ''}`}>{children}</span>
}

export function Divider() {
  return <hr className="divider" />
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><IconClose /></button>
        </div>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

export function Dialog({ icon, title, children, actions }: {
  icon?: ReactNode
  title: string
  children: ReactNode
  actions: ReactNode
}) {
  return (
    <div className="dialog-backdrop">
      <div className="dialog">
        <h3>{icon}{title}</h3>
        <div className="dialog-text">{children}</div>
        <div className="dialog-actions">{actions}</div>
      </div>
    </div>
  )
}

/** Controlled field helpers */
export function TextField({ label, value, onChange, placeholder, multiline, type, maxLength }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
  type?: string
  maxLength?: number
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {multiline ? (
        <textarea className="input" value={value} placeholder={placeholder} maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="input" type={type ?? 'text'} value={value} placeholder={placeholder} maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  )
}

export function NumberField({ label, value, onChange, min, max, step, suffix }: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input className="input mono-num" type="number" value={Number.isFinite(value) ? value : 0}
        min={min} max={max} step={step}
        onChange={(e) => onChange(Number(e.target.value))} />
      {suffix && <div className="row-sub" style={{ marginTop: 4 }}>{suffix}</div>}
    </div>
  )
}

export function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className={`switch ${checked ? 'on' : ''}`} role="switch" aria-checked={checked}
      onClick={() => onChange(!checked)} type="button" />
  )
}

export function ChipRow({ options, value, onChange, render }: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
  render?: (v: string) => ReactNode
}) {
  return (
    <div className="chip-row">
      {options.map((o) => (
        <button key={o.value} type="button"
          className={`chip ${value === o.value ? 'selected' : ''}`}
          onClick={() => onChange(o.value)}>
          {render ? render(o.value) : o.label}
        </button>
      ))}
    </div>
  )
}

/** Ring progress (0-100). */
export function Ring({ percent, size, stroke, color, children }: {
  percent: number
  size?: number
  stroke?: number
  color?: string
  children?: ReactNode
}) {
  const s = size ?? 120
  const w = stroke ?? 10
  const r = (s - w) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, percent))
  return (
    <span className="ring-wrap" style={{ width: s, height: s }}>
      <svg width={s} height={s}>
        <circle cx={s / 2} cy={s / 2} r={r} stroke="var(--elevated)" strokeWidth={w} fill="none" />
        <circle
          cx={s / 2} cy={s / 2} r={r}
          stroke={color ?? 'var(--accent-strong)'}
          strokeWidth={w} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}
          transform={`rotate(-90 ${s / 2} ${s / 2})`}
        />
      </svg>
      <span className="ring-center">{children}</span>
    </span>
  )
}

export function habitColor(h: { colorIndex: number }): string {
  return HABIT_COLORS[Math.abs(h.colorIndex) % HABIT_COLORS.length]
}

/** GitHub-style habit heatmap for the last `days` days ending today. */
export function Heatmap({ habit, days, isDone, progressOf }: {
  habit: Habit
  days: number
  isDone: (h: Habit, key: string) => boolean
  progressOf: (h: Habit, key: string) => number
}) {
  const cells = useMemo(() => {
    const out: { key: string; done: boolean; partial: boolean }[] = []
    const now = new Date()
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = dateKeyLocal(d)
      out.push({ key, done: isDone(habit, key), partial: !isDone(habit, key) && progressOf(habit, key) > 0 })
    }
    return out
  }, [habit, days, isDone, progressOf])
  return (
    <div className="heat-grid">
      {cells.map((c) => (
        <span key={c.key} className="heat-cell"
          title={c.key}
          style={{
            background: c.done ? habitColor(habit) : c.partial ? 'color-mix(in srgb, ' + habitColor(habit) + ' 40%, var(--elevated))' : undefined
          }} />
      ))}
    </div>
  )
}

export function dateKeyLocal(d: Date): string {
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Weekly bars (0..max). */
export function Bars({ values, labels, color }: { values: number[]; labels: string[]; color?: string }) {
  const max = Math.max(1, ...values)
  return (
    <div className="bar-chart">
      {values.map((v, i) => (
        <div key={i} className="bar-col">
          <div className="bar-fill" style={{ height: `${(v / max) * 100}%`, background: color ?? 'var(--accent)' }} />
          <span className="bar-label">{labels[i]}</span>
        </div>
      ))}
    </div>
  )
}

export function Markdown({ text }: { text: string }) {
  return <div className="md-body">{renderMarkdown(text)}</div>
}

/** Small toast message. */
export function useToast(): [string | null, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    if (!msg) return
    const t = window.setTimeout(() => setMsg(null), 2600)
    return () => window.clearTimeout(t)
  }, [msg])
  return [msg, setMsg]
}

export function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null
  return <div className="toast">{msg}</div>
}

export function CheckDone({ size }: { size?: number }) {
  return (
    <span style={{
      width: size ?? 44, height: size ?? 44, borderRadius: '50%',
      background: 'var(--accent)', color: '#fff', display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0
    }}>
      <IconCheck width={20} height={20} />
    </span>
  )
}
