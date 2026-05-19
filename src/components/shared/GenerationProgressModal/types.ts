import type { FileProgressItem } from '@store'
import type { RefObject }        from 'react'

export type { FileProgressItem }

export interface GenerationProgressModalHook {
  isOpen:           boolean
  isMinimised:      boolean
  msLabel:          string
  isGenerating:     boolean
  stopped:          boolean
  timedOut:         boolean
  continueCallback: (() => Promise<void>) | null
  isThinking:       boolean
  thinkingText:     string
  items:            FileProgressItem[]
  doneCount:        number
  totalCount:       number
  streaming:        FileProgressItem | undefined
  handleClose:      () => void
  handleMinimise:   () => void
  handleRestore:    () => void
  listRef:          RefObject<HTMLDivElement | null>
  streamingRowRef:  RefObject<HTMLDivElement | null>
}
