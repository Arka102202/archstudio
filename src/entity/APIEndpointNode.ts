import type { BaseNode, ErrorDefinition } from './shared'
import { NodeType, JavaType, HttpMethod } from './shared'

export interface PathVariable {
  name: string
  type: JavaType
}

export interface QueryParam {
  name:         string
  type:         JavaType
  defaultValue: string
  required:     boolean
}

export interface EndpointRequest {
  pathVars:    PathVariable[]
  queryParams: QueryParam[]
  bodyDTOId:   string | null
}

export interface EndpointResponse {
  successCode: number
  returnDTOId: string | null
  isList:      boolean
  isPage:      boolean
}

export interface EndpointErrorHandling {
  inheritFromController: boolean
  errors:                ErrorDefinition[]
}

export interface EndpointConfig {
  paginated:   boolean
  deprecated:  boolean
  description: string
}

export interface APIEndpointNode extends BaseNode {
  type:          NodeType.API_ENDPOINT
  msId:          string | null   // parent MicroserviceNode id — null = free-floating
  method:        HttpMethod
  path:          string
  authRuleId:    string | null
  request:       EndpointRequest
  response:      EndpointResponse
  errorHandling: EndpointErrorHandling
  config:        EndpointConfig
}

export { JavaType, HttpMethod }
