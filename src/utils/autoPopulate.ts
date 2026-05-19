// ─── autoPopulate.ts ──────────────────────────────────────────────
// Auto-population utilities. Called after edge creation and node field changes.
// Each function is pure — takes current state, returns updated state.
// The caller is responsible for writing to IDB and updating RF state.

import type { Edge as RFEdge, Node as RFNode } from '@xyflow/react'
import type { DTONode, EntityNode, DBNode, TableNode, ServiceNode, EntityField, Relation } from '@entity'
import { DTOOrigin, DTOPurpose, EdgeType, FieldConstraint, JavaType, NodeType, RelationType, CascadeType, FetchType } from '@entity'
import { emptyAIPrompt } from '@entity/AIPrompt'
import type { CustomQuery } from '@entity/TableNode'
import type { NodeRow } from '@db'
import { db } from '@db'
import { generateId } from './id'
import { createTableNode } from './node'

export type UpdatedDTOMap = Record<string, DTONode>

// ─── applyDerivedFromEdge ─────────────────────────────────────────
// Applies the initial auto-population when a DERIVED_FROM edge is created.
// Merges non-PK entity fields into the DTO and sets origin/entitySources/purpose.
// Respects any field names already in excludeFields (user previously removed them).

export const applyDerivedFromEdge = (
  dtoNode:    DTONode,
  entityNode: EntityNode,
): DTONode => {
  // Resolve existing excludeFields for this entity (if the edge is being re-added)
  const existingSource = dtoNode.entitySources.find(s => s.entityId === entityNode.id)
  const excludeFields  = existingSource?.excludeFields ?? []

  // Step 1 — merge non-PK entity fields into DTO fields (skip duplicates + excluded)
  const existingNames = new Set(dtoNode.fields.map(f => f.name))

  const newFields = entityNode.fields
    .filter(ef => ef.constraint !== FieldConstraint.PK)
    .filter(ef => !existingNames.has(ef.name))
    .filter(ef => !excludeFields.includes(ef.name))
    .map(ef => ({
      id:                generateId(),
      name:              ef.name,
      type:              ef.type,
      arraySubType:      ef.arraySubType ?? null,
      arrayEntityTypeId: ef.arraySubType === 'ENTITY_REF'      ? (ef.arrayEntityTypeId ?? null) : null,
      arrayCustomTypeId: ef.arraySubType === 'CUSTOM_TYPE_REF' ? (ef.arrayCustomTypeId ?? null) : null,
      entityTypeId:      ef.type === 'ENTITY_REF'              ? ef.entityTypeId                 : null,
      customTypeId:      ef.type === 'CUSTOM_TYPE_REF'         ? (ef.customTypeId ?? null)       : null,
      entityTypeInvalid: false,
      sourceEntityId:    entityNode.id,
      enumValues:        ef.type === JavaType.ENUM
        ? (ef.enumValues?.values ?? [])
        : null,
      validations:       [],
      serialization:     {
        jsonProperty:   '',
        jsonIgnore:     false,
        includeNonNull: false,
      },
    }))

  const mergedFields = [...dtoNode.fields, ...newFields]

  // Step 2 — append entitySource if not already present
  const alreadySourced = dtoNode.entitySources.some(s => s.entityId === entityNode.id)
  const updatedSources = alreadySourced
    ? dtoNode.entitySources
    : [
        ...dtoNode.entitySources,
        { entityId: entityNode.id, includeFields: [], excludeFields: [] },
      ]

  // Step 3 — set purpose if first entity connection
  const purpose: DTOPurpose =
    updatedSources.length === 1 ? DTOPurpose.RESPONSE : dtoNode.purpose
  if (purpose !== dtoNode.purpose) {
    console.log(`[PURPOSE] autoPopulate DERIVED_FROM: ${dtoNode.purpose} → ${purpose}`, { dtoId: dtoNode.id })
  }

  // Rule: only become DERIVED if the DTO has no user-created fields.
  // If the user already added custom fields (sourceEntityId === null) before connecting,
  // keep CUSTOM so their manual work isn't silently overridden.
  const hasCustomFields = dtoNode.fields.some(f => f.sourceEntityId === null)
  const newOrigin       = hasCustomFields ? DTOOrigin.CUSTOM : DTOOrigin.DERIVED

  return {
    ...dtoNode,
    fields:        mergedFields,
    origin:        newOrigin,
    entitySources: updatedSources,
    purpose,
  }
}

// ─── syncEntityFieldsToDTOs ───────────────────────────────────────
// Called after every field mutation on an EntityNode.
// Finds all DTOs connected via DERIVED_FROM edges and propagates changes.
// Canonical edge direction in RF: source = dtoId, target = entityId.
//
// Rules:
//  - Only fields with sourceEntityId === entityId are touched
//  - Fields whose name is in excludeFields are never re-added
//  - Custom fields (sourceEntityId === null) are never removed or modified
// Returns only the DTOs that actually changed.

export const syncEntityFieldsToDTOs = (
  entityId:      string,
  updatedEntity: EntityNode,
  allRFEdges:    RFEdge[],
  allRFNodes:    RFNode[],
): UpdatedDTOMap => {
  // Find all DERIVED_FROM edges whose target is this entity (DTO→Entity canonical direction)
  const connectedEdges = allRFEdges.filter(e =>
    e.target === entityId &&
    (e.data as { type?: string } | undefined)?.type === EdgeType.DERIVED_FROM
  )

  const result: UpdatedDTOMap = {}

  for (const edge of connectedEdges) {
    const dtoRFNode = allRFNodes.find(n => n.id === edge.source)
    if (!dtoRFNode) continue

    const dtoNode = dtoRFNode.data as unknown as DTONode

    const entityNonPkFields = updatedEntity.fields.filter(
      ef => ef.constraint !== FieldConstraint.PK,
    )
    const entityFieldNames = new Set(entityNonPkFields.map(ef => ef.name))

    // excludeFields for this entity source — user-removed field names
    const source        = dtoNode.entitySources.find(s => s.entityId === entityId)
    const excludeFields = source?.excludeFields ?? []

    let changed       = false
    let updatedFields = [...dtoNode.fields]

    // REMOVED: only remove fields that came FROM this entity and no longer exist in it
    // Fields from other sources (sourceEntityId !== entityId) or custom fields (null) are untouched
    {
      const beforeLength = updatedFields.length
      updatedFields = updatedFields.filter(df =>
        df.sourceEntityId !== entityId || entityFieldNames.has(df.name),
      )
      if (updatedFields.length !== beforeLength) changed = true
    }

    // ADDED: entity non-PK fields not yet in dto by name, skipping excluded names
    const dtoFieldNames = new Set(updatedFields.map(df => df.name))
    const toAdd = entityNonPkFields.filter(
      ef => !dtoFieldNames.has(ef.name) && !excludeFields.includes(ef.name),
    )
    if (toAdd.length > 0) {
      updatedFields = [
        ...updatedFields,
        ...toAdd.map(ef => ({
          id:                generateId(),
          name:              ef.name,
          type:              ef.type,
          arraySubType:      ef.arraySubType ?? null,
          arrayEntityTypeId: ef.arraySubType === 'ENTITY_REF'      ? (ef.arrayEntityTypeId ?? null) : null,
          arrayCustomTypeId: ef.arraySubType === 'CUSTOM_TYPE_REF' ? (ef.arrayCustomTypeId ?? null) : null,
          entityTypeId:      ef.type === 'ENTITY_REF'              ? ef.entityTypeId                 : null,
          customTypeId:      ef.type === 'CUSTOM_TYPE_REF'         ? (ef.customTypeId ?? null)       : null,
          entityTypeInvalid: false,
          sourceEntityId:    entityId,
          enumValues:        ef.type === JavaType.ENUM
            ? (ef.enumValues?.values ?? [])
            : null,
          validations:       [],
          serialization:     {
            jsonProperty:   '',
            jsonIgnore:     false,
            includeNonNull: false,
          },
        })),
      ]
      changed = true
    }

    // TYPE CHANGED: only update fields that came from this entity
    updatedFields = updatedFields.map(df => {
      if (df.sourceEntityId !== entityId) return df
      const matchingEntityField = entityNonPkFields.find(ef => ef.name === df.name)
      if (!matchingEntityField) return df
      const typeChanged           = matchingEntityField.type              !== df.type
      const subTypeChanged        = matchingEntityField.arraySubType      !== df.arraySubType
      const subEntityIdChanged    = matchingEntityField.arrayEntityTypeId !== df.arrayEntityTypeId
      const subCustomTypeChanged  = matchingEntityField.arrayCustomTypeId !== df.arrayCustomTypeId
      if (!typeChanged && !subTypeChanged && !subEntityIdChanged && !subCustomTypeChanged) return df
      changed = true
      return {
        ...df,
        type:              matchingEntityField.type,
        entityTypeId:      matchingEntityField.type === 'ENTITY_REF'      ? matchingEntityField.entityTypeId                 : null,
        customTypeId:      matchingEntityField.type === 'CUSTOM_TYPE_REF' ? (matchingEntityField.customTypeId ?? null)       : null,
        arraySubType:      matchingEntityField.arraySubType ?? null,
        arrayEntityTypeId: matchingEntityField.arraySubType === 'ENTITY_REF'      ? (matchingEntityField.arrayEntityTypeId ?? null) : null,
        arrayCustomTypeId: matchingEntityField.arraySubType === 'CUSTOM_TYPE_REF' ? (matchingEntityField.arrayCustomTypeId ?? null) : null,
      }
    })

    if (!changed) continue

    result[dtoNode.id] = {
      ...dtoNode,
      fields: updatedFields,
    }
  }

  return result
}

// ─── applyStoredInEdge ────────────────────────────────────────────
// Called when an Entity → TableNode (STORED_IN) edge is created.
// Sets entityId on the table and auto-sets tableName if still default.

export const applyStoredInEdge = (
  entity: EntityNode,
  table:  TableNode,
): TableNode => ({
  ...table,
  entityId:  entity.id,
  tableName: table.tableName === 'table_name' ? entity.tableName : table.tableName,
})

// ─── applyConnectsToEdge ──────────────────────────────────────────
// Called when a TableNode → DBNode (CONNECTS_TO) edge is created.
// Sets dbNodeId on the table and auto-sets label if still default.

export const applyConnectsToEdge = (
  table: TableNode,
  db:    DBNode,
): TableNode => ({
  ...table,
  dbNodeId: db.id,
  label:    table.label === 'Table' ? db.label + ' Table' : table.label,
})

// ─── migrateDbNodesToTableNodes ───────────────────────────────────
// One-time migration: splits old DBNode rows that have a customQueries
// array into a lean DBNode + a new TableNode carrying those queries.
// This is idempotent — on the second load, no DBNode has customQueries.

export async function migrateDbNodesToTableNodes(
  nodeRows:  NodeRow[],
  projectId: string,
): Promise<void> {
  for (const row of nodeRows) {
    if (row.type !== 'DB') continue

    const old = JSON.parse(row.data) as DBNode & { customQueries?: CustomQuery[] }
    if (!old.customQueries?.length) continue

    // Create a TableNode carrying the old queries
    const tableNode = createTableNode({
      label:         old.label + ' Table',
      tableName:     old.dbName.replace(/_db$/, ''),
      msId:          (old as DBNode & { msId?: string | null }).msId ?? null,
      dbNodeId:      old.id,
      customQueries: old.customQueries,
    })

    await db.nodes.add({
      id:        tableNode.id,
      projectId,
      type:      'TABLE',
      label:     tableNode.label,
      position:  tableNode.position,
      size:      tableNode.size,
      data:      JSON.stringify(tableNode),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    // Strip customQueries from the DBNode row
    const cleanedDb: DBNode = {
      id:       old.id,
      type:     NodeType.DB,
      msId:     (old as DBNode & { msId?: string | null }).msId ?? null,
      label:    old.label,
      dbName:   old.dbName,
      dbType:   old.dbType,
      host:     old.host,
      port:     old.port,
      schema:   old.schema,
      username: old.username,
      password: old.password,
      position: old.position,
      size:     old.size,
      aiPrompt: old.aiPrompt,
      config:   old.config,
    }

    await db.nodes.update(old.id, {
      data:      JSON.stringify(cleanedDb),
      updatedAt: Date.now(),
    })
  }
}

// ─── applyUsesEdge ────────────────────────────────────────────────
// Called when a Service → Entity (USES) edge is created.
// Generates 5 standard CRUD methods from the entity.
// Always regenerates from scratch — treats the service as fresh.
// Returns the updated ServiceNode. Caller writes to IDB and RF state.

export function applyUsesEdge(
  service: ServiceNode,
  entity:  EntityNode,
): ServiceNode {
  const entityId    = entity.id
  const entityLabel = entity.label

  const methods = [
    {
      id:            generateId(),
      name:          'findAll',
      returnType:    { type: 'ENTITY_REF' as const, entityTypeId: entityId, arraySubType: null, arrayEntityTypeId: null, isList: true,  isPage: false, isOptional: false, isVoid: false },
      params:        [],
      transactional: false,
      async:         false,
      aiPrompt:      emptyAIPrompt(),
      throwsErrors:  [],
    },
    {
      id:            generateId(),
      name:          'findById',
      returnType:    { type: 'ENTITY_REF' as const, entityTypeId: entityId, arraySubType: null, arrayEntityTypeId: null, isList: false, isPage: false, isOptional: true,  isVoid: false },
      params:        [{ name: 'id', type: JavaType.UUID, entityTypeId: null, arraySubType: null, arrayEntityTypeId: null, isPageable: false, enumValues: null }],
      transactional: false,
      async:         false,
      aiPrompt:      emptyAIPrompt(),
      throwsErrors:  [],
    },
    {
      id:            generateId(),
      name:          'create',
      returnType:    { type: 'ENTITY_REF' as const, entityTypeId: entityId, arraySubType: null, arrayEntityTypeId: null, isList: false, isPage: false, isOptional: false, isVoid: false },
      params:        [{ name: entityLabel.toLowerCase(), type: 'ENTITY_REF' as const, entityTypeId: entityId, arraySubType: null, arrayEntityTypeId: null, isPageable: false, enumValues: null }],
      transactional: true,
      async:         false,
      aiPrompt:      emptyAIPrompt(),
      throwsErrors:  [],
    },
    {
      id:            generateId(),
      name:          'update',
      returnType:    { type: 'ENTITY_REF' as const, entityTypeId: entityId, arraySubType: null, arrayEntityTypeId: null, isList: false, isPage: false, isOptional: false, isVoid: false },
      params:        [
        { name: 'id',                      type: JavaType.UUID,           entityTypeId: null,     arraySubType: null, arrayEntityTypeId: null, isPageable: false, enumValues: null },
        { name: entityLabel.toLowerCase(), type: 'ENTITY_REF' as const,  entityTypeId: entityId, arraySubType: null, arrayEntityTypeId: null, isPageable: false, enumValues: null },
      ],
      transactional: true,
      async:         false,
      aiPrompt:      emptyAIPrompt(),
      throwsErrors:  [],
    },
    {
      id:            generateId(),
      name:          'delete',
      returnType:    { type: null, entityTypeId: null, arraySubType: null, arrayEntityTypeId: null, isList: false, isPage: false, isOptional: false, isVoid: true },
      params:        [{ name: 'id', type: JavaType.UUID, entityTypeId: null, arraySubType: null, arrayEntityTypeId: null, isPageable: false, enumValues: null }],
      transactional: true,
      async:         false,
      aiPrompt:      emptyAIPrompt(),
      throwsErrors:  [],
    },
  ]

  return { ...service, methods }
}

// ─── resetServiceNode ─────────────────────────────────────────────
// Called when the USES edge is deleted.
// Resets the ServiceNode to factory defaults — methods, dependencyIds,
// config and aiPrompt are all cleared.
// Returns the reset ServiceNode. Caller writes to IDB and RF state.

export function resetServiceNode(service: ServiceNode): ServiceNode {
  return {
    ...service,
    methods:       [],
    dependencyIds: [],
    config: {
      classLevelTransactional: true,
      classLevelAsync:         false,
      generateInterface:       true,
    },
    aiPrompt: emptyAIPrompt(),
  }
}

// ─── syncEntityTypeFields ─────────────────────────────────────────
// Called when a STORED_IN edge is created or deleted.
// Finds all EntityNode and DTONode fields that reference the affected entity
// and updates their type warnings / edge types accordingly.
// Returns updatedNodes and edge changes — caller writes to IDB and RF state.

export interface EdgeChange {
  action:      'add' | 'remove'
  edgeId:      string
  edgeType?:   EdgeType
  fromNodeId?: string
  toNodeId?:   string
}

export interface SyncResult {
  updatedNodes: Map<string, EntityNode | DTONode>
  updatedEdges: EdgeChange[]
}

export function syncEntityTypeFields(
  affectedEntityId:  string,
  entityNowHasTable: boolean,
  allRFNodes:        RFNode[],
  allRFEdges:        RFEdge[],
): SyncResult {
  const updatedNodes = new Map<string, EntityNode | DTONode>()
  const updatedEdges: EdgeChange[] = []

  for (const rfNode of allRFNodes) {
    const nodeData = rfNode.data as unknown as EntityNode | DTONode
    if (!nodeData || !nodeData.type) continue

    if (nodeData.type === NodeType.ENTITY) {
      const entity = nodeData as EntityNode
      let changed  = false
      const fields = entity.fields.map(f => {
        if (f.type !== 'ENTITY_REF' || f.entityTypeId !== affectedEntityId) return f
        changed = true

        if (entityNowHasTable) {
          // Does this parent entity also have a table?
          const parentHasTable = allRFEdges.some(e => {
            const d = e.data as { type?: string } | undefined
            return d?.type === EdgeType.STORED_IN && e.source === rfNode.id
          })

          if (parentHasTable) {
            // Find existing EMBEDS edge from this entity to the affected entity
            const existingEdge = allRFEdges.find(e => {
              const d = e.data as { type?: string } | undefined
              return (d?.type === EdgeType.EMBEDS) &&
                     e.source === rfNode.id &&
                     e.target === affectedEntityId
            })
            if (existingEdge) {
              // Remove the EMBEDS edge, add a RELATES_TO edge
              updatedEdges.push({ action: 'remove', edgeId: existingEdge.id })
              updatedEdges.push({
                action:     'add',
                edgeId:     generateId(),
                edgeType:   EdgeType.RELATES_TO,
                fromNodeId: rfNode.id,
                toNodeId:   affectedEntityId,
              })
            }
            // Mark the field as needing JPA config
            return { ...f, entityTypeWarning: true }
          }
          // Parent has no table — edge stays EMBEDS, no warning
          return f
        } else {
          // Entity lost its table — downgrade RELATES_TO → EMBEDS
          const existingEdge = allRFEdges.find(e => {
            const d = e.data as { type?: string } | undefined
            return d?.type === EdgeType.RELATES_TO &&
                   e.source === rfNode.id &&
                   e.target === affectedEntityId
          })
          if (existingEdge) {
            updatedEdges.push({ action: 'remove', edgeId: existingEdge.id })
            updatedEdges.push({
              action:     'add',
              edgeId:     generateId(),
              edgeType:   EdgeType.EMBEDS,
              fromNodeId: rfNode.id,
              toNodeId:   affectedEntityId,
            })
          }
          // Clear relation and warning
          return { ...f, relation: null, entityTypeWarning: false }
        }
      })

      if (changed) {
        updatedNodes.set(rfNode.id, { ...entity, fields })
      }
    }

    if (nodeData.type === NodeType.DTO) {
      const dto     = nodeData as DTONode
      let changed   = false
      const fields  = dto.fields.map(f => {
        if (f.type !== 'ENTITY_REF' || f.entityTypeId !== affectedEntityId) return f
        changed = true
        if (entityNowHasTable) {
          return { ...f, entityTypeInvalid: true }
        } else {
          return { ...f, entityTypeInvalid: false }
        }
      })

      if (changed) {
        updatedNodes.set(rfNode.id, { ...dto, fields })
      }
    }
  }

  return { updatedNodes, updatedEdges }
}

// ─── isCollectionRelation ─────────────────────────────────────────
// Returns true when the relation type implies the field is a collection.
// ONE_TO_MANY and MANY_TO_MANY → ARRAY<EntityRef>
// ONE_TO_ONE and MANY_TO_ONE   → single EntityRef

export function isCollectionRelation(kind: RelationType): boolean {
  return kind === RelationType.ONE_TO_MANY || kind === RelationType.MANY_TO_MANY
}

// ─── complementaryRelationType ────────────────────────────────────
// Returns the inverse relation type for two-way binding.

export function complementaryRelationType(kind: RelationType): RelationType {
  switch (kind) {
    case RelationType.ONE_TO_MANY:  return RelationType.MANY_TO_ONE
    case RelationType.MANY_TO_ONE:  return RelationType.ONE_TO_MANY
    case RelationType.ONE_TO_ONE:   return RelationType.ONE_TO_ONE
    case RelationType.MANY_TO_MANY: return RelationType.MANY_TO_MANY
  }
}

// ─── applyRelationship ────────────────────────────────────────────
// Called when the RelationshipModal is confirmed.
// Handles both CANVAS_EDGE (add new field) and FIELD_TYPE (update existing field).
// Manages EMBEDS/RELATES_TO edge creation and optional two-way binding.

export interface ApplyRelationshipParams {
  trigger:             'CANVAS_EDGE' | 'FIELD_TYPE'
  entityAId:           string
  entityBId:           string
  fieldId:             string | null
  relationType:        RelationType
  twoWayBinding:       boolean
  sourceFieldName:     string   // field name added to entityA
  targetFieldName:     string   // field name added to entityB (two-way only)
  inverseRelationType: RelationType
  activeProjectId:     string
  sourceHandle:        string | null  // original drag handle (CANVAS_EDGE only)
  targetHandle:        string | null  // original drag handle (CANVAS_EDGE only)
  allNodes:            RFNode[]
  rfEdges:             RFEdge[]
  setNodes:            (updater: (nodes: RFNode[]) => RFNode[]) => void
  setEdges:            (updater: (edges: RFEdge[]) => RFEdge[]) => void
}

export async function applyRelationship(params: ApplyRelationshipParams): Promise<void> {
  const {
    trigger, entityAId, entityBId, fieldId, relationType, twoWayBinding,
    sourceFieldName, targetFieldName, inverseRelationType,
    activeProjectId, sourceHandle, targetHandle, allNodes, rfEdges, setNodes, setEdges,
  } = params

  // 1. Resolve entity nodes
  const entityARFNode = allNodes.find(n => n.id === entityAId)
  const entityBRFNode = allNodes.find(n => n.id === entityBId)
  if (!entityARFNode || !entityBRFNode) return

  const entityA = entityARFNode.data as unknown as EntityNode
  const entityB = entityBRFNode.data as unknown as EntityNode

  // 2. Determine edge type
  const entityAHasTable = rfEdges.some(e => {
    const d = e.data as { type?: string } | undefined
    return d?.type === EdgeType.STORED_IN && e.source === entityAId
  })
  const entityBHasTable = rfEdges.some(e => {
    const d = e.data as { type?: string } | undefined
    return d?.type === EdgeType.STORED_IN && e.source === entityBId
  })
  const edgeType   = (entityAHasTable && entityBHasTable) ? EdgeType.RELATES_TO : EdgeType.EMBEDS
  const rfEdgeType = edgeType === EdgeType.EMBEDS ? 'embeds' as const : 'relatesTo' as const

  // 3a. Upsert field on EntityA
  let updatedEntityA: EntityNode

  if (trigger === 'CANVAS_EDGE') {
    // Add a new field to EntityA representing the relationship
    const newRelation: Relation = {
      id:             generateId(),
      type:           relationType,
      targetEntityId: entityBId,
      mappedBy:       '',
      cascade:        CascadeType.NONE,
      fetch:          FetchType.LAZY,
      optional:       true,
    }
    const isCollection = isCollectionRelation(relationType)
    const newField: EntityField = {
      id:                generateId(),
      name:              sourceFieldName,
      type:              isCollection ? JavaType.ARRAY : 'ENTITY_REF',
      entityTypeId:      isCollection ? null : entityBId,
      customTypeId:      null,
      arraySubType:      isCollection ? 'ENTITY_REF' : null,
      arrayEntityTypeId: isCollection ? entityBId : null,
      arrayCustomTypeId: null,
      relation:          newRelation,
      constraint:        FieldConstraint.NONE,
      nullable:          true,
      columnName:        '',
      defaultValue:      '',
      enumValues:        null,
      entityTypeWarning: edgeType === EdgeType.RELATES_TO,
    }
    updatedEntityA = { ...entityA, fields: [...entityA.fields, newField] }
  } else {
    // FIELD_TYPE: find existing field, set its relation + update type shape
    if (!fieldId) return
    const isCollection = isCollectionRelation(relationType)
    const fields = entityA.fields.map(f => {
      if (f.id !== fieldId) return f
      const relation: Relation = {
        id:             generateId(),
        type:           relationType,
        targetEntityId: entityBId,
        mappedBy:       '',
        cascade:        CascadeType.NONE,
        fetch:          FetchType.LAZY,
        optional:       true,
      }
      return {
        ...f,
        type:              isCollection ? JavaType.ARRAY : 'ENTITY_REF' as const,
        entityTypeId:      isCollection ? null : entityBId,
        arraySubType:      isCollection ? 'ENTITY_REF' as const : null,
        arrayEntityTypeId: isCollection ? entityBId : null,
        relation,
        entityTypeWarning: edgeType === EdgeType.RELATES_TO,
      }
    })
    updatedEntityA = { ...entityA, fields }
  }

  // Write EntityA to RF state + IDB
  setNodes(nodes => nodes.map(n =>
    n.id === entityAId ? { ...n, data: updatedEntityA as unknown as Record<string, unknown> } : n,
  ))
  await db.nodes.update(entityAId, { data: JSON.stringify(updatedEntityA), updatedAt: Date.now() })

  // 3b. Two-way binding — add complementary field to EntityB
  let updatedEntityB: EntityNode | null = null
  if (twoWayBinding) {
    const compRelation: Relation = {
      id:             generateId(),
      type:           inverseRelationType,
      targetEntityId: entityAId,
      mappedBy:       '',
      cascade:        CascadeType.NONE,
      fetch:          FetchType.LAZY,
      optional:       true,
    }
    const compIsCollection = isCollectionRelation(inverseRelationType)
    const compField: EntityField = {
      id:                generateId(),
      name:              targetFieldName,
      type:              compIsCollection ? JavaType.ARRAY : 'ENTITY_REF',
      entityTypeId:      compIsCollection ? null : entityAId,
      customTypeId:      null,
      arraySubType:      compIsCollection ? 'ENTITY_REF' : null,
      arrayEntityTypeId: compIsCollection ? entityAId : null,
      arrayCustomTypeId: null,
      relation:          compRelation,
      constraint:        FieldConstraint.NONE,
      nullable:          true,
      columnName:        '',
      defaultValue:      '',
      enumValues:        null,
      entityTypeWarning: edgeType === EdgeType.RELATES_TO,
    }
    updatedEntityB = { ...entityB, fields: [...entityB.fields, compField] }
    setNodes(nodes => nodes.map(n =>
      n.id === entityBId ? { ...n, data: updatedEntityB as unknown as Record<string, unknown> } : n,
    ))
    await db.nodes.update(entityBId, { data: JSON.stringify(updatedEntityB), updatedAt: Date.now() })
  }

  // 4. Always create a new EMBEDS/RELATES_TO edge — multiple edges between
  //    the same entity pair are allowed (each represents a distinct field/relation)
  {
    const newEdgeId  = generateId()
    const fromHandle = sourceHandle ?? ''
    const toHandle   = targetHandle ?? ''
    const newEdgeRow = {
      id:         newEdgeId,
      projectId:  activeProjectId,
      fromNodeId: entityAId,
      toNodeId:   entityBId,
      type:       edgeType,
      label:      edgeType,
      fromHandle,
      toHandle,
    }
    await db.edges.add(newEdgeRow)
    setEdges(edges => [
      ...edges,
      {
        id:           newEdgeId,
        source:       entityAId,
        target:       entityBId,
        sourceHandle: fromHandle || undefined,
        targetHandle: toHandle   || undefined,
        type:         rfEdgeType,
        data:         newEdgeRow as unknown as Record<string, unknown>,
        markerEnd: {
          type:   'arrowclosed' as const,
          color:  rfEdgeType === 'embeds' ? 'var(--node-entity-accent)' : 'var(--color-warning)',
          width:  12,
          height: 12,
        },
      },
    ])
  }

  // 5. Cross-tab sync
  const bc = new BroadcastChannel('archflow-sync')
  bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
  bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
  bc.close()
}

// ─── syncCustomTypeEdges ──────────────────────────────────────────
// After any field mutation on an Entity or DTO node, call this to ensure
// USES_CUSTOM_TYPE edges are exactly in sync with the fields.
// Creates missing edges for custom type references and removes stale ones.
// This is the single authoritative sync function — call it after every
// handleAddField, handleRemoveField, and handleFieldTypeChange.

export function syncCustomTypeEdges(
  ownerNodeId:   string,
  updatedFields: Array<{ type: string; customTypeId: string | null; arraySubType?: string | null; arrayCustomTypeId?: string | null }>,
  currentEdges:  RFEdge[],
  setEdges:      (updater: (edges: RFEdge[]) => RFEdge[]) => void,
  projectId:     string,
): void {
  // 1. Collect all custom type IDs still referenced in fields
  const neededIds = new Set<string>()
  for (const field of updatedFields) {
    if (field.type === 'CUSTOM_TYPE_REF' && field.customTypeId) {
      neededIds.add(field.customTypeId)
    }
    if (field.arraySubType === 'CUSTOM_TYPE_REF' && field.arrayCustomTypeId) {
      neededIds.add(field.arrayCustomTypeId)
    }
  }

  // 2. Find all existing USES_CUSTOM_TYPE edges from this node
  const existing = currentEdges.filter(e => {
    const d = e.data as { type?: string } | undefined
    return d?.type === EdgeType.USES_CUSTOM_TYPE && e.source === ownerNodeId
  })

  // 3. Remove edges that are no longer needed
  for (const edge of existing) {
    if (!neededIds.has(edge.target)) {
      void db.edges.delete(edge.id)
      setEdges(edges => edges.filter(e => e.id !== edge.id))
    }
  }

  // 4. Add edges for custom types not yet connected
  const existingTargets = new Set(existing.map(e => e.target))
  for (const customTypeId of neededIds) {
    if (!existingTargets.has(customTypeId)) {
      const newEdgeId  = generateId()
      const newEdgeRow = {
        id:         newEdgeId,
        projectId,
        fromNodeId: ownerNodeId,
        toNodeId:   customTypeId,
        type:       EdgeType.USES_CUSTOM_TYPE,
        label:      EdgeType.USES_CUSTOM_TYPE,
        fromHandle: '',
        toHandle:   '',
      }
      void db.edges.add(newEdgeRow)
      setEdges(edges => [
        ...edges,
        {
          id:     newEdgeId,
          source: ownerNodeId,
          target: customTypeId,
          type:   'usesCustomType' as const,
          data:   newEdgeRow as unknown as Record<string, unknown>,
        },
      ])
    }
  }
}
