import { useState, useRef } from 'react'
import type React from 'react'
import type { EditorHeaderProps, EditorHeaderHook } from './types'

export const useEditorHeader = (
  { projectName, onRename }: Pick<EditorHeaderProps, 'projectName' | 'onRename'>
): EditorHeaderHook => {
  const [isEditing,  setIsEditing]  = useState<boolean>(false)
  const [editValue,  setEditValue]  = useState<string>(projectName)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const startEdit = (): void => {
    setEditValue(projectName)
    setIsEditing(true)
    setTimeout(() => {
      inputRef.current?.select()
    }, 0)
  }

  const commitEdit = (): void => {
    setIsEditing(false)
    if (editValue.trim() && editValue.trim() !== projectName) {
      void onRename(editValue.trim())
    }
  }

  const cancelEdit = (): void => {
    setIsEditing(false)
    setEditValue(projectName)
  }

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') cancelEdit()
  }

  return {
    isEditing,
    editValue,
    inputRef,
    startEdit,
    commitEdit,
    cancelEdit,
    handleEditKeyDown,
    setEditValue,
  }
}
