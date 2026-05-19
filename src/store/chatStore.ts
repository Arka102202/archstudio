import { create } from 'zustand'
import type { ChatSession, ChatMessage } from '../entity/Chat'

export interface ChatState {
  activeChatSessionId:    string | null
  activeChatMessages:     ChatMessage[]
  chatSessions:           ChatSession[]
  isLoading:              boolean
  isSendingArchitecture:  boolean

  setActiveChatSession:   (id: string | null) => void
  setActiveChatMessages:  (messages: ChatMessage[]) => void
  setChatSessions:        (sessions: ChatSession[]) => void
  setIsLoading:           (v: boolean) => void
  toggleSendArchitecture: () => void
  addMessage:             (msg: ChatMessage) => void
  updateLastMessage:      (patch: Partial<ChatMessage>) => void
}

function readSendArchitecture(): boolean {
  const stored = localStorage.getItem('archflow:sendArchitecture')
  if (stored === null) return true
  return stored !== 'false'
}

export const useChatStore = create<ChatState>()((set) => ({
  activeChatSessionId:   null,
  activeChatMessages:    [],
  chatSessions:          [],
  isLoading:             false,
  isSendingArchitecture: readSendArchitecture(),

  setActiveChatSession:  (id) => set({ activeChatSessionId: id }),
  setActiveChatMessages: (messages) => set({ activeChatMessages: messages }),
  setChatSessions:       (sessions) => set({ chatSessions: sessions }),
  setIsLoading:          (v) => set({ isLoading: v }),

  toggleSendArchitecture: () =>
    set((state) => {
      const newValue = !state.isSendingArchitecture
      localStorage.setItem('archflow:sendArchitecture', String(newValue))
      return { isSendingArchitecture: newValue }
    }),

  addMessage: (msg) =>
    set((state) => ({ activeChatMessages: [...state.activeChatMessages, msg] })),

  updateLastMessage: (patch) =>
    set((state) => {
      const messages = state.activeChatMessages
      if (messages.length === 0) return state
      const updated = [...messages]
      updated[updated.length - 1] = { ...updated[updated.length - 1], ...patch }
      return { activeChatMessages: updated }
    }),
}))
