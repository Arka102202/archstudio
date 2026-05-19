import { create } from 'zustand'

const genId = (): string => crypto.randomUUID()

// ─── Types ────────────────────────────────────────────────────────

export interface CodeChatFileOp {
  path:    string
  op:      'create' | 'update' | 'delete'
  content: string | null
  status:  'applied'
}

export interface CodeChatMessage {
  id:          string
  role:        'user' | 'assistant'
  content:     string
  fileOps:     CodeChatFileOp[]
  timestamp:   number
  isError:     boolean
  isStreaming: boolean
}

export interface CodeChatSession {
  id:        string
  title:     string
  messages:  CodeChatMessage[]
  createdAt: number
}

export interface AttachedFile {
  path: string
  name: string   // last path segment
}

// ─── Store ────────────────────────────────────────────────────────

interface CodeChatStore {
  sessions:              CodeChatSession[]
  activeSessionId:       string | null
  isLoading:             boolean
  isSendingArchitecture: boolean
  attachedFiles:         AttachedFile[]
  isHistoryOpen:         boolean

  // Session management
  newSession:    () => void
  switchSession: (id: string) => void
  deleteSession: (id: string) => void
  setSessions:   (sessions: CodeChatSession[], activeId: string | null) => void

  // Message management (always targets the active session)
  addMessage:              (msg: CodeChatMessage) => void
  updateLastMessage:       (patch: Partial<CodeChatMessage>) => void
  appendLastMessageText:   (chunk: string) => void
  appendLastMessageFileOp: (op: CodeChatFileOp) => void

  // File attachments (for next send)
  attachFile:        (file: AttachedFile) => void
  detachFile:        (path: string) => void
  clearAttachedFiles:() => void

  // Flags
  setLoading:               (v: boolean) => void
  setIsSendingArchitecture: (v: boolean) => void
  setHistoryOpen:           (v: boolean) => void
}

// ─── Helpers ──────────────────────────────────────────────────────

function withActiveSession(
  sessions: CodeChatSession[],
  activeId: string | null,
  fn: (sess: CodeChatSession) => CodeChatSession,
): CodeChatSession[] {
  if (!activeId) return sessions
  return sessions.map(s => (s.id === activeId ? fn(s) : s))
}

function updateLastMsg(
  messages: CodeChatMessage[],
  fn: (msg: CodeChatMessage) => CodeChatMessage,
): CodeChatMessage[] {
  if (messages.length === 0) return messages
  const next = [...messages]
  next[next.length - 1] = fn(next[next.length - 1])
  return next
}

// ─── Store definition ─────────────────────────────────────────────

export const useCodeChatStore = create<CodeChatStore>()((set, get) => {
  // Start with one default session
  const defaultId = genId()

  return {
    sessions:              [{ id: defaultId, title: 'New chat', messages: [], createdAt: Date.now() }],
    activeSessionId:       defaultId,
    isLoading:             false,
    isSendingArchitecture: true,
    attachedFiles:         [],
    isHistoryOpen:         false,

    // ── Session management ─────────────────────────────────────────

    newSession: () => {
      const id = genId()
      set(s => ({
        sessions:        [...s.sessions, { id, title: 'New chat', messages: [], createdAt: Date.now() }],
        activeSessionId: id,
        isHistoryOpen:   false,
        attachedFiles:   [],
      }))
    },

    switchSession: (id) => set({ activeSessionId: id, isHistoryOpen: false, attachedFiles: [] }),

    setSessions: (sessions, activeId) => {
      if (sessions.length === 0) {
        const id = genId()
        set({
          sessions:        [{ id, title: 'New chat', messages: [], createdAt: Date.now() }],
          activeSessionId: id,
        })
        return
      }
      set({
        sessions,
        activeSessionId: activeId ?? sessions[sessions.length - 1].id,
      })
    },

    deleteSession: (id) => {
      const { sessions, activeSessionId } = get()
      const remaining = sessions.filter(s => s.id !== id)
      // Always keep at least one session
      if (remaining.length === 0) {
        const newId = genId()
        set({
          sessions:        [{ id: newId, title: 'New chat', messages: [], createdAt: Date.now() }],
          activeSessionId: newId,
        })
        return
      }
      const newActive = activeSessionId === id
        ? (remaining[remaining.length - 1]?.id ?? null)
        : activeSessionId
      set({ sessions: remaining, activeSessionId: newActive })
    },

    // ── Message management ─────────────────────────────────────────

    addMessage: (msg) =>
      set(s => ({
        sessions: withActiveSession(s.sessions, s.activeSessionId, sess => {
          // Set title from first user message
          const title = sess.messages.length === 0 && msg.role === 'user'
            ? msg.content.slice(0, 45).trimEnd() + (msg.content.length > 45 ? '…' : '')
            : sess.title
          return { ...sess, title, messages: [...sess.messages, msg] }
        }),
      })),

    updateLastMessage: (patch) =>
      set(s => ({
        sessions: withActiveSession(s.sessions, s.activeSessionId, sess => ({
          ...sess,
          messages: updateLastMsg(sess.messages, m => ({ ...m, ...patch })),
        })),
      })),

    appendLastMessageText: (chunk) =>
      set(s => ({
        sessions: withActiveSession(s.sessions, s.activeSessionId, sess => ({
          ...sess,
          messages: updateLastMsg(sess.messages, m => ({ ...m, content: m.content + chunk })),
        })),
      })),

    appendLastMessageFileOp: (op) =>
      set(s => ({
        sessions: withActiveSession(s.sessions, s.activeSessionId, sess => ({
          ...sess,
          messages: updateLastMsg(sess.messages, m => ({ ...m, fileOps: [...m.fileOps, op] })),
        })),
      })),

    // ── File attachments ───────────────────────────────────────────

    attachFile: (file) =>
      set(s => ({
        attachedFiles: s.attachedFiles.find(f => f.path === file.path)
          ? s.attachedFiles
          : [...s.attachedFiles, file],
      })),

    detachFile: (path) =>
      set(s => ({ attachedFiles: s.attachedFiles.filter(f => f.path !== path) })),

    clearAttachedFiles: () => set({ attachedFiles: [] }),

    // ── Flags ──────────────────────────────────────────────────────

    setLoading:               (v) => set({ isLoading: v }),
    setIsSendingArchitecture: (v) => set({ isSendingArchitecture: v }),
    setHistoryOpen:           (v) => set({ isHistoryOpen: v }),
  }
})
