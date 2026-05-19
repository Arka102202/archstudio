import type { CustomTypeNode, CustomTypeField, AIPrompt, JavaType } from '@entity'

export interface CustomTypeInspectorProps {
  nodeId: string
}

export interface CustomTypeInspectorHook {
  node: CustomTypeNode | null

  // Identity
  handleLabelChange: (value: string) => void

  // Fields
  handleAddField:                (name: string, type: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF', entityId: string | null, customTypeId: string | null, subType?: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null, subEntityId?: string | null, subCustomTypeId?: string | null) => Promise<void>
  handleRemoveField:             (fieldId: string) => Promise<void>
  handleFieldTypeChange:         (fieldId: string, type: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF', entityId: string | null, customTypeId: string | null) => Promise<void>
  handleFieldArraySubTypeChange: (fieldId: string, subType: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null, entityId: string | null, customTypeId: string | null) => Promise<void>
  handleFieldNameChange:         (fieldId: string, name: string) => void
  handleAddEnumValue:            (fieldId: string, value: string) => void
  handleRemoveEnumValue:         (fieldId: string, index: number) => void

  // AI Prompt
  handleAIPromptChange:   (field: keyof AIPrompt, value: string | boolean) => void
  handleAIGenerateToggle: () => void

  // Available options for dropdowns
  entityOptions:     import('@components/shared').EntityOption[]
  customTypeOptions: import('@components/shared').CustomTypeOption[]

  // Lifecycle
  handleClose:  () => void
  handleDelete: () => void
}

export type { CustomTypeField }
