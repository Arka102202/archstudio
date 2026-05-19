import type { BaseNode, ErrorDefinition } from './shared'
import { NodeType } from './shared'

export interface ErrorHandlerConfig {
  errors:             ErrorDefinition[]
  includeTimestamp:   boolean
  includeRequestPath: boolean
}

export interface ControllerConfig {
  crossOrigin:    boolean
  apiVersion:     string | null
  requestLogging: boolean
}

export interface ControllerNode extends BaseNode {
  type:               NodeType.CONTROLLER
  msId:               string | null   // parent MicroserviceNode.id — drives RF parentId
  basePath:           string
  authRuleId:         string | null
  errorHandlerConfig: ErrorHandlerConfig
  config:             ControllerConfig
  swaggerTags:        string[]
}
