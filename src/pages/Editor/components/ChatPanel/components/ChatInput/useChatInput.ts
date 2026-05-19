import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import type { ChatInputHook, ChatInputProps } from './types'

export const useChatInput = ({ isLoading, onSend }: ChatInputProps): ChatInputHook => {
  const [value, setValue] = useState('')
  const textareaRef       = useRef<HTMLTextAreaElement>(null)

  const canSend = value.trim().length > 0 && !isLoading

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [value])

  const handleSend = (): void => {
    if (!canSend) return
    onSend(value.trim())
    setValue('')
    const el = textareaRef.current
    if (el) el.style.height = 'auto'
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return { value, setValue, textareaRef, handleKeyDown, handleSend, canSend }
}
