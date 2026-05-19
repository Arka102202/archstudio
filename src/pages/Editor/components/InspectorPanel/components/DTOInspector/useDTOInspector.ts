import { useCallback, useEffect } from 'react'
import { useNodes, useEdges, useReactFlow } from '@xyflow/react'
import { useCanvasStore } from '@store'
import { useProjectStore } from '@store'
import { useUpdateNode, useDeleteNode } from '@service'
import { useDebounce } from '@hooks'
import { NodeType, JavaType, DTOOrigin, EdgeType, DTOPurpose } from '@entity'
import { generateId } from '@utils'
import { useFieldTypeSelect } from '@components/shared'
import { MarkerType } from '@xyflow/react'
import { db } from '@db'
import type { DTONode, APIEndpointNode, LombokStyle, ValidationType as VT, AIPrompt } from '@entity'
import type { DTONodeData } from '@components/nodes/DTONode'
import type { DTOInspectorProps, DTOInspectorHook } from './types'

export const useDTOInspector = (
  { nodeId }: DTOInspectorProps,
): DTOInspectorHook => {
  const clearSelection  = useCanvasStore(s => s.clearSelection)
  const activeProjectId = useProjectStore(s => s.activeProjectId)
  const rfNodes         = useNodes()
  const allEdges        = useEdges()
  const { setNodes, setEdges, getNodes } = useReactFlow()

  const { mutate: updateNode } = useUpdateNode()
  const { mutate: deleteNode } = useDeleteNode()

  // Derive current node from RF state — no query round-trip
  const rfNode = rfNodes.find(n => n.id === nodeId)
  const node   = (rfNode?.data as unknown as DTONode | undefined) ?? null

  // ─── Core update helper ─────────────────────────────────────────

  const writeToIDB = useCallback((updated: DTONode): void => {
    if (!activeProjectId) return
    console.log(`[PURPOSE] writeToIDB fired: purpose=${updated.purpose}`, { id: updated.id })
    updateNode({
      id:        updated.id,
      projectId: activeProjectId,
      type:      NodeType.DTO,
      label:     updated.label,
      position:  updated.position,
      size:      updated.size,
      data:      JSON.stringify(updated),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }, [activeProjectId, updateNode])

  const debouncedWrite     = useDebounce(writeToIDB, 300)
  const debouncedWriteSlow = useDebounce(writeToIDB, 500)

  const applyUpdate = useCallback((
    updater:  (prev: DTONode) => DTONode,
    debounce: 'fast' | 'slow' = 'fast',
  ): void => {
    if (!node) return
    const updated = updater(node)
    if (updated.purpose !== node.purpose) {
      console.log(`[PURPOSE] applyUpdate: ${node.purpose} → ${updated.purpose}`, { nodeId, debounce })
    }

    setNodes(nodes => nodes.map(n =>
      n.id === nodeId ? { ...n, data: updated as unknown as DTONodeData } : n,
    ))

    if (debounce === 'slow') debouncedWriteSlow(updated)
    else debouncedWrite(updated)
  }, [node, nodeId, setNodes, debouncedWrite, debouncedWriteSlow])

  // ─── USES_TYPE / USES_CUSTOM_TYPE edge cleanup ──────────────────
  // Removes orphaned USES_TYPE edges — any where no field in `fields` still
  // references the target entity. Also removes orphaned USES_CUSTOM_TYPE edges.
  // Call after any field mutation.

  const cleanupUsesTypeEdges = useCallback(async (
    fields: DTONode['fields'],
  ): Promise<void> => {
    if (!activeProjectId) return
    const referencedEntityIds = new Set<string>()
    const referencedCustomTypeIds = new Set<string>()
    for (const f of fields) {
      if (f.type === 'ENTITY_REF' && f.entityTypeId)                           referencedEntityIds.add(f.entityTypeId)
      if (f.arraySubType === 'ENTITY_REF' && f.arrayEntityTypeId)              referencedEntityIds.add(f.arrayEntityTypeId)
      if (f.type === 'CUSTOM_TYPE_REF' && f.customTypeId)                      referencedCustomTypeIds.add(f.customTypeId)
      if (f.arraySubType === 'CUSTOM_TYPE_REF' && f.arrayCustomTypeId)         referencedCustomTypeIds.add(f.arrayCustomTypeId)
    }
    const orphans = allEdges.filter(e => {
      const d = e.data as { type?: string } | undefined
      if (d?.type === EdgeType.USES_TYPE && e.source === nodeId && !referencedEntityIds.has(e.target)) return true
      if (d?.type === EdgeType.USES_CUSTOM_TYPE && e.source === nodeId && !referencedCustomTypeIds.has(e.target)) return true
      return false
    })
    for (const edge of orphans) {
      await db.edges.delete(edge.id)
      setEdges(edges => edges.filter(e => e.id !== edge.id))
    }
  }, [activeProjectId, nodeId, allEdges, setEdges])

  // Run cleanup once on mount to clear any edges orphaned from a previous session
  useEffect(() => {
    if (!node) return
    void cleanupUsesTypeEdges(node.fields)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]) // intentionally only on mount / node switch

  // Deduplicate field IDs — AI-generated fields often arrive with identical IDs
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
    if (dirty) applyUpdate(n => ({ ...n, fields: fixed }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.fields])

  // ─── Identity ───────────────────────────────────────────────────

  const handleLabelChange = useCallback((value: string): void => {
    applyUpdate(n => ({ ...n, label: value }))
  }, [applyUpdate])

  const handlePurposeChange = useCallback((value: DTOPurpose): void => {
    if (!node || !activeProjectId) return
    if (value === node.purpose) return
    console.log(`[PURPOSE] Manual change: ${node.purpose} → ${value}`, { nodeId, stack: new Error().stack })

    const wantInBody     = value === DTOPurpose.REQUEST  || value === DTOPurpose.BOTH
    const wantInResponse = value === DTOPurpose.RESPONSE || value === DTOPurpose.BOTH

    // ── Collect endpoint connections (source = endpoint, target = this DTO) ──
    const acceptsEdges = allEdges.filter(e => {
      const d = e.data as { type?: string } | undefined
      return d?.type === EdgeType.ACCEPTS && e.target === nodeId
    })
    const returnsEdges = allEdges.filter(e => {
      const d = e.data as { type?: string } | undefined
      return d?.type === EdgeType.RETURNS && e.target === nodeId
    })

    const endpointIds = [
      ...new Set([
        ...acceptsEdges.map(e => e.source),
        ...returnsEdges.map(e => e.source),
      ]),
    ]

    // ── Guard: check all endpoints for slot conflicts before writing anything ──
    // Derive current slot state from bodyDTOId/returnDTOId — NOT from edge type,
    // because edge types don't change when purpose changes.
    for (const epId of endpointIds) {
      const epRFNode = rfNodes.find(n => n.id === epId)
      if (!epRFNode) continue
      const epData = epRFNode.data as unknown as APIEndpointNode

      if (wantInBody && epData.request.bodyDTOId !== null && epData.request.bodyDTOId !== nodeId) {
        window.alert(
          `Cannot change purpose to "${value}": the Body DTO slot on endpoint "${epData.label}" is already occupied by another DTO.\n\nDisconnect this DTO from that endpoint first.`,
        )
        return
      }
      if (wantInResponse && epData.response.returnDTOId !== null && epData.response.returnDTOId !== nodeId) {
        window.alert(
          `Cannot change purpose to "${value}": the Return DTO slot on endpoint "${epData.label}" is already occupied by another DTO.\n\nDisconnect this DTO from that endpoint first.`,
        )
        return
      }
    }

    // ── Apply DTO purpose change ────────────────────────────────────
    console.log(`[PURPOSE] Applying to RF state: ${value}`, { nodeId })
    applyUpdate(n => ({ ...n, purpose: value }))

    if (endpointIds.length === 0) return

    // ── Update slot data on every connected endpoint — no edge changes ──
    // Use getNodes() for fresh state — rfNodes in the closure may be stale
    // on repeated calls (e.g. REQUEST→RESPONSE then RESPONSE→REQUEST).
    void (async (): Promise<void> => {
      for (const epId of endpointIds) {
        const freshEpNode = getNodes().find(n => n.id === epId)
        if (!freshEpNode) continue
        const epData = freshEpNode.data as unknown as APIEndpointNode

        // Derive current slot state from the actual field values, not edge types
        const isInBody     = epData.request.bodyDTOId     === nodeId
        const isInResponse = epData.response.returnDTOId  === nodeId

        let updatedEp = epData
        if (isInBody     && !wantInBody)     updatedEp = { ...updatedEp, request:  { ...updatedEp.request,  bodyDTOId:   null   } }
        if (!isInBody    && wantInBody)      updatedEp = { ...updatedEp, request:  { ...updatedEp.request,  bodyDTOId:   nodeId } }
        if (isInResponse && !wantInResponse) updatedEp = { ...updatedEp, response: { ...updatedEp.response, returnDTOId: null   } }
        if (!isInResponse && wantInResponse) updatedEp = { ...updatedEp, response: { ...updatedEp.response, returnDTOId: nodeId } }

        if (updatedEp !== epData) {
          setNodes(nodes => nodes.map(n =>
            n.id === epId ? { ...n, data: updatedEp as unknown as Record<string, unknown> } : n,
          ))
          await db.nodes.update(epId, { data: JSON.stringify(updatedEp), updatedAt: Date.now() })
        }
      }

      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
      bc.close()
    })()
  }, [node, nodeId, activeProjectId, allEdges, rfNodes, applyUpdate, setNodes, getNodes])

  const handleOriginChange = useCallback((value: DTOOrigin): void => {
    applyUpdate(n => ({ ...n, origin: value }))
  }, [applyUpdate])

  // ─── Config ─────────────────────────────────────────────────────

  const handleValidationToggle = useCallback((): void => {
    applyUpdate(n => ({
      ...n,
      config: { ...n.config, validationEnabled: !n.config.validationEnabled },
    }))
  }, [applyUpdate])

  const handleLombokStyleChange = useCallback((value: LombokStyle): void => {
    applyUpdate(n => ({ ...n, config: { ...n.config, lombokStyle: value } }))
  }, [applyUpdate])

  // ─── Fields ─────────────────────────────────────────────────────
  // When user manually adds/removes a field, set origin = CUSTOM.

  const handleAddField = useCallback(async (
    name:            string,
    type:            JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF',
    entityId:        string | null,
    subType?:        JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null,
    subEntityId?:    string | null,
    customTypeId?:   string | null,
    subCustomTypeId?: string | null,
  ): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed || !node) return

    // Duplicate guard
    if (node.fields.some(f => f.name === trimmed)) return

    const newField = {
      id:                   generateId(),
      name:                 trimmed,
      type:                 type,
      arraySubType:         subType ?? null,
      arrayEntityTypeId:    subType === 'ENTITY_REF'      ? (subEntityId    ?? null) : null,
      arrayCustomTypeId:    subType === 'CUSTOM_TYPE_REF' ? (subCustomTypeId ?? null) : null,
      entityTypeId:         type === 'ENTITY_REF'         ? entityId                  : null,
      customTypeId:         type === 'CUSTOM_TYPE_REF'    ? (customTypeId   ?? null)  : null,
      mapKeyType:           null,
      mapKeyEntityTypeId:   null,
      mapKeyCustomTypeId:   null,
      mapValueType:         null,
      mapValueEntityTypeId: null,
      mapValueCustomTypeId: null,
      entityTypeInvalid:    false,
      sourceEntityId:       null,
      enumValues:           type === JavaType.ENUM ? [] : null,
      validations:          [],
      serialization:        { jsonProperty: '', jsonIgnore: false, includeNonNull: false },
    }

    const updatedNode: DTONode = {
      ...node,
      origin: DTOOrigin.CUSTOM,
      fields: [...node.fields, newField],
    }

    setNodes(nodes => nodes.map(n =>
      n.id === nodeId ? { ...n, data: updatedNode as unknown as DTONodeData } : n,
    ))
    debouncedWrite(updatedNode)

    // Create USES_TYPE edges for entity refs (type or subType), dedup-checked
    const entityIdsToLink: string[] = []
    if (type === 'ENTITY_REF' && entityId)       entityIdsToLink.push(entityId)
    if (subType === 'ENTITY_REF' && subEntityId) entityIdsToLink.push(subEntityId)

    for (const refId of [...new Set(entityIdsToLink)]) {
      if (!activeProjectId) continue
      const alreadyExists = allEdges.some(e => {
        const d = e.data as { type?: string } | undefined
        return d?.type === EdgeType.USES_TYPE && e.source === nodeId && e.target === refId
      })
      if (alreadyExists) continue
      const newEdgeId  = generateId()
      const newEdgeRow = {
        id: newEdgeId, projectId: activeProjectId,
        fromNodeId: nodeId, toNodeId: refId,
        type: EdgeType.USES_TYPE, label: EdgeType.USES_TYPE,
        fromHandle: '', toHandle: '',
      }
      await db.edges.add(newEdgeRow)
      setEdges(edges => [
        ...edges,
        {
          id: newEdgeId, source: nodeId, target: refId,
          type: 'usesType' as const,
          data: newEdgeRow as unknown as Record<string, unknown>,
          markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--node-dto-accent)', width: 12, height: 12 },
        },
      ])
    }

    // Create USES_CUSTOM_TYPE edges for custom type refs (top-level type or array subtype), dedup-checked
    const ctEdgeTargets: string[] = []
    if (type === 'CUSTOM_TYPE_REF' && customTypeId)                 ctEdgeTargets.push(customTypeId)
    if (subType === 'CUSTOM_TYPE_REF' && subCustomTypeId)           ctEdgeTargets.push(subCustomTypeId)

    for (const ctId of [...new Set(ctEdgeTargets)]) {
      if (!activeProjectId) continue
      const alreadyExists = allEdges.some(e => {
        const d = e.data as { type?: string } | undefined
        return d?.type === EdgeType.USES_CUSTOM_TYPE && e.source === nodeId && e.target === ctId
      })
      if (!alreadyExists) {
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

    if (activeProjectId) {
      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.close()
    }
  }, [node, nodeId, activeProjectId, allEdges, setNodes, setEdges, debouncedWrite])

  const handleRemoveField = useCallback(async (fieldId: string): Promise<void> => {
    if (!node) return
    const field = node.fields.find(f => f.id === fieldId)
    if (!field) return

    const remainingFields = node.fields.filter(f => f.id !== fieldId)

    // Persist the exclusion if field was derived from an entity
    const updatedSources = field.sourceEntityId
      ? node.entitySources.map(s =>
          s.entityId !== field.sourceEntityId ? s : {
            ...s,
            excludeFields: s.excludeFields.includes(field.name)
              ? s.excludeFields
              : [...s.excludeFields, field.name],
          },
        )
      : node.entitySources

    const updatedNode: DTONode = {
      ...node,
      origin:        DTOOrigin.CUSTOM,
      fields:        remainingFields,
      entitySources: updatedSources,
    }
    setNodes(nodes => nodes.map(n =>
      n.id === nodeId ? { ...n, data: updatedNode as unknown as DTONodeData } : n,
    ))
    debouncedWrite(updatedNode)
    await cleanupUsesTypeEdges(remainingFields)
  }, [node, nodeId, setNodes, debouncedWrite, cleanupUsesTypeEdges])

  const handleFieldTypeChange = useCallback(async (
    fieldId:          string,
    newType:          JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF',
    newEntityTypeId:  string | null,
    newCustomTypeId:  string | null,
  ): Promise<void> => {
    if (!node || !activeProjectId) return
    const field = node.fields.find(f => f.id === fieldId)
    if (!field) return

    const updatedField = {
      ...field,
      type:              newType,
      entityTypeId:      newType === 'ENTITY_REF'      ? newEntityTypeId : null,
      customTypeId:      newType === 'CUSTOM_TYPE_REF' ? newCustomTypeId : null,
      arraySubType:         newType === JavaType.ARRAY ? (field.arraySubType      ?? null) : null,
      arrayEntityTypeId:    newType === JavaType.ARRAY ? (field.arrayEntityTypeId ?? null) : null,
      arrayCustomTypeId:    newType === JavaType.ARRAY ? (field.arrayCustomTypeId ?? null) : null,
      mapKeyType:           newType === JavaType.MAP ? (field.mapKeyType           ?? null) : null,
      mapKeyEntityTypeId:   newType === JavaType.MAP ? (field.mapKeyEntityTypeId   ?? null) : null,
      mapKeyCustomTypeId:   newType === JavaType.MAP ? (field.mapKeyCustomTypeId   ?? null) : null,
      mapValueType:         newType === JavaType.MAP ? (field.mapValueType         ?? null) : null,
      mapValueEntityTypeId: newType === JavaType.MAP ? (field.mapValueEntityTypeId ?? null) : null,
      mapValueCustomTypeId: newType === JavaType.MAP ? (field.mapValueCustomTypeId ?? null) : null,
      entityTypeInvalid:    false,
      enumValues:           newType === JavaType.ENUM ? (field.enumValues ?? []) : null,
    }

    const updatedFields = node.fields.map(f => f.id === fieldId ? updatedField : f)

    // Create USES_TYPE edge for ENTITY_REF
    if (newType === 'ENTITY_REF' && newEntityTypeId) {
      const alreadyExists = allEdges.some(e => {
        const d = e.data as { type?: string } | undefined
        return d?.type === EdgeType.USES_TYPE && e.source === nodeId && e.target === newEntityTypeId
      })
      if (!alreadyExists) {
        const newEdgeId  = generateId()
        const newEdgeRow = {
          id: newEdgeId, projectId: activeProjectId,
          fromNodeId: nodeId, toNodeId: newEntityTypeId,
          type: EdgeType.USES_TYPE, label: EdgeType.USES_TYPE,
          fromHandle: '', toHandle: '',
        }
        await db.edges.add(newEdgeRow)
        setEdges(edges => [
          ...edges,
          {
            id: newEdgeId, source: nodeId, target: newEntityTypeId,
            type: 'usesType' as const,
            data: newEdgeRow as unknown as Record<string, unknown>,
            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--node-dto-accent)', width: 12, height: 12 },
          },
        ])
      }
    }

    // Create USES_CUSTOM_TYPE edge for CUSTOM_TYPE_REF
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

    const updatedNode: DTONode = { ...node, fields: updatedFields }
    setNodes(nodes => nodes.map(n =>
      n.id === nodeId ? { ...n, data: updatedNode as unknown as DTONodeData } : n,
    ))
    debouncedWrite(updatedNode)
    await cleanupUsesTypeEdges(updatedFields)
  }, [node, nodeId, activeProjectId, allEdges, setEdges, setNodes, debouncedWrite, cleanupUsesTypeEdges])

  const handleFieldArraySubTypeChange = useCallback(async (
    fieldId:       string,
    subType:       JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null,
    entityId:      string | null,
    customTypeId?: string | null,
  ): Promise<void> => {
    if (!node || !activeProjectId) return
    const field = node.fields.find(f => f.id === fieldId)
    if (!field) return

    const updatedField = {
      ...field,
      arraySubType:      subType,
      arrayEntityTypeId: subType === 'ENTITY_REF'      ? entityId                  : null,
      arrayCustomTypeId: subType === 'CUSTOM_TYPE_REF' ? (customTypeId ?? null)     : null,
    }

    // Create USES_TYPE edge if new subType is ENTITY_REF and not already linked
    if (subType === 'ENTITY_REF' && entityId) {
      const edgeExists = allEdges.some(e => {
        const d = e.data as { type?: string } | undefined
        return d?.type === EdgeType.USES_TYPE && e.source === nodeId && e.target === entityId
      })
      if (!edgeExists) {
        const newEdgeId  = generateId()
        const newEdgeRow = {
          id: newEdgeId, projectId: activeProjectId,
          fromNodeId: nodeId, toNodeId: entityId,
          type: EdgeType.USES_TYPE, label: EdgeType.USES_TYPE,
          fromHandle: '', toHandle: '',
        }
        await db.edges.add(newEdgeRow)
        setEdges(edges => [
          ...edges,
          {
            id: newEdgeId, source: nodeId, target: entityId,
            type: 'usesType' as const,
            data: newEdgeRow as unknown as Record<string, unknown>,
            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--node-dto-accent)', width: 12, height: 12 },
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
    const updatedNode: DTONode = { ...node, fields: updatedFields }
    setNodes(nodes => nodes.map(n =>
      n.id === nodeId ? { ...n, data: updatedNode as unknown as DTONodeData } : n,
    ))
    debouncedWrite(updatedNode)
    await cleanupUsesTypeEdges(updatedFields)

    const bc = new BroadcastChannel('archflow-sync')
    bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
    bc.close()
  }, [node, nodeId, activeProjectId, allEdges, setEdges, setNodes, debouncedWrite, cleanupUsesTypeEdges])

  const handleFieldMapSubTypeChange = useCallback((
    fieldId:  string,
    slot:     'key' | 'value',
    subType:  JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null,
    entityId: string | null,
    customTypeId: string | null,
  ): void => {
    applyUpdate(n => {
      const field = n.fields.find(f => f.id === fieldId)
      if (!field) return n
      const updatedField = slot === 'key'
        ? { ...field, mapKeyType: subType, mapKeyEntityTypeId: subType === 'ENTITY_REF' ? entityId : null, mapKeyCustomTypeId: subType === 'CUSTOM_TYPE_REF' ? customTypeId : null }
        : { ...field, mapValueType: subType, mapValueEntityTypeId: subType === 'ENTITY_REF' ? entityId : null, mapValueCustomTypeId: subType === 'CUSTOM_TYPE_REF' ? customTypeId : null }
      return { ...n, fields: n.fields.map(f => f.id === fieldId ? updatedField : f) }
    })
  }, [applyUpdate])

  const handleFieldNameChange = useCallback((fieldId: string, name: string): void => {
    applyUpdate(n => {
      const field = n.fields.find(f => f.id === fieldId)
      if (!field) return n

      // If renaming a derived field, exclude the old name so it doesn't re-appear
      // on next sync, and detach the source link (it's now a custom field).
      const updatedSources = field.sourceEntityId
        ? n.entitySources.map(s =>
            s.entityId !== field.sourceEntityId ? s : {
              ...s,
              excludeFields: s.excludeFields.includes(field.name)
                ? s.excludeFields
                : [...s.excludeFields, field.name],
            },
          )
        : n.entitySources

      return {
        ...n,
        fields: n.fields.map(f =>
          f.id !== fieldId ? f : { ...f, name, sourceEntityId: null },
        ),
        entitySources: updatedSources,
      }
    })
  }, [applyUpdate])

  // ─── Serialisation (per-field) ───────────────────────────────────

  const handleJsonPropertyChange = useCallback((fieldId: string, value: string): void => {
    applyUpdate(n => ({
      ...n,
      fields: n.fields.map(f =>
        f.id !== fieldId ? f : { ...f, serialization: { ...f.serialization, jsonProperty: value } },
      ),
    }))
  }, [applyUpdate])

  const handleJsonIgnoreToggle = useCallback((fieldId: string): void => {
    applyUpdate(n => ({
      ...n,
      fields: n.fields.map(f =>
        f.id !== fieldId ? f : {
          ...f,
          serialization: { ...f.serialization, jsonIgnore: !f.serialization.jsonIgnore },
        },
      ),
    }))
  }, [applyUpdate])

  const handleIncludeNonNullToggle = useCallback((fieldId: string): void => {
    applyUpdate(n => ({
      ...n,
      fields: n.fields.map(f =>
        f.id !== fieldId ? f : {
          ...f,
          serialization: { ...f.serialization, includeNonNull: !f.serialization.includeNonNull },
        },
      ),
    }))
  }, [applyUpdate])

  // ─── Enum values (per-field, only when type === ENUM) ────────────

  const handleAddEnumValue = useCallback((fieldId: string, value: string): void => {
    const trimmed = value.trim().toUpperCase()
    if (!trimmed) return
    applyUpdate(n => ({
      ...n,
      fields: n.fields.map(f => {
        if (f.id !== fieldId) return f
        const existing = f.enumValues ?? []
        if (existing.includes(trimmed)) return f
        return { ...f, enumValues: [...existing, trimmed] }
      }),
    }))
  }, [applyUpdate])

  const handleRemoveEnumValue = useCallback((fieldId: string, index: number): void => {
    applyUpdate(n => ({
      ...n,
      fields: n.fields.map(f => {
        if (f.id !== fieldId) return f
        return { ...f, enumValues: (f.enumValues ?? []).filter((_, i) => i !== index) }
      }),
    }))
  }, [applyUpdate])

  // ─── Validations (per-field) ─────────────────────────────────────

  const handleAddValidation = useCallback((fieldId: string, type: VT): void => {
    applyUpdate(n => ({
      ...n,
      fields: n.fields.map(f =>
        f.id !== fieldId ? f : {
          ...f,
          validations: [
            ...f.validations,
            { type, value: '', message: '' },
          ],
        },
      ),
    }))
  }, [applyUpdate])

  const handleRemoveValidation = useCallback((fieldId: string, validationIdx: number): void => {
    applyUpdate(n => ({
      ...n,
      fields: n.fields.map(f =>
        f.id !== fieldId ? f : {
          ...f,
          validations: f.validations.filter((_, i) => i !== validationIdx),
        },
      ),
    }))
  }, [applyUpdate])

  const handleValidationValueChange = useCallback((
    fieldId:       string,
    validationIdx: number,
    value:         string,
  ): void => {
    applyUpdate(n => ({
      ...n,
      fields: n.fields.map(f =>
        f.id !== fieldId ? f : {
          ...f,
          validations: f.validations.map((v, i) =>
            i !== validationIdx ? v : { ...v, value },
          ),
        },
      ),
    }))
  }, [applyUpdate])

  const handleValidationMessageChange = useCallback((
    fieldId:       string,
    validationIdx: number,
    message:       string,
  ): void => {
    applyUpdate(n => ({
      ...n,
      fields: n.fields.map(f =>
        f.id !== fieldId ? f : {
          ...f,
          validations: f.validations.map((v, i) =>
            i !== validationIdx ? v : { ...v, message },
          ),
        },
      ),
    }))
  }, [applyUpdate])

  // ─── AI Prompt ──────────────────────────────────────────────────

  const handleAIPromptChange = useCallback(
    (field: keyof AIPrompt, value: string): void => {
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
  const { entityOptions, customTypeOptions } = useFieldTypeSelect(nodeId, 'dto')

  // ─── Connections — edge data for the CONNECTIONS section ─────────
  // Canonical edge direction: source = dtoId, target = entityId
  // So edges where source === nodeId are the DERIVED_FROM edges for this DTO.

  const connectedEntities = allEdges
    .filter(e => e.source === nodeId)
    .map(e => {
      const entityRFNode = rfNodes.find(n => n.id === e.target)
      if (!entityRFNode) return null
      const entityData = entityRFNode.data as { label?: string }
      return {
        edgeId:      e.id,
        entityId:    e.target,
        entityLabel: entityData.label ?? 'Entity',
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  // ─── Delete edge from the inspector ─────────────────────────────

  const handleDeleteEdge = useCallback(async (edgeId: string): Promise<void> => {
    const edge = allEdges.find(e => e.id === edgeId)
    if (!edge) return

    const entityId = edge.target

    await db.edges.delete(edgeId)
    setEdges(edges => edges.filter(e => e.id !== edgeId))

    // Update this DTO's entitySources and fields
    if (node) {
      const newSources = node.entitySources.filter(s => s.entityId !== entityId)

      // Rule 4: DERIVED DTO → strip fields that came from the removed entity
      // Rule 5: CUSTOM DTO → keep all fields regardless of which entity is disconnected
      const updatedFields = node.origin === DTOOrigin.DERIVED
        ? node.fields.filter(f => f.sourceEntityId !== entityId)
        : node.fields

      const updatedDto: DTONode = {
        ...node,
        fields:        updatedFields,
        entitySources: newSources,
        origin:        newSources.length === 0 ? DTOOrigin.CUSTOM : node.origin,
      }
      await db.nodes.update(nodeId, {
        data:      JSON.stringify(updatedDto),
        updatedAt: Date.now(),
      })
      setNodes(nodes => nodes.map(n =>
        n.id === nodeId ? { ...n, data: updatedDto as unknown as DTONodeData } : n,
      ))
    }
  }, [allEdges, node, nodeId, setEdges, setNodes])

  // ─── Lifecycle ──────────────────────────────────────────────────

  const handleClose = useCallback((): void => {
    clearSelection()
  }, [clearSelection])

  const handleDelete = useCallback((): void => {
    if (!node || !activeProjectId) return
    const confirmed = window.confirm(`Delete "${node.label}"?`)
    if (!confirmed) return
    deleteNode({ nodeId: node.id, projectId: activeProjectId })
    setNodes(nodes => nodes.filter(n => n.id !== nodeId))
    clearSelection()
  }, [node, activeProjectId, deleteNode, setNodes, nodeId, clearSelection])

  return {
    node,
    handleLabelChange,
    handlePurposeChange,
    handleOriginChange,
    handleValidationToggle,
    handleLombokStyleChange,
    handleAddField,
    handleRemoveField,
    handleFieldTypeChange,
    handleFieldArraySubTypeChange,
    handleFieldMapSubTypeChange,
    handleFieldNameChange,
    handleAddEnumValue,
    handleRemoveEnumValue,
    handleJsonPropertyChange,
    handleJsonIgnoreToggle,
    handleIncludeNonNullToggle,
    handleAddValidation,
    handleRemoveValidation,
    handleValidationValueChange,
    handleValidationMessageChange,
    handleAIPromptChange,
    handleAIGenerateToggle,
    handleClose,
    handleDelete,
    connectedEntities,
    handleDeleteEdge,
    entityOptions,
    customTypeOptions,
  }
}
