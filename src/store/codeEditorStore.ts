import { create } from 'zustand'

// ─── FileProgressItem ─────────────────────────────────────────────

export interface FileProgressItem {
  path:       string
  fileName:   string   // last segment e.g. "Order.java"
  category:   string   // "entity" | "repository" | "dto" | "service" | "controller" | "config" | "build" | "other"
  status:     'waiting' | 'streaming' | 'done' | 'error'
  liveLines:  string[] // last 5 lines of current content
  changeType: 'full' | 'new' | 'updated' | 'incomplete' | 'missing'
}

// ─── CodeEditorStore ─────────────────────────────────────────────

export interface CodeEditorStore {
  isGenerating:   boolean
  generatingMsId: string | null

  // Active MS in the Code tab selector
  activeMsId:    string | null
  setActiveMsId: (id: string | null) => void

  // Open tabs
  openFilePaths:  string[]
  activeFilePath: string | null
  openFile:       (path: string) => void
  closeFile:      (path: string) => void
  setActiveFile:  (path: string) => void

  // Explorer panel width (drag-to-resize) + collapsed folders
  collapsedFolders: Record<string, boolean>
  explorerWidth:    number
  toggleFolder:     (path: string) => void
  setExplorerWidth: (w: number) => void

  // In-memory mirror of IDB generatedFiles table
  generatedFiles: Record<string, string>   // filePath → content

  // Modified files tracking (user edits after generation)
  modifiedFiles:      Record<string, boolean>  // filePath → true
  markFileModified:   (path: string) => void
  clearModifiedFiles: () => void

  // Generation progress — drives the progress modal
  fileProgress: FileProgressItem[]

  abortController:    AbortController | null
  setAbortController: (c: AbortController | null) => void
  abortGeneration:    () => void

  // Thinking phase — raw Claude output before first <file> tag
  thinkingText:        string
  generationStarted:   boolean
  appendThinkingChunk: (chunk: string) => void
  clearThinkingText:   () => void
  setGenerationStarted: (v: boolean) => void

  // Actions
  setGenerating:       (msId: string | null) => void
  setGeneratedFile:    (path: string, content: string) => void
  deleteGeneratedFile: (path: string) => void
  clearGeneratedFiles: () => void
  setFileProgress:     (items: FileProgressItem[]) => void
  updateFileProgress:  (path: string, patch: Partial<FileProgressItem>) => void
  appendFileChunk:     (path: string, chunk: string) => void
}

export const useCodeEditorStore = create<CodeEditorStore>()((set, get) => ({
  isGenerating:      false,
  generatingMsId:    null,
  abortController:   null,
  thinkingText:      '',
  generationStarted: false,
  activeMsId:        null,
  explorerWidth:  220,
  generatedFiles: {},
  modifiedFiles:  {},
  fileProgress:   [],

  openFilePaths:  [],
  activeFilePath: null,
  collapsedFolders: {},

  setActiveMsId: (id) => set({ activeMsId: id }),

  markFileModified:   (path) => set(s => ({ modifiedFiles: { ...s.modifiedFiles, [path]: true } })),
  clearModifiedFiles: ()     => set({ modifiedFiles: {} }),

  openFile: (path) => {
    const { openFilePaths } = get()
    if (!openFilePaths.includes(path)) {
      set({ openFilePaths: [...openFilePaths, path], activeFilePath: path })
    } else {
      set({ activeFilePath: path })
    }
  },

  closeFile: (path) => {
    const { openFilePaths, activeFilePath } = get()
    const idx     = openFilePaths.indexOf(path)
    const updated = openFilePaths.filter(p => p !== path)
    let active    = activeFilePath
    if (activeFilePath === path) {
      active = updated[Math.min(idx, updated.length - 1)] ?? null
    }
    set({ openFilePaths: updated, activeFilePath: active })
  },

  setActiveFile: (path) => set({ activeFilePath: path }),

  toggleFolder: (path) => set(s => ({
    collapsedFolders: { ...s.collapsedFolders, [path]: !s.collapsedFolders[path] },
  })),

  setExplorerWidth: (w) => set({ explorerWidth: w }),

  setAbortController: (c) => set({ abortController: c }),

  abortGeneration: () => {
    const { abortController } = get()
    if (abortController) abortController.abort()
    set({ abortController: null, isGenerating: false, generatingMsId: null })
  },

  appendThinkingChunk:  (chunk) => set(s => ({ thinkingText: s.thinkingText + chunk })),
  clearThinkingText:    () => set({ thinkingText: '' }),
  setGenerationStarted: (v) => set({ generationStarted: v }),

  setGenerating: (msId) => set({
    isGenerating:   msId !== null,
    generatingMsId: msId,
  }),

  setGeneratedFile: (path, content) => set(state => ({
    generatedFiles: { ...state.generatedFiles, [path]: content },
  })),

  deleteGeneratedFile: (path) => set(state => {
    const { [path]: _removed, ...rest } = state.generatedFiles
    const openFilePaths  = state.openFilePaths.filter(p => p !== path)
    const activeFilePath = state.activeFilePath === path
      ? (openFilePaths[0] ?? null)
      : state.activeFilePath
    return { generatedFiles: rest, openFilePaths, activeFilePath }
  }),

  clearGeneratedFiles: () => set({
    generatedFiles:    {},
    fileProgress:      [],
    openFilePaths:     [],
    activeFilePath:    null,
    thinkingText:      '',
    generationStarted: false,
  }),

  setFileProgress: (items) => set({ fileProgress: items }),

  updateFileProgress: (path, patch) => set(state => {
    const existing = state.fileProgress.find(i => i.path === path)
    if (existing) {
      return {
        fileProgress: state.fileProgress.map(i =>
          i.path === path ? { ...i, ...patch } : i
        ),
      }
    }
    // New entry — patch must include all required fields
    const newItem: FileProgressItem = {
      path,
      fileName:   patch.fileName   ?? (path.split('/').pop() ?? path),
      category:   patch.category   ?? 'other',
      status:     patch.status     ?? 'waiting',
      liveLines:  patch.liveLines  ?? [],
      changeType: patch.changeType ?? 'full',
    }
    return { fileProgress: [...state.fileProgress, newItem] }
  }),

  appendFileChunk: (path, chunk) => set(state => ({
    generatedFiles: {
      ...state.generatedFiles,
      [path]: (state.generatedFiles[path] ?? '') + chunk,
    },
  })),
}))
