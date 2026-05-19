import type { BaseNode , NodeType} from './shared'
import { JavaType, LombokStyle } from './shared'

export enum DTOPurpose {
  REQUEST  = 'REQUEST',
  RESPONSE = 'RESPONSE',
  BOTH     = 'BOTH',
}

export enum DTOOrigin {
  DERIVED = 'DERIVED',
  CUSTOM  = 'CUSTOM',
}

export enum ValidationType {
  NOT_NULL  = 'NOT_NULL',
  NOT_BLANK = 'NOT_BLANK',
  NOT_EMPTY = 'NOT_EMPTY',
  MIN       = 'MIN',
  MAX       = 'MAX',
  SIZE      = 'SIZE',
  EMAIL     = 'EMAIL',
  PATTERN   = 'PATTERN',
  POSITIVE  = 'POSITIVE',
  FUTURE    = 'FUTURE',
  PAST      = 'PAST',
}

export interface EntitySource {
  entityId:      string
  includeFields: string[]
  excludeFields: string[]
}

export interface Validation {
  type:    ValidationType
  value:   string
  message: string
}

export interface Serialization {
  jsonProperty:   string
  jsonIgnore:     boolean
  includeNonNull: boolean
}

export interface DTOField {
  id:                string
  name:              string
  // type is either a JavaType primitive, 'ENTITY_REF', or 'CUSTOM_TYPE_REF'
  // ENTITY_REF: only allowed when entity has NO table connection
  // CUSTOM_TYPE_REF: always allowed — CustomTypeNode never has a table
  type:              JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF'
  arraySubType:      JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null   // only used when type === JavaType.ARRAY
  arrayEntityTypeId: string | null     // → EntityNode.id when arraySubType === 'ENTITY_REF'
  arrayCustomTypeId: string | null     // → CustomTypeNode.id when arraySubType === 'CUSTOM_TYPE_REF'
  mapKeyType:           JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null  // only used when type === JavaType.MAP
  mapKeyEntityTypeId:   string | null
  mapKeyCustomTypeId:   string | null
  mapValueType:         JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null  // only used when type === JavaType.MAP
  mapValueEntityTypeId: string | null
  mapValueCustomTypeId: string | null
  entityTypeId:      string | null     // → EntityNode.id when type === 'ENTITY_REF'
  customTypeId:      string | null     // → CustomTypeNode.id when type === 'CUSTOM_TYPE_REF'
  // Runtime flag — set when a referenced entity gains a table connection (becomes DB-mapped).
  // Shown as error state in inspector — user must resolve this.
  entityTypeInvalid: boolean
  sourceEntityId:    string | null     // which EntityNode this field was copied from; null = user-added
  enumValues:        string[] | null   // allowed values when type === ENUM — drives @JsonCreator / code gen
  validations:       Validation[]
  serialization:     Serialization
}

export interface DTOConfig {
  lombokStyle:       LombokStyle
  validationEnabled: boolean
}

export interface DTONode extends BaseNode {
  type:          NodeType.DTO
  msId:          string | null   // parent MicroserviceNode.id — drives RF parentId
  purpose:       DTOPurpose
  origin:        DTOOrigin
  entitySources: EntitySource[]
  fields:        DTOField[]
  config:        DTOConfig
}

export { JavaType, LombokStyle }
