import type { APIEndpointNode, HttpMethod, DTONode, ErrorDefinition } from '@entity'

export interface APIEndpointInspectorProps {
  nodeId: string
}

export interface ConnectedController {
  edgeId: string
  id:     string
  label:  string
}

export interface ConnectedDTO {
  edgeId: string
  id:     string
  label:  string
}

export interface AvailableNode {
  id:    string
  label: string
  type:  string
}

export interface APIEndpointInspectorHook {
  node:                     APIEndpointNode | null
  connectedController:      ConnectedController | null
  connectedRequestDTO:      ConnectedDTO | null
  connectedResponseDTO:     ConnectedDTO | null
  availableRequestDTOs:     DTONode[]
  availableResponseDTOs:    DTONode[]
  availableControllerNodes: AvailableNode[]
  queryParamsExpanded:      boolean
  setQueryParamsExpanded:   (v: boolean) => void

  // Auth rule (read-only — derived from edges)
  authRuleName:   string | null
  authRuleEffect: string | null

  // Label + HTTP
  handleLabelChange:       (value: string) => void
  handleMethodChange:      (value: HttpMethod) => void
  handlePathChange:        (value: string) => void
  handleDescriptionChange: (value: string) => void

  // Request
  handleBodyDTOChange:    (dtoId: string | null) => void
  handleAddPathVar:       (name: string) => void
  handleRemovePathVar:    (index: number) => void
  handleAddQueryParam:    (name: string, type: string, defaultValue: string, required: boolean) => void
  handleRemoveQueryParam: (index: number) => void

  // Response
  handleReturnDTOChange:   (dtoId: string | null) => void
  handleSuccessCodeChange: (value: number) => void
  handlePaginatedToggle:   () => void
  handleDeprecatedToggle:  () => void

  // Error handling
  handleInheritFromControllerToggle: () => void
  handleErrorsChange:                (updated: ErrorDefinition[]) => void

  // Connections
  handleDisconnectController:  () => void
  handleDisconnectRequestDTO:  () => void
  handleDisconnectResponseDTO: () => void
  handleQuickConnect:          (targetNodeId: string) => void

  // Lifecycle
  handleClose:  () => void
  handleDelete: () => void
}
