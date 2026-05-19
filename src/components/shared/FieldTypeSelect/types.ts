import type { JavaType } from '@entity'

export interface EntityOption {
  id:       string
  label:    string
  hasTable: boolean   // true if STORED_IN edge exists for this entity
  disabled: boolean   // true for DTO mode when entity has a table
}

export interface CustomTypeOption {
  id:    string
  label: string
  // CustomTypeNode is always valid for both entity and DTO fields — never disabled
}

export interface FieldTypeSelectProps {
  value:              JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null
  entityTypeId:       string | null
  customTypeId?:      string | null
  entityOptions:      EntityOption[]
  customTypeOptions?: CustomTypeOption[]
  onChange:           (value: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF', entityId: string | null, customTypeId: string | null) => void
  // Java types to hide from the list (e.g. exclude ARRAY for array subtype selectors)
  excludeTypes?:      JavaType[]
  // When true, the Entity Types optgroup is hidden entirely
  excludeEntityRef?:  boolean
}
