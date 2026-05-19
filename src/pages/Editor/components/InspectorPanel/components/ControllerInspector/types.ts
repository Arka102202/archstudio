import type { ControllerNode, AIPrompt, HttpMethod, ErrorDefinition } from '@entity'

export interface ControllerInspectorProps {
  nodeId: string
}

export interface ConnectedService {
  edgeId: string
  id:     string
  label:  string
}

export interface ConnectedEndpoint {
  edgeId: string
  id:     string
  label:  string
  method: HttpMethod
  path:   string
}

export interface ControllerInspectorHook {
  node: ControllerNode | null

  // Connection state
  connectedService:   ConnectedService | null
  connectedEndpoints: ConnectedEndpoint[]

  // Auth rule (read-only — set via edge)
  authRuleName: string | null

  // Identity
  handleLabelChange:    (value: string) => void
  handleBasePathChange: (value: string) => void

  // Connection
  handleDisconnectService:  () => void
  handleDisconnectEndpoint: (edgeId: string) => void

  // Config
  handleCrossOriginToggle:    () => void
  handleApiVersionChange:     (value: string) => void
  handleRequestLoggingToggle: () => void

  // Error handling
  handleIncludeTimestampToggle:   () => void
  handleIncludeRequestPathToggle: () => void
  handleErrorsChange:             (updated: ErrorDefinition[]) => void

  // Swagger tags
  handleAddSwaggerTag:    (tag: string) => void
  handleRemoveSwaggerTag: (index: number) => void

  // AI Prompt
  handleAIPromptChange:   (field: keyof AIPrompt, value: string) => void
  handleAIGenerateToggle: () => void

  // Lifecycle
  handleClose:  () => void
  handleDelete: () => void
}
