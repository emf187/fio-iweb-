import { createRoot } from 'react-dom/client'
import { App } from './App'
import { loadState } from './lib/store'
import './styles.css'

async function boot() {
  // Load the persisted document first so the first paint already has data.
  await loadState()
  const root = createRoot(document.getElementById('root')!)
  root.render(<App />)
}

void boot()
