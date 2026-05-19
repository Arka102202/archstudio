import { useState, useEffect, useRef } from 'react'
import type React from 'react'
import type { CreateProjectModalProps, CreateProjectModalHook } from './types'

export const useCreateProjectModal = (
  { onSubmit, onClose }: CreateProjectModalProps
): CreateProjectModalHook => {
  const [name,          setName]          = useState<string>('')
  const [description,   setDescription]   = useState<string>('')
  const [isSubmitting,  setIsSubmitting]  = useState<boolean>(false)

  const nameInputRef = useRef<HTMLInputElement | null>(null)

  const canSubmit = name.trim().length > 0 && !isSubmitting

  // Autofocus name input on mount
  useEffect(() => {
    nameInputRef.current?.focus()
  }, [])

  // Escape closes modal
  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keyup', handleKeyUp)
    return () => document.removeEventListener('keyup', handleKeyUp)
  }, [onClose])

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) return
    setIsSubmitting(true)
    try {
      await onSubmit({ name, description })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && canSubmit) {
      void handleSubmit()
    }
  }

  return {
    name,
    description,
    isSubmitting,
    canSubmit,
    nameInputRef,
    setName,
    setDescription,
    handleSubmit,
    handleKeyDown,
  }
}
