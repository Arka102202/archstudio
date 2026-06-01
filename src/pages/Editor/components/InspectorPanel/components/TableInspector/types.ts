import type {
  TableNode,
  CustomQuery,
  QueryType,
  QueryReturnType,
  CacheConfig,
  AIPrompt,
  JavaType,
} from '@entity'

export interface TableInspectorProps {
  nodeId: string
}

// ─── Connected entity entry for the CONNECTIONS section ──────────

export interface ConnectedEntity {
  edgeId:      string
  entityId:    string
  entityLabel: string
}

// ─── Connected DB entry for the CONNECTIONS section ──────────────

export interface ConnectedDBEntry {
  edgeId:  string
  dbId:    string
  dbLabel: string
}

// ─── Connected DTO — derived from the entity this table stores ────

export interface ConnectedDTO {
  edgeId:     string
  dtoId:      string
  dtoLabel:   string
  dtoPurpose: string
}

// ─── Connected sibling table — linked to the same entity ─────────

export interface ConnectedSiblingTable {
  edgeId:     string
  tableId:    string
  tableLabel: string
}

export interface TableInspectorHook {
  node: TableNode | null

  // Direct connections (entity + DB)
  connectedEntity:        ConnectedEntity | null
  connectedDB:            ConnectedDBEntry | null
  handleDisconnectEntity: (edgeId: string) => Promise<void>
  handleDisconnectDB:     (edgeId: string) => Promise<void>

  // Indirect connections (via linked entity)
  connectedDTOs:         ConnectedDTO[]
  connectedTables:       ConnectedSiblingTable[]
  handleDeleteEdge:      (edgeId: string) => Promise<void>
  handleDisconnectTable: (edgeId: string) => Promise<void>

  // Identity
  handleLabelChange:     (value: string) => void
  handleTableNameChange: (value: string) => void

  // Custom queries UI state
  expandedQueryId:  string | null
  setExpandedQueryId: (id: string | null) => void

  // Custom query handlers
  handleAddQuery:                  () => void
  handleRemoveQuery:               (queryId: string) => void
  handleQueryMethodNameChange:     (queryId: string, value: string) => void
  handleQueryDescriptionChange:    (queryId: string, value: string) => void
  handleQueryTypeChange:           (queryId: string, value: QueryType | null) => void
  handleQueryStringChange:         (queryId: string, value: string) => void
  handleQueryTargetEntityChange:   (queryId: string, entityId: string | null) => void
  handleQueryNativeToggle:         (queryId: string) => void
  handleQueryModifyingToggle:      (queryId: string) => void
  handleAddQueryParam:             (queryId: string, name: string, type: JavaType | 'CUSTOM_TYPE_REF', arraySubType?: JavaType | 'CUSTOM_TYPE_REF' | null, enumValues?: string[] | null, customTypeId?: string | null, arrayCustomTypeId?: string | null) => void
  handleRemoveQueryParam:          (queryId: string, paramIdx: number) => void
  handleQueryParamSubTypeChange:   (queryId: string, paramIdx: number, subType: JavaType) => void
  handleQueryReturnTypeChange:     (queryId: string, partial: Partial<QueryReturnType>) => void
  handleQueryCacheToggle:          (queryId: string) => void
  handleQueryCacheFieldChange:     (queryId: string, field: keyof CacheConfig, value: unknown) => void
  handleQueryAIPromptChange:       (queryId: string, field: keyof AIPrompt, value: string | boolean) => void

  // AI Prompt
  handleAIPromptChange:   (field: keyof AIPrompt, value: string) => void
  handleAIGenerateToggle: () => void

  // Lifecycle
  handleClose:  () => void
  handleDelete: () => void
}

// Re-export for convenience
export type { CustomQuery, QueryType, QueryReturnType, CacheConfig }
