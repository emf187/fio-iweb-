import { useState } from 'react'
import { useFio, update } from '../lib/store'
import { sendPrompt } from '../lib/ai'
import { parseBackup, mergeBackup } from '../lib/backup'
import { Badge, Card, ScreenHeader, TextField, Toast, useToast } from '../ui/components'
import { IconCheck } from '../ui/icons'

/**
 * Guided first-run setup — the web mirror of Android's onboarding. A fresh
 * profile walks through its name and the Wingman AI key (with a live
 * connection test) before the app opens; "Switching from Android?" restores a
 * backup instead, and a skip keeps Fio usable offline. Gated by
 * state.setupDone in App.tsx.
 */

const PROVIDERS: [string, string, string][] = [
  // (id, label, base URL default)
  ['Google Gemini', 'Gemini', 'https://generativelanguage.googleapis.com/v1beta/openai'],
  ['OpenRouter', 'OpenRouter', 'https://openrouter.ai/api/v1'],
  ['Custom', 'Custom', '']
]

const KEY_LINKS: Record<string, [string, string]> = {
  'Google Gemini': ['Get a free Gemini key ↗', 'https://aistudio.google.com/apikey'],
  'OpenRouter': ['Get a free OpenRouter key ↗', 'https://openrouter.ai/keys']
}

const STEPS = ['Your name', 'AI key', 'Ready']

export function OnboardingScreen() {
  const state = useFio()
  const settings = state.settings
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [name, setName] = useState(state.profileName)
  const [testing, setTesting] = useState(false)
  const [testState, setTestState] = useState<'ok' | 'fail' | null>(null)
  const [testMsg, setTestMsg] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [toast, showToast] = useToast()

  const set = (patch: Partial<typeof settings>) => {
    update((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
  }

  const continueWithName = () => {
    update((s) => ({ ...s, profileName: name.trim() }))
    setStep(1)
  }

  const applyImport = (mode: 'IMPORT' | 'MERGE') => {
    const parsed = mode === 'IMPORT' ? parseBackup(importJson) : mergeBackup(state, importJson)
    if (!parsed) {
      showToast('Invalid backup format')
      return
    }
    update(() => parsed) // parse/merge mark setup as done
    setImportOpen(false)
    setStep(2)
  }

  const runTest = async () => {
    if (!settings.aiApiKey.trim() || testing) return
    setTesting(true)
    setTestState(null)
    const res = await sendPrompt('Reply with just: OK', 'You are a connection test. Reply with one word.', settings, {
      tone: 'Reply with a single word.'
    })
    setTesting(false)
    if (res.ok) {
      setTestState('ok')
      setTestMsg('')
    } else {
      setTestState('fail')
      setTestMsg(res.error)
    }
  }

  const keyLink = KEY_LINKS[settings.aiProvider]

  return (
    <div className="screen">
      <ScreenHeader title="Fio" subtitle="effio • to realize & know" />

      {/* step pills — the highlighted tab walks the user through setup */}
      <div className="chip-row" style={{ justifyContent: 'center', marginBottom: 4 }}>
        {STEPS.map((label, i) => (
          <span
            key={label}
            className={`chip ${i === step ? 'selected' : ''}`}
            style={i === step ? { borderColor: 'var(--accent)', color: 'var(--text)' } : undefined}
          >
            {i < step ? '✓ ' : ''}{label}
          </span>
        ))}
      </div>

      {step === 0 && (
        <Card title="Welcome to Fio">
          <div className="row-sub" style={{ marginTop: 0 }}>
            Your private life planner &amp; Wingman study companion. Everything stays on this device.
          </div>
          <TextField
            label="Your name"
            value={name}
            onChange={setName}
            placeholder="What should Fio & Wingman call you?"
            maxLength={40}
          />
          <div className="btn-row">
            <button className="btn primary" disabled={!name.trim()} onClick={continueWithName}>
              Continue
            </button>
          </div>

          <div className="divider" />
          <div className="row-sub" style={{ textAlign: 'center' }}>
            Switching from Android? Bring your backup over.
          </div>
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <button className="text-btn" onClick={() => setImportOpen(!importOpen)}>
              {importOpen ? 'Hide import' : 'Import a backup instead'}
            </button>
          </div>
          {importOpen && (
            <>
              <div className="field">
                <label>Backup JSON</label>
                <textarea
                  className="input"
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  style={{ minHeight: 140, fontSize: '0.75rem', fontFamily: 'monospace' }}
                  placeholder='{ "version": 4, … }'
                />
              </div>
              <div className="btn-row">
                <button className="btn" disabled={!importJson.trim()} onClick={() => applyImport('IMPORT')}>
                  Import (replace)
                </button>
                <button className="btn" disabled={!importJson.trim()} onClick={() => applyImport('MERGE')}>
                  Merge
                </button>
              </div>
            </>
          )}
        </Card>
      )}

      {step === 1 && (
        <Card title="AI assistant">
          <div className="row-sub" style={{ marginTop: 0 }}>
            Wingman runs on your own free API key. It stays on this device — Fio never sees it.
          </div>
          <div className="chip-row">
            {PROVIDERS.map(([id, label, baseUrl]) => (
              <button
                key={id}
                className={`chip ${settings.aiProvider === id ? 'selected' : ''}`}
                onClick={() => {
                  const patch: Partial<typeof settings> = { aiProvider: id }
                  if (id !== 'Custom') patch.aiBaseUrl = baseUrl
                  set(patch)
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {keyLink && (
            <a className="text-btn" href={keyLink[1]} target="_blank" rel="noreferrer">
              {keyLink[0]}
            </a>
          )}
          <TextField
            label="API key"
            value={settings.aiApiKey}
            onChange={(v) => set({ aiApiKey: v })}
            placeholder="Paste your key"
            type="password"
          />
          <div className="btn-row">
            <button className="btn" disabled={!settings.aiApiKey.trim() || testing} onClick={() => void runTest()}>
              {testing ? 'Testing…' : 'Test connection'}
            </button>
            {testState === 'ok' && <Badge tone="success">Working ✓</Badge>}
          </div>
          {testState === 'fail' && (
            <div className="row-sub" style={{ color: 'var(--danger)' }}>{testMsg}</div>
          )}
          <div className="btn-row">
            <button className="btn primary" disabled={!settings.aiApiKey.trim()} onClick={() => setStep(2)}>
              Continue
            </button>
          </div>
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <button className="text-btn" onClick={() => setStep(2)}>
              Skip — you can add it later in Settings
            </button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: 'var(--accent)', color: '#fff',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <IconCheck width={18} height={18} />
            </span>
            <strong style={{ fontSize: '1.05rem' }}>
              You're all set{state.profileName ? `, ${state.profileName.split(' ')[0]}` : ''}!
            </strong>
          </div>
          <div className="row-sub" style={{ marginTop: 10 }}>
            {settings.aiApiKey.trim()
              ? 'Wingman is connected and ready — say hi from the Study tab.'
              : 'You can add your AI key anytime in Settings → AI assistant.'}
          </div>
          <div className="btn-row">
            <button
              className="btn primary"
              onClick={() => update((s) => ({ ...s, setupDone: true }))}
            >
              Start using Fio
            </button>
          </div>
        </Card>
      )}

      <Toast msg={toast} />
    </div>
  )
}
