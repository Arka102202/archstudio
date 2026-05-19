import { useCallback } from 'react'
import { useSettingsStore, SETTINGS_KEYS } from '@store'
import { db } from '@db'
import type { Theme } from '@store'
import type { ThemeToggleHook } from './types'

export const useThemeToggle = (): ThemeToggleHook => {
  const theme    = useSettingsStore(s => s.theme)
  const setTheme = useSettingsStore(s => s.setTheme)

  const isDark = theme === 'dark'

  const toggle = useCallback((): void => {
    const next: Theme = isDark ? 'light' : 'dark'

    // 1. DOM — instant visual update
    document.documentElement.setAttribute('data-theme', next)

    // 2. In-memory store — drives the toggle indicator
    setTheme(next)

    // 3. localStorage — synchronous mirror so main.tsx can patch the DOM
    //    before React mounts on the next page load (prevents FOUT)
    localStorage.setItem(SETTINGS_KEYS.THEME, next)

    // 4. IDB — primary persistent store (fire-and-forget, non-critical path)
    void db.settings.put({ key: SETTINGS_KEYS.THEME, value: JSON.stringify(next) })
  }, [isDark, setTheme])

  return { isDark, toggle }
}
