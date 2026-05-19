import type { AIPrompt } from './AIPrompt'

// ─── Node types ───────────────────────────────────────────────────

export enum NodeType {
  MICROSERVICE = 'MICROSERVICE',
  ENTITY       = 'ENTITY',
  DTO          = 'DTO',
  DB           = 'DB',
  TABLE        = 'TABLE',
  AUTH_GUARD   = 'AUTH_GUARD',
  CONTROLLER   = 'CONTROLLER',
  SERVICE      = 'SERVICE',
  API_ENDPOINT = 'API_ENDPOINT',
  CUSTOM_TYPE  = 'CUSTOM_TYPE',  // value object — no table, stored as JSON blob
}

// ─── Edge types ───────────────────────────────────────────────────

export enum EdgeType {
  ROUTES_TO    = 'ROUTES_TO',
  SECURED_BY   = 'SECURED_BY',
  LOADS_FROM   = 'LOADS_FROM',
  INVOKES      = 'INVOKES',
  USES         = 'USES',
  STORED_IN    = 'STORED_IN',    // Entity → TableNode
  CONNECTS_TO  = 'CONNECTS_TO',  // TableNode → DBNode
  DERIVED_FROM = 'DERIVED_FROM',
  ACCEPTS      = 'ACCEPTS',
  RETURNS      = 'RETURNS',
  DEPENDS_ON       = 'DEPENDS_ON',
  EMBEDS           = 'EMBEDS',            // Entity → Entity (no-table composition)
  RELATES_TO       = 'RELATES_TO',        // Entity → Entity (both have tables, JPA relation)
  USES_TYPE        = 'USES_TYPE',         // DTO → Entity (entity has no table)
  USES_CUSTOM_TYPE = 'USES_CUSTOM_TYPE',  // Entity or DTO → CustomTypeNode (always dashed)
}

// ─── Java types ───────────────────────────────────────────────────

export enum JavaType {
  UUID      = 'UUID',
  STRING    = 'STRING',
  INTEGER   = 'INTEGER',
  LONG      = 'LONG',
  DOUBLE    = 'DOUBLE',
  DECIMAL   = 'DECIMAL',
  BOOLEAN   = 'BOOLEAN',
  DATETIME  = 'DATETIME',
  DATE      = 'DATE',
  LOCALDATE = 'LOCALDATE',
  ENUM      = 'ENUM',
  TEXT      = 'TEXT',
  BLOB      = 'BLOB',
  ARRAY     = 'ARRAY',     // List<T> — requires arraySubType to identify T
  MAP       = 'MAP',       // Map<K,V> — requires mapKeyType + mapValueType
  JSON_NODE = 'JSON_NODE', // com.fasterxml.jackson.databind.JsonNode — arbitrary JSON
}

// ─── HTTP methods ─────────────────────────────────────────────────

export enum HttpMethod {
  GET    = 'GET',
  POST   = 'POST',
  PUT    = 'PUT',
  DELETE = 'DELETE',
  PATCH  = 'PATCH',
}

// ─── Lombok styles ────────────────────────────────────────────────

export enum LombokStyle {
  DATA    = 'DATA',
  BUILDER = 'BUILDER',
  BOTH    = 'BOTH',
  NONE    = 'NONE',
}

// ─── Shared shapes ────────────────────────────────────────────────

export interface Position {
  x: number
  y: number
}

export interface Size {
  w: number
  h: number
}

// ─── Error handling ───────────────────────────────────────────────
// Shared by ControllerNode (via ErrorHandlerConfig) and APIEndpointNode
// (via EndpointErrorHandling). Single canonical source.

export interface ErrorResponseField {
  key:   string
  value: string
}

export interface ErrorDefinition {
  id:               string
  description:      string   // plain English — "User not found"
  httpStatus:       number   // e.g. 404, 400, 500
  message:          string   // client-facing response message
  includeTimestamp: boolean  // include timestamp in this error's response
  fields:           ErrorResponseField[]
}

// ─── BaseNode ─────────────────────────────────────────────────────

export interface BaseNode {
  id:       string
  type:     NodeType
  label:    string
  position: Position
  size:     Size
  aiPrompt: AIPrompt
}
