import type { AIPrompt } from '@entity'

export interface AIPromptBoxProps {
  value:            AIPrompt | null | undefined
  onChange:         (field: keyof AIPrompt, value: string) => void
  onGenerateToggle: () => void
}
