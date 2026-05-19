import { useCallback, useMemo, useEffect, useRef } from 'react'
import { useNodes, useEdges, useReactFlow } from '@xyflow/react'
import { useCanvasStore, useRelationshipModalStore } from '@store'
import { useProjectStore } from '@store'
import { useUpdateNode, useDeleteNode } from '@service'
import { useDebounce } from '@hooks'
import { NodeType, EdgeType, JavaType, FieldConstraint, DTOOrigin, RelationType, CascadeType, FetchType } from '@entity'
import { generateId, syncEntityFieldsToDTOs, resetServiceNode, syncEntityTypeFields, syncCustomTypeEdges } from '@utils'
import { useFieldTypeSelect } from '@components/shared'
import { db } from '@db'
import { MarkerType } from '@xyflow/react'
import type { EntityNode, DTONode, ServiceNode, AIPrompt, LombokStyle, EntityField, Relation } from '@entity'
import type { ConnectedTable, ConnectedService } from './types'
import type { EntityNodeData } from '@components/nodes/EntityNode'
import type { DTONodeData } from '@components/nodes/DTONode'
import type { EntityInspectorProps, EntityInspectorHook } from './types'

// ─── Auto-format tableName ────────────────────────────────────────
// "OrderItem" → "order_item", "Orders" stays "orders"

const toSnakeCase = (value: string): string =>
  value
    .replace(/([A-Z])/g, '_$1')
    .replace(/\s+/g, '_')
    .replace(/^_/, '')
    .toLowerCase()

// ─── Hook ─────────────────────────────────────────────────────────

export const useEntityInspector = (
  { nodeId }: EntityInspectorProps,
): EntityInspectorHook => {
  const clearSelection        = useCanvasStore(s => s.clearSelection)
  const activeProjectId       = useProjectStore(s => s.activeProjectId)
  const openRelationshipModal = useRelationshipModalStore(s => s.open)
  const rfNodes         = useNodes()
  const allEdges        = useEdges()
  const { setNodes, setEdges, getNodes, getEdges } = useReactFlow()

  const { mutate: updateNode } = useUpdateNode()
  const { mutate: deleteNode } = useDeleteNode()

  // Derive current node from RF state — no query round-trip
  const rfNode = rfNodes.find(n => n.id === nodeId)
  const node   = (rfNode?.data as unknown as EntityNode | undefined) ?? null

  // ─── Core update helper ─────────────────────────────────────────

  const writeToIDB = useCallback((updated: EntityNode): void => {
    if (!activeProjectId) return
    updateNode({
      id:        updated.id,
      projectId: activeProjectId,
      type:      NodeType.ENTITY,
      label:     updated.label,
      position:  updated.position,
      size:      updated.size,
      data:      JSON.stringify(updated),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }, [activeProjectId, updateNode])

  // DTO IDB write — direct db call since DTO updates don't go through entity mutation
  const writeDTOToIDB = useCallback((updated: DTONode): void => {
    if (!activeProjectId) return
    void db.nodes.update(updated.id, {
      data:      JSON.stringify(updated),
      updatedAt: Date.now(),
    })
  }, [activeProjectId])

  const debouncedWrite     = useDebounce(writeToIDB, 300)
  const debouncedWriteSlow = useDebounce(writeToIDB, 500)
  const debouncedWriteDTO  = useDebounce(writeDTOToIDB, 300)

  const applyUpdate = useCallback((
    updater:  (prev: EntityNode) => EntityNode,
    debounce: 'fast' | 'slow' = 'fast',
  ): void => {
    if (!node) return
    const updated = updater(node)

    setNodes(nodes => nodes.map(n =>
      n.id === nodeId ? { ...n, data: updated as unknown as EntityNodeData } : n,
    ))

    if (debounce === 'slow') debouncedWriteSlow(updated)
    else debouncedWrite(updated)
  }, [node, nodeId, setNodes, debouncedWrite, debouncedWriteSlow])

  // ─── Sync updated entity fields to connected DTOs ────────────────
  // Called after every field mutation on this entity.

  const syncDTOs = useCallback((updatedEntity: EntityNode): void => {
    if (!activeProjectId) return
    const dtoUpdates = syncEntityFieldsToDTOs(nodeId, updatedEntity, allEdges, rfNodes)
    Object.entries(dtoUpdates).forEach(([dtoId, updatedDto]) => {
      setNodes(nodes => nodes.map(n =>
        n.id === dtoId ? { ...n, data: updatedDto as unknown as DTONodeData } : n,
      ))
      debouncedWriteDTO(updatedDto)
      // Sync USES_CUSTOM_TYPE edges for this DTO — a field may have been added or removed
      syncCustomTypeEdges(dtoId, updatedDto.fields, allEdges, setEdges, activeProjectId)
    })
  }, [nodeId, activeProjectId, allEdges, rfNodes, setNodes, setEdges, debouncedWriteDTO])

  // ─── Identity ───────────────────────────────────────────────────

  const handleLabelChange = useCallback((value: string): void => {
    applyUpdate(n => ({ ...n, label: value }))
  }, [applyUpdate])

  const handleTableNameChange = useCallback((value: string): void => {
    applyUpdate(n => ({ ...n, tableName: toSnakeCase(value) }))
  }, [applyUpdate])

  // ─── Config toggles ─────────────────────────────────────────────

  const handleAuditingToggle = useCallback((): void => {
    applyUpdate(n => ({ ...n, config: { ...n.config, auditing: !n.config.auditing } }))
  }, [applyUpdate])

  const handleSoftDeleteToggle = useCallback((): void => {
    applyUpdate(n => ({ ...n, config: { ...n.config, softDelete: !n.config.softDelete } }))
  }, [applyUpdate])

  const handleGenerateRepositoryToggle = useCallback((): void => {
    applyUpdate(n => ({ ...n, config: { ...n.config, generateRepository: !n.config.generateRepository } }))
  }, [applyUpdate])

  const handleLombokStyleChange = useCallback((value: LombokStyle): void => {
    applyUpdate(n => ({ ...n, config: { ...n.config, lombokStyle: value } }))
  }, [applyUpdate])

  // ─── Fields (with DTO sync after each mutation) ──────────────────

  // ─── EMBEDS/RELATES_TO edge cleanup helper ───────────────────────
  // Removes orphaned EMBEDS/RELATES_TO edges — any where no field still references the target entity.
  // Also removes orphaned USES_CUSTOM_TYPE edges.
  const cleanupEntityRefEdges = useCallback(async (
    fields: EntityNode['fields'],
  ): Promise<void> => {
    if (!activeProjectId) return
    const referencedEntityIds = new Set<string>()
    const referencedCustomTypeIds = new Set<string>()
    for (const f of fields) {
      if (f.type === 'ENTITY_REF' && f.entityTypeId)                          referencedEntityIds.add(f.entityTypeId)
      if (f.arraySubType === 'ENTITY_REF' && f.arrayEntityTypeId)             referencedEntityIds.add(f.arrayEntityTypeId)
      if (f.type === 'CUSTOM_TYPE_REF' && f.customTypeId)                     referencedCustomTypeIds.add(f.customTypeId)
      if (f.arraySubType === 'CUSTOM_TYPE_REF' && f.arrayCustomTypeId)        referencedCustomTypeIds.add(f.arrayCustomTypeId)
    }
    const orphans = allEdges.filter(e => {
      const d = e.data as { type?: string } | undefined
      if ((d?.type === EdgeType.EMBEDS || d?.type === EdgeType.RELATES_TO) &&
           e.source === nodeId && !referencedEntityIds.has(e.target)) return true
      if (d?.type === EdgeType.USES_CUSTOM_TYPE &&
           e.source === nodeId && !referencedCustomTypeIds.has(e.target)) return true
      return false
    })
    for (const edge of orphans) {
      await db.edges.delete(edge.id)
      setEdges(edges => edges.filter(e => e.id !== edge.id))
    }
  }, [activeProjectId, nodeId, allEdges, setEdges])

  const handleAddField = useCallback(async (
    name:            string,
    type:            JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF',
    entityId:        string | null,
    constraint:      FieldConstraint,
    subType?:        JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null,
    subEntityId?:    string | null,
    customTypeId?:   string | null,
    subCustomTypeId?: string | null,
  ): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed || !node || !activeProjectId) return
    if (node.fields.some(f => f.name === trimmed)) return

    const newField: EntityField = {
      id:                generateId(),
      name:              trimmed,
      type:              type,
      arraySubType:      subType ?? null,
      arrayEntityTypeId: subType === 'ENTITY_REF'      ? (subEntityId    ?? null) : null,
      arrayCustomTypeId: subType === 'CUSTOM_TYPE_REF' ? (subCustomTypeId ?? null) : null,
      entityTypeId:      type === 'ENTITY_REF'         ? entityId                  : null,
      customTypeId:      type === 'CUSTOM_TYPE_REF'    ? (customTypeId   ?? null)  : null,
      relation:          null,
      constraint,
      nullable:          constraint !== FieldConstraint.PK,
      columnName:        trimmed,
      defaultValue:      '',
      enumValues:        type === JavaType.ENUM
        ? { values: [], columnDefinition: 'VARCHAR(20)' }
        : null,
      entityTypeWarning: false,
    }

    const updatedNode: EntityNode = { ...node, fields: [...node.fields, newField] }
    setNodes(nodes => nodes.map(n =>
      n.id === nodeId ? { ...n, data: updatedNode as unknown as EntityNodeData } : n,
    ))
    debouncedWrite(updatedNode)
    syncDTOs(updatedNode)

    // Create EMBEDS/RELATES_TO edges for entity refs, dedup-checked
    const entityIdsForEdge: string[] = []
    if (type === 'ENTITY_REF' && entityId)       entityIdsForEdge.push(entityId)
    if (subType === 'ENTITY_REF' && subEntityId) entityIdsForEdge.push(subEntityId)

    for (const refId of [...new Set(entityIdsForEdge)]) {
      const alreadyLinked = allEdges.some(e => {
        const d = e.data as { type?: string } | undefined
        return (d?.type === EdgeType.EMBEDS || d?.type === EdgeType.RELATES_TO) &&
               e.source === nodeId && e.target === refId
      })
      if (alreadyLinked) continue
      const targetHasTable = allEdges.some(e => {
        const d = e.data as { type?: string } | undefined
        return d?.type === EdgeType.STORED_IN && e.source === refId
      })
      const parentHasTable = allEdges.some(e => {
        const d = e.data as { type?: string } | undefined
        return d?.type === EdgeType.STORED_IN && e.source === nodeId
      })
      const edgeType   = (targetHasTable && parentHasTable) ? EdgeType.RELATES_TO : EdgeType.EMBEDS
      const rfEdgeType = edgeType === EdgeType.EMBEDS ? 'embeds' as const : 'relatesTo' as const
      const newEdgeId  = generateId()
      const newEdgeRow = {
        id: newEdgeId, projectId: activeProjectId,
        fromNodeId: nodeId, toNodeId: refId,
        type: edgeType, label: edgeType,
        fromHandle: '', toHandle: '',
      }
      await db.edges.add(newEdgeRow)
      setEdges(edges => [
        ...edges,
        {
          id: newEdgeId, source: nodeId, target: refId,
          type: rfEdgeType,
          data: newEdgeRow as unknown as Record<string, unknown>,
          markerEnd: {
            type:   MarkerType.ArrowClosed,
            color:  rfEdgeType === 'embeds' ? 'var(--node-entity-accent)' : 'var(--color-warning)',
            width:  12, height: 12,
          },
        },
      ])
    }

    // Create USES_CUSTOM_TYPE edge for top-level or array-subtype CUSTOM_TYPE_REF, dedup-checked
    const ctEdgeTargets: string[] = []
    if (type === 'CUSTOM_TYPE_REF' && customTypeId)                 ctEdgeTargets.push(customTypeId)
    if (subType === 'CUSTOM_TYPE_REF' && subCustomTypeId)           ctEdgeTargets.push(subCustomTypeId)

    for (const ctId of [...new Set(ctEdgeTargets)]) {
      const alreadyLinked = allEdges.some(e => {
        const d = e.data as { type?: string } | undefined
        return d?.type === EdgeType.USES_CUSTOM_TYPE && e.source === nodeId && e.target === ctId
      })
      if (!alreadyLinked) {
        const newEdgeId  = generateId()
        const newEdgeRow = {
          id: newEdgeId, projectId: activeProjectId,
          fromNodeId: nodeId, toNodeId: ctId,
          type: EdgeType.USES_CUSTOM_TYPE, label: EdgeType.USES_CUSTOM_TYPE,
          fromHandle: '', toHandle: '',
        }
        await db.edges.add(newEdgeRow)
        setEdges(edges => [
          ...edges,
          {
            id: newEdgeId, source: nodeId, target: ctId,
            type: 'usesCustomType' as const,
            data: newEdgeRow as unknown as Record<string, unknown>,
          },
        ])
      }
    }
  }, [node, nodeId, activeProjectId, allEdges, setNodes, setEdges, debouncedWrite, syncDTOs])

  const handleRemoveField = useCallback(async (fieldId: string): Promise<void> => {
    if (!node) return
    const field = node.fields.find(f => f.id === fieldId)
    if (!field) return

    const remainingFields = node.fields.filter(f => f.id !== fieldId)
    const updatedNode: EntityNode = { ...node, fields: remainingFields }
    setNodes(nodes => nodes.map(n =>
      n.id === nodeId ? { ...n, data: updatedNode as unknown as EntityNodeData } : n,
    ))
    debouncedWrite(updatedNode)
    syncDTOs(updatedNode)
    await cleanupEntityRefEdges(remainingFields)
  }, [node, nodeId, setNodes, debouncedWrite, syncDTOs, cleanupEntityRefEdges])

  const handleFieldTypeChange = useCallback(async (
    fieldId:          string,
    newType:          JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF',
    newEntityTypeId:  string | null,
    newCustomTypeId:  string | null,
  ): Promise<void> => {
    if (!node || !activeProjectId) return
    const field = node.fields.find(f => f.id === fieldId)
    if (!field) return

    const updatedField: EntityField = {
      ...field,
      type:              newType,
      entityTypeId:      newType === 'ENTITY_REF'      ? newEntityTypeId : null,
      customTypeId:      newType === 'CUSTOM_TYPE_REF' ? newCustomTypeId : null,
      arraySubType:      newType === JavaType.ARRAY ? (field.arraySubType      ?? null) : null,
      arrayEntityTypeId: newType === JavaType.ARRAY ? (field.arrayEntityTypeId ?? null) : null,
      arrayCustomTypeId: newType === JavaType.ARRAY ? (field.arrayCustomTypeId ?? null) : null,
      enumValues:        newType === JavaType.ENUM
        ? (field.enumValues ?? { values: [], columnDefinition: 'VARCHAR(20)' })
        : null,
      relation:          null,
      entityTypeWarning: false,
    }

    const updatedFields = node.fields.map(f => f.id === fieldId ? updatedField : f)
    const updatedNode: EntityNode = { ...node, fields: updatedFields }
    setNodes(nodes => nodes.map(n =>
      n.id === nodeId ? { ...n, data: updatedNode as unknown as EntityNodeData } : n,
    ))
    debouncedWrite(updatedNode)
    syncDTOs(updatedNode)
    await cleanupEntityRefEdges(updatedFields)

    // Create USES_CUSTOM_TYPE edge when type changed to CUSTOM_TYPE_REF
    if (newType === 'CUSTOM_TYPE_REF' && newCustomTypeId) {
      const alreadyExists = allEdges.some(e => {
        const d = e.data as { type?: string } | undefined
        return d?.type === EdgeType.USES_CUSTOM_TYPE && e.source === nodeId && e.target === newCustomTypeId
      })
      if (!alreadyExists) {
        const newEdgeId  = generateId()
        const newEdgeRow = {
          id: newEdgeId, projectId: activeProjectId,
          fromNodeId: nodeId, toNodeId: newCustomTypeId,
          type: EdgeType.USES_CUSTOM_TYPE, label: EdgeType.USES_CUSTOM_TYPE,
          fromHandle: '', toHandle: '',
        }
        await db.edges.add(newEdgeRow)
        setEdges(edges => [
          ...edges,
          {
            id: newEdgeId, source: nodeId, target: newCustomTypeId,
            type: 'usesCustomType' as const,
            data: newEdgeRow as unknown as Record<string, unknown>,
          },
        ])
      }
    }

    // Open the RelationshipModal when selecting another entity as field type
    if (newType === 'ENTITY_REF' && newEntityTypeId) {
      openRelationshipModal({
        trigger:      'FIELD_TYPE',
        entityAId:    nodeId,
        entityBId:    newEntityTypeId,
        fieldId:      fieldId,
        sourceHandle: null,
        targetHandle: null,
      })
    }
  }, [node, nodeId, activeProjectId, allEdges, setEdges, setNodes, debouncedWrite, syncDTOs, cleanupEntityRefEdges, openRelationshipModal])

  const handleFieldArraySubTypeChange = useCallback(async (
    fieldId:      string,
    subType:      JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null,
    entityId:     string | null,
    customTypeId: string | null,
  ): Promise<void> => {
    if (!node || !activeProjectId) return
    const field = node.fields.find(f => f.id === fieldId)
    if (!field) return

    const updatedField: EntityField = {
      ...field,
      arraySubType:      subType,
      arrayEntityTypeId: subType === 'ENTITY_REF'      ? entityId     : null,
      arrayCustomTypeId: subType === 'CUSTOM_TYPE_REF' ? customTypeId : null,
    }

    // Create EMBEDS/RELATES_TO edge if new subType is ENTITY_REF and not already linked
    if (subType === 'ENTITY_REF' && entityId) {
      const edgeExists = allEdges.some(e => {
        const d = e.data as { type?: string } | undefined
        return (d?.type === EdgeType.EMBEDS || d?.type === EdgeType.RELATES_TO) &&
               e.source === nodeId && e.target === entityId
      })
      if (!edgeExists) {
        const targetHasTable = allEdges.some(e => {
          const d = e.data as { type?: string } | undefined
          return d?.type === EdgeType.STORED_IN && e.source === entityId
        })
        const parentHasTable = allEdges.some(e => {
          const d = e.data as { type?: string } | undefined
          return d?.type === EdgeType.STORED_IN && e.source === nodeId
        })
        const edgeType   = (targetHasTable && parentHasTable) ? EdgeType.RELATES_TO : EdgeType.EMBEDS
        const rfEdgeType = edgeType === EdgeType.EMBEDS ? 'embeds' as const : 'relatesTo' as const
        const newEdgeId  = generateId()
        const newEdgeRow = {
          id: newEdgeId, projectId: activeProjectId,
          fromNodeId: nodeId, toNodeId: entityId,
          type: edgeType, label: edgeType,
          fromHandle: '', toHandle: '',
        }
        await db.edges.add(newEdgeRow)
        setEdges(edges => [
          ...edges,
          {
            id: newEdgeId, source: nodeId, target: entityId, type: rfEdgeType,
            data: newEdgeRow as unknown as Record<string, unknown>,
            markerEnd: { type: MarkerType.ArrowClosed, color: rfEdgeType === 'embeds' ? 'var(--node-entity-accent)' : 'var(--color-warning)', width: 12, height: 12 },
          },
        ])
      }
    }

    // Create USES_CUSTOM_TYPE edge if new subType is CUSTOM_TYPE_REF and not already linked
    if (subType === 'CUSTOM_TYPE_REF' && customTypeId) {
      const edgeExists = allEdges.some(e => {
        const d = e.data as { type?: string } | undefined
        return d?.type === EdgeType.USES_CUSTOM_TYPE && e.source === nodeId && e.target === customTypeId
      })
      if (!edgeExists) {
        const newEdgeId  = generateId()
        const newEdgeRow = {
          id: newEdgeId, projectId: activeProjectId,
          fromNodeId: nodeId, toNodeId: customTypeId,
          type: EdgeType.USES_CUSTOM_TYPE, label: EdgeType.USES_CUSTOM_TYPE,
          fromHandle: '', toHandle: '',
        }
        await db.edges.add(newEdgeRow)
        setEdges(edges => [
          ...edges,
          {
            id: newEdgeId, source: nodeId, target: customTypeId,
            type: 'usesCustomType' as const,
            data: newEdgeRow as unknown as Record<string, unknown>,
          },
        ])
      }
    }

    const updatedFields = node.fields.map(f => f.id === fieldId ? updatedField : f)
    const updatedNode: EntityNode = { ...node, fields: updatedFields }
    setNodes(nodes => nodes.map(n =>
      n.id === nodeId ? { ...n, data: updatedNode as unknown as EntityNodeData } : n,
    ))
    debouncedWrite(updatedNode)
    syncDTOs(updatedNode)
    await cleanupEntityRefEdges(updatedFields)
  }, [node, nodeId, activeProjectId, allEdges, setEdges, setNodes, debouncedWrite, syncDTOs, cleanupEntityRefEdges])

  const handleFieldRelationshipChange = useCallback((fieldId: string, patch: Partial<Relation>): void => {
    if (!node) return
    const field = node.fields.find(f => f.id === fieldId)
    if (!field) return

    const initRelation: Relation = {
      id:             generateId(),
      type:           RelationType.ONE_TO_MANY,
      targetEntityId: field.entityTypeId ?? '',
      mappedBy:       '',
      cascade:        CascadeType.NONE,
      fetch:          FetchType.LAZY,
      optional:       true,
    }

    applyUpdate(n => ({
      ...n,
      fields: n.fields.map(f => {
        if (f.id !== fieldId) return f
        return {
          ...f,
          relation:          { ...(f.relation ?? initRelation), ...patch },
          entityTypeWarning: false,
        }
      }),
    }))
  }, [node, applyUpdate])

  // ─── Enum values (no DTO sync needed — enums don't affect DTO fields) ──

  const handleAddEnumValue = useCallback((fieldId: string, value: string): void => {
    const trimmed = value.trim()
    if (!trimmed) return
    applyUpdate(n => ({
      ...n,
      fields: n.fields.map(f => {
        if (f.id !== fieldId || !f.enumValues) return f
        if (f.enumValues.values.includes(trimmed)) return f
        return {
          ...f,
          enumValues: {
            ...f.enumValues,
            values: [...f.enumValues.values, trimmed],
          },
        }
      }),
    }))
  }, [applyUpdate])

  const handleRemoveEnumValue = useCallback((fieldId: string, index: number): void => {
    applyUpdate(n => ({
      ...n,
      fields: n.fields.map(f => {
        if (f.id !== fieldId || !f.enumValues) return f
        return {
          ...f,
          enumValues: {
            ...f.enumValues,
            values: f.enumValues.values.filter((_, i) => i !== index),
          },
        }
      }),
    }))
  }, [applyUpdate])

  // ─── AI Prompt ──────────────────────────────────────────────────

  const handleAIPromptChange = useCallback(
    (field: keyof AIPrompt, value: string | boolean): void => {
      applyUpdate(
        n => ({ ...n, aiPrompt: { ...n.aiPrompt, [field]: value } }),
        'slow',
      )
    },
    [applyUpdate],
  )

  const handleAIGenerateToggle = useCallback((): void => {
    applyUpdate(n => ({
      ...n,
      aiPrompt: { ...n.aiPrompt, aiGenerate: !n.aiPrompt.aiGenerate },
    }))
  }, [applyUpdate])

  // ─── Entity + custom type options for FieldTypeSelect ───────────
  const { entityOptions, customTypeOptions } = useFieldTypeSelect(nodeId, 'entity')

  // ─── Reconcile USES_CUSTOM_TYPE edges on inspector open ──────────
  // Fields that had CUSTOM_TYPE_REF set before the auto-edge fix was deployed
  // have no edge in IDB. On every nodeId change (inspector opens for a node),
  // create any missing USES_CUSTOM_TYPE edges for existing CUSTOM_TYPE_REF fields.
  // getNodes/getEdges are imperative — always current at call time, no stale closure.
  const activeProjectIdRef = useRef(activeProjectId)
  activeProjectIdRef.current = activeProjectId

  useEffect(() => {
    const projectId = activeProjectIdRef.current
    if (!projectId) return

    const currentNode = getNodes().find(n => n.id === nodeId)?.data as unknown as EntityNode | undefined
    if (!currentNode) return

    const customTypeIds = [
      ...new Set(
        currentNode.fields
          .filter(f => f.type === 'CUSTOM_TYPE_REF' && f.customTypeId)
          .map(f => f.customTypeId as string),
      ),
    ]
    if (customTypeIds.length === 0) return

    const currentEdges = getEdges()

    void (async () => {
      for (const ctId of customTypeIds) {
        const alreadyExists = currentEdges.some(e => {
          const d = e.data as { type?: string } | undefined
          return d?.type === EdgeType.USES_CUSTOM_TYPE && e.source === nodeId && e.target === ctId
        })
        if (alreadyExists) continue

        const newEdgeId  = generateId()
        const newEdgeRow = {
          id: newEdgeId, projectId,
          fromNodeId: nodeId, toNodeId: ctId,
          type: EdgeType.USES_CUSTOM_TYPE, label: EdgeType.USES_CUSTOM_TYPE,
          fromHandle: '', toHandle: '',
        }
        try {
          await db.edges.add(newEdgeRow)
        } catch {
          continue   // already in IDB — skip
        }
        setEdges(edges => [
          ...edges,
          {
            id: newEdgeId, source: nodeId, target: ctId,
            type: 'usesCustomType' as const,
            data: newEdgeRow as unknown as Record<string, unknown>,
          },
        ])
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId])   // intentionally only nodeId — getNodes/getEdges are always current

  // ─── Connections — edge data for the CONNECTIONS section ─────────
  // Canonical edge direction: source = dtoId, target = entityId
  // So edges where target === nodeId are the DERIVED_FROM edges for this entity.

  const connectedDTOs = allEdges
    .filter(e => e.target === nodeId)
    .map(e => {
      const dtoRFNode = rfNodes.find(n => n.id === e.source)
      if (!dtoRFNode) return null
      const dtoData = dtoRFNode.data as { label?: string; purpose?: string }
      return {
        edgeId:     e.id,
        dtoId:      e.source,
        dtoLabel:   dtoData.label ?? 'DTO',
        dtoPurpose: dtoData.purpose ?? '',
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  // ─── STORED_IN edges — connected Tables ──────────────────────────
  // Canonical direction: source = EntityNode.id, target = TableNode.id
  // Only include edges whose target is a table-type node (not legacy DB)

  const connectedTables: ConnectedTable[] = allEdges
    .filter(e => {
      const edgeData  = e.data as { type?: string } | undefined
      const targetNode = rfNodes.find(n => n.id === e.target)
      return edgeData?.type === EdgeType.STORED_IN && e.source === nodeId && targetNode?.type === 'table'
    })
    .map(e => {
      const tableRFNode = rfNodes.find(n => n.id === e.target)
      const tableData   = tableRFNode?.data as { tableName?: string; label?: string } | undefined
      return {
        edgeId:     e.id,
        tableId:    e.target,
        tableLabel: tableData?.tableName ?? tableData?.label ?? 'Table',
      }
    })

  const handleDisconnectTable = useCallback(async (edgeId: string): Promise<void> => {
    const edge = allEdges.find(e => e.id === edgeId)
    await db.edges.delete(edgeId)
    setEdges(edges => edges.filter(e => e.id !== edgeId))

    // Set table.entityId = null
    if (edge) {
      const tableRFNode = rfNodes.find(n => n.id === edge.target)
      if (tableRFNode) {
        const tableData = tableRFNode.data as { entityId?: string | null; [key: string]: unknown }
        const updatedTable = { ...tableData, entityId: null }
        setNodes(nodes => nodes.map(n =>
          n.id === edge.target ? { ...n, data: updatedTable } : n,
        ))
        await db.nodes.update(edge.target, {
          data:      JSON.stringify(updatedTable),
          updatedAt: Date.now(),
        })
      }
    }

    // ── Sync entity-type fields across all nodes that reference this entity ──
    if (activeProjectId) {
      // Build edges without the removed STORED_IN edge
      const edgesWithout = allEdges.filter(e => e.id !== edgeId)
      const syncResult = syncEntityTypeFields(nodeId, false, rfNodes, edgesWithout)

      for (const [nid, updatedNodeData] of syncResult.updatedNodes) {
        setNodes(nodes => nodes.map(n =>
          n.id === nid ? { ...n, data: updatedNodeData as unknown as Record<string, unknown> } : n,
        ))
        await db.nodes.update(nid, { data: JSON.stringify(updatedNodeData), updatedAt: Date.now() })
      }

      for (const change of syncResult.updatedEdges) {
        if (change.action === 'remove') {
          await db.edges.delete(change.edgeId)
          setEdges(edges => edges.filter(e => e.id !== change.edgeId))
        } else if (change.action === 'add' && change.fromNodeId && change.toNodeId && change.edgeType) {
          const fromId = change.fromNodeId
          const toId   = change.toNodeId
          const rfType = change.edgeType === EdgeType.EMBEDS ? 'embeds' as const : 'relatesTo' as const
          const newEd = {
            id:         change.edgeId,
            projectId:  activeProjectId,
            fromNodeId: fromId,
            toNodeId:   toId,
            type:       change.edgeType,
            label:      change.edgeType,
            fromHandle: '',
            toHandle:   '',
          }
          await db.edges.add(newEd)
          setEdges(edges => [
            ...edges,
            {
              id:     change.edgeId,
              source: fromId,
              target: toId,
              type:   rfType,
              data:   newEd as unknown as Record<string, unknown>,
              markerEnd: {
                type:  MarkerType.ArrowClosed,
                color: rfType === 'embeds' ? 'var(--node-entity-accent)' : 'var(--color-warning)',
                width: 12,
                height: 12,
              },
            },
          ])
        }
      }

      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
      bc.close()
    }
  }, [allEdges, rfNodes, setEdges, setNodes, activeProjectId, nodeId])

  // ─── USES edges — connected Services ─────────────────────────────
  // Canonical direction: source = ServiceNode.id, target = EntityNode.id
  // So edges where target === nodeId and type === USES are service connections.

  const connectedServices: ConnectedService[] = allEdges
    .filter(e => {
      const edgeData = e.data as { type?: string } | undefined
      return edgeData?.type === EdgeType.USES && e.target === nodeId
    })
    .map(e => {
      const serviceRFNode = rfNodes.find(n => n.id === e.source)
      const serviceData   = serviceRFNode?.data as { label?: string } | undefined
      return {
        edgeId:       e.id,
        serviceId:    e.source,
        serviceLabel: serviceData?.label ?? 'Service',
      }
    })

  const handleDisconnectService = useCallback(async (edgeId: string): Promise<void> => {
    const edge = allEdges.find(e => e.id === edgeId)
    if (!edge) return

    const serviceId = edge.source

    await db.edges.delete(edgeId)
    setEdges(edges => edges.filter(e => e.id !== edgeId))

    // Reset the ServiceNode to factory defaults
    const serviceRFNode = rfNodes.find(n => n.id === serviceId)
    if (serviceRFNode) {
      const serviceNode = serviceRFNode.data as unknown as ServiceNode
      const reset       = resetServiceNode(serviceNode)
      setNodes(nodes => nodes.map(n =>
        n.id === serviceId
          ? { ...n, data: reset as unknown as Record<string, unknown> }
          : n,
      ))
      await db.nodes.update(serviceId, {
        data:      JSON.stringify(reset),
        updatedAt: Date.now(),
      })
    }

    if (activeProjectId) {
      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
      bc.close()
    }
  }, [allEdges, rfNodes, setEdges, setNodes, activeProjectId])

  // ─── Delete DERIVED_FROM edge from the inspector ──────────────────

  const handleDeleteEdge = useCallback(async (edgeId: string): Promise<void> => {
    const edge = allEdges.find(e => e.id === edgeId)
    if (!edge) return

    const dtoId    = edge.source
    const entityId = edge.target

    await db.edges.delete(edgeId)
    setEdges(edges => edges.filter(e => e.id !== edgeId))

    const dtoRFNode = rfNodes.find(n => n.id === dtoId)
    if (dtoRFNode) {
      const dtoNode    = dtoRFNode.data as unknown as DTONode
      const newSources = dtoNode.entitySources.filter(s => s.entityId !== entityId)
      const updatedDto: DTONode = {
        ...dtoNode,
        entitySources: newSources,
        origin: newSources.length === 0 ? DTOOrigin.CUSTOM : dtoNode.origin,
      }
      await db.nodes.update(dtoId, {
        data:      JSON.stringify(updatedDto),
        updatedAt: Date.now(),
      })
      setNodes(nodes => nodes.map(n =>
        n.id === dtoId ? { ...n, data: updatedDto as unknown as DTONodeData } : n,
      ))
    }
  }, [allEdges, rfNodes, setEdges, setNodes])

  // ─── Key fields by entity — for "Mapped by" dropdown ────────────
  // Maps entityId → array of PK and UNIQUE field names from that entity.

  const keyFieldsByEntityId = useMemo((): Record<string, string[]> => {
    const map: Record<string, string[]> = {}
    rfNodes.forEach(n => {
      if (n.type !== 'entity') return
      const entity = n.data as unknown as EntityNode
      const names = entity.fields.map(f => f.name).filter(Boolean)
      map[n.id] = names
    })
    return map
  }, [rfNodes])

  // ─── Dedup field IDs ────────────────────────────────────────────
  // AI-generated fields often share the same placeholder ID — detect and fix on every fields change.

  const applyUpdateRef = useRef(applyUpdate)
  applyUpdateRef.current = applyUpdate

  useEffect(() => {
    if (!node) return
    const seen = new Set<string>()
    let dirty = false
    const fixed = node.fields.map(f => {
      if (!f.id || seen.has(f.id)) {
        dirty = true
        const id = generateId()
        seen.add(id)
        return { ...f, id }
      }
      seen.add(f.id)
      return f
    })
    if (dirty) applyUpdateRef.current(n => ({ ...n, fields: fixed }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.fields])

  // ─── Lifecycle ──────────────────────────────────────────────────

  const handleClose = useCallback((): void => {
    clearSelection()
  }, [clearSelection])

  const handleDelete = useCallback((): void => {
    if (!node || !activeProjectId) return
    const confirmed = window.confirm(
      `Delete "${node.label}"? This will also remove DTOs derived from it.`,
    )
    if (!confirmed) return
    deleteNode({ nodeId: node.id, projectId: activeProjectId })
    setNodes(nodes => nodes.filter(n => n.id !== nodeId))
    clearSelection()
  }, [node, activeProjectId, deleteNode, setNodes, nodeId, clearSelection])

  return {
    node,
    handleLabelChange,
    handleTableNameChange,
    handleAuditingToggle,
    handleSoftDeleteToggle,
    handleGenerateRepositoryToggle,
    handleLombokStyleChange,
    handleAddField,
    handleRemoveField,
    handleFieldTypeChange,
    handleFieldArraySubTypeChange,
    handleFieldRelationshipChange,
    handleAddEnumValue,
    handleRemoveEnumValue,
    handleAIPromptChange,
    handleAIGenerateToggle,
    handleClose,
    handleDelete,
    connectedDTOs,
    handleDeleteEdge,
    connectedTables,
    handleDisconnectTable,
    connectedServices,
    handleDisconnectService,
    entityOptions,
    customTypeOptions,
    keyFieldsByEntityId,
  }
}
