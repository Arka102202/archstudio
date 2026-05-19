import type { FileNode } from '@utils/buildFileTree'

// Re-export for use within this component tree
export type { FileNode }

// ─── ExplorerProps ────────────────────────────────────────────────

export interface ExplorerProps {
  tree:             FileNode
  activeFilePath:   string | null
  collapsedFolders: Record<string, boolean>
  modifiedFiles:    Record<string, boolean>
  onFileClick:      (path: string) => void
  onFolderToggle:   (path: string) => void
}

// ─── ExplorerItemProps ────────────────────────────────────────────

export interface ExplorerItemProps {
  node:             FileNode
  depth:            number
  activeFilePath:   string | null
  collapsedFolders: Record<string, boolean>
  modifiedFiles:    Record<string, boolean>
  onFileClick:      (path: string) => void
  onFolderToggle:   (path: string) => void
}

// ─── TabBarProps ──────────────────────────────────────────────────

export interface TabBarProps {
  openFilePaths:  string[]
  activeFilePath: string | null
  fileMap:        Record<string, FileNode>
  modifiedFiles:  Record<string, boolean>
  onTabClick:     (path: string) => void
  onTabClose:     (path: string) => void
}

// ─── EditorPaneProps ──────────────────────────────────────────────

export interface EditorPaneProps {
  fileNode:     FileNode | null
  onFileChange: (path: string, content: string) => void
}

// ─── CodeEditorProps ──────────────────────────────────────────────

export interface CodeEditorProps {
  projectId: string
}

// ─── UseCodeEditorReturn ──────────────────────────────────────────

import type React from 'react'

export interface UseCodeEditorReturn {
  tree:             FileNode | null
  fileMap:          Record<string, FileNode>
  activeFileNode:   FileNode | null
  openFilePaths:    string[]
  activeFilePath:   string | null
  collapsedFolders: Record<string, boolean>
  modifiedFiles:    Record<string, boolean>
  explorerWidth:    number
  openFile:         (path: string) => void
  closeFile:        (path: string) => void
  setActiveFile:    (path: string) => void
  toggleFolder:     (path: string) => void
  handleResizeStart: (e: React.MouseEvent) => void
  onFileChange:     (path: string, content: string) => void
}
