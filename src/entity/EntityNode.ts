import type { BaseNode , NodeType} from './shared'
import { JavaType, LombokStyle } from './shared'

export enum FieldConstraint {
  PK     = 'PK',
  FK     = 'FK',
  UNIQUE = 'UNIQUE',
  NONE   = 'NONE',
}

export enum RelationType {
  ONE_TO_MANY  = 'ONE_TO_MANY',
  MANY_TO_ONE  = 'MANY_TO_ONE',
  MANY_TO_MANY = 'MANY_TO_MANY',
  ONE_TO_ONE   = 'ONE_TO_ONE',
}

export enum CascadeType {
  ALL     = 'ALL',
  PERSIST = 'PERSIST',
  MERGE   = 'MERGE',
  REMOVE  = 'REMOVE',
  NONE    = 'NONE',
}

export enum FetchType {
  LAZY  = 'LAZY',
  EAGER = 'EAGER',
}

export interface EnumValues {
  values:           string[]
  columnDefinition: string
}

export interface EntityField {
  id:                string
  name:              string
  // type is either a JavaType primitive, 'ENTITY_REF', or 'CUSTOM_TYPE_REF'
  type:              JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF'
  arraySubType:        JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null  // only used when type === JavaType.ARRAY
  arrayEntityTypeId:   string | null   // → EntityNode.id when arraySubType === 'ENTITY_REF'
  arrayCustomTypeId:   string | null   // → CustomTypeNode.id when arraySubType === 'CUSTOM_TYPE_REF'
  entityTypeId:      string | null     // → EntityNode.id when type === 'ENTITY_REF'
  customTypeId:      string | null     // → CustomTypeNode.id when type === 'CUSTOM_TYPE_REF'
  relation:          Relation | null   // reuses existing Relation — only when both entities have tables
  constraint:        FieldConstraint
  nullable:          boolean
  columnName:        string
  defaultValue:      string
  enumValues:        EnumValues | null
  entityTypeWarning: boolean           // true when referenced entity gained a table, needs JPA config
}

export interface Relation {
  id:             string
  type:           RelationType
  targetEntityId: string
  mappedBy:       string
  cascade:        CascadeType
  fetch:          FetchType
  optional:       boolean
}

export interface EntityConfig {
  softDelete:         boolean
  auditing:           boolean
  lombokStyle:        LombokStyle
  generateRepository: boolean
}

export interface EntityNode extends BaseNode {
  type:      NodeType.ENTITY
  msId:      string | null   // parent MicroserviceNode.id — drives RF parentId
  tableName: string
  fields:    EntityField[]
  relations: Relation[]
  config:    EntityConfig
}

// Re-export used enums to satisfy noUnusedLocals when consuming this module
export { JavaType, LombokStyle }
