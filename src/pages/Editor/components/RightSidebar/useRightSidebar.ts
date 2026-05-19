import { useRef } from 'react'
import type React from 'react'
import { useSettingsStore, SETTINGS_KEYS, INSPECTOR_WIDTH_MIN, INSPECTOR_WIDTH_MAX } from '@store'
import { db } from '@db'
import type { RightSidebarHook } from './types'

export const useRightSidebar = (): RightSidebarHook => {
  const width    = useSettingsStore(s => s.inspectorWidth)
  const setWidth = useSettingsStore(s => s.setInspectorWidth)

  const isDragging = useRef<boolean>(false)
  const startX     = useRef<number>(0)
  const startWidth = useRef<number>(width)

  const handleResizeStart = (e: React.MouseEvent): void => {
    e.preventDefault()
    isDragging.current  = true
    startX.current      = e.clientX
    startWidth.current  = width

    const handleMouseMove = (ev: MouseEvent): void => {
      if (!isDragging.current) return
      // Left-edge drag: moving left (lower clientX) = wider
      const delta    = startX.current - ev.clientX
      const newWidth = Math.min(INSPECTOR_WIDTH_MAX, Math.max(INSPECTOR_WIDTH_MIN, startWidth.current + delta))
      setWidth(newWidth)
    }

    const handleMouseUp = (): void => {
      isDragging.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup',   handleMouseUp)

      // Persist final width to IDB on drag end
      const finalWidth = useSettingsStore.getState().inspectorWidth
      void db.settings.put({ key: SETTINGS_KEYS.INSPECTOR_WIDTH, value: JSON.stringify(finalWidth) })
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup',   handleMouseUp)
  }

  return { width, handleResizeStart }
}
