import type { ErrorDefinition } from '@entity'

export interface ErrorHandlingSectionProps {
  errors:        ErrorDefinition[]
  onChange:      (updated: ErrorDefinition[]) => void
  // Optional label for the section header (default: "ERROR HANDLING")
  sectionLabel?: string
}
