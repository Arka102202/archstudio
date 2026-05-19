import type { BaseNode } from './shared'
import { NodeType, JavaType } from './shared'
import type { AIPrompt } from './AIPrompt'

export interface ErrorContract {
  exceptionClass:  string
  description:     string
  createException: boolean
}

export interface MethodReturnType {
  type:              JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null
  entityTypeId:      string | null   // → EntityNode.id when type === 'ENTITY_REF'
  customTypeId:      string | null   // → CustomTypeNode.id when type === 'CUSTOM_TYPE_REF'
  arraySubType:      JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null
  arrayEntityTypeId: string | null   // → EntityNode.id when arraySubType === 'ENTITY_REF'
  arrayCustomTypeId: string | null   // → CustomTypeNode.id when arraySubType === 'CUSTOM_TYPE_REF'
  isList:            boolean
  isPage:            boolean
  isOptional:        boolean
  isVoid:            boolean
}

export interface MethodParam {
  name:              string
  type:              JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF'   // the param type
  entityTypeId:      string | null   // → EntityNode.id when type === 'ENTITY_REF'
  customTypeId:      string | null   // → CustomTypeNode.id when type === 'CUSTOM_TYPE_REF'
  arraySubType:      JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null  // only when type === ARRAY
  arrayEntityTypeId: string | null   // → EntityNode.id when arraySubType === 'ENTITY_REF'
  arrayCustomTypeId: string | null   // → CustomTypeNode.id when arraySubType === 'CUSTOM_TYPE_REF'
  isPageable:        boolean         // true = Pageable param for paginated queries
  enumValues:        string[] | null // only when type === JavaType.ENUM
}

export interface ServiceMethod {
  id:            string
  name:          string
  returnType:    MethodReturnType
  params:        MethodParam[]
  transactional: boolean
  async:         boolean
  aiPrompt:      AIPrompt
  throwsErrors:  ErrorContract[]
}

export interface ServiceConfig {
  classLevelTransactional: boolean
  classLevelAsync:         boolean
  generateInterface:       boolean
}

export interface ServiceNode extends BaseNode {
  type:          NodeType.SERVICE
  msId:          string | null   // parent MicroserviceNode.id — drives RF parentId
  methods:       ServiceMethod[]
  dependencyIds: string[]
  config:        ServiceConfig
}

export { JavaType }
