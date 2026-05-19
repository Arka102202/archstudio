import { create } from 'zustand'

// ─── RegenerateModalStore ─────────────────────────────────────────

export type RegenerateAction = 'diff' | 'full'

interface RegenerateModalStore {
  isOpen:   boolean
  msId:     string | null
  msLabel:  string
  open:     (msId: string, msLabel: string) => void
  close:    () => void
  resolve:  ((action: RegenerateAction) => void) | null
  setResolve: (fn: (action: RegenerateAction) => void) => void
}

export const useRegenerateModalStore = create<RegenerateModalStore>()(set => ({
  isOpen:  false,
  msId:    null,
  msLabel: '',
  resolve: null,

  open: (msId, msLabel) => set({ isOpen: true, msId, msLabel }),
  close: ()              => set({ isOpen: false, resolve: null }),
  setResolve: (fn)       => set({ resolve: fn }),
}))
