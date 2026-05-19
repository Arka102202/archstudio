import { create } from 'zustand'

// ─── GenerationProgressStore ──────────────────────────────────────

interface GenerationProgressStore {
  isOpen:              boolean
  isMinimised:         boolean
  msLabel:             string
  stopped:             boolean
  timedOut:            boolean
  continueCallback:    (() => Promise<void>) | null
  open:                (msLabel: string) => void
  close:               () => void
  minimise:            () => void
  restore:             () => void
  setStopped:          (v: boolean) => void
  setTimedOut:         (v: boolean) => void
  setContinueCallback: (fn: (() => Promise<void>) | null) => void
}

export const useGenerationProgressStore = create<GenerationProgressStore>()(set => ({
  isOpen:              false,
  isMinimised:         false,
  msLabel:             '',
  stopped:             false,
  timedOut:            false,
  continueCallback:    null,
  open:                (msLabel) => set({ isOpen: true, isMinimised: false, msLabel, stopped: false, timedOut: false }),
  close:               ()        => set({ isOpen: false, isMinimised: false, timedOut: false, continueCallback: null }),
  minimise:            ()        => set({ isMinimised: true }),
  restore:             ()        => set({ isMinimised: false }),
  setStopped:          (v)       => set({ stopped: v }),
  setTimedOut:         (v)       => set({ timedOut: v }),
  setContinueCallback: (fn)      => set({ continueCallback: fn }),
}))
