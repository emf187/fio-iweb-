import { useRef, useState } from 'react'
import {
  evaluate, expressionText, livePreview,
  type AngleMode, type Tok
} from '../lib/casio'
import { Card, ScreenHeader } from '../ui/components'

/**
 * Scientific Calculator — web port of the Android CasioEmuX calculator into
 * Fio: same fx-ES 5×7 key grid, SHIFT second functions, Ans memory,
 * DEG/RAD/GRA, history browse with ▲▼ and the same display rules.
 */

type KeyAct =
  | { a: 'tok'; tokens: Tok[] }
  | { a: 'shift' }
  | { a: 'del' }
  | { a: 'clear' }
  | { a: 'eq' }
  | { a: 'up' }
  | { a: 'down' }

interface KeyDef {
  label: string
  act: KeyAct
  shiftLabel?: string
  shiftAct?: KeyAct
  style: 'digit' | 'func' | 'shift' | 'del' | 'ac' | 'equal'
}

const tokKey = (label: string, tokens: Tok[], shiftLabel?: string, shiftAct?: KeyAct): KeyDef =>
  ({ label, act: { a: 'tok', tokens }, shiftLabel, shiftAct, style: 'func' })

const digitKey = (label: string): KeyDef =>
  ({ label, act: { a: 'tok', tokens: [{ k: 'num', text: label }] }, style: 'digit' })

const openTok: Tok = { k: 'open' }

/** fx-ES style grid — 5 columns × 7 rows, SHIFT unlocks second functions. */
const KEYPAD_ROWS: KeyDef[][] = [
  [
    { label: 'SHIFT', act: { a: 'shift' }, style: 'shift' },
    { label: '▲', act: { a: 'up' }, style: 'func' },
    { label: '▼', act: { a: 'down' }, style: 'func' },
    { label: 'DEL', act: { a: 'del' }, style: 'del' },
    { label: 'AC', act: { a: 'clear' }, style: 'ac' }
  ],
  [
    tokKey('sin', [{ k: 'func', name: 'sin' }, openTok], 'sin⁻¹', { a: 'tok', tokens: [{ k: 'func', name: 'asin' }, openTok] }),
    tokKey('cos', [{ k: 'func', name: 'cos' }, openTok], 'cos⁻¹', { a: 'tok', tokens: [{ k: 'func', name: 'acos' }, openTok] }),
    tokKey('tan', [{ k: 'func', name: 'tan' }, openTok], 'tan⁻¹', { a: 'tok', tokens: [{ k: 'func', name: 'atan' }, openTok] }),
    tokKey('x²', [{ k: 'post', name: 'sq' }], 'x³', { a: 'tok', tokens: [{ k: 'post', name: 'cube' }] }),
    tokKey('^', [{ k: 'op', ch: '^' }])
  ],
  [
    tokKey('log', [{ k: 'func', name: 'log' }, openTok], '10^', { a: 'tok', tokens: [{ k: 'func', name: 'pow10' }, openTok] }),
    tokKey('ln', [{ k: 'func', name: 'ln' }, openTok], 'e^', { a: 'tok', tokens: [{ k: 'func', name: 'exp' }, openTok] }),
    tokKey('x⁻¹', [{ k: 'post', name: 'inv' }]),
    tokKey('√', [{ k: 'func', name: 'sqrt' }, openTok], '³√', { a: 'tok', tokens: [{ k: 'func', name: 'cbrt' }, openTok] }),
    tokKey('Ans', [{ k: 'ans' }], 'π', { a: 'tok', tokens: [{ k: 'pi' }] })
  ],
  [
    digitKey('7'), digitKey('8'), digitKey('9'),
    tokKey('(', [{ k: 'open' }]),
    tokKey(')', [{ k: 'close' }])
  ],
  [
    digitKey('4'), digitKey('5'), digitKey('6'),
    tokKey('÷', [{ k: 'op', ch: '÷' }]),
    tokKey('×', [{ k: 'op', ch: '×' }])
  ],
  [
    digitKey('1'), digitKey('2'), digitKey('3'),
    tokKey('−', [{ k: 'op', ch: '−' }]),
    tokKey('+', [{ k: 'op', ch: '+' }])
  ],
  [
    digitKey('0'),
    tokKey('.', [{ k: 'num', text: '.' }], 'e', { a: 'tok', tokens: [{ k: 'e' }] }),
    tokKey('(−)', [{ k: 'op', ch: '−' }]),
    tokKey('×10^', [{ k: 'op', ch: '×' }, { k: 'num', text: '10' }, { k: 'op', ch: '^' }]),
    { label: '=', act: { a: 'eq' }, style: 'equal' }
  ]
]

/** Merges digit keys so typed numbers stay whole; a second dot is a dead key. */
function appendTokens(current: Tok[], incoming: Tok[]): Tok[] {
  const out = [...current]
  for (const t of incoming) {
    const last = out[out.length - 1]
    if (t.k === 'num' && last && last.k === 'num') {
      if (t.text === '.') {
        if (!last.text.includes('.')) out[out.length - 1] = { k: 'num', text: last.text + '.' }
      } else {
        out[out.length - 1] = { k: 'num', text: last.text + t.text }
      }
    } else {
      out.push(t)
    }
  }
  return out
}

export function CalculatorScreen() {
  const [expr, setExpr] = useState<Tok[]>([])
  const [shiftOn, setShiftOn] = useState(false)
  const [angleMode, setAngleMode] = useState<AngleMode>('DEG')
  const [ansValue, setAnsValue] = useState<number | null>(null)
  const [resultText, setResultText] = useState<string | null>(null)
  const [errorText, setErrorText] = useState<string | null>(null)
  // (expression, result display) pairs, newest first; browse index, -1 = live.
  const [history, setHistory] = useState<[Tok[], string][]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const exprScrollRef = useRef<HTMLDivElement>(null)

  const exprText = expressionText(expr)

  const press = (tokens: Tok[]) => {
    // After '=', digits/dot/π/( start fresh, everything else chains on Ans
    // — exactly the hardware behavior.
    const hadResult = resultText !== null || errorText !== null
    const startsFresh =
      tokens.length === 1 &&
      (tokens[0].k === 'num' || tokens[0].k === 'pi' || tokens[0].k === 'e' || tokens[0].k === 'open')
    const base: Tok[] = hadResult && startsFresh ? [] : hadResult ? [{ k: 'ans' }] : expr
    setExpr(appendTokens(base, tokens))
    setResultText(null)
    setErrorText(null)
    setHistoryIndex(-1)
    requestAnimationFrame(() => {
      const el = exprScrollRef.current
      if (el) el.scrollLeft = el.scrollWidth
    })
  }

  const evaluateNow = () => {
    if (expr.length === 0) return
    const res = evaluate(expr, angleMode, ansValue)
    if (res.error) {
      setErrorText(res.error)
    } else {
      setResultText(res.display)
      setAnsValue(res.value)
      const entry: [Tok[], string] = [expr, res.display]
      setHistory((h) => [entry, ...h].slice(0, 25))
    }
    setHistoryIndex(-1)
  }

  const browseHistory = (step: number) => {
    if (history.length === 0) return
    const next =
      historyIndex === -1 && step < 0 ? 0
      : historyIndex === -1 && step > 0 ? history.length - 1
      : Math.max(0, Math.min(history.length - 1, historyIndex + step))
    setHistoryIndex(next)
    setExpr(history[next][0])
    setResultText(null)
    setErrorText(null)
  }

  const onKey = (key: KeyDef) => {
    const act = shiftOn ? (key.shiftAct ?? key.act) : key.act
    switch (act.a) {
      case 'shift': setShiftOn((s) => !s); break
      case 'tok': setShiftOn(false); press(act.tokens); break
      case 'del':
        setShiftOn(false)
        setExpr((e) => e.slice(0, -1))
        setHistoryIndex(-1)
        break
      case 'clear':
        setShiftOn(false)
        setExpr([])
        setResultText(null)
        setErrorText(null)
        setHistoryIndex(-1)
        break
      case 'eq': setShiftOn(false); evaluateNow(); break
      case 'up': setShiftOn(false); browseHistory(-1); break
      case 'down': setShiftOn(false); browseHistory(1); break
    }
  }

  const preview = resultText === null && errorText === null ? livePreview(expr, angleMode, ansValue) : null

  return (
    <div className="screen">
      <ScreenHeader title="Calculator" subtitle="Scientific — the fx-ES layout you know." />

      <Card className="elevated">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {shiftOn && <span className="calc-chip on">SHIFT</span>}
            <span className="calc-chip">{angleMode}</span>
          </div>
          {ansValue !== null && (
            <span className="calc-ans">Ans={expr.length >= 0 ? formatAns(ansValue) : ''}</span>
          )}
        </div>

        <div className="calc-expr" ref={exprScrollRef}>{exprText || ' '}</div>

        {errorText !== null ? (
          <div className="calc-result calc-error">{errorText}</div>
        ) : resultText !== null ? (
          <div className="calc-result">{resultText}</div>
        ) : (
          <div className="calc-preview">{preview ? `≈ ${preview}` : ' '}</div>
        )}
      </Card>

      <div className="chip-row" style={{ margin: '14px 2px 4px' }}>
        {(['DEG', 'RAD', 'GRA'] as AngleMode[]).map((m) => (
          <button key={m} className={`chip ${angleMode === m ? 'selected' : ''}`}
            onClick={() => setAngleMode(m)}>
            {m}
          </button>
        ))}
      </div>

      <div className="calc-keypad">
        {KEYPAD_ROWS.map((row, ri) => (
          <div className="calc-row" key={ri}>
            {row.map((key, ki) => {
              const showShift = shiftOn && key.shiftLabel
              const shown = showShift ? key.shiftLabel! : key.label
              return (
                <button
                  key={`${ri}-${ki}`}
                  className={`calc-key ${key.style} ${showShift ? 'shift-active' : ''}`}
                  onClick={() => onKey(key)}
                >
                  {shown}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {history.length > 0 && (
        <Card title={`History (${history.length})`}>
          {history.slice(0, 6).map(([toks, res], i) => (
            <div className="row-item" key={i} style={{ display: 'block' }}>
              <div className="calc-hist-expr">{expressionText(toks)}</div>
              <div className="calc-hist-res">= {res}</div>
            </div>
          ))}
          <button className="text-btn" onClick={() => { setHistory([]); setHistoryIndex(-1) }}>
            Clear history
          </button>
        </Card>
      )}
    </div>
  )
}

function formatAns(v: number): string {
  const r = Number(v.toPrecision(10))
  if (!Number.isFinite(r)) return 'Math ERROR'
  return String(r)
}
