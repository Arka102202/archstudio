import { useCallback, useState } from 'react'
import { useNodes, useEdges, useReactFlow } from '@xyflow/react'
import { useCanvasStore } from '@store'
import { useProjectStore } from '@store'
import { useUpdateNode, useDeleteNode } from '@service'
import { useDebounce } from '@hooks'
import { NodeType, EdgeType } from '@entity'
import { db } from '@db'
import type { DBNode, DBType, DDLAuto, AIPrompt } from '@entity'
import type { DBNodeData } from '@components/nodes/DBNode'
import type { DBInspectorProps, DBInspectorHook, ConnectedTable } from './types'

// ─── Hook ─────────────────────────────────────────────────────────

export const useDBInspector = (
  { nodeId }: DBInspectorProps,
): DBInspectorHook => {
  const clearSelection  = useCanvasStore(s => s.clearSelection)
  const activeProjectId = useProjectStore(s => s.activeProjectId)
  const rfNodes         = useNodes()
  const allEdges        = useEdges()
  const { setNodes, setEdges } = useReactFlow()

  const { mutate: updateNode } = useUpdateNode()
  const { mutate: deleteNode } = useDeleteNode()

  // Local UI state
  const [showPassword, setShowPassword] = useState(false)

  // Derive current node from RF state
  const rfNode = rfNodes.find(n => n.id === nodeId)
  const node   = (rfNode?.data as unknown as DBNode | undefined) ?? null

  // ─── Core update helper ─────────────────────────────────────────

  const writeToIDB = useCallback((updated: DBNode): void => {
    if (!activeProjectId) return
    updateNode({
      id:        updated.id,
      projectId: activeProjectId,
      type:      NodeType.DB,
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
    updater:  (prev: DBNode) => DBNode,
    debounce: 'fast' | 'slow' = 'fast',
  ): void => {
    if (!node) return
    const updated = updater(node)

    setNodes(nodes => nodes.map(n =>
      n.id === nodeId ? { ...n, data: updated as unknown as DBNodeData } : n,
    ))

    if (debounce === 'slow') debouncedWriteSlow(updated)
    else debouncedWrite(updated)
  }, [node, nodeId, setNodes, debouncedWrite, debouncedWriteSlow])

  // ─── Identity ───────────────────────────────────────────────────

  const handleLabelChange = useCallback((value: string): void => {
    applyUpdate(n => ({ ...n, label: value }))
  }, [applyUpdate])

  const handleDbNameChange = useCallback((value: string): void => {
    applyUpdate(n => ({ ...n, dbName: value }))
  }, [applyUpdate])

  const handleDbTypeChange = useCallback((value: DBType): void => {
    applyUpdate(n => ({ ...n, dbType: value }))
  }, [applyUpdate])

  // ─── Connection fields ──────────────────────────────────────────

  const handleHostChange = useCallback((value: string): void => {
    applyUpdate(n => ({ ...n, host: value }))
  }, [applyUpdate])

  const handlePortChange = useCallback((value: string): void => {
    const parsed = parseInt(value, 10)
    if (isNaN(parsed)) return
    applyUpdate(n => ({ ...n, port: parsed }))
  }, [applyUpdate])

  const handleSchemaChange = useCallback((value: string): void => {
    applyUpdate(n => ({ ...n, schema: value }))
  }, [applyUpdate])

  const handleUsernameChange = useCallback((value: string): void => {
    applyUpdate(n => ({ ...n, username: value }))
  }, [applyUpdate])

  const handlePasswordChange = useCallback((value: string): void => {
    applyUpdate(n => ({ ...n, password: value }), 'slow')
  }, [applyUpdate])

  const toggleShowPassword = useCallback((): void => {
    setShowPassword(prev => !prev)
  }, [])

  // ─── Config ─────────────────────────────────────────────────────

  const handleDdlAutoChange = useCallback((value: DDLAuto): void => {
    applyUpdate(n => ({ ...n, config: { ...n.config, ddlAuto: value } }))
  }, [applyUpdate])

  const handlePoolSizeChange = useCallback((value: string): void => {
    const parsed = parseInt(value, 10)
    if (isNaN(parsed)) return
    applyUpdate(n => ({ ...n, config: { ...n.config, poolSize: parsed } }))
  }, [applyUpdate])

  const handleShowSqlToggle = useCallback((): void => {
    applyUpdate(n => ({ ...n, config: { ...n.config, showSql: !n.config.showSql } }))
  }, [applyUpdate])

  const handleFlywayToggle = useCallback((): void => {
    applyUpdate(n => ({ ...n, config: { ...n.config, flyway: !n.config.flyway } }))
  }, [applyUpdate])

  const handleRedisToggle = useCallback((): void => {
    applyUpdate(n => ({ ...n, config: { ...n.config, redis: !n.config.redis } }))
  }, [applyUpdate])

  // ─── Connections ────────────────────────────────────────────────
  // DBNode is the TARGET of CONNECTS_TO edges (TableNode → DBNode)

  const connectedTables: ConnectedTable[] = allEdges
    .filter(e => {
      const edgeData = e.data as { type?: string } | undefined
      return edgeData?.type === EdgeType.CONNECTS_TO && e.target === nodeId
    })
    .map(e => {
      const tableRFNode = rfNodes.find(n => n.id === e.source)
      const tableData   = tableRFNode?.data as { label?: string } | undefined
      return {
        edgeId:     e.id,
        tableId:    e.source,
        tableLabel: tableData?.label ?? 'Table',
      }
    })

  const handleDisconnectTable = useCallback(async (edgeId: string): Promise<void> => {
    await db.edges.delete(edgeId)
    setEdges(edges => edges.filter(e => e.id !== edgeId))
    if (activeProjectId) {
      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.close()
    }
  }, [setEdges, activeProjectId])

  // ─── AI Prompt (node-level) ──────────────────────────────────────

  const handleAIPromptChange = useCallback((field: keyof AIPrompt, value: string): void => {
    applyUpdate(
      n => ({ ...n, aiPrompt: { ...n.aiPrompt, [field]: value } }),
      'slow',
    )
  }, [applyUpdate])

  const handleAIGenerateToggle = useCallback((): void => {
    applyUpdate(n => ({
      ...n,
      aiPrompt: { ...n.aiPrompt, aiGenerate: !n.aiPrompt.aiGenerate },
    }))
  }, [applyUpdate])

  // ─── Lifecycle ──────────────────────────────────────────────────

  const handleClose = useCallback((): void => {
    clearSelection()
  }, [clearSelection])

  const handleDelete = useCallback((): void => {
    if (!node || !activeProjectId) return
    const confirmed = window.confirm(`Delete "${node.label}"? This cannot be undone.`)
    if (!confirmed) return

    // Delete all CONNECTS_TO edges where this DBNode is the target
    const connectsToEdges = allEdges.filter(e => {
      const edgeData = e.data as { type?: string } | undefined
      return edgeData?.type === EdgeType.CONNECTS_TO && e.target === nodeId
    })

    void (async (): Promise<void> => {
      // Delete edges from IDB
      await Promise.all(connectsToEdges.map(e => db.edges.delete(e.id)))

      // Delete node from IDB
      deleteNode({ nodeId: node.id, projectId: activeProjectId })

      // Remove from RF state
      setNodes(nodes => nodes.filter(n => n.id !== nodeId))
      setEdges(edges => edges.filter(e => !connectsToEdges.some(ce => ce.id === e.id)))

      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.close()

      clearSelection()
    })()
  }, [node, activeProjectId, nodeId, allEdges, deleteNode, setNodes, setEdges, clearSelection])

  return {
    node,
    handleLabelChange,
    handleDbNameChange,
    handleDbTypeChange,
    handleHostChange,
    handlePortChange,
    handleSchemaChange,
    handleUsernameChange,
    handlePasswordChange,
    showPassword,
    toggleShowPassword,
    handleDdlAutoChange,
    handlePoolSizeChange,
    handleShowSqlToggle,
    handleFlywayToggle,
    handleRedisToggle,
    connectedTables,
    handleDisconnectTable,
    handleAIPromptChange,
    handleAIGenerateToggle,
    handleClose,
    handleDelete,
  }
}
