import { useRegenerateModalStore } from '@store'
import type { RegenerateModalHook } from './types'

// ─── useRegenerateModal ───────────────────────────────────────────

export const useRegenerateModal = (): RegenerateModalHook => {
  const { isOpen, msLabel, resolve, close } = useRegenerateModalStore()

  const handleDiff = (): void => {
    resolve?.('diff')
    close()
  }

  const handleFull = (): void => {
    resolve?.('full')
    close()
  }

  const handleClose = (): void => {
    resolve?.('diff')   // default to diff on dismiss
    close()
  }

  return { isOpen, msLabel, handleDiff, handleFull, handleClose }
}
