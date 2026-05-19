import type { ChatSession, ChatMessage } from '@entity'

export interface ChatPanelProps {
  projectId: string
}

export interface ChatPanelHook {
  projectId:           string
  msNodes:             MsNodeEntry[]
  activeMsId:          string | null
  sessions:            ChatSession[]
  activeChatSessionId: string | null
  messages:            ChatMessage[]
  isLoading:           boolean
  isSendingArchitecture: boolean
  handleMsChange:      (msId: string) => void
  handleNewSession:    () => Promise<void>
  handleSelectSession: (sessionId: string) => Promise<void>
  handleDeleteSession: (sessionId: string) => Promise<void>
  handleRenameSession: (sessionId: string, newTitle: string) => Promise<void>
  handleSendMessage:        (content: string) => void
  handleStopGeneration:     () => void
  handleToggleArchitecture: () => void
}

export interface MsNodeEntry {
  id:    string
  label: string
}
