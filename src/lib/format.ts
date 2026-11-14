/** Shared small formatting helpers. */

export function formatTimestampWeb(ms: number): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleString([], {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  })
}

export function formatDateWeb(ms: number): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatTimeWeb(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
