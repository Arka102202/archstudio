import type { BaseNode } from './shared'
import { NodeType }      from './shared'
import type { JavaType } from './shared'
import type { EnumValues } from './EntityNode'

// ─── CustomTypeNode ───────────────────────────────────────────────
// A value object with no database table.
// Stored as a JSON column wherever it is referenced.
// Cannot connect to a TableNode — has no @Entity annotation.

export interface CustomTypeNode extends BaseNode {
  type:   NodeType.CUSTOM_TYPE
  msId:   string | null   // parent MicroserviceNode.id — drives RF parentId
  fields: CustomTypeField[]
}

export interface CustomTypeField {
  id:                string
  name:              string
  // Same type union as EntityField and DTOField
  type:              JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF'
  arraySubType:      JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null  // only when type === ARRAY
  arrayEntityTypeId: string | null    // → EntityNode.id when arraySubType === 'ENTITY_REF'
  arrayCustomTypeId: string | null    // → CustomTypeNode.id when arraySubType === 'CUSTOM_TYPE_REF'
  entityTypeId:      string | null    // → EntityNode.id when type === 'ENTITY_REF'
  customTypeId:      string | null    // → CustomTypeNode.id when type === 'CUSTOM_TYPE_REF'
  nullable:          boolean
  defaultValue:      string
  enumValues:        EnumValues | null  // only when type === JavaType.ENUM
}
