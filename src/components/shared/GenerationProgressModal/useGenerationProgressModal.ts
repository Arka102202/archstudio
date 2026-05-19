import { useRef, useEffect }                              from 'react'
import { useCodeEditorStore, useGenerationProgressStore } from '@store'
import type { GenerationProgressModalHook }               from './types'

// ─── useGenerationProgressModal ───────────────────────────────────

export const useGenerationProgressModal = (): GenerationProgressModalHook => {
  const { isOpen, isMinimised, msLabel, close, minimise, restore, stopped, timedOut, continueCallback } = useGenerationProgressStore()
  const { fileProgress, isGenerating, thinkingText } = useCodeEditorStore()

  const doneCount  = fileProgress.filter(i => i.status === 'done').length
  const totalCount = fileProgress.length
  const streaming  = fileProgress.find(i => i.status === 'streaming')
  const isThinking = fileProgress.length === 0 && isGenerating

  const listRef         = useRef<HTMLDivElement>(null)
  const streamingRowRef = useRef<HTMLDivElement>(null)

  // Scroll the active streaming row into view whenever the streaming file changes
  useEffect(() => {
    if (!streaming || !streamingRowRef.current || !listRef.current) return
    streamingRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [streaming?.path])

  // Auto-dismiss: close 2 seconds after generation completes successfully
  useEffect(() => {
    if (!isOpen || isGenerating || stopped || timedOut) return
    if (doneCount === 0 || doneCount < totalCount) return
    const timer = setTimeout(() => { close() }, 2000)
    return () => clearTimeout(timer)
  }, [isOpen, isGenerating, stopped, timedOut, doneCount, totalCount, close])

  const handleClose = (): void => {
    if (isGenerating) {
      useCodeEditorStore.getState().abortGeneration()
    }
    close()
  }

  return {
    isOpen,
    isMinimised,
    msLabel,
    isGenerating,
    stopped,
    timedOut,
    continueCallback,
    isThinking,
    thinkingText,
    items:       fileProgress,
    doneCount,
    totalCount,
    streaming,
    handleClose,
    handleMinimise: minimise,
    handleRestore:  restore,
    listRef,
    streamingRowRef,
  }
}
