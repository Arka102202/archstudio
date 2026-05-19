import { useState } from 'react'
import type { SessionHeaderHook, SessionHeaderProps } from './types'

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

export { formatTimeAgo }

export const useSessionHeader = (props: SessionHeaderProps): SessionHeaderHook => {
  const [editingSessionId,  setEditingSessionId]  = useState<string | null>(null)
  const [editingTitle,      setEditingTitle]       = useState<string>('')
  const [openMenuSessionId, setOpenMenuSessionId]  = useState<string | null>(null)

  const startRename = (sessionId: string, currentTitle: string): void => {
    setEditingSessionId(sessionId)
    setEditingTitle(currentTitle)
    setOpenMenuSessionId(null)
  }

  const commitRename = async (): Promise<void> => {
    if (editingSessionId && editingTitle.trim()) {
      await props.onRenameSession(editingSessionId, editingTitle.trim())
    }
    setEditingSessionId(null)
    setEditingTitle('')
  }

  const toggleMenu = (sessionId: string): void => {
    setOpenMenuSessionId(prev => prev === sessionId ? null : sessionId)
  }

  const closeMenu = (): void => {
    setOpenMenuSessionId(null)
  }

  return {
    ...props,
    editingSessionId,
    editingTitle,
    openMenuSessionId,
    startRename,
    commitRename,
    setEditingTitle,
    toggleMenu,
    closeMenu,
  }
}
