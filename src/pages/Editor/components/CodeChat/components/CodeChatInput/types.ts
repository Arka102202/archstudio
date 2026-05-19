import type { AttachedFile } from '@store'

export interface CodeChatInputProps {
  onSend:                (text: string) => void
  isLoading:             boolean
  isSendingArchitecture: boolean
  hasActiveMsId:         boolean
  attachedFiles:         AttachedFile[]
  availableFiles:        string[]
  onToggleArchitecture:  (v: boolean) => void
  onAbort:               () => void
  onAttachFile:          (file: AttachedFile) => void
  onDetachFile:          (path: string) => void
}

// ─── File-picker tree ──────────────────────────────────────────────────────────

export interface TreeFile {
  kind: 'file'
  name: string
  path: string
}

export interface TreeFolder {
  kind:     'folder'
  name:     string
  path:     string
  children: Array<TreeFolder | TreeFile>
}

export type PickerView = 'tree' | 'flat'
export type CheckState = 'all' | 'some' | 'none'
