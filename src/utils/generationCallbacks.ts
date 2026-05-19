import { useCodeEditorStore }       from '@store'
import { useGenerationProgressStore } from '@store'
import type { FileProgressItem }       from '@store'
import { syncClaudeContext }           from './syncClaudeContext'

// ─── categoryFromPath ─────────────────────────────────────────────

export function categoryFromPath(path: string): string {
  if (path.includes('/entity/'))     return 'entity'
  if (path.includes('/repository/')) return 'repository'
  if (path.includes('/dto/'))        return 'dto'
  if (path.includes('/service/'))    return 'service'
  if (path.includes('/controller/')) return 'controller'
  if (path.includes('application'))  return 'config'
  if (path.includes('pom.xml') || path.includes('build.gradle')) return 'build'
  if (path.includes('Dockerfile'))   return 'build'
  return 'other'
}

// ─── makeGenerationCallbacks ──────────────────────────────────────

export interface GenerationCallbackParams {
  msId:      string
  projectId: string
  diffMode:  boolean   // true = diff run → show NEW/UPDATED badges
}

export interface GenerationCallbacks {
  onFileListReady?:     (allPaths: string[], completePaths: string[]) => void
  onFileStart:          (path: string) => void
  onFileChunk:          (path: string, chunk: string) => void
  onFileComplete:       (path: string, content: string) => void
  onDone:               () => void
  onError:              (err: Error) => void
  onTimeout?:           () => void
  onThinkingChunk?:     (chunk: string) => void
  onGenerationStarted?: () => void
}

export function makeGenerationCallbacks(
  params: GenerationCallbackParams,
): GenerationCallbacks {
  const codeStore = useCodeEditorStore.getState()

  return {
    onFileListReady: (allPaths, completePaths) => {
      const completeSet = new Set(completePaths)
      const items: FileProgressItem[] = allPaths.map(path => ({
        path,
        fileName:   path.split('/').pop() ?? path,
        category:   categoryFromPath(path),
        status:     completeSet.has(path) ? 'done' : 'waiting',
        liveLines:  [],
        changeType: params.diffMode
          ? (codeStore.generatedFiles[path] !== undefined ? 'updated' : 'new')
          : 'full',
      }))
      codeStore.setFileProgress(items)
    },

    onFileStart: (path) => {
      const changeType: FileProgressItem['changeType'] = params.diffMode
        ? (codeStore.generatedFiles[path] !== undefined ? 'updated' : 'new')
        : 'full'

      const item: FileProgressItem = {
        path,
        fileName:   path.split('/').pop() ?? path,
        category:   categoryFromPath(path),
        status:     'streaming',
        liveLines:  [],
        changeType,
      }
      codeStore.updateFileProgress(path, item)
      codeStore.setGeneratedFile(path, '')
    },

    onFileChunk: (path, chunk) => {
      codeStore.appendFileChunk(path, chunk)
      const content   = (useCodeEditorStore.getState().generatedFiles[path] ?? '') + chunk
      const allLines  = content.split('\n')
      const liveLines = allLines.slice(Math.max(0, allLines.length - 5))
      useCodeEditorStore.getState().updateFileProgress(path, { liveLines })
    },

    onFileComplete: (path, content) => {
      useCodeEditorStore.getState().setGeneratedFile(path, content)
      useCodeEditorStore.getState().updateFileProgress(path, { status: 'done', liveLines: [] })
    },

    onDone: () => {
      useCodeEditorStore.getState().setGenerating(null)
      void syncClaudeContext(params.msId, params.projectId)
    },

    onError: (err) => {
      useCodeEditorStore.getState().setGenerating(null)
      console.error('[archflow] Generation failed:', err.message)
    },

    onTimeout: () => {
      useCodeEditorStore.getState().setGenerating(null)
      useGenerationProgressStore.getState().setTimedOut(true)
    },

    onThinkingChunk: (chunk: string) => {
      useCodeEditorStore.getState().appendThinkingChunk(chunk)
    },

    onGenerationStarted: () => {
      useCodeEditorStore.getState().setGenerationStarted(true)
      useCodeEditorStore.getState().clearThinkingText()
    },
  }
}

// ─── openGenerationSession ────────────────────────────────────────
// Call before any generation run to set up stores and switch the tab.

export function openGenerationSession(params: {
  msId:         string
  msLabel:      string
  clearFiles?:  boolean
}): void {
  const codeStore     = useCodeEditorStore.getState()
  const progressStore = useGenerationProgressStore.getState()

  codeStore.setGenerating(params.msId)
  if (params.clearFiles) codeStore.clearGeneratedFiles()
  codeStore.setFileProgress([])

  progressStore.open(params.msLabel)
  window.dispatchEvent(new CustomEvent('archflow-switch-tab', { detail: 'code' }))
}
