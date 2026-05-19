import { useCallback, useState } from 'react'
import { useNodes, useEdges, useReactFlow } from '@xyflow/react'
import { useCanvasStore, useProjectStore } from '@store'
import { useUpdateNode, useDeleteNode } from '@service'
import { useDebounce } from '@hooks'
import { NodeType, EdgeType, JavaType } from '@entity'
import { generateId, resetServiceNode } from '@utils'
import { emptyAIPrompt } from '@entity/AIPrompt'
import { db } from '@db'
import type { ServiceNode, EntityNode, ControllerNode, AIPrompt, ServiceMethod, MethodReturnType } from '@entity'
import type { ServiceInspectorProps, ServiceInspectorHook, ConnectedEntity, ConnectedController } from './types'

// ─── Hook ─────────────────────────────────────────────────────────

export const useServiceInspector = (
  { nodeId }: ServiceInspectorProps,
): ServiceInspectorHook => {
  const clearSelection  = useCanvasStore(s => s.clearSelection)
  const activeProjectId = useProjectStore(s => s.activeProjectId)
  const rfNodes         = useNodes()
  const allEdges        = useEdges()
  const { setNodes, setEdges } = useReactFlow()

  const { mutate: updateNode } = useUpdateNode()
  const { mutate: _deleteNode } = useDeleteNode()

  // Method expand/collapse state
  const [expandedMethodId, setExpandedMethodId] = useState<string | null>(null)

  // Derive current node from RF state
  const rfNode = rfNodes.find(n => n.id === nodeId)
  const node   = (rfNode?.data as unknown as ServiceNode | undefined) ?? null

  // ─── Resolve connected entity via USES edge ───────────────────────

  const usesEdge = allEdges.find(e => {
    const edgeData = e.data as { type?: string } | undefined
    return edgeData?.type === EdgeType.USES && e.source === nodeId
  })

  const connectedEntityRFNode = usesEdge
    ? rfNodes.find(n => n.id === usesEdge.target)
    : null

  const connectedEntity: ConnectedEntity | null = connectedEntityRFNode && usesEdge
    ? {
        edgeId: usesEdge.id,
        id:     connectedEntityRFNode.id,
        label:  (connectedEntityRFNode.data as unknown as EntityNode).label,
      }
    : null

  // ─── Resolve connected controllers via INVOKES edges ─────────────
  // Controllers invoke this service: INVOKES edges where target = nodeId

  const connectedControllers: ConnectedController[] = allEdges
    .filter(e => {
      const edgeData = e.data as { type?: string } | undefined
      return edgeData?.type === EdgeType.INVOKES && e.target === nodeId
    })
    .flatMap(e => {
      const controllerRFNode = rfNodes.find(n => n.id === e.source)
      if (!controllerRFNode) return []
      return [{
        edgeId: e.id,
        id:     controllerRFNode.id,
        label:  (controllerRFNode.data as unknown as ControllerNode).label,
      }]
    })

  // ─── Available entity nodes for method dropdowns ─────────────────

  const availableEntities = rfNodes
    .filter(n => n.type === 'entity')
    .map(n => ({
      id:    n.id,
      label: (n.data as unknown as EntityNode).label,
    }))

  const availableCustomTypes = rfNodes
    .filter(n => n.type === 'customType')
    .map(n => ({
      id:    n.id,
      label: (n.data as unknown as { label: string }).label,
    }))

  // ─── Core update helper ─────────────────────────────────────────

  const writeToIDB = useCallback((updated: ServiceNode): void => {
    if (!activeProjectId) return
    updateNode({
      id:        updated.id,
      projectId: activeProjectId,
      type:      NodeType.SERVICE,
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
    updater:  (prev: ServiceNode) => ServiceNode,
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

  // ─── Connection — disconnect entity ──────────────────────────────

  const handleDisconnectEntity = useCallback((): void => {
    if (!connectedEntity || !activeProjectId) return
    const edgeId    = connectedEntity.edgeId
    const serviceId = nodeId

    void (async (): Promise<void> => {
      await db.edges.delete(edgeId)
      setEdges(edges => edges.filter(e => e.id !== edgeId))

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

      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
      bc.close()
    })()
  }, [connectedEntity, nodeId, activeProjectId, rfNodes, setEdges, setNodes])

  // ─── Connection — disconnect controller (INVOKES edge only) ─────────

  const handleDisconnectController = useCallback((edgeId: string): void => {
    if (!activeProjectId) return

    void (async (): Promise<void> => {
      await db.edges.delete(edgeId)
      setEdges(edges => edges.filter(e => e.id !== edgeId))

      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.close()
    })()
  }, [activeProjectId, setEdges])

  // ─── Config toggles ──────────────────────────────────────────────

  const handleTransactionalToggle = useCallback((): void => {
    applyUpdate(n => ({
      ...n,
      config: { ...n.config, classLevelTransactional: !n.config.classLevelTransactional },
    }))
  }, [applyUpdate])

  const handleAsyncToggle = useCallback((): void => {
    applyUpdate(n => ({
      ...n,
      config: { ...n.config, classLevelAsync: !n.config.classLevelAsync },
    }))
  }, [applyUpdate])

  const handleGenerateInterfaceToggle = useCallback((): void => {
    applyUpdate(n => ({
      ...n,
      config: { ...n.config, generateInterface: !n.config.generateInterface },
    }))
  }, [applyUpdate])

  // ─── Methods ─────────────────────────────────────────────────────

  const handleAddMethod = useCallback((): void => {
    const emptyReturn: MethodReturnType = {
      type:              null,
      entityTypeId:      null,
      arraySubType:      null,
      arrayEntityTypeId: null,
      isList:            false,
      isPage:            false,
      isOptional:        false,
      isVoid:            false,
    }
    const newMethod: ServiceMethod = {
      id:            generateId(),
      name:          'newMethod',
      returnType:    emptyReturn,
      params:        [],
      transactional: false,
      async:         false,
      aiPrompt:      emptyAIPrompt(),
      throwsErrors:  [],
    }
    applyUpdate(n => ({ ...n, methods: [...n.methods, newMethod] }))
  }, [applyUpdate])

  const handleRemoveMethod = useCallback((methodId: string): void => {
    applyUpdate(n => ({
      ...n,
      methods: n.methods.filter(m => m.id !== methodId),
    }))
    if (expandedMethodId === methodId) setExpandedMethodId(null)
  }, [applyUpdate, expandedMethodId])

  const handleMethodNameChange = useCallback((methodId: string, value: string): void => {
    applyUpdate(n => ({
      ...n,
      methods: n.methods.map(m => m.id === methodId ? { ...m, name: value } : m),
    }))
  }, [applyUpdate])

  // ─── Return type ─────────────────────────────────────────────────

  const handleReturnTypeChange = useCallback((
    methodId:           string,
    type:               JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null,
    entityTypeId:       string | null,
    customTypeId?:      string | null,
    arraySubType?:      JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null,
    arrayEntityTypeId?: string | null,
    arrayCustomTypeId?: string | null,
  ): void => {
    applyUpdate(n => ({
      ...n,
      methods: n.methods.map(m => {
        if (m.id !== methodId) return m
        return {
          ...m,
          returnType: {
            ...m.returnType,
            type,
            entityTypeId,
            customTypeId:      customTypeId      ?? null,
            arraySubType:      arraySubType      ?? null,
            arrayEntityTypeId: arrayEntityTypeId ?? null,
            arrayCustomTypeId: arrayCustomTypeId ?? null,
            isVoid: false,
          },
        }
      }),
    }))
  }, [applyUpdate])

  // Keep these shims so existing callers in ServiceInspector.tsx still compile
  // until the component UI is updated in step 6.
  const handleReturnEntityChange = useCallback((methodId: string, entityId: string | null): void => {
    handleReturnTypeChange(methodId, entityId ? 'ENTITY_REF' : null, entityId)
  }, [handleReturnTypeChange])

  const handleReturnPrimitiveChange = useCallback((methodId: string, type: JavaType | null): void => {
    handleReturnTypeChange(methodId, type, null)
  }, [handleReturnTypeChange])

  const handleReturnIsListToggle = useCallback((methodId: string): void => {
    applyUpdate(n => ({
      ...n,
      methods: n.methods.map(m => {
        if (m.id !== methodId) return m
        const next = !m.returnType.isList
        return {
          ...m,
          returnType: {
            ...m.returnType,
            isList:     next,
            isPage:     false,
            isOptional: false,
            isVoid:     false,
          },
        }
      }),
    }))
  }, [applyUpdate])

  const handleReturnIsPageToggle = useCallback((methodId: string): void => {
    applyUpdate(n => ({
      ...n,
      methods: n.methods.map(m => {
        if (m.id !== methodId) return m
        const next = !m.returnType.isPage
        return {
          ...m,
          returnType: {
            ...m.returnType,
            isPage:     next,
            isList:     false,
            isOptional: false,
            isVoid:     false,
          },
        }
      }),
    }))
  }, [applyUpdate])

  const handleReturnIsOptionalToggle = useCallback((methodId: string): void => {
    applyUpdate(n => ({
      ...n,
      methods: n.methods.map(m => {
        if (m.id !== methodId) return m
        const next = !m.returnType.isOptional
        return {
          ...m,
          returnType: {
            ...m.returnType,
            isOptional: next,
            isList:     false,
            isPage:     false,
            isVoid:     false,
          },
        }
      }),
    }))
  }, [applyUpdate])

  const handleReturnIsVoidToggle = useCallback((methodId: string): void => {
    applyUpdate(n => ({
      ...n,
      methods: n.methods.map(m => {
        if (m.id !== methodId) return m
        const next = !m.returnType.isVoid
        return {
          ...m,
          returnType: {
            type:              null,
            entityTypeId:      null,
            arraySubType:      null,
            arrayEntityTypeId: null,
            isList:            false,
            isPage:            false,
            isOptional:        false,
            isVoid:            next,
          },
        }
      }),
    }))
  }, [applyUpdate])

  // ─── Params ──────────────────────────────────────────────────────

  const handleAddParam = useCallback((
    methodId:           string,
    name:               string,
    type:               JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF',
    entityTypeId:       string | null,
    customTypeId?:      string | null,
    arraySubType?:      JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null,
    arrayEntityTypeId?: string | null,
    arrayCustomTypeId?: string | null,
    enumValues?:        string[] | null,
  ): void => {
    const trimmed = name.trim()
    if (!trimmed) return
    applyUpdate(n => ({
      ...n,
      methods: n.methods.map(m => {
        if (m.id !== methodId) return m
        return {
          ...m,
          params: [
            ...m.params,
            {
              name:              trimmed,
              type,
              entityTypeId,
              customTypeId:      customTypeId      ?? null,
              arraySubType:      arraySubType      ?? null,
              arrayEntityTypeId: arrayEntityTypeId ?? null,
              arrayCustomTypeId: arrayCustomTypeId ?? null,
              isPageable:        false,
              enumValues:        (type === 'ENTITY_REF' || type === 'CUSTOM_TYPE_REF') ? null : (enumValues ?? null),
            },
          ],
        }
      }),
    }))
  }, [applyUpdate])

  const handleRemoveParam = useCallback((methodId: string, paramIdx: number): void => {
    applyUpdate(n => ({
      ...n,
      methods: n.methods.map(m => {
        if (m.id !== methodId) return m
        return { ...m, params: m.params.filter((_, i) => i !== paramIdx) }
      }),
    }))
  }, [applyUpdate])

  const handleParamIsPageableToggle = useCallback((methodId: string, paramIdx: number): void => {
    applyUpdate(n => ({
      ...n,
      methods: n.methods.map(m => {
        if (m.id !== methodId) return m
        return {
          ...m,
          params: m.params.map((p, i) =>
            i === paramIdx ? { ...p, isPageable: !p.isPageable } : p,
          ),
        }
      }),
    }))
  }, [applyUpdate])

  // ─── Method flags ─────────────────────────────────────────────────

  const handleMethodTransactionalToggle = useCallback((methodId: string): void => {
    applyUpdate(n => ({
      ...n,
      methods: n.methods.map(m =>
        m.id === methodId ? { ...m, transactional: !m.transactional } : m,
      ),
    }))
  }, [applyUpdate])

  const handleMethodAsyncToggle = useCallback((methodId: string): void => {
    applyUpdate(n => ({
      ...n,
      methods: n.methods.map(m =>
        m.id === methodId ? { ...m, async: !m.async } : m,
      ),
    }))
  }, [applyUpdate])

  // ─── Errors ──────────────────────────────────────────────────────

  const handleAddError = useCallback((methodId: string, exceptionClass: string): void => {
    const trimmed = exceptionClass.trim()
    if (!trimmed) return
    applyUpdate(n => ({
      ...n,
      methods: n.methods.map(m => {
        if (m.id !== methodId) return m
        return {
          ...m,
          throwsErrors: [
            ...m.throwsErrors,
            { exceptionClass: trimmed, description: '', createException: false },
          ],
        }
      }),
    }))
  }, [applyUpdate])

  const handleRemoveError = useCallback((methodId: string, errorIdx: number): void => {
    applyUpdate(n => ({
      ...n,
      methods: n.methods.map(m => {
        if (m.id !== methodId) return m
        return { ...m, throwsErrors: m.throwsErrors.filter((_, i) => i !== errorIdx) }
      }),
    }))
  }, [applyUpdate])

  const handleErrorDescriptionChange = useCallback((
    methodId:  string,
    errorIdx:  number,
    value:     string,
  ): void => {
    applyUpdate(n => ({
      ...n,
      methods: n.methods.map(m => {
        if (m.id !== methodId) return m
        return {
          ...m,
          throwsErrors: m.throwsErrors.map((e, i) =>
            i === errorIdx ? { ...e, description: value } : e,
          ),
        }
      }),
    }), 'slow')
  }, [applyUpdate])

  const handleErrorCreateExceptionToggle = useCallback((
    methodId: string,
    errorIdx: number,
  ): void => {
    applyUpdate(n => ({
      ...n,
      methods: n.methods.map(m => {
        if (m.id !== methodId) return m
        return {
          ...m,
          throwsErrors: m.throwsErrors.map((e, i) =>
            i === errorIdx ? { ...e, createException: !e.createException } : e,
          ),
        }
      }),
    }))
  }, [applyUpdate])

  // ─── Per-method AI prompt ─────────────────────────────────────────

  const handleMethodAIPromptChange = useCallback((
    methodId: string,
    field:    keyof AIPrompt,
    value:    string,
  ): void => {
    applyUpdate(n => ({
      ...n,
      methods: n.methods.map(m => {
        if (m.id !== methodId) return m
        return { ...m, aiPrompt: { ...m.aiPrompt, [field]: value } }
      }),
    }), 'slow')
  }, [applyUpdate])

  const handleMethodAIGenerateToggle = useCallback((methodId: string): void => {
    applyUpdate(n => ({
      ...n,
      methods: n.methods.map(m => {
        if (m.id !== methodId) return m
        return { ...m, aiPrompt: { ...m.aiPrompt, aiGenerate: !m.aiPrompt.aiGenerate } }
      }),
    }))
  }, [applyUpdate])

  // ─── Node-level AI prompt ─────────────────────────────────────────

  const handleAIPromptChange = useCallback(
    (field: keyof AIPrompt, value: string): void => {
      applyUpdate(n => ({ ...n, aiPrompt: { ...n.aiPrompt, [field]: value } }), 'slow')
    },
    [applyUpdate],
  )

  const handleAIGenerateToggle = useCallback((): void => {
    applyUpdate(n => ({
      ...n,
      aiPrompt: { ...n.aiPrompt, aiGenerate: !n.aiPrompt.aiGenerate },
    }))
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
      // Delete USES edge if present — no reset needed, node is gone
      await db.edges.where('fromNodeId').equals(nodeId).delete()

      setNodes(nodes => nodes.filter(n => n.id !== nodeId))
      setEdges(edges => edges.filter(e => e.source !== nodeId))
      clearSelection()

      if (activeProjectId) {
        const bc = new BroadcastChannel('archflow-sync')
        bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
        bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
        bc.close()
      }
    })()
  }, [node, nodeId, activeProjectId, setNodes, setEdges, clearSelection])

  return {
    node,
    connectedEntity,
    connectedControllers,
    handleLabelChange,
    handleDisconnectEntity,
    handleDisconnectController,
    handleTransactionalToggle,
    handleAsyncToggle,
    handleGenerateInterfaceToggle,
    expandedMethodId,
    setExpandedMethodId,
    handleAddMethod,
    handleRemoveMethod,
    handleMethodNameChange,
    handleReturnTypeChange,
    handleReturnEntityChange,
    handleReturnPrimitiveChange,
    handleReturnIsListToggle,
    handleReturnIsPageToggle,
    handleReturnIsOptionalToggle,
    handleReturnIsVoidToggle,
    handleAddParam,
    handleRemoveParam,
    handleParamIsPageableToggle,
    handleMethodTransactionalToggle,
    handleMethodAsyncToggle,
    handleAddError,
    handleRemoveError,
    handleErrorDescriptionChange,
    handleErrorCreateExceptionToggle,
    handleMethodAIPromptChange,
    handleMethodAIGenerateToggle,
    handleAIPromptChange,
    handleAIGenerateToggle,
    handleClose,
    handleDelete,
    availableEntities,
    availableCustomTypes,
  }
}
