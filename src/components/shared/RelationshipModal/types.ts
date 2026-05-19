import type { RelationType } from '@entity'

export interface RelationshipModalResult {
  relationType:        RelationType
  twoWayBinding:       boolean
  sourceFieldName:     string
  targetFieldName:     string
  inverseRelationType: RelationType
}
