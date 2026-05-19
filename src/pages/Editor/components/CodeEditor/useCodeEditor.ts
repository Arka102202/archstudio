import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import type React from 'react'
import { useCodeEditorStore }    from '@store'
import { exportArchitecture }    from '@utils/exportArchitecture'
import { buildFileTree }         from '@utils/buildFileTree'
import type { ArchitectureExport } from '@utils/buildFileTree'
import { db }                    from '@db'
import type { FileNode }         from './types'
import type { UseCodeEditorReturn } from './types'

export function useCodeEditor(projectId: string): UseCodeEditorReturn {
  const store = useCodeEditorStore()

  const [tree, setTree] = useState<FileNode | null>(null)

  // Build file tree when activeMsId or generatedFiles change
  useEffect(() => {
    if (!store.activeMsId || !projectId) {
      setTree(null)
      return
    }

    void exportArchitecture(store.activeMsId, projectId).then(arch => {
      const newTree = buildFileTree(
        arch as ArchitectureExport,
        store.generatedFiles,
      )
      // Only show tree if there are generated files
      if (Object.keys(store.generatedFiles).length > 0) {
        setTree(newTree)
      } else {
        setTree(null)
      }
    })
  }, [store.activeMsId, projectId, store.generatedFiles])

  // Load generated files from IDB when activeMsId changes
  useEffect(() => {
    if (!store.activeMsId) return
    store.clearGeneratedFiles()
    void db.generatedFiles
      .where('msId').equals(store.activeMsId)
      .toArray()
      .then(rows => rows.forEach(row => store.setGeneratedFile(row.filePath, row.content)))
  }, [store.activeMsId]) // eslint-disable-line react-hooks/exhaustive-deps
  // Intentionally omitting store methods — they are stable Zustand actions

  // Build flat file map for O(1) content lookup
  const fileMap = useMemo<Record<string, FileNode>>(() => {
    if (!tree) return {}
    const map: Record<string, FileNode> = {}
    const walk = (node: FileNode): void => {
      if (node.type === 'file') {
        map[node.path] = {
          ...node,
          content: store.generatedFiles[node.path] ?? node.content,
        }
      }
      node.children.forEach(walk)
    }
    walk(tree)
    return map
  }, [tree, store.generatedFiles])

  const activeFileNode: FileNode | null = store.activeFilePath
    ? (fileMap[store.activeFilePath] ?? null)
    : null

  // Debounced file change — updates store + IDB + marks file as modified
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onFileChange = useCallback((path: string, content: string): void => {
    // Update in-memory store immediately for responsive editing
    store.setGeneratedFile(path, content)
    store.markFileModified(path)

    // Debounce IDB write by 500ms
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      if (!store.activeMsId) return
      void db.generatedFiles.put({
        id:          `${store.activeMsId}:${path}`,
        msId:        store.activeMsId,
        projectId,
        filePath:    path,
        content,
        generatedAt: Date.now(),
      })
    }, 500)
  }, [store, projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Resizable explorer
  const handleResizeStart = useCallback((e: React.MouseEvent): void => {
    e.preventDefault()
    const startX     = e.clientX
    const startWidth = store.explorerWidth

    const onMove = (ev: MouseEvent): void => {
      const w = Math.min(500, Math.max(160, startWidth + ev.clientX - startX))
      store.setExplorerWidth(w)
    }

    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [store.explorerWidth, store.setExplorerWidth]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    tree,
    fileMap,
    activeFileNode,
    openFilePaths:    store.openFilePaths,
    activeFilePath:   store.activeFilePath,
    collapsedFolders: store.collapsedFolders,
    explorerWidth:    store.explorerWidth,
    openFile:         store.openFile,
    closeFile:        store.closeFile,
    setActiveFile:    store.setActiveFile,
    toggleFolder:     store.toggleFolder,
    modifiedFiles:    store.modifiedFiles,
    handleResizeStart,
    onFileChange,
  }
}
