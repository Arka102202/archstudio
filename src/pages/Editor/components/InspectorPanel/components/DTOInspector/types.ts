import type {
  DTONode,
  DTOField,
  DTOPurpose,
  DTOOrigin,
  JavaType,
  LombokStyle,
  ValidationType,
  AIPrompt,
} from '@entity'

export interface DTOInspectorProps {
  nodeId: string
}

// ─── Connected Entity entry for the CONNECTIONS section ──────────

export interface ConnectedEntity {
  edgeId:      string
  entityId:    string
  entityLabel: string
}

export interface DTOInspectorHook {
  node: DTONode | null

  // Identity
  handleLabelChange:   (value: string) => void
  handlePurposeChange: (value: DTOPurpose) => void
  handleOriginChange:  (value: DTOOrigin) => void

  // Config
  handleValidationToggle:  () => void
  handleLombokStyleChange: (value: LombokStyle) => void

  // Fields
  handleAddField:             (name: string, type: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF', entityId: string | null, subType?: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null, subEntityId?: string | null, customTypeId?: string | null, subCustomTypeId?: string | null) => Promise<void>
  handleRemoveField:          (fieldId: string) => Promise<void>
  handleFieldTypeChange:      (fieldId: string, type: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF', entityId: string | null, customTypeId: string | null) => Promise<void>
  handleFieldArraySubTypeChange: (fieldId: string, subType: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null, entityId: string | null, customTypeId?: string | null) => Promise<void>
  handleFieldMapSubTypeChange:   (fieldId: string, slot: 'key' | 'value', subType: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null, entityId: string | null, customTypeId: string | null) => void
  handleFieldNameChange:      (fieldId: string, name: string) => void

  // entity + custom type options for FieldTypeSelect
  entityOptions:     import('@components/shared').EntityOption[]
  customTypeOptions: import('@components/shared').CustomTypeOption[]

  // Serialisation (per-field)
  handleJsonPropertyChange:    (fieldId: string, value: string) => void
  handleJsonIgnoreToggle:      (fieldId: string) => void
  handleIncludeNonNullToggle:  (fieldId: string) => void

  // Enum values (per-field, only when type === ENUM)
  handleAddEnumValue:    (fieldId: string, value: string) => void
  handleRemoveEnumValue: (fieldId: string, index: number) => void

  // Validations (per-field)
  handleAddValidation:           (fieldId: string, type: ValidationType) => void
  handleRemoveValidation:        (fieldId: string, validationIdx: number) => void
  handleValidationValueChange:   (fieldId: string, validationIdx: number, value: string) => void
  handleValidationMessageChange: (fieldId: string, validationIdx: number, message: string) => void

  // AI Prompt
  handleAIPromptChange:   (field: keyof AIPrompt, value: string) => void
  handleAIGenerateToggle: () => void

  // Connections
  connectedEntities: ConnectedEntity[]
  handleDeleteEdge:  (edgeId: string) => Promise<void>

  // Lifecycle
  handleClose:  () => void
  handleDelete: () => void
}

// Re-export field type for component use
export type { DTOField }
