import type React from 'react'
import type { ChatSession, ChatMessage } from '@entity'

export interface MessageThreadProps {
  messages:  ChatMessage[]
  session:   ChatSession | null
  isLoading: boolean
}

export interface MessageThreadHook {
  messagesEndRef:   React.RefObject<HTMLDivElement>
  containerRef:     React.RefObject<HTMLDivElement>
  shouldAutoScroll: boolean
  handleScroll:     () => void
}
