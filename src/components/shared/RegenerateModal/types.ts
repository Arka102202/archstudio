import type { RegenerateAction } from '@store'

export type { RegenerateAction }

export interface RegenerateModalHook {
  isOpen:         boolean
  msLabel:        string
  handleDiff:     () => void
  handleFull:     () => void
  handleClose:    () => void
}
