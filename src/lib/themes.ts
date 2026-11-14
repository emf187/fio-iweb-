/**
 * Fio themes — the Android theme system ported to CSS variables. Theme ids and
 * accent ids match the Android values exactly (they travel inside backup
 * JSON), and the colours mirror FioTheme.kt palettes.
 */

export interface ThemePalette {
  id: string
  label: string
  light: boolean
  bg: string
  surface: string
  elevated: string
  border: string
  /** Solid action fill (white-safe). */
  primary: string
  /** Quiet tinted surface. */
  primaryContainer: string
  /** Signal colour for text/icons/progress. */
  accent: string
  text: string
  text2: string
  muted: string
  success: string
  warning: string
  danger: string
  info: string
}

const DARK_STATUS = { success: '#4ADE80', warning: '#FBBF24', danger: '#F87171', info: '#7DD3FC' }
const LIGHT_STATUS = { success: '#15803D', warning: '#B45309', danger: '#B91C1C', info: '#0369A1' }

/** Midnight — near-black canvas, quiet charcoal surfaces, mint signal. */
const MIDNIGHT: Omit<ThemePalette, 'id' | 'label' | 'light'> = {
  bg: '#0B0B0C', surface: '#141416', elevated: '#1C1C1F', border: '#27272B',
  primary: '#0F766E', primaryContainer: '#123A35', accent: '#5EEAD4',
  text: '#F3F3F1', text2: '#A7A7AC', muted: '#74747A', ...DARK_STATUS
}

const LIGHT_STATUS_OF = LIGHT_STATUS

export const THEMES: ThemePalette[] = [
  { id: 'OBSIDIAN_PURPLE', label: 'Midnight', light: false, ...MIDNIGHT },
  {
    id: 'SLATE', label: 'Slate', light: false,
    bg: '#0C0F12', surface: '#141A1F', elevated: '#1B232B', border: '#27323C',
    primary: '#0E7490', primaryContainer: '#10303B', accent: '#67E8F9',
    text: '#EDF2F5', text2: '#9EACB6', muted: '#6F7C86', ...DARK_STATUS
  },
  {
    id: 'PLUM', label: 'Plum', light: false,
    bg: '#0E0A10', surface: '#17121B', elevated: '#201826', border: '#2D2434',
    primary: '#86198F', primaryContainer: '#3A1440', accent: '#F0ABFC',
    text: '#F5EFF7', text2: '#B6A9BF', muted: '#80728A', ...DARK_STATUS
  },
  {
    id: 'FOREST', label: 'Forest', light: false,
    bg: '#0A0F0B', surface: '#121813', elevated: '#19211A', border: '#253026',
    primary: '#166534', primaryContainer: '#14351D', accent: '#86EFAC',
    text: '#EFF4EE', text2: '#A7B3A6', muted: '#728072', ...DARK_STATUS
  },
  {
    id: 'OBSIDIAN_LIGHT', label: 'Paper', light: true,
    bg: '#FAFAF7', surface: '#FFFFFF', elevated: '#F2F2EC', border: '#E6E6DE',
    primary: '#0F766E', primaryContainer: '#DCF3EE', accent: '#0F766E',
    text: '#1B1B19', text2: '#5D5D57', muted: '#8A8A82', ...LIGHT_STATUS_OF
  },
  {
    id: 'SAND', label: 'Sand', light: true,
    bg: '#F7F3EA', surface: '#FFFDF8', elevated: '#EFE9DC', border: '#E2DAC9',
    primary: '#4F5D2C', primaryContainer: '#E9ECD7', accent: '#556B2F',
    text: '#2A241B', text2: '#6B6152', muted: '#948874', ...LIGHT_STATUS_OF
  },
  {
    id: 'MIST', label: 'Mist', light: true,
    bg: '#F5F7FA', surface: '#FFFFFF', elevated: '#ECF0F5', border: '#DCE2EA',
    primary: '#1E3A8A', primaryContainer: '#E1E8F7', accent: '#1D4ED8',
    text: '#171A1F', text2: '#5B6470', muted: '#8A929D', ...LIGHT_STATUS_OF
  },
  {
    id: 'OLED_BLACK', label: 'True black', light: false,
    bg: '#000000', surface: '#0B0B0C', elevated: '#151517', border: '#232326',
    primary: MIDNIGHT.primary, primaryContainer: MIDNIGHT.primaryContainer, accent: MIDNIGHT.accent,
    text: MIDNIGHT.text, text2: MIDNIGHT.text2, muted: MIDNIGHT.muted, ...DARK_STATUS
  },
  {
    id: 'HIGH_CONTRAST', label: 'Contrast', light: false,
    bg: '#000000', surface: '#0A0A0C', elevated: '#191920', border: '#4B4B55',
    primary: '#0F766E', primaryContainer: '#103F39', accent: '#5EEAD4',
    text: '#FFFFFF', text2: '#D4D4D8', muted: '#A1A1AA',
    success: '#86EFAC', warning: '#FDE047', danger: '#FCA5A5', info: '#93C5FD'
  }
]

export function themeById(id: string): ThemePalette {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

export interface AccentPalette {
  id: string
  label: string
  swatch: string
  /** (fill, container, signal) for dark and light canvases. */
  dark: [string, string, string]
  light: [string, string, string]
}

export const ACCENTS: AccentPalette[] = [
  { id: 'MINT', label: 'Theme', swatch: '#5EEAD4', dark: [MIDNIGHT.primary, MIDNIGHT.primaryContainer, MIDNIGHT.accent], light: ['#0F766E', '#DCF3EE', '#0F766E'] },
  { id: 'BLUE', label: 'Blue', swatch: '#60A5FA', dark: ['#1E5AA8', '#152A42', '#7DD3FC'], light: ['#1D4ED8', '#E0EBFD', '#1D4ED8'] },
  { id: 'GREEN', label: 'Green', swatch: '#4ADE80', dark: ['#166534', '#14281B', '#4ADE80'], light: ['#15803D', '#E3F5E8', '#15803D'] },
  { id: 'AMBER', label: 'Amber', swatch: '#FBBF24', dark: ['#9A5B11', '#2A2113', '#FBBF24'], light: ['#B45309', '#FAEFDD', '#B45309'] },
  { id: 'ROSE', label: 'Rose', swatch: '#FB7185', dark: ['#9F1239', '#2A151C', '#FB7185'], light: ['#BE123C', '#FCE8ED', '#BE123C'] },
  { id: 'ORANGE', label: 'Orange', swatch: '#FB923C', dark: ['#9A3D0C', '#2A1C13', '#FB923C'], light: ['#C2410C', '#FBEDE3', '#C2410C'] }
]

/**
 * "MINT" (and legacy "PURPLE") means "use this theme's own signature accent";
 * an explicit accent overrides primary/container/signal.
 */
export function resolvePalette(themeId: string, accentId: string): ThemePalette {
  const base = themeById(themeId)
  if (accentId === 'MINT' || accentId === 'PURPLE') return base
  const accent = ACCENTS.find((a) => a.id === accentId)
  if (!accent) return base
  const [primary, primaryContainer, signal] = base.light ? accent.light : accent.dark
  return { ...base, primary, primaryContainer, accent: signal }
}

/** CSS custom properties for the resolved palette (applied on :root). */
export function cssVarsFor(themeId: string, accentId: string, fontScale: number): Record<string, string> {
  const p = resolvePalette(themeId, accentId)
  return {
    '--bg': p.bg,
    '--surface': p.surface,
    '--elevated': p.elevated,
    '--border': p.border,
    '--accent': p.primary,
    '--accent-strong': p.accent,
    '--accent-container': p.primaryContainer,
    '--text': p.text,
    '--text-2': p.text2,
    '--muted': p.muted,
    '--success': p.success,
    '--warning': p.warning,
    '--danger': p.danger,
    '--info': p.info,
    '--scale': String(fontScale || 1)
  }
}
