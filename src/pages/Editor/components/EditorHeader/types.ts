import type { ActiveTab } from '@pages/Editor/types'

export interface EditorHeaderProps {
  projectName: string
  activeTab:   ActiveTab
  onTabChange: (tab: ActiveTab) => void
  onBack:      () => void
  onRename:    (name: string) => Promise<void>
}

export interface EditorHeaderHook {
  isEditing:              boolean
  editValue:              string
  inputRef:               React.RefObject<HTMLInputElement | null>
  startEdit:              () => void
  commitEdit:             () => void
  cancelEdit:             () => void
  handleEditKeyDown:      (e: React.KeyboardEvent<HTMLInputElement>) => void
  setEditValue:           (v: string) => void
  handleCloneFromExample: () => Promise<void>
}
