import { useSyncExternalStore } from 'react'
import { readDoc, writeDoc } from './db'
import { emptyState, type FioState } from './types'

/**
 * Single-document store, like the Android app's SharedPreferences snapshot:
 * the whole state is one JSON object, saved to IndexedDB (debounced) and
 * flushed on page hide. Immutable updates through `update`.
 */

let state: FioState = emptyState()
let loaded = false

const listeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
}

let saveTimer: number | undefined

function scheduleSave() {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => void writeDoc(state), 400)
}

// Durable snapshot before the tab can be evicted — mirrors MainActivity.onStop.
window.addEventListener('pagehide', () => void writeDoc(state))
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void writeDoc(state)
})

export async function loadState(): Promise<void> {
  if (loaded) return
  loaded = true
  const doc = await readDoc<Partial<FioState>>()
  if (doc) {
    state = { ...emptyState(), ...doc } as FioState
  }
  emit()
}

export function getState(): FioState {
  return state
}

/** Immutable patch — pass a function that returns the next state. */
export function update(fn: (prev: FioState) => FioState): void {
  const next = fn(state)
  next.updatedAt = Date.now()
  state = next
  scheduleSave()
  emit()
}

export function patch(partial: Partial<FioState>): void {
  update((prev) => ({ ...prev, ...partial }))
}

/** React hook — subscribes to the whole document (screens re-render on any change). */
export function useFio(): FioState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state
  )
}
