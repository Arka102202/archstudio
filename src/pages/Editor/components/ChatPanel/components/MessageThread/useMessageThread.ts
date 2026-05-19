import { useEffect, useRef, useState } from 'react'
import type { MessageThreadHook } from './types'

export const useMessageThread = (messageCount: number): MessageThreadHook => {
  const messagesEndRef   = useRef<HTMLDivElement>(null)
  const containerRef     = useRef<HTMLDivElement>(null)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)

  const handleScroll = (): void => {
    const el = containerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShouldAutoScroll(distanceFromBottom < 60)
  }

  useEffect(() => {
    if (shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messageCount, shouldAutoScroll])

  return { messagesEndRef, containerRef, shouldAutoScroll, handleScroll }
}
