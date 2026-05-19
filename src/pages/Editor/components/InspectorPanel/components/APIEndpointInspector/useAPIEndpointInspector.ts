import { useCallback, useState } from 'react'
import { useNodes, useEdges, useReactFlow, MarkerType } from '@xyflow/react'
import type { Edge as RFEdge } from '@xyflow/react'
import { useCanvasStore, useProjectStore } from '@store'
import { useUpdateNode } from '@service'
import { useDebounce } from '@hooks'
import { NodeType, EdgeType, HttpMethod, JavaType, DTOPurpose } from '@entity'
import { generateId } from '@utils'
import { db } from '@db'
import type { APIEndpointNode, DTONode, ControllerNode, ErrorDefinition } from '@entity'
import type {
  APIEndpointInspectorProps,
  APIEndpointInspectorHook,
  ConnectedController,
  ConnectedDTO,
  AvailableNode,
} from './types'

// ─── Shape of an AuthRuleNode data blob (best-effort — node not yet defined) ──
interface AuthRuleData {
  ruleName?: string
  effect?:   string
  roles?:    string[]
}

export const useAPIEndpointInspector = (
  { nodeId }: APIEndpointInspectorProps,
): APIEndpointInspectorHook => {
  const clearSelection  = useCanvasStore(s => s.clearSelection)
  const activeProjectId = useProjectStore(s => s.activeProjectId)
  const rfNodes         = useNodes()
  const allEdges        = useEdges()
  const { setNodes, setEdges } = useReactFlow()

  const { mutate: updateNode } = useUpdateNode()

  const [queryParamsExpanded, setQueryParamsExpanded] = useState(false)

  // ─── Derive current node from RF state ───────────────────────────

  const rfNode = rfNodes.find(n => n.id === nodeId)
  const node   = (rfNode?.data as unknown as APIEndpointNode | undefined) ?? null

  // ─── Derive authRuleName + authRuleEffect from authRuleId ─────────

  const authRuleRFNode = node?.authRuleId
    ? rfNodes.find(n => n.id === node.authRuleId)
    : null

  const authRuleData = authRuleRFNode?.data as AuthRuleData | undefined

  const authRuleName: string | null   = authRuleData?.ruleName ?? null
  const authRuleEffect: string | null = authRuleData
    ? authRuleData.effect === 'ALLOW_ALL'
      ? 'Public — no auth required'
      : authRuleData.effect === 'DENY_ALL'
      ? 'Locked — all access denied'
      : authRuleData.effect && authRuleData.roles?.length
      ? `${authRuleData.effect} — ${authRuleData.roles.join(', ')}`
      : (authRuleData.effect ?? null)
    : null

  // ─── Resolve connected controller via ROUTES_TO edge ─────────────

  const routesToEdge = allEdges.find(e => {
    const edgeData = e.data as { type?: string } | undefined
    return edgeData?.type === EdgeType.ROUTES_TO && e.source === nodeId
  })

  const controllerRFNode = routesToEdge
    ? rfNodes.find(n => n.id === routesToEdge.target)
    : null

  const connectedController: ConnectedController | null =
    controllerRFNode && routesToEdge
      ? {
          edgeId: routesToEdge.id,
          id:     controllerRFNode.id,
          label:  (controllerRFNode.data as unknown as ControllerNode).label,
        }
      : null

  // ─── Resolve connected request DTO via ACCEPTS edge ──────────────

  const acceptsEdge = allEdges.find(e => {
    const edgeData = e.data as { type?: string } | undefined
    return edgeData?.type === EdgeType.ACCEPTS && e.source === nodeId
  })

  const requestDTORFNode = acceptsEdge
    ? rfNodes.find(n => n.id === acceptsEdge.target)
    : null

  const connectedRequestDTO: ConnectedDTO | null =
    requestDTORFNode && acceptsEdge
      ? {
          edgeId: acceptsEdge.id,
          id:     requestDTORFNode.id,
          label:  (requestDTORFNode.data as unknown as DTONode).label,
        }
      : null

  // ─── Resolve connected response DTO via RETURNS edge ─────────────

  const returnsEdge = allEdges.find(e => {
    const edgeData = e.data as { type?: string } | undefined
    return edgeData?.type === EdgeType.RETURNS && e.source === nodeId
  })

  const responseDTORFNode = returnsEdge
    ? rfNodes.find(n => n.id === returnsEdge.target)
    : null

  const connectedResponseDTO: ConnectedDTO | null =
    responseDTORFNode && returnsEdge
      ? {
          edgeId: returnsEdge.id,
          id:     responseDTORFNode.id,
          label:  (responseDTORFNode.data as unknown as DTONode).label,
        }
      : null

  // ─── Available nodes for quick-connect ───────────────────────────

  const endpointParentId = rfNode?.parentId ?? null

  const allDTONodes: DTONode[] = rfNodes
    .filter(n => n.type === 'dto' && (endpointParentId === null || n.parentId === endpointParentId))
    .map(n => n.data as unknown as DTONode)

  const availableRequestDTOs  = allDTONodes.filter(d => d.purpose === DTOPurpose.REQUEST || d.purpose === DTOPurpose.BOTH)
  const availableResponseDTOs = allDTONodes.filter(d => d.purpose === DTOPurpose.RESPONSE || d.purpose === DTOPurpose.BOTH)

  const availableControllerNodes: AvailableNode[] = routesToEdge
    ? []
    : rfNodes
        .filter(n => n.type === 'controller')
        .map(n => ({
          id:    n.id,
          label: (n.data as unknown as ControllerNode).label,
          type:  'controller',
        }))

  // ─── Core update helpers ──────────────────────────────────────────

  const writeToIDB = useCallback((updated: APIEndpointNode): void => {
    if (!activeProjectId) return
    updateNode({
      id:        updated.id,
      projectId: activeProjectId,
      type:      NodeType.API_ENDPOINT,
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
    updater:  (prev: APIEndpointNode) => APIEndpointNode,
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

  // ─── Label + HTTP ─────────────────────────────────────────────────

  const buildLabel = (method: HttpMethod, path: string): string => `${method} ${path}`

  const handleLabelChange = useCallback((value: string): void => {
    applyUpdate(n => ({ ...n, label: value }))
  }, [applyUpdate])

  const handleMethodChange = useCallback((value: HttpMethod): void => {
    applyUpdate(n => ({
      ...n,
      method: value,
      label:  buildLabel(value, n.path),
    }))
  }, [applyUpdate])

  const handlePathChange = useCallback((value: string): void => {
    const normalised = value === '' ? '/' : value.startsWith('/') ? value : `/${value}`
    applyUpdate(n => ({
      ...n,
      path:  normalised,
      label: buildLabel(n.method, normalised),
    }))
  }, [applyUpdate])

  const handleDescriptionChange = useCallback((value: string): void => {
    applyUpdate(n => ({ ...n, config: { ...n.config, description: value } }), 'slow')
  }, [applyUpdate])

  // ─── Request ──────────────────────────────────────────────────────

  const handleBodyDTOChange = useCallback((dtoId: string | null): void => {
    applyUpdate(n => ({ ...n, request: { ...n.request, bodyDTOId: dtoId } }))
    if (dtoId === null && acceptsEdge && activeProjectId) {
      void db.edges.delete(acceptsEdge.id)
      setEdges(edges => edges.filter(e => e.id !== acceptsEdge.id))
      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.close()
    }
  }, [applyUpdate, acceptsEdge, activeProjectId, setEdges])

  const handleAddPathVar = useCallback((name: string): void => {
    const trimmed = name.trim()
    if (!trimmed) return
    applyUpdate(n => ({
      ...n,
      request: {
        ...n.request,
        pathVars: [...n.request.pathVars, { name: trimmed, type: JavaType.UUID }],
      },
    }))
  }, [applyUpdate])

  const handleRemovePathVar = useCallback((index: number): void => {
    applyUpdate(n => ({
      ...n,
      request: {
        ...n.request,
        pathVars: n.request.pathVars.filter((_, i) => i !== index),
      },
    }))
  }, [applyUpdate])

  const handleAddQueryParam = useCallback((
    name:         string,
    type:         string,
    defaultValue: string,
    required:     boolean,
  ): void => {
    const trimmed = name.trim()
    if (!trimmed) return
    applyUpdate(n => ({
      ...n,
      request: {
        ...n.request,
        queryParams: [...n.request.queryParams, {
          name:         trimmed,
          type:         type as JavaType,
          defaultValue,
          required,
        }],
      },
    }))
  }, [applyUpdate])

  const handleRemoveQueryParam = useCallback((index: number): void => {
    applyUpdate(n => ({
      ...n,
      request: {
        ...n.request,
        queryParams: n.request.queryParams.filter((_, i) => i !== index),
      },
    }))
  }, [applyUpdate])

  // ─── Response ─────────────────────────────────────────────────────

  const handleReturnDTOChange = useCallback((dtoId: string | null): void => {
    applyUpdate(n => ({ ...n, response: { ...n.response, returnDTOId: dtoId } }))
    if (dtoId === null && returnsEdge && activeProjectId) {
      void db.edges.delete(returnsEdge.id)
      setEdges(edges => edges.filter(e => e.id !== returnsEdge.id))
      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.close()
    }
  }, [applyUpdate, returnsEdge, activeProjectId, setEdges])

  const handleSuccessCodeChange = useCallback((value: number): void => {
    applyUpdate(n => ({ ...n, response: { ...n.response, successCode: value } }))
  }, [applyUpdate])

  const handlePaginatedToggle = useCallback((): void => {
    applyUpdate(n => ({
      ...n,
      config:   { ...n.config,   paginated: !n.config.paginated },
      response: { ...n.response, isPage:    !n.response.isPage, isList: n.response.isPage ? n.response.isList : false },
    }))
  }, [applyUpdate])

  const handleDeprecatedToggle = useCallback((): void => {
    applyUpdate(n => ({ ...n, config: { ...n.config, deprecated: !n.config.deprecated } }))
  }, [applyUpdate])

  // ─── Error handling ───────────────────────────────────────────────

  const handleInheritFromControllerToggle = useCallback((): void => {
    applyUpdate(n => ({
      ...n,
      errorHandling: {
        ...n.errorHandling,
        inheritFromController: !n.errorHandling.inheritFromController,
      },
    }))
  }, [applyUpdate])

  const handleErrorsChange = useCallback((updated: ErrorDefinition[]): void => {
    applyUpdate(n => ({
      ...n,
      errorHandling: { ...n.errorHandling, errors: updated },
    }))
  }, [applyUpdate])

  // ─── Connections ──────────────────────────────────────────────────

  const handleDisconnectController = useCallback((): void => {
    if (!connectedController || !activeProjectId) return
    void (async (): Promise<void> => {
      await db.edges.delete(connectedController.edgeId)
      setEdges(edges => edges.filter(e => e.id !== connectedController.edgeId))

      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.close()
    })()
  }, [connectedController, activeProjectId, setEdges])

  const handleDisconnectRequestDTO = useCallback((): void => {
    if (!connectedRequestDTO || !activeProjectId || !node) return
    void (async (): Promise<void> => {
      await db.edges.delete(connectedRequestDTO.edgeId)
      setEdges(edges => edges.filter(e => e.id !== connectedRequestDTO.edgeId))

      const updated: APIEndpointNode = {
        ...node,
        request: { ...node.request, bodyDTOId: null },
      }
      setNodes(nodes => nodes.map(n =>
        n.id === nodeId ? { ...n, data: updated as unknown as Record<string, unknown> } : n,
      ))
      await db.nodes.update(nodeId, { data: JSON.stringify(updated), updatedAt: Date.now() })

      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
      bc.close()
    })()
  }, [connectedRequestDTO, activeProjectId, node, nodeId, setEdges, setNodes])

  const handleDisconnectResponseDTO = useCallback((): void => {
    if (!connectedResponseDTO || !activeProjectId || !node) return
    void (async (): Promise<void> => {
      await db.edges.delete(connectedResponseDTO.edgeId)
      setEdges(edges => edges.filter(e => e.id !== connectedResponseDTO.edgeId))

      const updated: APIEndpointNode = {
        ...node,
        response: { ...node.response, returnDTOId: null },
      }
      setNodes(nodes => nodes.map(n =>
        n.id === nodeId ? { ...n, data: updated as unknown as Record<string, unknown> } : n,
      ))
      await db.nodes.update(nodeId, { data: JSON.stringify(updated), updatedAt: Date.now() })

      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
      bc.close()
    })()
  }, [connectedResponseDTO, activeProjectId, node, nodeId, setEdges, setNodes])

  const handleQuickConnect = useCallback((targetNodeId: string): void => {
    if (!activeProjectId || !node) return

    const targetRFNode = rfNodes.find(n => n.id === targetNodeId)
    if (!targetRFNode) return

    const targetType = targetRFNode.type

    void (async (): Promise<void> => {
      const edgeId = generateId()

      if (targetType === 'controller') {
        await db.edges.add({
          id:         edgeId,
          projectId:  activeProjectId,
          fromNodeId: nodeId,
          toNodeId:   targetNodeId,
          type:       EdgeType.ROUTES_TO,
          label:      EdgeType.ROUTES_TO,
          fromHandle: 'right',
          toHandle:   'left',
        })

        const successCode =
          node.method === HttpMethod.POST   ? 201
          : node.method === HttpMethod.DELETE ? 204
          : 200

        const pathVarMatch = node.path.match(/\{(\w+)\}/)
        const newPathVars = pathVarMatch
          ? [...node.request.pathVars, { name: pathVarMatch[1], type: JavaType.UUID }].filter(
              (v, i, arr) => arr.findIndex(x => x.name === v.name) === i,
            )
          : node.request.pathVars

        const paginated = node.method === HttpMethod.GET && !node.path.includes('{')
          ? true
          : node.config.paginated

        const updated: APIEndpointNode = {
          ...node,
          response: { ...node.response, successCode },
          config:   { ...node.config,   paginated },
          request:  { ...node.request,  pathVars: newPathVars },
        }

        setNodes(nodes => nodes.map(n =>
          n.id === nodeId ? { ...n, data: updated as unknown as Record<string, unknown> } : n,
        ))
        await db.nodes.update(nodeId, { data: JSON.stringify(updated), updatedAt: Date.now() })

        setEdges(edges => [
          ...edges,
          {
            id:           edgeId,
            source:       nodeId,
            target:       targetNodeId,
            sourceHandle: 'right',
            targetHandle: 'left',
            type:         'routesTo' as const,
            data:         {
              id:         edgeId,
              projectId:  activeProjectId,
              fromNodeId: nodeId,
              toNodeId:   targetNodeId,
              type:       EdgeType.ROUTES_TO,
              label:      EdgeType.ROUTES_TO,
            } as unknown as Record<string, unknown>,
          },
        ])

        const bc = new BroadcastChannel('archflow-sync')
        bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
        bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
        bc.close()
        return
      }

      if (targetType === 'dto') {
        const dtoRFNode = rfNodes.find(n => n.id === targetNodeId)
        if (!dtoRFNode) return
        const dtoData = dtoRFNode.data as unknown as DTONode

        const bodyEmpty   = node.request.bodyDTOId   === null
        const returnEmpty = node.response.returnDTOId === null

        const fillBody   = dtoData.purpose === DTOPurpose.REQUEST  ||
                           dtoData.purpose === DTOPurpose.BOTH && bodyEmpty
        const fillReturn = dtoData.purpose === DTOPurpose.RESPONSE ||
                           dtoData.purpose === DTOPurpose.BOTH && returnEmpty

        if (!fillBody && !fillReturn) return

        let updatedEndpoint: APIEndpointNode = node
        if (fillBody   && bodyEmpty)   updatedEndpoint = { ...updatedEndpoint, request:  { ...updatedEndpoint.request,  bodyDTOId:   targetNodeId } }
        if (fillReturn && returnEmpty) updatedEndpoint = { ...updatedEndpoint, response: { ...updatedEndpoint.response, returnDTOId: targetNodeId } }

        const newEdges: RFEdge[] = []
        if (fillBody && bodyEmpty) {
          const eid = generateId()
          await db.edges.add({ id: eid, projectId: activeProjectId, fromNodeId: nodeId, toNodeId: targetNodeId, type: EdgeType.ACCEPTS, label: EdgeType.ACCEPTS, fromHandle: 'right', toHandle: 'left' })
          newEdges.push({ id: eid, source: nodeId, target: targetNodeId, sourceHandle: 'right', targetHandle: 'left', type: 'accepts' as const, data: { id: eid, projectId: activeProjectId, fromNodeId: nodeId, toNodeId: targetNodeId, type: EdgeType.ACCEPTS, label: EdgeType.ACCEPTS } as unknown as Record<string, unknown>, markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--node-dto-accent)', width: 12, height: 12 } })
        }
        if (fillReturn && returnEmpty) {
          const eid = generateId()
          await db.edges.add({ id: eid, projectId: activeProjectId, fromNodeId: nodeId, toNodeId: targetNodeId, type: EdgeType.RETURNS, label: EdgeType.RETURNS, fromHandle: 'right', toHandle: 'left' })
          newEdges.push({ id: eid, source: nodeId, target: targetNodeId, sourceHandle: 'right', targetHandle: 'left', type: 'returns' as const, data: { id: eid, projectId: activeProjectId, fromNodeId: nodeId, toNodeId: targetNodeId, type: EdgeType.RETURNS, label: EdgeType.RETURNS } as unknown as Record<string, unknown>, markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--node-dto-accent)', width: 12, height: 12 } })
        }

        setNodes(nodes => nodes.map(n =>
          n.id === nodeId ? { ...n, data: updatedEndpoint as unknown as Record<string, unknown> } : n,
        ))
        await db.nodes.update(nodeId, { data: JSON.stringify(updatedEndpoint), updatedAt: Date.now() })
        setEdges(edges => [...edges, ...newEdges])

        const bc = new BroadcastChannel('archflow-sync')
        bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
        bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
        bc.close()
      }
    })()
  }, [activeProjectId, node, nodeId, rfNodes, setEdges, setNodes])

  // ─── Lifecycle ────────────────────────────────────────────────────

  const handleClose = useCallback((): void => {
    clearSelection()
  }, [clearSelection])

  const handleDelete = useCallback((): void => {
    if (!node || !activeProjectId) return
    const confirmed = window.confirm(`Delete "${node.label}"? This cannot be undone.`)
    if (!confirmed) return

    void (async (): Promise<void> => {
      await db.nodes.delete(nodeId)
      await db.edges.where('fromNodeId').equals(nodeId).delete()

      const connectedDTOIds = [node.request.bodyDTOId, node.response.returnDTOId].filter(
        (id): id is string => id !== null,
      )
      for (const dtoId of connectedDTOIds) {
        const dtoRFNode = rfNodes.find(n => n.id === dtoId)
        if (dtoRFNode) {
          const dto = dtoRFNode.data as unknown as DTONode
          const updatedDTO: DTONode = { ...dto }
          await db.nodes.update(dtoId, { data: JSON.stringify(updatedDTO), updatedAt: Date.now() })
        }
      }

      setNodes(nodes => nodes.filter(n => n.id !== nodeId))
      setEdges(edges => edges.filter(e => e.source !== nodeId && e.target !== nodeId))
      clearSelection()

      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.close()
    })()
  }, [node, nodeId, activeProjectId, rfNodes, setNodes, setEdges, clearSelection])

  return {
    node,
    connectedController,
    connectedRequestDTO,
    connectedResponseDTO,
    availableRequestDTOs,
    availableResponseDTOs,
    availableControllerNodes,
    queryParamsExpanded,
    setQueryParamsExpanded,
    authRuleName,
    authRuleEffect,
    handleLabelChange,
    handleMethodChange,
    handlePathChange,
    handleDescriptionChange,
    handleBodyDTOChange,
    handleAddPathVar,
    handleRemovePathVar,
    handleAddQueryParam,
    handleRemoveQueryParam,
    handleReturnDTOChange,
    handleSuccessCodeChange,
    handlePaginatedToggle,
    handleDeprecatedToggle,
    handleInheritFromControllerToggle,
    handleErrorsChange,
    handleDisconnectController,
    handleDisconnectRequestDTO,
    handleDisconnectResponseDTO,
    handleQuickConnect,
    handleClose,
    handleDelete,
  }
}
