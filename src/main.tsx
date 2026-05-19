import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { registerSW } from 'virtual:pwa-register'
import '@xyflow/react/dist/style.css'
import './index.css'
import App from './App'

// ─── TanStack Query client ────────────────────────────────────────
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:        1000 * 60,  // 1 minute
      refetchOnWindowFocus: false,
    },
  },
})

// ─── Service worker registration ─────────────────────────────────
registerSW({ immediate: true })

// ─── Cross-tab sync listener ──────────────────────────────────────
const SYNC_CHANNEL = 'archflow-sync'

const bc = new BroadcastChannel(SYNC_CHANNEL)

bc.onmessage = (event: MessageEvent) => {
  if (event.data?.type === 'IDB_CHANGED') {
    void queryClient.invalidateQueries()
    console.debug('[archflow] IDB_CHANGED received', event.data)
  }
}

// ─── Early theme patch — prevents flash of wrong theme ───────────
// Reads the mirrored localStorage value (written on every theme change)
// and applies data-theme to <html> synchronously, before React renders.
// IDB is async and cannot do this; localStorage is the right tool here.
const _earlyTheme = localStorage.getItem('theme')
if (_earlyTheme === 'light' || _earlyTheme === 'dark') {
  document.documentElement.setAttribute('data-theme', _earlyTheme)
}

// ─── App mount ───────────────────────────────────────────────────
const root = document.getElementById('root')
if (!root) throw new Error('Root element #root not found')

createRoot(root).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
)
