import type { ChatSession } from '@entity'
import type { MsNodeEntry } from '../../types'

export interface SessionHeaderProps {
  msNodes:             MsNodeEntry[]
  activeMsId:          string | null
  sessions:            ChatSession[]
  activeChatSessionId: string | null
  isLoading:           boolean
  chatView:            'chat' | 'history'
  onChatViewChange:    (view: 'chat' | 'history') => void
  onMsChange:          (msId: string) => void
  onNewSession:        () => Promise<void>
  onSelectSession:     (sessionId: string) => Promise<void>
  onDeleteSession:     (sessionId: string) => Promise<void>
  onRenameSession:     (sessionId: string, newTitle: string) => Promise<void>
}

export interface SessionHeaderHook extends SessionHeaderProps {
  editingSessionId:  string | null
  editingTitle:      string
  openMenuSessionId: string | null
  startRename:       (sessionId: string, currentTitle: string) => void
  commitRename:      () => Promise<void>
  setEditingTitle:   (v: string) => void
  toggleMenu:        (sessionId: string) => void
  closeMenu:         () => void
}
