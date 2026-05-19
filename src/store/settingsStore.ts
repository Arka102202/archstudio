import { create } from 'zustand'

export type Theme = 'light' | 'dark'

export const SETTINGS_KEYS = {
  THEME:           'theme',
  INSPECTOR_WIDTH: 'inspectorWidth',
  SIDEBAR_WIDTH:   'sidebarWidth',
} as const

export const INSPECTOR_WIDTH_MIN     = 200
export const INSPECTOR_WIDTH_MAX     = 480
export const INSPECTOR_WIDTH_DEFAULT = 272

export const SIDEBAR_WIDTH_MIN     = 160
export const SIDEBAR_WIDTH_MAX     = 360
export const SIDEBAR_WIDTH_DEFAULT = 192

// ─── Synchronous initial theme — reads localStorage so the toggle
//     reflects the correct state from the very first render.
//     localStorage is written whenever the user changes the theme so
//     the DOM can be patched before React even mounts (see main.tsx).

const getInitialTheme = (): Theme => {
  const stored = localStorage.getItem(SETTINGS_KEYS.THEME)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

// ─── Store ────────────────────────────────────────────────────────

interface SettingsState {
  theme:          Theme
  inspectorWidth: number
  sidebarWidth:   number

  setTheme:          (theme: Theme)   => void
  setInspectorWidth: (width: number)  => void
  setSidebarWidth:   (width: number)  => void
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  theme:          getInitialTheme(),
  inspectorWidth: INSPECTOR_WIDTH_DEFAULT,
  sidebarWidth:   SIDEBAR_WIDTH_DEFAULT,

  setTheme:          (theme)  => set({ theme }),
  setInspectorWidth: (width)  => set({ inspectorWidth: width }),
  setSidebarWidth:   (width)  => set({ sidebarWidth: width }),
}))
