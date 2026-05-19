import type React from 'react'

export interface ChatInputProps {
  isLoading:             boolean
  isSendingArchitecture: boolean
  onSend:                (text: string) => void
  onStop:                () => void
  onToggleArchitecture:  () => void
}

export interface ChatInputHook {
  value:         string
  setValue:      (v: string) => void
  textareaRef:   React.RefObject<HTMLTextAreaElement>
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  handleSend:    () => void
  canSend:       boolean
}
