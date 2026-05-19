import { useCallback } from 'react'
import { useNodes, useEdges, useReactFlow } from '@xyflow/react'
import { useCanvasStore, useProjectStore } from '@store'
import { useUpdateNode } from '@service'
import { useDebounce } from '@hooks'
import { NodeType, EdgeType } from '@entity'
import { generateId as _generateId } from '@utils'
import { db } from '@db'
import type { ControllerNode, ServiceNode, APIEndpointNode, AIPrompt, ErrorDefinition } from '@entity'
import type {
  ControllerInspectorProps,
  ControllerInspectorHook,
  ConnectedService,
  ConnectedEndpoint,
} from './types'

// Suppress unused-variable warning — generateId kept for future use
void _generateId

// ─── Hook ─────────────────────────────────────────────────────────

export const useControllerInspector = (
  { nodeId }: ControllerInspectorProps,
): ControllerInspectorHook => {
  const clearSelection  = useCanvasStore(s => s.clearSelection)
  const activeProjectId = useProjectStore(s => s.activeProjectId)
  const rfNodes         = useNodes()
  const allEdges        = useEdges()
  const { setNodes, setEdges } = useReactFlow()

  const { mutate: updateNode } = useUpdateNode()

  // Derive current node from RF state
  const rfNode = rfNodes.find(n => n.id === nodeId)
  const node   = (rfNode?.data as unknown as ControllerNode | undefined) ?? null

  // ─── Resolve auth rule name from authRuleId ────────────────────────

  const authRuleRFNode = node?.authRuleId
    ? rfNodes.find(n => n.id === node.authRuleId)
    : null

  const authRuleName: string | null = authRuleRFNode
    ? ((authRuleRFNode.data as { ruleName?: string }).ruleName ?? null)
    : null

  // ─── Resolve connected service via INVOKES edge ────────────────────

  const invokesEdge = allEdges.find(e => {
    const edgeData = e.data as { type?: string } | undefined
    return edgeData?.type === EdgeType.INVOKES && e.source === nodeId
  })

  const connectedServiceRFNode = invokesEdge
    ? rfNodes.find(n => n.id === invokesEdge.target)
    : null

  const connectedService: ConnectedService | null = connectedServiceRFNode && invokesEdge
    ? {
        edgeId: invokesEdge.id,
        id:     connectedServiceRFNode.id,
        label:  (connectedServiceRFNode.data as unknown as ServiceNode).label,
      }
    : null

  // ─── Resolve connected endpoints via ROUTES_TO edges ──────────────
  // ROUTES_TO: source = endpoint, target = controller

  const connectedEndpoints: ConnectedEndpoint[] = allEdges
    .filter(e => {
      const edgeData = e.data as { type?: string } | undefined
      return edgeData?.type === EdgeType.ROUTES_TO && e.target === nodeId
    })
    .flatMap(e => {
      const n = rfNodes.find(n => n.id === e.source)
      if (!n) return []
      const ep = n.data as unknown as APIEndpointNode
      return [{
        edgeId: e.id,
        id:     n.id,
        label:  ep.label,
        method: ep.method,
        path:   ep.path,
      }]
    })

  // ─── Core update helper ─────────────────────────────────────────

  const writeToIDB = useCallback((updated: ControllerNode): void => {
    if (!activeProjectId) return
    updateNode({
      id:        updated.id,
      projectId: activeProjectId,
      type:      NodeType.CONTROLLER,
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
    updater:  (prev: ControllerNode) => ControllerNode,
    debounce: 'fast' | 'slow' = 'fast',
  ): void => {
    if (!node) return
    const updated = updater(node)

    setNodes(nodes => nodes.map(n =>
      n.id === nodeId ? { ...n, data: updated as unknown as Record<string, unknown> } : n,
    ))

    if (debounce === 'slow') debouncedWriteSlow(updated)
    else debouncedWrite(updated)
  }, [node, nodeId, setNodes, debouncedWrite, debouncedWriteSlow])

  // ─── Identity ────────────────────────────────────────────────────

  const handleLabelChange = useCallback((value: string): void => {
    applyUpdate(n => ({ ...n, label: value }))
  }, [applyUpdate])

  const handleBasePathChange = useCallback((value: string): void => {
    const normalised = value === '' ? '/' : value.startsWith('/') ? value : `/${value}`
    applyUpdate(n => ({ ...n, basePath: normalised }))
  }, [applyUpdate])

  // ─── Connection — disconnect service ─────────────────────────────

  const handleDisconnectService = useCallback((): void => {
    if (!connectedService || !activeProjectId) return
    const edgeId = connectedService.edgeId

    void (async (): Promise<void> => {
      await db.edges.delete(edgeId)
      setEdges(edges => edges.filter(e => e.id !== edgeId))

      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.close()
    })()
  }, [connectedService, activeProjectId, setEdges])

  // ─── Connection — disconnect endpoint ────────────────────────────

  const handleDisconnectEndpoint = useCallback((edgeId: string): void => {
    if (!activeProjectId) return

    void (async (): Promise<void> => {
      await db.edges.delete(edgeId)
      setEdges(edges => edges.filter(e => e.id !== edgeId))

      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.close()
    })()
  }, [activeProjectId, setEdges])

  // ─── Config ──────────────────────────────────────────────────────

  const handleCrossOriginToggle = useCallback((): void => {
    applyUpdate(n => ({ ...n, config: { ...n.config, crossOrigin: !n.config.crossOrigin } }))
  }, [applyUpdate])

  const handleApiVersionChange = useCallback((value: string): void => {
    applyUpdate(n => ({
      ...n,
      config: { ...n.config, apiVersion: value.trim() === '' ? null : value.trim() },
    }))
  }, [applyUpdate])

  const handleRequestLoggingToggle = useCallback((): void => {
    applyUpdate(n => ({ ...n, config: { ...n.config, requestLogging: !n.config.requestLogging } }))
  }, [applyUpdate])

  // ─── Error handling ──────────────────────────────────────────────

  const handleIncludeTimestampToggle = useCallback((): void => {
    applyUpdate(n => ({
      ...n,
      errorHandlerConfig: {
        ...n.errorHandlerConfig,
        includeTimestamp: !n.errorHandlerConfig.includeTimestamp,
      },
    }))
  }, [applyUpdate])

  const handleIncludeRequestPathToggle = useCallback((): void => {
    applyUpdate(n => ({
      ...n,
      errorHandlerConfig: {
        ...n.errorHandlerConfig,
        includeRequestPath: !n.errorHandlerConfig.includeRequestPath,
      },
    }))
  }, [applyUpdate])

  const handleErrorsChange = useCallback((updated: ErrorDefinition[]): void => {
    applyUpdate(n => ({
      ...n,
      errorHandlerConfig: { ...n.errorHandlerConfig, errors: updated },
    }))
  }, [applyUpdate])

  // ─── Swagger tags ────────────────────────────────────────────────

  const handleAddSwaggerTag = useCallback((tag: string): void => {
    const trimmed = tag.trim()
    if (!trimmed) return
    applyUpdate(n => {
      if (n.swaggerTags.includes(trimmed)) return n
      return { ...n, swaggerTags: [...n.swaggerTags, trimmed] }
    })
  }, [applyUpdate])

  const handleRemoveSwaggerTag = useCallback((index: number): void => {
    applyUpdate(n => ({
      ...n,
      swaggerTags: n.swaggerTags.filter((_, i) => i !== index),
    }))
  }, [applyUpdate])

  // ─── AI Prompt ───────────────────────────────────────────────────

  const handleAIPromptChange = useCallback(
    (field: keyof AIPrompt, value: string): void => {
      applyUpdate(n => ({ ...n, aiPrompt: { ...n.aiPrompt, [field]: value } }), 'slow')
    },
    [applyUpdate],
  )

  const handleAIGenerateToggle = useCallback((): void => {
    applyUpdate(n => ({ ...n, aiPrompt: { ...n.aiPrompt, aiGenerate: !n.aiPrompt.aiGenerate } }))
  }, [applyUpdate])

  // ─── Lifecycle ───────────────────────────────────────────────────

  const handleClose = useCallback((): void => {
    clearSelection()
  }, [clearSelection])

  const handleDelete = useCallback((): void => {
    if (!node || !activeProjectId) return
    const confirmed = window.confirm(`Delete "${node.label}"? This cannot be undone.`)
    if (!confirmed) return

    void (async (): Promise<void> => {
      await db.nodes.delete(nodeId)
      // Delete INVOKES edge if present — no reset needed on the service side
      await db.edges.where('fromNodeId').equals(nodeId).delete()

      setNodes(nodes => nodes.filter(n => n.id !== nodeId))
      setEdges(edges => edges.filter(e => e.source !== nodeId && e.target !== nodeId))
      clearSelection()

      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.close()
    })()
  }, [node, nodeId, activeProjectId, setNodes, setEdges, clearSelection])

  return {
    node,
    authRuleName,
    connectedService,
    connectedEndpoints,
    handleLabelChange,
    handleBasePathChange,
    handleDisconnectService,
    handleDisconnectEndpoint,
    handleCrossOriginToggle,
    handleApiVersionChange,
    handleRequestLoggingToggle,
    handleIncludeTimestampToggle,
    handleIncludeRequestPathToggle,
    handleErrorsChange,
    handleAddSwaggerTag,
    handleRemoveSwaggerTag,
    handleAIPromptChange,
    handleAIGenerateToggle,
    handleClose,
    handleDelete,
  }
}
