import { useEffect } from 'react'
import { db } from '@db'
import { useSettingsStore, SETTINGS_KEYS } from '@store'
import type { Theme } from '@store'

// ─── useLoadAppSettings ────────────────────────────────────────────
// Called once at the App root. Reads every row from the IDB `settings`
// table and hydrates the in-memory settingsStore. Also applies the
// stored theme to the DOM (belt-and-suspenders alongside the
// synchronous localStorage patch in main.tsx).

export const useLoadAppSettings = (): void => {
  const { setTheme, setInspectorWidth, setSidebarWidth } = useSettingsStore()

  useEffect(() => {
    const load = async (): Promise<void> => {
      const rows = await db.settings.toArray()

      for (const row of rows) {
        const value = JSON.parse(row.value) as unknown

        switch (row.key) {
          case SETTINGS_KEYS.THEME:
            if (value === 'light' || value === 'dark') {
              setTheme(value as Theme)
              document.documentElement.setAttribute('data-theme', value as string)
            }
            break

          case SETTINGS_KEYS.INSPECTOR_WIDTH:
            if (typeof value === 'number' && value > 0) setInspectorWidth(value)
            break

          case SETTINGS_KEYS.SIDEBAR_WIDTH:
            if (typeof value === 'number' && value > 0) setSidebarWidth(value)
            break
        }
      }
    }

    void load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])  // intentionally empty — runs once on mount only
}
