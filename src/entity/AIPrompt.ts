// ─── AIPrompt ─────────────────────────────────────────────────────

export interface AIPrompt {
  description:       string
  businessRules:     string
  edgeCases:         string
  expectedBehaviour: string
  aiGenerate:        boolean
}

export const emptyAIPrompt = (): AIPrompt => ({
  description:       '',
  businessRules:     '',
  edgeCases:         '',
  expectedBehaviour: '',
  aiGenerate:        false,
})
