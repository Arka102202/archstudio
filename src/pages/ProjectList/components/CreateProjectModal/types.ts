import type { CreateProjectInput } from '@pages/ProjectList'

export interface CreateProjectModalProps {
  onSubmit: (input: CreateProjectInput) => Promise<void>
  onClose:  () => void
}

export interface CreateProjectModalHook {
  name:             string
  description:      string
  isSubmitting:     boolean
  canSubmit:        boolean
  nameInputRef:     React.RefObject<HTMLInputElement | null>
  setName:          (v: string) => void
  setDescription:   (v: string) => void
  handleSubmit:     () => Promise<void>
  handleKeyDown:    (e: React.KeyboardEvent) => void
}
