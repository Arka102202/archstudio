import type { ServiceNode, ServiceMethod, AIPrompt, JavaType } from '@entity'

export interface ServiceInspectorProps {
  nodeId: string
}

export interface ConnectedEntity {
  edgeId: string
  id:     string
  label:  string
}

export interface ConnectedController {
  edgeId: string
  id:     string
  label:  string
}

export interface ServiceInspectorHook {
  node: ServiceNode | null

  // Connection state
  connectedEntity:      ConnectedEntity | null
  connectedControllers: ConnectedController[]

  // Identity
  handleLabelChange: (value: string) => void

  // Connection
  handleDisconnectEntity:     () => void
  handleDisconnectController: (edgeId: string) => void

  // Config toggles (only when connected)
  handleTransactionalToggle:     () => void
  handleAsyncToggle:             () => void
  handleGenerateInterfaceToggle: () => void

  // Methods
  expandedMethodId:     string | null
  setExpandedMethodId:  (id: string | null) => void
  handleAddMethod:      () => void
  handleRemoveMethod:   (methodId: string) => void
  handleMethodNameChange: (methodId: string, value: string) => void

  // Return type
  handleReturnTypeChange:       (methodId: string, type: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null, entityTypeId: string | null, customTypeId?: string | null, arraySubType?: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null, arrayEntityTypeId?: string | null, arrayCustomTypeId?: string | null) => void
  handleReturnEntityChange:     (methodId: string, entityId: string | null) => void
  handleReturnPrimitiveChange:  (methodId: string, type: JavaType | null) => void
  handleReturnIsListToggle:     (methodId: string) => void
  handleReturnIsPageToggle:     (methodId: string) => void
  handleReturnIsOptionalToggle: (methodId: string) => void
  handleReturnIsVoidToggle:     (methodId: string) => void

  // Params
  handleAddParam:            (methodId: string, name: string, type: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF', entityTypeId: string | null, customTypeId?: string | null, arraySubType?: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null, arrayEntityTypeId?: string | null, arrayCustomTypeId?: string | null, enumValues?: string[] | null) => void
  handleRemoveParam:         (methodId: string, paramIdx: number) => void
  handleParamIsPageableToggle: (methodId: string, paramIdx: number) => void

  // Method flags
  handleMethodTransactionalToggle: (methodId: string) => void
  handleMethodAsyncToggle:         (methodId: string) => void

  // Errors
  handleAddError:                     (methodId: string, exceptionClass: string) => void
  handleRemoveError:                  (methodId: string, errorIdx: number) => void
  handleErrorDescriptionChange:       (methodId: string, errorIdx: number, value: string) => void
  handleErrorCreateExceptionToggle:   (methodId: string, errorIdx: number) => void

  // Per-method AI prompt
  handleMethodAIPromptChange:  (methodId: string, field: keyof AIPrompt, value: string) => void
  handleMethodAIGenerateToggle: (methodId: string) => void

  // Node-level AI prompt
  handleAIPromptChange:   (field: keyof AIPrompt, value: string) => void
  handleAIGenerateToggle: () => void

  // Lifecycle
  handleClose:  () => void
  handleDelete: () => void

  // Available nodes for dropdowns
  availableEntities:    { id: string; label: string }[]
  availableCustomTypes: { id: string; label: string }[]
}

// Re-export for component use
export type { ServiceMethod }
