import { useEffect, useState } from 'react'
import { useFio, update } from '../lib/store'
import { exportBackup, mergeBackup, parseBackup } from '../lib/backup'
import { requestPersistence, estimateStorage } from '../lib/db'
import { ACCENTS, THEMES } from '../lib/themes'
import { Badge, Card, PreviewTheme, Modal, ScreenHeader, Switch, TextField, NumberField, Toast, useToast } from '../ui/components'
import { IconDownload, IconKey, IconMoon, IconSettings, IconTarget, IconUpload } from '../ui/icons'

const PROVIDERS: [string, string, string][] = [
  // (id, label, base URL default)
  ['Google Gemini', 'Gemini', 'https://generativelanguage.googleapis.com/v1beta/openai'],
  ['OpenRouter', 'OpenRouter', 'https://openrouter.ai/api/v1'],
  ['Custom', 'Custom', '']
]

const GEMINI_MODELS: [string, string][] = [
  ['gemini-3.8-flash', 'Default — current flagship'],
  ['gemini-3.6-flash', 'Fast — free tier'],
  ['gemini-3.5-flash-lite', 'Light — free tier'],
  ['gemini-3.1-flash-lite', 'Lightest — free tier']
]

export function SettingsScreen() {
  const state = useFio()
  const settings = state.settings
  const [toast, showToast] = useToast()
  const [backupMode, setBackupMode] = useState<'EXPORT' | 'IMPORT' | 'MERGE' | null>(null)
  const [backupJson, setBackupJson] = useState('')
  const [storageUsed, setStorageUsed] = useState<string | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)

  useEffect(() => {
    void (async () => {
      setStorageUsed(await estimateStorage())
      if (navigator.storage?.persisted) {
        try { setPersisted(await navigator.storage.persisted()) } catch { /* ignore */ }
      }
    })()
  }, [])

  const set = (patch: Partial<typeof settings>) => {
    update((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
  }

  const exportJson = exportBackup(state)

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportJson)
      showToast('Backup copied to clipboard')
    } catch {
      showToast('Copy failed — select the text and copy manually')
    }
  }

  const downloadExport = () => {
    const stamp = new Date().toISOString().slice(0, 10)
    const blob = new Blob([exportJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fio-backup-${stamp}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Backup downloaded')
  }

  const applyImport = (mode: 'IMPORT' | 'MERGE') => {
    if (!backupJson.trim()) return
    if (mode === 'IMPORT') {
      const parsed = parseBackup(backupJson)
      if (!parsed) {
        showToast('Invalid backup format')
        return
      }
      update(() => parsed)
      showToast('Imported successfully!')
    } else {
      const merged = mergeBackup(state, backupJson)
      if (!merged) {
        showToast('Invalid backup format')
        return
      }
      update(() => merged)
      showToast('Merged — newest data wins')
    }
    setBackupMode(null)
    setBackupJson('')
  }

  const askPersist = async () => {
    const ok = await requestPersistence()
    setPersisted(ok)
    showToast(ok ? 'Storage will not be cleaned up automatically' : 'The browser declined — keep regular backups')
  }

  return (
    <div className="screen">
      <ScreenHeader title="Settings" subtitle="Make Fio yours." />

      {/* -------------------------------------------- profile */}
      <Card title="Profile" icon={<IconSettings width={16} height={16} />}>
        <TextField
          label="Your name"
          value={state.profileName}
          onChange={(v) => update((s) => ({ ...s, profileName: v }))}
          placeholder="e.g. Mike"
          maxLength={40}
        />
      </Card>

      {/* -------------------------------------------- AI */}
      <Card title="AI assistant" icon={<IconKey width={16} height={16} />}>
        <div className="row-sub" style={{ marginTop: 0 }}>
          Add a key from your AI provider. It stays on this device.
        </div>
        <ProviderPicker
          value={settings.aiProvider}
          onChange={(providerId) => {
            const found = PROVIDERS.find((p) => p[0] === providerId)
            if (!found) return
            const patch: Partial<typeof settings> = { aiProvider: providerId }
            if (providerId === 'Google Gemini') {
              patch.aiBaseUrl = found[2]
              if (!settings.aiModelName || settings.aiModelName.includes('/')) {
                patch.aiModelName = 'gemini-3.8-flash'
              }
            } else if (providerId === 'OpenRouter') {
              patch.aiBaseUrl = found[2]
              if (!settings.aiModelName || !settings.aiModelName.includes('/')) {
                patch.aiModelName = 'google/gemini-2.0-flash-001'
              }
            }
            set(patch)
          }}
        />
        <TextField
          label="API Key"
          value={settings.aiApiKey}
          onChange={(v) => set({ aiApiKey: v })}
          placeholder="Paste your key"
          type="password"
        />
        {settings.aiProvider === 'Google Gemini' && (
          <>
            <a className="text-btn" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
              Get a free Gemini API key
            </a>
            <div className="field">
              <label>Choose Gemini model</label>
              <div className="chip-row">
                {GEMINI_MODELS.map(([model, note]) => (
                  <button key={model}
                    className={`chip ${settings.aiModelName === model ? 'selected' : ''}`}
                    title={note}
                    onClick={() => set({ aiModelName: model })}>
                    {model}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <TextField
          label="Base URL"
          value={settings.aiBaseUrl}
          onChange={(v) => set({ aiBaseUrl: v })}
          placeholder="https://…"
        />
        <TextField
          label="Model identifier"
          value={settings.aiModelName}
          onChange={(v) => set({ aiModelName: v })}
          placeholder="model id"
        />
        <div className="row-sub" style={{ marginTop: 10 }}>
          Works with any OpenAI-compatible endpoint (Gemini's compatibility layer, OpenRouter, Ollama, LM Studio…).
        </div>
      </Card>

      {/* -------------------------------------------- look and feel */}
      <Card title="Look and feel" icon={<IconMoon width={16} height={16} />}>
        <div className="field">
          <label>Theme</label>
          <div className="theme-grid">
            {THEMES.map((t) => (
              <button key={t.id}
                className={`theme-swatch ${settings.theme === t.id ? 'selected' : ''}`}
                style={{ background: t.bg, color: t.text, borderColor: settings.theme === t.id ? t.accent : t.border }}
                onClick={() => set({ theme: t.id })}>
                <span style={{ background: t.accent }} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Accent</label>
          <div className="chip-row">
            {ACCENTS.map((a) => {
              const selected = settings.accentColor === a.id
              return (
                <button key={a.id} className={`chip ${selected ? 'selected' : ''}`}
                  onClick={() => set({ accentColor: a.id })}
                  style={selected ? { color: a.swatch } : undefined}>
                  <span style={{
                    width: 11, height: 11, borderRadius: '50%', background: a.swatch,
                    display: 'inline-block', marginRight: 6
                  }} />
                  {a.label}
                </button>
              )
            })}
          </div>
        </div>
        <div className="switch-row">
          <div>
            <div className="label">Reduce motion</div>
            <div className="hint">Turns off extra animation. Easier on older devices.</div>
          </div>
          <Switch checked={settings.reduceMotion} onChange={(v) => set({ reduceMotion: v })} />
        </div>
        <div className="field">
          <label>Text size</label>
          <div className="chip-row">
            {([['S', 0.92], ['M', 1], ['L', 1.14]] as const).map(([label, scale]) => (
              <button key={label}
                className={`chip ${Math.abs(settings.fontScale - scale) < 0.03 ? 'selected' : ''}`}
                onClick={() => set({ fontScale: scale })}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <LivePreview theme={settings.theme} accent={settings.accentColor} />
      </Card>

      {/* -------------------------------------------- focus rules */}
      <Card title="Focus rules" icon={<IconTarget width={16} height={16} />}>
        <div className="row-sub" style={{ marginTop: 0 }}>
          How often you get breaks during a focus session, and how long they run.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <NumberField label="Break every (minutes)" value={settings.breakFrequencyMinutes}
            onChange={(v) => set({ breakFrequencyMinutes: Math.max(1, Math.round(v) || 1) })} min={1} max={180} />
          <NumberField label="Break length (minutes)" value={settings.breakDurationMinutes}
            onChange={(v) => set({ breakDurationMinutes: Math.max(1, Math.round(v) || 1) })} min={1} max={60} />
        </div>
        <div className="row-sub">
          Grace periods and lockdown strikes are Android features. On web, one emergency pause (5 minutes) is available per session.
        </div>
      </Card>

      {/* -------------------------------------------- health targets */}
      <Card title="Health targets" icon={<IconTarget width={16} height={16} />}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <NumberField label="Sleep target (hours)" value={settings.sleepTargetHours}
            onChange={(v) => set({ sleepTargetHours: Math.max(0, v) })} min={0} max={14} step={0.5} />
          <NumberField label="Meals per day" value={settings.mealTargetCount}
            onChange={(v) => set({ mealTargetCount: Math.max(0, Math.round(v) || 0) })} min={0} max={10} />
        </div>
      </Card>

      {/* -------------------------------------------- backup */}
      <Card title="Backup" icon={<IconDownload width={16} height={16} />}>
        <div className="row-sub" style={{ marginTop: 0 }}>
          Your data stays on this device. Save a text copy, or restore one you made earlier —
          the same file works on the Android app.
        </div>
        <div className="btn-row">
          <button className="btn primary" onClick={downloadExport}>
            <IconDownload width={15} height={15} /> Export file
          </button>
          <button className="btn" onClick={() => void copyExport()}>Copy JSON</button>
        </div>
        <div className="btn-row">
          <button className="btn" onClick={() => { setBackupMode('IMPORT'); setBackupJson('') }}>
            <IconUpload width={15} height={15} /> Import (replace)
          </button>
          <button className="btn" onClick={() => { setBackupMode('MERGE'); setBackupJson('') }}>
            Merge (keep both)
          </button>
        </div>
        <details style={{ marginTop: 12 }}>
          <summary className="text-btn" style={{ cursor: 'pointer' }}>View full backup JSON</summary>
          <textarea className="input" readOnly value={exportJson} style={{ marginTop: 8, minHeight: 160, fontSize: '0.72rem', fontFamily: 'monospace' }} />
        </details>
      </Card>

      {/* -------------------------------------------- storage */}
      <Card title="Storage" icon={<IconSettings width={16} height={16} />}>
        <div className="row-item" style={{ borderBottom: 'none' }}>
          <div className="row-main">
            <div className="row-title">{storageUsed ?? 'Not available'}</div>
            <div className="row-sub">Used by Fio on this device</div>
          </div>
          {persisted !== null && (
            <Badge tone={persisted ? 'success' : 'warning'}>{persisted ? 'Persistent' : 'Best-effort'}</Badge>
          )}
        </div>
        <div className="row-sub" style={{ marginTop: 0 }}>
          iOS can clear website data under storage pressure. Ask the browser to keep Fio, and export regular backups.
        </div>
        <div className="btn-row">
          <button className="btn" onClick={() => void askPersist()} disabled={persisted === true}>
            Keep my data
          </button>
        </div>
      </Card>

      <div className="row-sub" style={{ textAlign: 'center', marginTop: 18 }}>
        Fio web · companion to the Fio Android app · backups are compatible both ways.
      </div>

      {backupMode && (
        <Modal
          title={backupMode === 'EXPORT' ? 'Export Data' : backupMode === 'IMPORT' ? 'Import Data Backup' : 'Merge Backup'}
          onClose={() => setBackupMode(null)}
        >
          {backupMode === 'EXPORT' ? (
            <>
              <textarea className="input" readOnly value={exportJson}
                style={{ minHeight: 220, fontSize: '0.75rem', fontFamily: 'monospace' }} />
              <div className="modal-actions">
                <button className="btn" onClick={() => void copyExport()}>Copy</button>
                <button className="btn primary" onClick={downloadExport}>Download file</button>
              </div>
            </>
          ) : (
            <>
              <div className="row-sub" style={{ marginTop: 0 }}>
                {backupMode === 'IMPORT'
                  ? 'Paste a backup below. Importing replaces everything on this device with the backup.'
                  : 'Paste a backup below. Merging keeps data from both sides — newest record wins.'}
              </div>
              <div className="field">
                <label>Backup JSON</label>
                <textarea className="input" value={backupJson} onChange={(e) => setBackupJson(e.target.value)}
                  style={{ minHeight: 200, fontSize: '0.75rem', fontFamily: 'monospace' }}
                  placeholder='{ "version": 4, … }' />
              </div>
              <div className="modal-actions">
                <button className="btn ghost" onClick={() => setBackupMode(null)}>Cancel</button>
                <button className="btn primary" disabled={!backupJson.trim()} onClick={() => applyImport(backupMode)}>
                  {backupMode === 'IMPORT' ? 'Import' : 'Merge'}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      <Toast msg={toast} />
    </div>
  )
}

function ProviderPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="chip-row" style={{ marginTop: 12 }}>
      {PROVIDERS.map(([id, label]) => (
        <button key={id} className={`chip ${value === id ? 'selected' : ''}`} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </div>
  )
}

/** Small live card reflecting the picked theme instantly (scoped, no :root writes). */
function LivePreview(p: { theme: string; accent: string }) {
  return (
    <div style={{ marginTop: 14 }}>
      <PreviewTheme theme={p.theme} accent={p.accent}>
        <div className="card elevated" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Preview</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>How your theme reads.</div>
          </div>
          <span className="badge accent">Life Score</span>
        </div>
      </PreviewTheme>
    </div>
  )
}
