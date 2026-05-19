import type { EntityNode, EntityField, FieldConstraint, JavaType, LombokStyle, AIPrompt, ServiceNode, Relation } from '@entity'

export interface EntityInspectorProps {
  nodeId: string
}

// ─── Connected DTO entry for the CONNECTIONS section ─────────────

export interface ConnectedDTO {
  edgeId:     string
  dtoId:      string
  dtoLabel:   string
  dtoPurpose: string
}

// ─── Connected Table entry for the CONNECTIONS section ───────────

export interface ConnectedTable {
  edgeId:     string
  tableId:    string
  tableLabel: string
}

// ─── Connected Service entry for the CONNECTIONS section ─────────

export interface ConnectedService {
  edgeId:       string
  serviceId:    string
  serviceLabel: string
}

// Re-export ServiceNode for use in hook
export type { ServiceNode }

export interface EntityInspectorHook {
  node: EntityNode | null

  // Identity
  handleLabelChange:     (value: string) => void
  handleTableNameChange: (value: string) => void

  // Config toggles
  handleAuditingToggle:            () => void
  handleSoftDeleteToggle:          () => void
  handleGenerateRepositoryToggle:  () => void
  handleLombokStyleChange:         (value: LombokStyle) => void

  // Fields
  handleAddField:                (name: string, type: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF', entityId: string | null, constraint: FieldConstraint, subType?: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null, subEntityId?: string | null, customTypeId?: string | null, subCustomTypeId?: string | null) => Promise<void>
  handleRemoveField:             (fieldId: string) => void
  handleFieldTypeChange:         (fieldId: string, type: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF', entityId: string | null, customTypeId: string | null) => Promise<void>
  handleFieldArraySubTypeChange: (fieldId: string, subType: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null, entityId: string | null, customTypeId: string | null) => Promise<void>
  handleFieldRelationshipChange: (fieldId: string, patch: Partial<Relation>) => void

  // Enum values
  handleAddEnumValue:    (fieldId: string, value: string) => void
  handleRemoveEnumValue: (fieldId: string, index: number) => void

  // entity + custom type options for FieldTypeSelect
  entityOptions:     import('@components/shared').EntityOption[]
  customTypeOptions: import('@components/shared').CustomTypeOption[]

  // PK/UNIQUE field names per entity — for "Mapped by" dropdown
  keyFieldsByEntityId: Record<string, string[]>

  // AI Prompt
  handleAIPromptChange:   (field: keyof AIPrompt, value: string | boolean) => void
  handleAIGenerateToggle: () => void

  // Connections — DTOs
  connectedDTOs:   ConnectedDTO[]
  handleDeleteEdge: (edgeId: string) => Promise<void>

  // Connections — DB

  // Connections — Table
  connectedTables:       ConnectedTable[]
  handleDisconnectTable: (edgeId: string) => Promise<void>

  // Connections — Service
  connectedServices:       ConnectedService[]
  handleDisconnectService: (edgeId: string) => Promise<void>

  // Lifecycle
  handleClose:  () => void
  handleDelete: () => void
}

// ─── Add-field row local state — used inside the inspector component

export interface AddFieldState {
  name:       string
  type:       JavaType
  constraint: FieldConstraint
}

// ─── Re-export field type for component use

export type { EntityField }
