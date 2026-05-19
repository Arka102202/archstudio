import { useCallback, useState } from 'react'
import { useNodes, useEdges, useReactFlow } from '@xyflow/react'
import { useCanvasStore } from '@store'
import { useProjectStore } from '@store'
import { useUpdateNode, useDeleteNode } from '@service'
import { useDebounce } from '@hooks'
import { NodeType, EdgeType, JavaType, type DbQueryParam } from '@entity'
import { generateId } from '@utils'
import { emptyAIPrompt } from '@entity/AIPrompt'
import { db } from '@db'
import type {
  TableNode,
  CustomQuery,
  QueryType,
  QueryReturnType,
  CacheConfig,
  AIPrompt,
} from '@entity'
import { CacheOp } from '@entity'
import type { TableInspectorProps, TableInspectorHook, ConnectedEntity, ConnectedDBEntry, ConnectedDTO, ConnectedSiblingTable } from './types'

// ─── Auto-format tableName to snake_case ──────────────────────────

const toSnakeCase = (value: string): string =>
  value
    .toLowerCase()
    .replace(/([A-Z])/g, '_$1')
    .replace(/\s+/g, '_')
    .replace(/^_/, '')

// ─── Hook ─────────────────────────────────────────────────────────

export const useTableInspector = (
  { nodeId }: TableInspectorProps,
): TableInspectorHook => {
  const clearSelection  = useCanvasStore(s => s.clearSelection)
  const activeProjectId = useProjectStore(s => s.activeProjectId)
  const rfNodes         = useNodes()
  const allEdges        = useEdges()
  const { setNodes, setEdges } = useReactFlow()

  const { mutate: updateNode } = useUpdateNode()
  const { mutate: deleteNode } = useDeleteNode()

  // Local UI state
  const [expandedQueryId, setExpandedQueryId] = useState<string | null>(null)

  // Derive current node from RF state
  const rfNode = rfNodes.find(n => n.id === nodeId)
  const node   = (rfNode?.data as unknown as TableNode | undefined) ?? null

  // ─── Core update helper ─────────────────────────────────────────

  const writeToIDB = useCallback((updated: TableNode): void => {
    if (!activeProjectId) return
    updateNode({
      id:        updated.id,
      projectId: activeProjectId,
      type:      NodeType.TABLE,
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
    updater:  (prev: TableNode) => TableNode,
    debounce: 'fast' | 'slow' = 'fast',
  ): void => {
    if (!node) return
    // Normalize legacy queries that may be missing fields (e.g. id, params)
    const normalizedNode: TableNode = {
      ...node,
      customQueries: node.customQueries.map(q => ({
        id:             q.id             ?? generateId(),
        methodName:     q.methodName     ?? '',
        description:    q.description    ?? '',
        targetEntityId: q.targetEntityId ?? null,
        type:           q.type           ?? null,
        queryString:    q.queryString    ?? null,
        aiPrompt:       q.aiPrompt       ?? null,
        params:         q.params         ?? [],
        returnType:     q.returnType     ?? null,
        nativeQuery:    q.nativeQuery    ?? false,
        modifying:      q.modifying      ?? false,
        cache:          q.cache          ?? null,
      })),
    }
    const updated = updater(normalizedNode)

    setNodes(nodes => nodes.map(n =>
      n.id === nodeId ? { ...n, data: updated as unknown as Record<string, unknown> } : n,
    ))

    if (debounce === 'slow') debouncedWriteSlow(updated)
    else debouncedWrite(updated)
  }, [node, nodeId, setNodes, debouncedWrite, debouncedWriteSlow])

  // ─── Connections ────────────────────────────────────────────────
  // Source of truth: node.entityId / node.dbNodeId (set by applyStoredInEdge /
  // applyConnectsToEdge immediately when the edge is drawn).
  // The edge lookup is secondary — used only to get the edgeId for disconnect.

  const storedInEdge = allEdges.find(e => {
    const edgeData = e.data as { type?: string } | undefined
    return edgeData?.type === EdgeType.STORED_IN && e.target === nodeId
  })

  const connectsToEdge = allEdges.find(e => {
    const edgeData = e.data as { type?: string } | undefined
    return edgeData?.type === EdgeType.CONNECTS_TO && e.source === nodeId
  })

  // Entity connection — primary: node.entityId; fallback: edge source
  const resolvedEntityId = node?.entityId ?? storedInEdge?.source ?? null

  const connectedEntity: ConnectedEntity | null = (() => {
    if (!resolvedEntityId) return null
    const entityRFNode = rfNodes.find(n => n.id === resolvedEntityId)
    const entityData   = entityRFNode?.data as { label?: string } | undefined
    return {
      edgeId:      storedInEdge?.id ?? '',
      entityId:    resolvedEntityId,
      entityLabel: entityData?.label ?? 'Entity',
    }
  })()

  // DB connection — primary: node.dbNodeId; fallback: edge target
  const resolvedDbId = node?.dbNodeId ?? connectsToEdge?.target ?? null

  const connectedDB: ConnectedDBEntry | null = (() => {
    if (!resolvedDbId) return null
    const dbRFNode = rfNodes.find(n => n.id === resolvedDbId)
    const dbData   = dbRFNode?.data as { dbName?: string; label?: string } | undefined
    return {
      edgeId:  connectsToEdge?.id ?? '',
      dbId:    resolvedDbId,
      dbLabel: dbData?.dbName ?? dbData?.label ?? 'Database',
    }
  })()

  // ─── Direct DTO connections (edges to/from this table where the other node is a DTO) ──

  const connectedDTOs: ConnectedDTO[] = allEdges
    .filter(e => e.source === nodeId || e.target === nodeId)
    .flatMap(e => {
      const otherId   = e.source === nodeId ? e.target : e.source
      const otherNode = rfNodes.find(n => n.id === otherId)
      if (otherNode?.type !== 'dto') return []
      const dtoData = otherNode.data as { label?: string; purpose?: string }
      return [{
        edgeId:     e.id,
        dtoId:      otherId,
        dtoLabel:   dtoData.label   ?? 'DTO',
        dtoPurpose: dtoData.purpose ?? '',
      }]
    })

  // ─── Direct Table connections (edges to/from this table where the other node is a table) ──

  const connectedTables: ConnectedSiblingTable[] = allEdges
    .filter(e => {
      const edgeData = e.data as { type?: string } | undefined
      // Exclude the STORED_IN (entity→table) and CONNECTS_TO (table→db) already shown in Section 2
      return (e.source === nodeId || e.target === nodeId)
        && edgeData?.type !== EdgeType.STORED_IN
        && edgeData?.type !== EdgeType.CONNECTS_TO
    })
    .flatMap(e => {
      const otherId   = e.source === nodeId ? e.target : e.source
      const otherNode = rfNodes.find(n => n.id === otherId)
      if (otherNode?.type !== 'table') return []
      const tableData = otherNode.data as { tableName?: string; label?: string } | undefined
      return [{
        edgeId:     e.id,
        tableId:    otherId,
        tableLabel: tableData?.tableName ?? tableData?.label ?? 'Table',
      }]
    })

  // Delete a DERIVED_FROM edge (disconnect DTO from entity)

  const handleDeleteEdge = useCallback(async (edgeId: string): Promise<void> => {
    await db.edges.delete(edgeId)
    setEdges(edges => edges.filter(e => e.id !== edgeId))
    if (activeProjectId) {
      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.close()
    }
  }, [setEdges, activeProjectId])

  // Disconnect a sibling STORED_IN edge (clear sibling table's entityId)

  const handleDisconnectTable = useCallback(async (edgeId: string): Promise<void> => {
    const edge = allEdges.find(e => e.id === edgeId)
    await db.edges.delete(edgeId)
    setEdges(edges => edges.filter(e => e.id !== edgeId))
    if (edge) {
      const siblingRFNode = rfNodes.find(n => n.id === edge.target)
      if (siblingRFNode) {
        const siblingData = siblingRFNode.data as unknown as import('@entity').TableNode
        const updated = { ...siblingData, entityId: null }
        setNodes(nodes => nodes.map(n =>
          n.id === edge.target ? { ...n, data: updated as unknown as Record<string, unknown> } : n,
        ))
        void db.nodes.update(edge.target, { data: JSON.stringify(updated), updatedAt: Date.now() })
      }
    }
    if (activeProjectId) {
      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
      bc.close()
    }
  }, [allEdges, rfNodes, setEdges, setNodes, activeProjectId])

  const handleDisconnectEntity = useCallback(async (edgeId: string): Promise<void> => {
    await db.edges.delete(edgeId)
    setEdges(edges => edges.filter(e => e.id !== edgeId))

    // Set table.entityId = null
    applyUpdate(n => ({ ...n, entityId: null }))

    if (activeProjectId) {
      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
      bc.close()
    }
  }, [setEdges, applyUpdate, activeProjectId])

  const handleDisconnectDB = useCallback(async (edgeId: string): Promise<void> => {
    await db.edges.delete(edgeId)
    setEdges(edges => edges.filter(e => e.id !== edgeId))

    // Set table.dbNodeId = null
    applyUpdate(n => ({ ...n, dbNodeId: null }))

    if (activeProjectId) {
      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
      bc.close()
    }
  }, [setEdges, applyUpdate, activeProjectId])

  // ─── Identity ───────────────────────────────────────────────────

  const handleLabelChange = useCallback((value: string): void => {
    applyUpdate(n => ({ ...n, label: value }))
  }, [applyUpdate])

  const handleTableNameChange = useCallback((value: string): void => {
    applyUpdate(n => ({ ...n, tableName: toSnakeCase(value) }))
  }, [applyUpdate])

  // ─── Query helpers ───────────────────────────────────────────────

  const updateQuery = useCallback((
    queryId: string,
    updater: (prev: CustomQuery) => CustomQuery,
    debounce: 'fast' | 'slow' = 'fast',
  ): void => {
    applyUpdate(n => ({
      ...n,
      customQueries: n.customQueries.map(q =>
        q.id === queryId ? updater(q) : q,
      ),
    }), debounce)
  }, [applyUpdate])

  // ─── Custom query handlers ───────────────────────────────────────

  const handleAddQuery = useCallback((): void => {
    const newQuery: CustomQuery = {
      id:             generateId(),
      methodName:     'newQuery',
      description:    '',
      targetEntityId: null,
      type:           null,
      queryString:    null,
      aiPrompt:       emptyAIPrompt(),
      params:         [],
      returnType:     null,
      nativeQuery:    false,
      modifying:      false,
      cache:          null,
    }
    applyUpdate(n => ({ ...n, customQueries: [...n.customQueries, newQuery] }))
    setExpandedQueryId(newQuery.id)
  }, [applyUpdate])

  const handleRemoveQuery = useCallback((queryId: string): void => {
    applyUpdate(n => ({
      ...n,
      customQueries: n.customQueries.filter(q => q.id !== queryId),
    }))
    setExpandedQueryId(prev => (prev === queryId ? null : prev))
  }, [applyUpdate])

  const handleQueryMethodNameChange = useCallback((queryId: string, value: string): void => {
    updateQuery(queryId, q => ({ ...q, methodName: value }))
  }, [updateQuery])

  const handleQueryDescriptionChange = useCallback((queryId: string, value: string): void => {
    updateQuery(queryId, q => ({ ...q, description: value }), 'slow')
  }, [updateQuery])

  const handleQueryTypeChange = useCallback((queryId: string, value: QueryType | null): void => {
    updateQuery(queryId, q => ({ ...q, type: value }))
  }, [updateQuery])

  const handleQueryStringChange = useCallback((queryId: string, value: string): void => {
    updateQuery(queryId, q => ({ ...q, queryString: value }), 'slow')
  }, [updateQuery])

  const handleQueryTargetEntityChange = useCallback((queryId: string, entityId: string | null): void => {
    updateQuery(queryId, q => ({ ...q, targetEntityId: entityId }))
  }, [updateQuery])

  const handleQueryNativeToggle = useCallback((queryId: string): void => {
    updateQuery(queryId, q => ({ ...q, nativeQuery: !q.nativeQuery }))
  }, [updateQuery])

  const handleQueryModifyingToggle = useCallback((queryId: string): void => {
    updateQuery(queryId, q => ({ ...q, modifying: !q.modifying }))
  }, [updateQuery])

  const handleAddQueryParam = useCallback((
    queryId:          string,
    name:             string,
    type:             JavaType | 'CUSTOM_TYPE_REF',
    arraySubType?:    JavaType | 'CUSTOM_TYPE_REF' | null,
    enumValues?:      string[] | null,
    customTypeId?:    string | null,
    arrayCustomTypeId?: string | null,
  ): void => {
    const trimmed = name.trim()
    if (!trimmed) return
    const param: DbQueryParam = {
      name:              trimmed,
      type,
      customTypeId:      type === 'CUSTOM_TYPE_REF' ? (customTypeId ?? null) : null,
      arraySubType:      type === JavaType.ARRAY ? (arraySubType ?? null) : null,
      arrayCustomTypeId: type === JavaType.ARRAY ? (arrayCustomTypeId ?? null) : null,
      isCollection:      false,
      enumValues:        type === JavaType.ENUM ? (enumValues ?? null) : null,
    }
    updateQuery(queryId, q => ({ ...q, params: [...q.params, param] }))
  }, [updateQuery])

  const handleRemoveQueryParam = useCallback((queryId: string, paramIdx: number): void => {
    updateQuery(queryId, q => ({
      ...q,
      params: q.params.filter((_, i) => i !== paramIdx),
    }))
  }, [updateQuery])

  const handleQueryParamSubTypeChange = useCallback((queryId: string, paramIdx: number, subType: JavaType): void => {
    updateQuery(queryId, q => ({
      ...q,
      params: q.params.map((p, i) => i === paramIdx ? { ...p, arraySubType: subType } : p),
    }))
  }, [updateQuery])

  const handleQueryReturnTypeChange = useCallback((queryId: string, partial: Partial<QueryReturnType>): void => {
    updateQuery(queryId, q => ({
      ...q,
      returnType: q.returnType !== null
        ? { ...q.returnType, ...partial }
        : {
            entityId:        '',
            isList:          false,
            isPage:          false,
            isOptional:      false,
            projectionClass: '',
            ...partial,
          },
    }))
  }, [updateQuery])

  const handleQueryCacheToggle = useCallback((queryId: string): void => {
    updateQuery(queryId, q => {
      if (q.cache === null) {
        const defaultCache: CacheConfig = {
          enabled:    true,
          cacheName:  q.methodName,
          ttlSeconds: 300,
          operation:  CacheOp.CACHEABLE,
        }
        return { ...q, cache: defaultCache }
      }
      return { ...q, cache: { ...q.cache, enabled: !q.cache.enabled } }
    })
  }, [updateQuery])

  const handleQueryCacheFieldChange = useCallback((queryId: string, field: keyof CacheConfig, value: unknown): void => {
    updateQuery(queryId, q => {
      if (!q.cache) return q
      return { ...q, cache: { ...q.cache, [field]: value } }
    }, 'slow')
  }, [updateQuery])

  const handleQueryAIPromptChange = useCallback((queryId: string, field: keyof AIPrompt, value: string | boolean): void => {
    updateQuery(queryId, q => ({
      ...q,
      aiPrompt: q.aiPrompt !== null
        ? { ...q.aiPrompt, [field]: value }
        : {
            description:       '',
            businessRules:     '',
            edgeCases:         '',
            expectedBehaviour: '',
            aiGenerate:        true,
            [field]:           value,
          },
    }), 'slow')
  }, [updateQuery])

  // ─── AI Prompt (node-level) ──────────────────────────────────────

  const handleAIPromptChange = useCallback((field: keyof AIPrompt, value: string): void => {
    applyUpdate(n => ({ ...n, aiPrompt: { ...n.aiPrompt, [field]: value } }), 'slow')
  }, [applyUpdate])

  const handleAIGenerateToggle = useCallback((): void => {
    applyUpdate(n => ({ ...n, aiPrompt: { ...n.aiPrompt, aiGenerate: !n.aiPrompt.aiGenerate } }))
  }, [applyUpdate])

  // ─── Lifecycle ──────────────────────────────────────────────────

  const handleClose = useCallback((): void => {
    clearSelection()
  }, [clearSelection])

  const handleDelete = useCallback((): void => {
    if (!node || !activeProjectId) return
    const confirmed = window.confirm(`Delete "${node.label}"? This cannot be undone.`)
    if (!confirmed) return

    // Find all edges involving this node
    const relatedEdges = allEdges.filter(e => e.source === nodeId || e.target === nodeId)

    void (async (): Promise<void> => {
      // Delete edges from IDB
      await Promise.all(relatedEdges.map(e => db.edges.delete(e.id)))

      // Delete node from IDB
      deleteNode({ nodeId: node.id, projectId: activeProjectId })

      // Remove from RF state
      setNodes(nodes => nodes.filter(n => n.id !== nodeId))
      setEdges(edges => edges.filter(e => e.source !== nodeId && e.target !== nodeId))

      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.close()

      clearSelection()
    })()
  }, [node, activeProjectId, nodeId, allEdges, deleteNode, setNodes, setEdges, clearSelection])

  return {
    node,
    connectedEntity,
    connectedDB,
    handleDisconnectEntity,
    handleDisconnectDB,
    connectedDTOs,
    connectedTables,
    handleDeleteEdge,
    handleDisconnectTable,
    handleLabelChange,
    handleTableNameChange,
    expandedQueryId,
    setExpandedQueryId,
    handleAddQuery,
    handleRemoveQuery,
    handleQueryMethodNameChange,
    handleQueryDescriptionChange,
    handleQueryTypeChange,
    handleQueryStringChange,
    handleQueryTargetEntityChange,
    handleQueryNativeToggle,
    handleQueryModifyingToggle,
    handleAddQueryParam,
    handleRemoveQueryParam,
    handleQueryParamSubTypeChange,
    handleQueryReturnTypeChange,
    handleQueryCacheToggle,
    handleQueryCacheFieldChange,
    handleQueryAIPromptChange,
    handleAIPromptChange,
    handleAIGenerateToggle,
    handleClose,
    handleDelete,
  }
}
