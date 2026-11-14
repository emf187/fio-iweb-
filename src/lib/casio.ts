/**
 * Casio-style scientific calculator engine — TypeScript port of the Android
 * CasioEngine (fx-570/991 ES-PLUS feel): SHIFT second functions, Ans memory,
 * DEG/RAD/GRA, auto-closing parentheses, Math/Syntax errors, 10-digit
 * rounding, ×10^ display beyond range and comma digit grouping.
 */

export type AngleMode = 'DEG' | 'RAD' | 'GRA'

export type FuncName =
  | 'sin' | 'cos' | 'tan'
  | 'asin' | 'acos' | 'atan'
  | 'log' | 'ln' | 'sqrt' | 'cbrt' | 'pow10' | 'exp'

export type Tok =
  | { k: 'num'; text: string }
  | { k: 'op'; ch: '+' | '−' | '×' | '÷' | '^' }
  | { k: 'open' }
  | { k: 'close' }
  | { k: 'func'; name: FuncName }
  | { k: 'post'; name: 'sq' | 'cube' | 'inv' }
  | { k: 'pi' }
  | { k: 'e' }
  | { k: 'ans' }

export interface EvalResult {
  value: number | null
  error: string | null
  display: string
}

class CalcError extends Error {}

export const FUNC_LABELS: Record<FuncName, string> = {
  sin: 'sin', cos: 'cos', tan: 'tan',
  asin: 'sin⁻¹', acos: 'cos⁻¹', atan: 'tan⁻¹',
  log: 'log', ln: 'ln', sqrt: '√', cbrt: '³√', pow10: '10^', exp: 'e^'
}

export function label(tok: Tok): string {
  switch (tok.k) {
    case 'num': return tok.text
    case 'op': return tok.ch
    case 'open': return '('
    case 'close': return ')'
    case 'func': return FUNC_LABELS[tok.name]
    case 'post': return tok.name === 'sq' ? 'x²' : tok.name === 'cube' ? 'x³' : 'x⁻¹'
    case 'pi': return 'π'
    case 'e': return 'e'
    case 'ans': return 'Ans'
  }
}

export function expressionText(toks: Tok[]): string {
  return toks.map(label).join('')
}

// ------------------------------------------------------------------ rounding

/** Rounds to 10 significant digits like the ES hardware (0.1+0.2 → 0.3). */
function round10(x: number): number {
  if (!Number.isFinite(x)) return x
  let r = Number(x.toPrecision(10))
  // Sub-picorad trig residue snaps to a clean zero (tan 180° → 0).
  if (Math.abs(r) < 1e-12) r = 0
  return r
}

const SUP = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹']

function superscript(v: number): string {
  const s = String(v)
  if (s.startsWith('-')) return '⁻' + s.slice(1).split('').map((d) => SUP[Number(d)]).join('')
  return s.split('').map((d) => SUP[Number(d)]).join('')
}

/** Casio-style result text: plain decimals, ×10^ beyond range, comma groups. */
export function formatResult(x: number): string {
  const r = round10(x)
  if (Number.isNaN(r) || !Number.isFinite(r)) return 'Math ERROR'
  if (r === 0) return '0'
  const ax = Math.abs(r)
  if (ax >= 1e10 || ax < 1e-9) return sciString(r)
  return groupDigits(plainString(r))
}

function plainString(r: number): string {
  let s = r.toPrecision(10)
  if (!s.includes('e')) {
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '')
    return s
  }
  // Expand exponential notation into plain decimal digits.
  const [mant, exp] = s.split('e')
  const expN = parseInt(exp, 10)
  const neg = mant.startsWith('-')
  const body = mant.replace('-', '')
  const intLen = body.indexOf('.') >= 0 ? body.indexOf('.') : body.length
  const digits = body.replace('.', '').replace(/0+$/, '') || '0'
  const decPos = intLen + expN
  let out: string
  if (decPos <= 0) out = '0.' + '0'.repeat(-decPos) + digits
  else if (decPos >= digits.length) out = digits + '0'.repeat(decPos - digits.length)
  else out = digits.slice(0, decPos) + '.' + digits.slice(decPos)
  out = out.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
  return (neg ? '-' : '') + out
}

function sciString(r: number): string {
  const s = round10(r).toExponential(9) // "1.500000000e+3"
  const [mantRaw, expRaw] = s.split('e')
  let mantissa = mantRaw.replace(/0+$/, '').replace(/\.$/, '')
  const exponent = parseInt(expRaw, 10)
  if (mantissa === '1') mantissa = ''
  return mantissa === '' ? `1×10${superscript(exponent)}` : `${mantissa}×10${superscript(exponent)}`
}

function groupDigits(plain: string): string {
  const neg = plain.startsWith('-')
  const body = neg ? plain.slice(1) : plain
  const dot = body.indexOf('.')
  const intPart = dot >= 0 ? body.slice(0, dot) : body
  const fracPart = dot >= 0 ? body.slice(dot) : ''
  if (intPart.length <= 3) return plain
  let grouped = ''
  const lead = intPart.length % 3
  if (lead > 0) grouped += intPart.slice(0, lead)
  for (let i = lead; i < intPart.length; i += 3) {
    if (grouped) grouped += ','
    grouped += intPart.slice(i, Math.min(intPart.length, i + 3))
  }
  return (neg ? '-' : '') + grouped + fracPart
}

// --------------------------------------------------------------- evaluation

function toRad(x: number, mode: AngleMode): number {
  if (mode === 'DEG') return (x * Math.PI) / 180
  if (mode === 'GRA') return (x * Math.PI) / 200
  return x
}

function fromRad(r: number, mode: AngleMode): number {
  if (mode === 'DEG') return (r * 180) / Math.PI
  if (mode === 'GRA') return (r * 200) / Math.PI
  return r
}

function applyFunc(name: FuncName, x: number, mode: AngleMode): number {
  switch (name) {
    case 'sin': return Math.sin(toRad(x, mode))
    case 'cos': return Math.cos(toRad(x, mode))
    case 'tan': return Math.tan(toRad(x, mode))
    case 'asin':
      if (x < -1 || x > 1) throw new CalcError('Math ERROR')
      return fromRad(Math.asin(x), mode)
    case 'acos':
      if (x < -1 || x > 1) throw new CalcError('Math ERROR')
      return fromRad(Math.acos(x), mode)
    case 'atan':
      return fromRad(Math.atan(x), mode)
    case 'log':
      if (x <= 0) throw new CalcError('Math ERROR')
      return Math.log10(x)
    case 'ln':
      if (x <= 0) throw new CalcError('Math ERROR')
      return Math.log(x)
    case 'sqrt':
      if (x < 0) throw new CalcError('Math ERROR')
      return Math.sqrt(x)
    case 'cbrt':
      return Math.cbrt(x)
    case 'pow10': {
      const v = Math.pow(10, x)
      if (!Number.isFinite(v)) throw new CalcError('Math ERROR')
      return v
    }
    case 'exp': {
      const v = Math.exp(x)
      if (!Number.isFinite(v)) throw new CalcError('Math ERROR')
      return v
    }
  }
}

function startsAtom(t: Tok | undefined): boolean {
  if (!t) return false
  return t.k === 'num' || t.k === 'pi' || t.k === 'e' || t.k === 'ans' || t.k === 'open' || t.k === 'func'
}

export function evaluate(toks: Tok[], mode: AngleMode, ans: number | null): EvalResult {
  if (toks.length === 0) return { value: null, error: null, display: '' }
  try {
    let pos = 0
    const peek = () => toks[pos]
    const next = () => toks[pos++]

    const parseExpr = (): number => {
      let v = parseTerm()
      for (;;) {
        const t = peek()
        if (t && t.k === 'op' && (t.ch === '+' || t.ch === '−')) {
          next()
          const r = parseTerm()
          v = t.ch === '+' ? v + r : v - r
        } else break
      }
      return v
    }

    const parseTerm = (): number => {
      let v = parseFactor()
      for (;;) {
        const t = peek()
        if (t && t.k === 'op' && (t.ch === '×' || t.ch === '÷')) {
          next()
          const r = parseFactor()
          if (t.ch === '÷' && r === 0) throw new CalcError('Math ERROR')
          v = t.ch === '×' ? v * r : v / r
        } else if (startsAtom(t)) {
          // Implicit multiplication (Casio style): 2π, 3(4+5), 2sin(30).
          const r = parseFactor()
          v = v * r
        } else break
      }
      return v
    }

    const parseFactor = (): number => {
      const v = parseUnary()
      const t = peek()
      if (t && t.k === 'op' && t.ch === '^') {
        next()
        const r = parseFactor()
        const out = Math.pow(v, r)
        if (Number.isNaN(out)) throw new CalcError('Math ERROR')
        return out
      }
      return v
    }

    const parseUnary = (): number => {
      const t = peek()
      if (t && t.k === 'op' && t.ch === '−') {
        next()
        return -parseUnary()
      }
      return parsePostfix()
    }

    const parsePostfix = (): number => {
      let v = parseAtom()
      for (;;) {
        const t = peek()
        if (t && t.k === 'post') {
          next()
          if (t.name === 'sq') v = v * v
          else if (t.name === 'cube') v = v * v * v
          else {
            if (v === 0) throw new CalcError('Math ERROR')
            v = 1 / v
          }
          if (Number.isNaN(v) || !Number.isFinite(v)) throw new CalcError('Math ERROR')
        } else break
      }
      return v
    }

    const parseAtom = (): number => {
      const t = next()
      if (!t) {
        // Auto-close: expression ended while parentheses are still open.
        throw new CalcError('Syntax ERROR')
      }
      if (t.k === 'num') {
        const v = Number(t.text)
        if (!Number.isFinite(v)) throw new CalcError('Syntax ERROR')
        return v
      }
      if (t.k === 'pi') return Math.PI
      if (t.k === 'e') return Math.E
      if (t.k === 'ans') return ans ?? 0
      if (t.k === 'open') {
        const v = parseExpr()
        const c = peek()
        if (c && c.k === 'close') next()
        else if (c !== undefined) throw new CalcError('Syntax ERROR')
        return v // ran out of tokens: auto-closed, fine
      }
      if (t.k === 'func') {
        const o = peek()
        if (!o || o.k !== 'open') throw new CalcError('Syntax ERROR')
        next()
        const v = parseExpr()
        const c = peek()
        if (c && c.k === 'close') next()
        else if (c !== undefined) throw new CalcError('Syntax ERROR')
        return applyFunc(t.name, v, mode)
      }
      throw new CalcError('Syntax ERROR')
    }

    const value = round10(parseExpr())
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      return { value: null, error: 'Math ERROR', display: 'Math ERROR' }
    }
    if (pos < toks.length) {
      // Unconsumed trailing tokens (e.g. stray ')').
      return { value: null, error: 'Syntax ERROR', display: 'Syntax ERROR' }
    }
    return { value, error: null, display: formatResult(value) }
  } catch (e) {
    if (e instanceof CalcError) return { value: null, error: e.message, display: e.message }
    return { value: null, error: 'Math ERROR', display: 'Math ERROR' }
  }
}

/** Live preview under the input when the expression is evaluatable. */
export function livePreview(toks: Tok[], mode: AngleMode, ans: number | null): string | null {
  if (toks.length === 0) return null
  const res = evaluate(toks, mode, ans)
  return res.error === null && res.display !== '' ? res.display : null
}
