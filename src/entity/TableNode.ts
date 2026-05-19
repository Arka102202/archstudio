import type { AIPrompt } from './AIPrompt'
import type { BaseNode, JavaType } from './shared'
import type { NodeType } from './shared'

export interface TableNode extends BaseNode {
  type:          NodeType.TABLE
  tableName:     string
  msId:          string | null   // parent MicroserviceNode.id — drives RF parentId
  entityId:      string | null   // set by STORED_IN edge
  dbNodeId:      string | null   // set by CONNECTS_TO edge
  customQueries: CustomQuery[]
}

export interface CustomQuery {
  id:             string
  methodName:     string
  description:    string

  targetEntityId: string | null
  type:           QueryType | null
  queryString:    string | null
  aiPrompt:       AIPrompt | null
  params:         DbQueryParam[]
  returnType:     QueryReturnType | null
  nativeQuery:    boolean
  modifying:      boolean
  cache:          CacheConfig | null
}

export enum QueryType {
  DERIVED    = 'DERIVED',
  JPQL       = 'JPQL',
  NATIVE_SQL = 'NATIVE_SQL',
  AI         = 'AI',
}

export interface DbQueryParam {
  name:              string
  type:              JavaType | 'CUSTOM_TYPE_REF'
  customTypeId:      string | null   // only when type === 'CUSTOM_TYPE_REF'
  arraySubType:      JavaType | 'CUSTOM_TYPE_REF' | null   // only when type === JavaType.ARRAY
  arrayCustomTypeId: string | null   // only when arraySubType === 'CUSTOM_TYPE_REF'
  isCollection:      boolean
  enumValues:        string[] | null  // only when type === JavaType.ENUM
}

export interface QueryReturnType {
  entityId:        string
  isList:          boolean
  isPage:          boolean
  isOptional:      boolean
  projectionClass: string
}

export interface CacheConfig {
  enabled:    boolean
  cacheName:  string
  ttlSeconds: number
  operation:  CacheOp
}

export enum CacheOp {
  CACHEABLE   = 'CACHEABLE',
  CACHE_EVICT = 'CACHE_EVICT',
  CACHE_PUT   = 'CACHE_PUT',
}
