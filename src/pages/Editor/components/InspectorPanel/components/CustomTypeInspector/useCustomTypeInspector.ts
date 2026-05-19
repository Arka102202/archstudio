import { useCallback } from 'react'
import { useNodes, useEdges, useReactFlow } from '@xyflow/react'
import { useCanvasStore } from '@store'
import { useProjectStore } from '@store'
import { useUpdateNode, useDeleteNode } from '@service'
import { useDebounce } from '@hooks'
import { NodeType, EdgeType, JavaType, type EnumValues } from '@entity'
import { generateId } from '@utils'
import { useFieldTypeSelect } from '@components/shared'
import { db } from '@db'
import { MarkerType } from '@xyflow/react'
import type { CustomTypeNode, AIPrompt } from '@entity'
import type { CustomTypeInspectorProps, CustomTypeInspectorHook } from './types'

export const useCustomTypeInspector = (
  { nodeId }: CustomTypeInspectorProps,
): CustomTypeInspectorHook => {
  const clearSelection        = useCanvasStore(s => s.clearSelection)
  const activeProjectId       = useProjectStore(s => s.activeProjectId)
  const rfNodes               = useNodes()
  const allEdges              = useEdges()
  const { setNodes, setEdges } = useReactFlow()

  const { mutate: updateNode } = useUpdateNode()
  const { mutate: deleteNode } = useDeleteNode()

  const rfNode = rfNodes.find(n => n.id === nodeId)
  const node   = (rfNode?.data as unknown as CustomTypeNode | undefined) ?? null

  // ─── Core update helper ─────────────────────────────────────────

  const writeToIDB = useCallback((updated: CustomTypeNode): void => {
    if (!activeProjectId) return
    updateNode({
      id:        updated.id,
      projectId: activeProjectId,
      type:      NodeType.CUSTOM_TYPE,
      label:     updated.label,
      position:  updated.position,
      size:      updated.size,
      data:      JSON.stringify(updated),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    const bc = new BroadcastChannel('archflow-sync')
    bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
    bc.close()
  }, [activeProjectId, updateNode])

  const applyUpdate = useCallback((fn: (n: CustomTypeNode) => CustomTypeNode): void => {
    if (!node) return
    const updated = fn(node)
    setNodes(nodes => nodes.map(n =>
      n.id === nodeId ? { ...n, data: updated as unknown as Record<string, unknown> } : n,
    ))
    writeToIDB(updated)
  }, [node, nodeId, setNodes, writeToIDB])

  const debouncedWriteIDB = useDebounce(writeToIDB, 300)

  // ─── Identity ───────────────────────────────────────────────────

  // RF state updates immediately (instant input feedback).
  // IDB write is debounced — no need to persist every keystroke.
  const handleLabelChange = useCallback((value: string): void => {
    if (!node) return
    const updated = { ...node, label: value }
    setNodes(nodes => nodes.map(n =>
      n.id === nodeId ? { ...n, data: updated as unknown as Record<string, unknown> } : n,
    ))
    debouncedWriteIDB(updated)
  }, [node, nodeId, setNodes, debouncedWriteIDB])

  // ─── USES_CUSTOM_TYPE edge helpers ──────────────────────────────

  const ensureUsesCustomTypeEdge = useCallback(async (customTypeId: string): Promise<void> => {
    if (!activeProjectId) return
    const alreadyExists = allEdges.some(e => {
      const d = e.data as { type?: string } | undefined
      return d?.type === EdgeType.USES_CUSTOM_TYPE && e.source === nodeId && e.target === customTypeId
    })
    if (alreadyExists) return

    const edgeId = generateId()
    const edgeRow = {
      id:         edgeId,
      projectId:  activeProjectId,
      fromNodeId: nodeId,
      toNodeId:   customTypeId,
      type:       EdgeType.USES_CUSTOM_TYPE,
      label:      EdgeType.USES_CUSTOM_TYPE,
      fromHandle: '',
      toHandle:   '',
    }
    await db.edges.add(edgeRow)
    setEdges(edges => [
      ...edges,
      {
        id:     edgeId,
        source: nodeId,
        target: customTypeId,
        type:   'usesCustomType' as const,
        data:   edgeRow as unknown as Record<string, unknown>,
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--node-entity-accent)', width: 12, height: 12 },
      },
    ])
    const bc = new BroadcastChannel('archflow-sync')
    bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
    bc.close()
  }, [activeProjectId, allEdges, nodeId, setEdges])

  const cleanupUsesCustomTypeEdge = useCallback(async (customTypeId: string, currentFields: CustomTypeNode['fields']): Promise<void> => {
    if (!activeProjectId) return
    const stillUsed = currentFields.some(f => f.customTypeId === customTypeId || f.arrayCustomTypeId === customTypeId)
    if (stillUsed) return
    const edge = allEdges.find(e => {
      const d = e.data as { type?: string } | undefined
      return d?.type === EdgeType.USES_CUSTOM_TYPE && e.source === nodeId && e.target === customTypeId
    })
    if (!edge) return
    await db.edges.delete(edge.id)
    setEdges(edges => edges.filter(e => e.id !== edge.id))
    const bc = new BroadcastChannel('archflow-sync')
    bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
    bc.close()
  }, [activeProjectId, allEdges, nodeId, setEdges])

  // ─── Fields ─────────────────────────────────────────────────────

  const handleAddField = useCallback(async (
    name:            string,
    type:            JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF',
    entityId:        string | null,
    customTypeId:    string | null,
    subType?:        JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null,
    subEntityId?:    string | null,
    subCustomTypeId?: string | null,
  ): Promise<void> => {
    if (!node) return
    const newField = {
      id:                generateId(),
      name,
      type,
      arraySubType:      type === JavaType.ARRAY ? (subType ?? null) : null,
      arrayEntityTypeId: type === JavaType.ARRAY && subType === 'ENTITY_REF'      ? (subEntityId    ?? null) : null,
      arrayCustomTypeId: type === JavaType.ARRAY && subType === 'CUSTOM_TYPE_REF' ? (subCustomTypeId ?? null) : null,
      entityTypeId:      type === 'ENTITY_REF'      ? entityId     : null,
      customTypeId:      type === 'CUSTOM_TYPE_REF' ? customTypeId : null,
      nullable:          true,
      defaultValue:      '',
      enumValues:        type === JavaType.ENUM
        ? { values: [], columnDefinition: 'VARCHAR(20)' } satisfies EnumValues
        : null,
    }
    const updated: CustomTypeNode = { ...node, fields: [...node.fields, newField] }
    setNodes(nodes => nodes.map(n =>
      n.id === nodeId ? { ...n, data: updated as unknown as Record<string, unknown> } : n,
    ))
    writeToIDB(updated)

    if (type === 'CUSTOM_TYPE_REF' && customTypeId) {
      await ensureUsesCustomTypeEdge(customTypeId)
    }
    if (type === JavaType.ARRAY && subType === 'CUSTOM_TYPE_REF' && subCustomTypeId) {
      await ensureUsesCustomTypeEdge(subCustomTypeId)
    }
  }, [node, nodeId, setNodes, writeToIDB, ensureUsesCustomTypeEdge])

  const handleRemoveField = useCallback(async (fieldId: string): Promise<void> => {
    if (!node) return
    const field = node.fields.find(f => f.id === fieldId)
    const updated: CustomTypeNode = { ...node, fields: node.fields.filter(f => f.id !== fieldId) }
    setNodes(nodes => nodes.map(n =>
      n.id === nodeId ? { ...n, data: updated as unknown as Record<string, unknown> } : n,
    ))
    writeToIDB(updated)

    if (field?.type === 'CUSTOM_TYPE_REF' && field.customTypeId) {
      await cleanupUsesCustomTypeEdge(field.customTypeId, updated.fields)
    }
    if (field?.arrayCustomTypeId) {
      await cleanupUsesCustomTypeEdge(field.arrayCustomTypeId, updated.fields)
    }
  }, [node, nodeId, setNodes, writeToIDB, cleanupUsesCustomTypeEdge])

  const handleFieldTypeChange = useCallback(async (
    fieldId:      string,
    type:         JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF',
    entityId:     string | null,
    customTypeId: string | null,
  ): Promise<void> => {
    if (!node) return
    const oldField = node.fields.find(f => f.id === fieldId)
    const oldCustomTypeId = oldField?.customTypeId ?? null

    const updated: CustomTypeNode = {
      ...node,
      fields: node.fields.map(f => {
        if (f.id !== fieldId) return f
        return {
          ...f,
          type,
          entityTypeId:      type === 'ENTITY_REF'      ? entityId     : null,
          customTypeId:      type === 'CUSTOM_TYPE_REF' ? customTypeId : null,
          arraySubType:      type === JavaType.ARRAY ? (f.arraySubType      ?? null) : null,
          arrayEntityTypeId: type === JavaType.ARRAY ? (f.arrayEntityTypeId ?? null) : null,
          arrayCustomTypeId: type === JavaType.ARRAY ? (f.arrayCustomTypeId ?? null) : null,
          enumValues: type === JavaType.ENUM
            ? (f.enumValues ?? { values: [], columnDefinition: 'VARCHAR(20)' })
            : null,
        }
      }),
    }
    setNodes(nodes => nodes.map(n =>
      n.id === nodeId ? { ...n, data: updated as unknown as Record<string, unknown> } : n,
    ))
    writeToIDB(updated)

    if (type === 'CUSTOM_TYPE_REF' && customTypeId) {
      await ensureUsesCustomTypeEdge(customTypeId)
    }
    if (oldCustomTypeId && oldCustomTypeId !== customTypeId) {
      await cleanupUsesCustomTypeEdge(oldCustomTypeId, updated.fields)
    }
  }, [node, nodeId, setNodes, writeToIDB, ensureUsesCustomTypeEdge, cleanupUsesCustomTypeEdge])

  const handleFieldArraySubTypeChange = useCallback(async (
    fieldId:      string,
    subType:      JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null,
    entityId:     string | null,
    customTypeId: string | null,
  ): Promise<void> => {
    if (!node) return
    const oldField         = node.fields.find(f => f.id === fieldId)
    const oldCustomTypeId  = oldField?.arrayCustomTypeId ?? null

    const updated: CustomTypeNode = {
      ...node,
      fields: node.fields.map(f => {
        if (f.id !== fieldId) return f
        return {
          ...f,
          arraySubType:      subType,
          arrayEntityTypeId: subType === 'ENTITY_REF'      ? entityId     : null,
          arrayCustomTypeId: subType === 'CUSTOM_TYPE_REF' ? customTypeId : null,
        }
      }),
    }
    setNodes(nodes => nodes.map(n =>
      n.id === nodeId ? { ...n, data: updated as unknown as Record<string, unknown> } : n,
    ))
    writeToIDB(updated)

    if (subType === 'CUSTOM_TYPE_REF' && customTypeId) {
      await ensureUsesCustomTypeEdge(customTypeId)
    }
    if (oldCustomTypeId && oldCustomTypeId !== customTypeId) {
      await cleanupUsesCustomTypeEdge(oldCustomTypeId, updated.fields)
    }
  }, [node, nodeId, setNodes, writeToIDB, ensureUsesCustomTypeEdge, cleanupUsesCustomTypeEdge])

  const handleFieldNameChange = useCallback((fieldId: string, name: string): void => {
    applyUpdate(n => ({
      ...n,
      fields: n.fields.map(f => f.id === fieldId ? { ...f, name } : f),
    }))
  }, [applyUpdate])

  const handleAddEnumValue = useCallback((fieldId: string, value: string): void => {
    const trimmed = value.trim().toUpperCase()
    if (!trimmed) return
    applyUpdate(n => ({
      ...n,
      fields: n.fields.map(f => {
        if (f.id !== fieldId || !f.enumValues) return f
        if (f.enumValues.values.includes(trimmed)) return f
        return { ...f, enumValues: { ...f.enumValues, values: [...f.enumValues.values, trimmed] } }
      }),
    }))
  }, [applyUpdate])

  const handleRemoveEnumValue = useCallback((fieldId: string, index: number): void => {
    applyUpdate(n => ({
      ...n,
      fields: n.fields.map(f => {
        if (f.id !== fieldId || !f.enumValues) return f
        return { ...f, enumValues: { ...f.enumValues, values: f.enumValues.values.filter((_, i) => i !== index) } }
      }),
    }))
  }, [applyUpdate])

  // ─── AI Prompt ──────────────────────────────────────────────────

  const handleAIPromptChange = useCallback((field: keyof AIPrompt, value: string | boolean): void => {
    if (!node) return
    const updated = { ...node, aiPrompt: { ...node.aiPrompt, [field]: value } }
    setNodes(nodes => nodes.map(n =>
      n.id === nodeId ? { ...n, data: updated as unknown as Record<string, unknown> } : n,
    ))
    debouncedWriteIDB(updated)
  }, [node, nodeId, setNodes, debouncedWriteIDB])

  const handleAIGenerateToggle = useCallback((): void => {
    applyUpdate(n => ({
      ...n,
      aiPrompt: { ...n.aiPrompt, aiGenerate: !n.aiPrompt.aiGenerate },
    }))
  }, [applyUpdate])

  // ─── Entity/CustomType options for FieldTypeSelect ───────────────
  const { entityOptions, customTypeOptions } = useFieldTypeSelect(nodeId, 'entity')

  // ─── Lifecycle ──────────────────────────────────────────────────

  const handleClose = useCallback((): void => {
    clearSelection()
  }, [clearSelection])

  const handleDelete = useCallback((): void => {
    if (!node || !activeProjectId) return
    const confirmed = window.confirm(`Delete custom type "${node.label}"?`)
    if (!confirmed) return
    deleteNode({ nodeId: node.id, projectId: activeProjectId })
    setNodes(nodes => nodes.filter(n => n.id !== nodeId))
    clearSelection()
  }, [node, activeProjectId, deleteNode, setNodes, nodeId, clearSelection])

  return {
    node,
    handleLabelChange,
    handleAddField,
    handleRemoveField,
    handleFieldTypeChange,
    handleFieldArraySubTypeChange,
    handleFieldNameChange,
    handleAddEnumValue,
    handleRemoveEnumValue,
    handleAIPromptChange,
    handleAIGenerateToggle,
    entityOptions,
    customTypeOptions,
    handleClose,
    handleDelete,
  }
}
