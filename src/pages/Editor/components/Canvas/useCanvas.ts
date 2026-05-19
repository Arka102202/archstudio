import type React from 'react';
import { useEffect, useCallback, useRef, useState } from 'react'
import {
  useNodesState,
  useEdgesState,
  useReactFlow,
  applyNodeChanges,
  MarkerType,
  type Node as RFNode,
  type Edge as RFEdge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
  type OnNodeDrag,
  type NodeChange,
} from '@xyflow/react'
import { useCanvasStore, useRelationshipModalStore } from '@store'
import { useProjectStore } from '@store'
import { useGetNodes, useCreateNode, useUpdateNode, useDeleteNode, useDeleteNodes } from '@service'
import { createMicroserviceNode, createEntityNode, createDTONode, createDBNode, createTableNode, createServiceNode, createControllerNode, createAPIEndpointNode, createCustomTypeNode, findSafeMsPosition, applyDerivedFromEdge, applyStoredInEdge, applyConnectsToEdge, applyUsesEdge, resetServiceNode, migrateDbNodesToTableNodes, syncEntityTypeFields, syncCustomTypeEdges } from '@utils'
import { generateId } from '@utils'
import { NodeType, EdgeType, DTOOrigin, HttpMethod, JavaType, DTOPurpose } from '@entity'
import type { MicroserviceNode, EntityNode, DTONode, DBNode, TableNode, ServiceNode, ControllerNode, APIEndpointNode } from '@entity'
import { db } from '@db'
import type { NodeRow } from '@db'
import type { MsNodeData } from '@components/nodes/MicroserviceNode'
import type { EntityNodeData } from '@components/nodes/EntityNode'
import type { DTONodeData } from '@components/nodes/DTONode'
import type { DBNodeData } from '@components/nodes/DBNode'
import type { TableNodeData } from '@components/nodes/TableNode'
import type { ServiceNodeData } from '@components/nodes/ServiceNode'
import type { ControllerNodeData } from '@components/nodes/ControllerNode'
import type { APIEndpointNodeData } from '@components/nodes/APIEndpointNode'
import type { CustomTypeNodeData } from '@components/nodes/CustomTypeNode'
import type { CanvasProps } from './types'

interface CanvasHook {
  rfNodes:              RFNode[]
  rfEdges:              RFEdge[]
  isPanMode:            boolean
  onNodesChange:        OnNodesChange
  onEdgesChange:        OnEdgesChange
  onNodeClick:          (_event: React.MouseEvent, node: RFNode) => void
  onEdgeClick:          (_event: React.MouseEvent, edge: RFEdge) => void
  onPaneClick:          () => void
  onConnect:            (connection: Connection) => void
  onNodeDragStop:       OnNodeDrag
  onDragOver:           (e: React.DragEvent) => void
  onDrop:               (e: React.DragEvent) => void
  onEdgeDoubleClick:    (_event: React.MouseEvent, edge: RFEdge) => void
  handleDeleteUsesEdge: (edgeId: string) => Promise<void>
}

export const useCanvas = ({ projectId }: CanvasProps): CanvasHook => {
  const [rfNodes, setRfNodes] = useNodesState<RFNode>([])
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<RFEdge>([])

  const { setSelectedNode, setSelectedEdge, clearSelection, selectedNodeId, setRightPanelTab } = useCanvasStore()
  const activeProjectId = useProjectStore(s => s.activeProjectId)
  const openRelationshipModal = useRelationshipModalStore(s => s.open)

  const { data: nodeRows }     = useGetNodes(projectId)
  const { mutate: createNode } = useCreateNode()
  const { mutate: updateNode } = useUpdateNode()
  const { mutate: deleteNode }  = useDeleteNode()
  const { mutate: deleteNodes } = useDeleteNodes()
  const { screenToFlowPosition, fitView } = useReactFlow()

  // ─── Cmd (Meta) key → pan mode ───────────────────────────────────
  // When Meta is held, nodes are non-draggable so pointer events fall
  // through to the RF panner, enabling drag-to-pan anywhere on canvas.

  const [isPanMode, setIsPanMode] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => { if (e.key === 'Meta') setIsPanMode(true)  }
    const onKeyUp   = (e: KeyboardEvent): void => { if (e.key === 'Meta') setIsPanMode(false) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup',   onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup',   onKeyUp)
    }
  }, [])

  // ─── Load nodes from IDB into RF state — initial load only ───────
  // After the first successful load, RF state is the source of truth
  // for position/size. Subsequent nodeRows changes (from mutation
  // invalidations) must NOT replace RF state — that would reset
  // React Flow's internal node tracking mid-interaction, causing the
  // "not initialized" drag warning and making resize snap back.

  const initialLoadDone      = useRef(false)
  const initialEdgesLoadDone = useRef(false)

  useEffect(() => {
    if (!nodeRows) return
    if (initialLoadDone.current) return
    initialLoadDone.current = true

    const loadNodes = async (): Promise<void> => {
      const currentProjectId = projectId
      if (!currentProjectId) return

      // ─── Migration: split old DBNode (with customQueries) into DBNode + TableNode
      let allRows: NodeRow[] = [...nodeRows]
      const migrationNeeded = allRows.some(n => {
        if (n.type !== 'DB') return false
        const parsed = JSON.parse(n.data) as { customQueries?: unknown }
        const queries = parsed.customQueries
        return Array.isArray(queries) && queries.length > 0
      })
      if (migrationNeeded) {
        await migrateDbNodesToTableNodes(allRows, currentProjectId)
        // Reload rows after migration
        allRows = await db.nodes.where('projectId').equals(currentProjectId).toArray()
      }

      // Sort: MS nodes must come before child nodes so RF can resolve parentId refs
      const sortedRows = [...allRows].sort((a, b) => {
        if (a.type === NodeType.MICROSERVICE && b.type !== NodeType.MICROSERVICE) return -1
        if (a.type !== NodeType.MICROSERVICE && b.type === NodeType.MICROSERVICE) return  1
        return 0
      })

      const rfNodesFromIDB: RFNode[] = sortedRows
        .filter(row =>
          row.type === NodeType.MICROSERVICE ||
          row.type === NodeType.ENTITY       ||
          row.type === NodeType.DTO          ||
          row.type === NodeType.DB           ||
          row.type === NodeType.TABLE        ||
          row.type === NodeType.SERVICE      ||
          row.type === NodeType.CONTROLLER   ||
          row.type === NodeType.API_ENDPOINT ||
          row.type === NodeType.CUSTOM_TYPE,
        )
        .map(row => {
          if (row.type === NodeType.MICROSERVICE) {
            return {
              id:         row.id,
              type:       'microservice' as const,
              position:   row.position,
              data:       JSON.parse(row.data) as MsNodeData,
              dragHandle: '.ms-drag-handle',
              width:      row.size.w,
              height:     row.size.h,
              style:      { width: row.size.w, height: row.size.h },
            }
          }

          if (row.type === NodeType.ENTITY) {
            const entityData = JSON.parse(row.data) as EntityNodeData
            // Migrate: backfill fields added in later versions
            entityData.fields = entityData.fields.map(f => ({
              ...('arraySubType' in f ? {} : { arraySubType: null }),
              ...('arrayEntityTypeId' in f ? {} : { arrayEntityTypeId: null }),
              ...f,
            }))
            const entityRfNode: RFNode = {
              id:       row.id,
              type:     'entity' as const,
              position: row.position,
              data:     entityData,
              width:    row.size.w,
              height:   row.size.h,
            }
            if (entityData.msId) {
              entityRfNode.parentId = entityData.msId
              entityRfNode.extent   = 'parent'
            }
            return entityRfNode
          }

          if (row.type === NodeType.DB) {
            const dbData = JSON.parse(row.data) as DBNodeData
            const dbRfNode: RFNode = {
              id:       row.id,
              type:     'db' as const,
              position: row.position,
              data:     dbData,
              width:    row.size.w,
              height:   row.size.h,
            }
            if (dbData.msId) {
              dbRfNode.parentId = dbData.msId
              dbRfNode.extent   = 'parent'
            }
            return dbRfNode
          }

          if (row.type === NodeType.TABLE) {
            const tableData = JSON.parse(row.data) as TableNode

            // Backfill msId for TableNodes created before the msId field existed.
            // Infer it from the linked DBNode's msId, or from any MS row.
            let resolvedMsId: string | null = tableData.msId ?? null
            if (!resolvedMsId) {
              if (tableData.dbNodeId) {
                const dbRow = allRows.find(r => r.id === tableData.dbNodeId)
                if (dbRow) {
                  const dbParsed = JSON.parse(dbRow.data) as { msId?: string | null }
                  resolvedMsId = dbParsed.msId ?? null
                }
              }
              if (!resolvedMsId) {
                const msRow = allRows.find(r => r.type === NodeType.MICROSERVICE)
                resolvedMsId = msRow?.id ?? null
              }
              if (resolvedMsId) {
                // Persist backfill so we don't repeat this on next load
                const patched = { ...tableData, msId: resolvedMsId }
                void db.nodes.update(row.id, { data: JSON.stringify(patched), updatedAt: Date.now() })
              }
            }

            const tableRfNode: RFNode = {
              id:       row.id,
              type:     'table' as const,
              position: row.position,
              data:     { ...tableData, msId: resolvedMsId } as unknown as Record<string, unknown>,
              width:    row.size.w,
              height:   row.size.h,
            }
            if (resolvedMsId) {
              tableRfNode.parentId = resolvedMsId
              tableRfNode.extent   = 'parent'
            }
            return tableRfNode
          }

          if (row.type === NodeType.SERVICE) {
            const serviceData = JSON.parse(row.data) as ServiceNodeData
            const serviceRfNode: RFNode = {
              id:       row.id,
              type:     'service' as const,
              position: row.position,
              data:     serviceData,
              width:    row.size.w,
              height:   row.size.h,
            }
            if (serviceData.msId) {
              serviceRfNode.parentId = serviceData.msId
              serviceRfNode.extent   = 'parent'
            }
            return serviceRfNode
          }

          if (row.type === NodeType.CONTROLLER) {
            const controllerData = JSON.parse(row.data) as ControllerNodeData
            const controllerRfNode: RFNode = {
              id:       row.id,
              type:     'controller' as const,
              position: row.position,
              data:     controllerData,
              width:    row.size.w,
              height:   row.size.h,
            }
            if (controllerData.msId) {
              controllerRfNode.parentId = controllerData.msId
              controllerRfNode.extent   = 'parent'
            }
            return controllerRfNode
          }

          if (row.type === NodeType.API_ENDPOINT) {
            const endpointData = JSON.parse(row.data) as APIEndpointNodeData
            const endpointRfNode: RFNode = {
              id:       row.id,
              type:     'endpoint' as const,
              position: row.position,
              data:     endpointData,
              width:    row.size.w,
              height:   row.size.h,
            }
            if (endpointData.msId) {
              endpointRfNode.parentId = endpointData.msId
              endpointRfNode.extent   = 'parent'
            }
            return endpointRfNode
          }

          if (row.type === NodeType.CUSTOM_TYPE) {
            const ctData = JSON.parse(row.data) as CustomTypeNodeData
            const ctRfNode: RFNode = {
              id:       row.id,
              type:     'customType' as const,
              position: row.position,
              data:     ctData as unknown as Record<string, unknown>,
              width:    row.size.w,
              height:   row.size.h,
            }
            if (ctData.msId) {
              ctRfNode.parentId = ctData.msId
              ctRfNode.extent   = 'parent'
            }
            return ctRfNode
          }

          // DTO
          const dtoData = JSON.parse(row.data) as DTONodeData
          // Migrate: backfill fields added in later versions
          dtoData.fields = dtoData.fields.map(f => ({
            ...('arraySubType' in f ? {} : { arraySubType: null }),
            ...('arrayEntityTypeId' in f ? {} : { arrayEntityTypeId: null }),
            ...f,
          }))
          const dtoRfNode: RFNode = {
            id:       row.id,
            type:     'dto' as const,
            position: row.position,
            data:     dtoData,
            width:    row.size.w,
            height:   row.size.h,
          }
          if (dtoData.msId) {
            dtoRfNode.parentId = dtoData.msId
            dtoRfNode.extent   = 'parent'
          }
          return dtoRfNode
        })

      setRfNodes(rfNodesFromIDB)
    }

    void loadNodes()
  }, [nodeRows, setRfNodes, projectId])

  // ─── Load edges from IDB — runs after nodes load ──────────────────
  // Edges are loaded once on mount. After that, RF edge state is the
  // source of truth. Do NOT re-run auto-population on load — the DTO
  // data in IDB already contains the correct fields from creation time.

  useEffect(() => {
    if (!projectId) return
    if (initialEdgesLoadDone.current) return
    // Wait until nodes are loaded so RF has the node data for edge rendering
    if (!initialLoadDone.current) return

    const loadEdges = async (): Promise<void> => {
      if (initialEdgesLoadDone.current) return
      initialEdgesLoadDone.current = true

      const edgeRows = await db.edges.where('projectId').equals(projectId).toArray()

      // Build a quick lookup of loaded node types for legacy STORED_IN guard
      const loadedNodeTypeById: Record<string, string> = {}
      rfNodes.forEach(n => {
        const d = n.data as { type?: string } | undefined
        if (d?.type) loadedNodeTypeById[n.id] = d.type
      })

      const rfEdgesFromIDB: RFEdge[] = edgeRows.flatMap((row): RFEdge[] => {
        if (row.type === EdgeType.STORED_IN) {
          // Legacy guard: old STORED_IN edges point to a DBNode — skip silently.
          // After migration, STORED_IN edges point to TABLE nodes.
          const toNodeType = loadedNodeTypeById[row.toNodeId]
          if (toNodeType === NodeType.DB) return []
          return [{
            id:           row.id,
            source:       row.fromNodeId,
            target:       row.toNodeId,
            sourceHandle: row.fromHandle ?? 'right',
            targetHandle: row.toHandle   ?? 'left',
            type:         'storedIn' as const,
            data:         row as unknown as Record<string, unknown>,
            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--node-db-accent)', width: 12, height: 12 },
          }]
        }
        if (row.type === EdgeType.CONNECTS_TO) {
          return [{
            id:           row.id,
            source:       row.fromNodeId,
            target:       row.toNodeId,
            sourceHandle: row.fromHandle ?? 'right',
            targetHandle: row.toHandle   ?? 'left',
            type:         'connectsTo' as const,
            data:         row as unknown as Record<string, unknown>,
            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--node-db-accent)', width: 12, height: 12 },
          }]
        }
        if (row.type === EdgeType.USES) {
          return [{
            id:           row.id,
            source:       row.fromNodeId,
            target:       row.toNodeId,
            sourceHandle: row.fromHandle ?? 'right',
            targetHandle: row.toHandle   ?? 'left',
            type:         'uses' as const,
            data:         row as unknown as Record<string, unknown>,
            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--node-svc-accent)', width: 12, height: 12 },
          }]
        }
        if (row.type === EdgeType.INVOKES) {
          return [{
            id:           row.id,
            source:       row.fromNodeId,
            target:       row.toNodeId,
            sourceHandle: row.fromHandle ?? 'right',
            targetHandle: row.toHandle   ?? 'left',
            type:         'invokes' as const,
            data:         row as unknown as Record<string, unknown>,
            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--node-ctrl-accent)', width: 12, height: 12 },
          }]
        }
        if (row.type === EdgeType.ROUTES_TO) {
          return [{
            id:           row.id,
            source:       row.fromNodeId,
            target:       row.toNodeId,
            sourceHandle: row.fromHandle ?? 'right',
            targetHandle: row.toHandle   ?? 'left',
            type:         'routesTo' as const,
            data:         row as unknown as Record<string, unknown>,
            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--node-ep-accent)', width: 12, height: 12 },
          }]
        }
        if (row.type === EdgeType.ACCEPTS) {
          return [{
            id:           row.id,
            source:       row.fromNodeId,
            target:       row.toNodeId,
            sourceHandle: row.fromHandle ?? 'right',
            targetHandle: row.toHandle   ?? 'left',
            type:         'accepts' as const,
            data:         row as unknown as Record<string, unknown>,
            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--node-dto-accent)', width: 12, height: 12 },
          }]
        }
        if (row.type === EdgeType.RETURNS) {
          return [{
            id:           row.id,
            source:       row.fromNodeId,
            target:       row.toNodeId,
            sourceHandle: row.fromHandle ?? 'right',
            targetHandle: row.toHandle   ?? 'left',
            type:         'returns' as const,
            data:         row as unknown as Record<string, unknown>,
            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--node-dto-accent)', width: 12, height: 12 },
          }]
        }
        if (row.type === EdgeType.EMBEDS) {
          return [{
            id:           row.id,
            source:       row.fromNodeId,
            target:       row.toNodeId,
            sourceHandle: row.fromHandle ?? 'right',
            targetHandle: row.toHandle   ?? 'left',
            type:         'embeds' as const,
            data:         row as unknown as Record<string, unknown>,
            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--node-entity-accent)', width: 12, height: 12 },
          }]
        }
        if (row.type === EdgeType.RELATES_TO) {
          return [{
            id:           row.id,
            source:       row.fromNodeId,
            target:       row.toNodeId,
            sourceHandle: row.fromHandle ?? 'right',
            targetHandle: row.toHandle   ?? 'left',
            type:         'relatesTo' as const,
            data:         row as unknown as Record<string, unknown>,
            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--color-warning)', width: 12, height: 12 },
          }]
        }
        if (row.type === EdgeType.USES_TYPE) {
          return [{
            id:           row.id,
            source:       row.fromNodeId,
            target:       row.toNodeId,
            sourceHandle: row.fromHandle ?? 'right',
            targetHandle: row.toHandle   ?? 'left',
            type:         'usesType' as const,
            data:         row as unknown as Record<string, unknown>,
            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--node-dto-accent)', width: 12, height: 12 },
          }]
        }
        if (row.type === EdgeType.USES_CUSTOM_TYPE) {
          return [{
            id:           row.id,
            source:       row.fromNodeId,
            target:       row.toNodeId,
            sourceHandle: row.fromHandle ?? '',
            targetHandle: row.toHandle   ?? '',
            type:         'usesCustomType' as const,
            data:         row as unknown as Record<string, unknown>,
            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--node-entity-accent)', width: 12, height: 12 },
          }]
        }
        return [{
          id:           row.id,
          source:       row.fromNodeId,
          target:       row.toNodeId,
          sourceHandle: row.fromHandle ?? 'right',
          targetHandle: row.toHandle   ?? 'left',
          type:         'derivedFrom' as const,
          data:         row as unknown as Record<string, unknown>,
          markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--node-dto-accent)', width: 12, height: 12 },
        }]
      })

      setRfEdges(rfEdgesFromIDB)
    }

    void loadEdges()
  }, [projectId, setRfEdges, nodeRows])

  // ─── onNodesChange — intercept resize-end to persist size ────────

  const rfNodesRef = useRef(rfNodes)
  rfNodesRef.current = rfNodes

  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setRfNodes(nodes => applyNodeChanges(changes, nodes))

      if (!activeProjectId) return

      changes.forEach(change => {
        if (change.type !== 'dimensions') return
        if (change.resizing) return  // still dragging the handle — wait for end

        const node = rfNodesRef.current.find(n => n.id === change.id)
        if (!node) return

        const w    = change.dimensions?.width  ?? node.width  ?? 220
        const h    = change.dimensions?.height ?? node.height ?? 180
        const data = node.data as unknown as MicroserviceNode | EntityNode | DTONode | DBNode

        updateNode({
          id:        node.id,
          projectId: activeProjectId,
          type:      data.type,
          label:     data.label,
          position:  node.position,
          size:      { w, h },
          data:      JSON.stringify({ ...data, size: { w, h } }),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      })
    },
    [activeProjectId, setRfNodes, updateNode],
  )

  // ─── Event handlers ───────────────────────────────────────────────

  const onNodeClick = (_event: React.MouseEvent, node: RFNode): void => {
    setSelectedNode(node.id)
    setSelectedEdge(null)
    setRightPanelTab('inspector')
    fitView({ nodes: [{ id: node.id }], duration: 350, padding: 0.25, maxZoom: 1.5 })
  }

  const onEdgeClick = (_event: React.MouseEvent, edge: RFEdge): void => {
    setSelectedEdge(edge.id)
    setSelectedNode(null)
  }

  const onPaneClick = (): void => {
    clearSelection()
  }

  // ─── handleConnect — async implementation ─────────────────────────

  const handleConnect = useCallback(async (connection: Connection): Promise<void> => {
    if (!activeProjectId) return
    if (!connection.source || !connection.target) return

    const sourceNode = rfNodes.find(n => n.id === connection.source)
    const targetNode = rfNodes.find(n => n.id === connection.target)
    if (!sourceNode || !targetNode) return

    const sourceType = (sourceNode.data as { type?: string }).type
    const targetType = (targetNode.data as { type?: string }).type

    // ─── Guard: Block all manual edges to or from CustomTypeNode ──
    // All USES_CUSTOM_TYPE edges are created programmatically only —
    // via syncCustomTypeEdges when a field type is set to CUSTOM_TYPE_REF.
    if (
      sourceType === NodeType.CUSTOM_TYPE ||
      targetType === NodeType.CUSTOM_TYPE
    ) {
      return  // silently reject — no toast, no error
    }

    // ─── Handle Entity↔DB pair — STORED_IN edge ──────────────────
    const isEntityDBPair =
      (sourceType === NodeType.ENTITY && targetType === NodeType.DB) ||
      (sourceType === NodeType.DB     && targetType === NodeType.ENTITY)

    if (isEntityDBPair) {
      // Normalise: canonical storage is Entity→DB
      const sourceWasEntity  = sourceType === NodeType.ENTITY
      const entityId = sourceWasEntity ? sourceNode.id : targetNode.id
      const dbId     = sourceWasEntity ? targetNode.id : sourceNode.id

      const entityRFNode = rfNodes.find(n => n.id === entityId)
      const dbRFNode     = rfNodes.find(n => n.id === dbId)
      if (!entityRFNode || !dbRFNode) return

      // Rejection check 1: entity already has a STORED_IN edge
      const entityAlreadyConnected = rfEdges.some(e => {
        const edgeData = e.data as { type?: string } | undefined
        return edgeData?.type === EdgeType.STORED_IN && (e.source === entityId || e.target === entityId)
      })
      if (entityAlreadyConnected) return

      // Rejection check 2: DB already has a STORED_IN edge
      const dbAlreadyConnected = rfEdges.some(e => {
        const edgeData = e.data as { type?: string } | undefined
        return edgeData?.type === EdgeType.STORED_IN && (e.source === dbId || e.target === dbId)
      })
      if (dbAlreadyConnected) return

      // Rejection check 3: edge between this exact pair already exists
      const pairExists = rfEdges.some(e =>
        (e.source === entityId && e.target === dbId) ||
        (e.source === dbId     && e.target === entityId),
      )
      if (pairExists) return

      const entityNode = entityRFNode.data as unknown as EntityNode
      const dbNode     = dbRFNode.data     as unknown as DBNode

      // Auto-populate: update DB label/dbName if still default
      const updatedDB: DBNode = {
        ...dbNode,
        label:  dbNode.label  === 'Database' ? `${entityNode.tableName}_db` : dbNode.label,
        dbName: dbNode.dbName === 'app_db'   ? `${entityNode.tableName}_db` : dbNode.dbName,
      }

      const edgeId = generateId()
      const entityHandleId = sourceWasEntity ? (connection.sourceHandle ?? 'right') : (connection.targetHandle ?? 'left')
      const dbHandleId     = sourceWasEntity ? (connection.targetHandle ?? 'left')  : (connection.sourceHandle ?? 'right')

      await db.edges.add({
        id:         edgeId,
        projectId:  activeProjectId,
        fromNodeId: entityId,
        toNodeId:   dbId,
        type:       EdgeType.STORED_IN,
        label:      EdgeType.STORED_IN,
        fromHandle: entityHandleId,
        toHandle:   dbHandleId,
      })

      await db.nodes.update(dbId, {
        label:     updatedDB.label,
        data:      JSON.stringify(updatedDB),
        updatedAt: Date.now(),
      })

      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
      bc.close()

      setRfEdges(edges => [
        ...edges,
        {
          id:           edgeId,
          source:       entityId,
          target:       dbId,
          sourceHandle: entityHandleId,
          targetHandle: dbHandleId,
          type:         'storedIn' as const,
          data:         {
            id:         edgeId,
            projectId:  activeProjectId,
            fromNodeId: entityId,
            toNodeId:   dbId,
            type:       EdgeType.STORED_IN,
            label:      EdgeType.STORED_IN,
            fromHandle: entityHandleId,
            toHandle:   dbHandleId,
          } as unknown as Record<string, unknown>,
          markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--node-db-accent)', width: 12, height: 12 },
        },
      ])

      setRfNodes(nodes => nodes.map(n =>
        n.id === dbId
          ? { ...n, data: updatedDB as unknown as Record<string, unknown> }
          : n,
      ))
      return
    }

    // ─── Handle Entity↔Table pair — STORED_IN edge ───────────────
    const isEntityTablePair =
      (sourceType === NodeType.ENTITY && targetType === NodeType.TABLE) ||
      (sourceType === NodeType.TABLE  && targetType === NodeType.ENTITY)

    if (isEntityTablePair) {
      // Normalise: canonical storage is Entity→Table (fromNodeId=entity, toNodeId=table)
      const sourceWasEntity = sourceType === NodeType.ENTITY
      const entityId = sourceWasEntity ? sourceNode.id : targetNode.id
      const tableId  = sourceWasEntity ? targetNode.id : sourceNode.id

      const entityRFNode = rfNodes.find(n => n.id === entityId)
      const tableRFNode  = rfNodes.find(n => n.id === tableId)
      if (!entityRFNode || !tableRFNode) return

      // Guard 1: entity already has a STORED_IN edge (one-to-one)
      const entityAlreadyHasTable = rfEdges.some(e => {
        const edgeData = e.data as { type?: string } | undefined
        return edgeData?.type === EdgeType.STORED_IN && e.source === entityId
      })
      if (entityAlreadyHasTable) return

      // Guard 2: table already has an entity via STORED_IN (one-to-one)
      const tableAlreadyHasEntity = rfEdges.some(e => {
        const edgeData = e.data as { type?: string } | undefined
        return edgeData?.type === EdgeType.STORED_IN && e.target === tableId
      })
      if (tableAlreadyHasEntity) return

      const entityNode = entityRFNode.data as unknown as EntityNode
      const tableNode  = tableRFNode.data  as unknown as TableNode

      // Auto-populate: set entityId, optionally update tableName
      const updatedTable = applyStoredInEdge(entityNode, tableNode)

      const edgeId = generateId()
      const entityHandleId = sourceWasEntity ? (connection.sourceHandle ?? 'right') : (connection.targetHandle ?? 'left')
      const tableHandleId  = sourceWasEntity ? (connection.targetHandle ?? 'left')  : (connection.sourceHandle ?? 'right')

      await db.edges.add({
        id:         edgeId,
        projectId:  activeProjectId,
        fromNodeId: entityId,
        toNodeId:   tableId,
        type:       EdgeType.STORED_IN,
        label:      EdgeType.STORED_IN,
        fromHandle: entityHandleId,
        toHandle:   tableHandleId,
      })

      await db.nodes.update(tableId, {
        data:      JSON.stringify(updatedTable),
        updatedAt: Date.now(),
      })

      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
      bc.close()

      setRfEdges(edges => [
        ...edges,
        {
          id:           edgeId,
          source:       entityId,
          target:       tableId,
          sourceHandle: entityHandleId,
          targetHandle: tableHandleId,
          type:         'storedIn' as const,
          data:         {
            id:         edgeId,
            projectId:  activeProjectId,
            fromNodeId: entityId,
            toNodeId:   tableId,
            type:       EdgeType.STORED_IN,
            label:      EdgeType.STORED_IN,
            fromHandle: entityHandleId,
            toHandle:   tableHandleId,
          } as unknown as Record<string, unknown>,
          markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--node-entity-accent)', width: 12, height: 12 },
        },
      ])

      setRfNodes(nodes => nodes.map(n =>
        n.id === tableId
          ? { ...n, data: updatedTable as unknown as Record<string, unknown> }
          : n,
      ))

      // ── Sync entity-type fields across all nodes that reference this entity ──
      {
        // Build updated edge list (add the newly created STORED_IN edge)
        const newStoredInEdge: import('@xyflow/react').Edge = {
          id:           edgeId,
          source:       entityId,
          target:       tableId,
          type:         'storedIn' as const,
          data:         { type: EdgeType.STORED_IN } as unknown as Record<string, unknown>,
        }
        const edgesWithNew = [...rfEdges, newStoredInEdge]
        const syncResult   = syncEntityTypeFields(entityId, true, rfNodes, edgesWithNew)

        for (const [nid, updatedNodeData] of syncResult.updatedNodes) {
          setRfNodes(nodes => nodes.map(n =>
            n.id === nid ? { ...n, data: updatedNodeData as unknown as Record<string, unknown> } : n,
          ))
          await db.nodes.update(nid, { data: JSON.stringify(updatedNodeData), updatedAt: Date.now() })
        }

        for (const change of syncResult.updatedEdges) {
          if (change.action === 'remove') {
            await db.edges.delete(change.edgeId)
            setRfEdges(edges => edges.filter(e => e.id !== change.edgeId))
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
            setRfEdges(edges => [
              ...edges,
              {
                id:     change.edgeId,
                source: fromId,
                target: toId,
                type:   rfType,
                data:   newEd as unknown as Record<string, unknown>,
                markerEnd: { type: MarkerType.ArrowClosed, color: rfType === 'embeds' ? 'var(--node-entity-accent)' : 'var(--color-warning)', width: 12, height: 12 },
              },
            ])
          }
        }

        if (syncResult.updatedNodes.size > 0 || syncResult.updatedEdges.length > 0) {
          const bcSync = new BroadcastChannel('archflow-sync')
          bcSync.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
          bcSync.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
          bcSync.close()
        }
      }
      return
    }

    // ─── Handle Table↔DB pair — CONNECTS_TO edge ─────────────────
    const isTableDBPair =
      (sourceType === NodeType.TABLE && targetType === NodeType.DB) ||
      (sourceType === NodeType.DB    && targetType === NodeType.TABLE)

    if (isTableDBPair) {
      // Normalise: canonical storage is Table→DB (fromNodeId=table, toNodeId=db)
      const sourceWasTable = sourceType === NodeType.TABLE
      const tableId = sourceWasTable ? sourceNode.id : targetNode.id
      const dbId    = sourceWasTable ? targetNode.id : sourceNode.id

      const tableRFNode = rfNodes.find(n => n.id === tableId)
      const dbRFNode    = rfNodes.find(n => n.id === dbId)
      if (!tableRFNode || !dbRFNode) return

      // Guard 1: table already has a CONNECTS_TO edge (one-to-one table→db)
      const tableAlreadyHasDB = rfEdges.some(e => {
        const edgeData = e.data as { type?: string } | undefined
        return edgeData?.type === EdgeType.CONNECTS_TO && e.source === tableId
      })
      if (tableAlreadyHasDB) return

      // Guard 2: this exact Table→DB pair already exists
      const pairAlreadyExists = rfEdges.some(e => {
        const edgeData = e.data as { type?: string } | undefined
        return edgeData?.type === EdgeType.CONNECTS_TO && e.source === tableId && e.target === dbId
      })
      if (pairAlreadyExists) return

      const tableNode = tableRFNode.data as unknown as TableNode
      const dbNode    = dbRFNode.data    as unknown as DBNode

      // Auto-populate: set dbNodeId on the table
      const updatedTable = applyConnectsToEdge(tableNode, dbNode)

      const edgeId = generateId()
      const tableHandleId = sourceWasTable ? (connection.sourceHandle ?? 'right') : (connection.targetHandle ?? 'left')
      const dbHandleId    = sourceWasTable ? (connection.targetHandle ?? 'left')  : (connection.sourceHandle ?? 'right')

      await db.edges.add({
        id:         edgeId,
        projectId:  activeProjectId,
        fromNodeId: tableId,
        toNodeId:   dbId,
        type:       EdgeType.CONNECTS_TO,
        label:      EdgeType.CONNECTS_TO,
        fromHandle: tableHandleId,
        toHandle:   dbHandleId,
      })

      await db.nodes.update(tableId, {
        data:      JSON.stringify(updatedTable),
        updatedAt: Date.now(),
      })

      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
      bc.close()

      setRfEdges(edges => [
        ...edges,
        {
          id:           edgeId,
          source:       tableId,
          target:       dbId,
          sourceHandle: tableHandleId,
          targetHandle: dbHandleId,
          type:         'connectsTo' as const,
          data:         {
            id:         edgeId,
            projectId:  activeProjectId,
            fromNodeId: tableId,
            toNodeId:   dbId,
            type:       EdgeType.CONNECTS_TO,
            label:      EdgeType.CONNECTS_TO,
            fromHandle: tableHandleId,
            toHandle:   dbHandleId,
          } as unknown as Record<string, unknown>,
          markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--node-db-accent)', width: 12, height: 12 },
        },
      ])

      setRfNodes(nodes => nodes.map(n =>
        n.id === tableId
          ? { ...n, data: updatedTable as unknown as Record<string, unknown> }
          : n,
      ))
      return
    }

    // ─── Handle Service↔Entity pair — USES edge ──────────────────
    const isServiceEntityPair =
      (sourceType === NodeType.SERVICE && targetType === NodeType.ENTITY) ||
      (sourceType === NodeType.ENTITY  && targetType === NodeType.SERVICE)

    if (isServiceEntityPair) {
      // Normalise: canonical direction is Service→Entity (source=service, target=entity)
      const sourceWasService = sourceType === NodeType.SERVICE
      const serviceId = sourceWasService ? sourceNode.id : targetNode.id
      const seEntityId = sourceWasService ? targetNode.id : sourceNode.id

      const serviceHandleId = sourceWasService ? (connection.sourceHandle ?? 'right') : (connection.targetHandle ?? 'left')
      const seEntityHandleId = sourceWasService ? (connection.targetHandle ?? 'left')  : (connection.sourceHandle ?? 'right')

      const serviceRFNode  = rfNodes.find(n => n.id === serviceId)
      const seEntityRFNode = rfNodes.find(n => n.id === seEntityId)
      if (!serviceRFNode || !seEntityRFNode) return

      // Guard: service already has a USES edge — one entity only
      const serviceAlreadyConnected = rfEdges.some(e => {
        const edgeData = e.data as { type?: string } | undefined
        return edgeData?.type === EdgeType.USES && e.source === serviceId
      })
      if (serviceAlreadyConnected) return

      const serviceNode  = serviceRFNode.data  as unknown as ServiceNode
      const seEntityNode = seEntityRFNode.data as unknown as EntityNode

      // Auto-populate: generate 5 CRUD methods from the entity
      const updatedService = applyUsesEdge(serviceNode, seEntityNode)

      const edgeId = generateId()

      await db.edges.add({
        id:         edgeId,
        projectId:  activeProjectId,
        fromNodeId: serviceId,
        toNodeId:   seEntityId,
        type:       EdgeType.USES,
        label:      EdgeType.USES,
        fromHandle: serviceHandleId,
        toHandle:   seEntityHandleId,
      })

      await db.nodes.update(serviceId, {
        data:      JSON.stringify(updatedService),
        updatedAt: Date.now(),
      })

      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
      bc.close()

      setRfEdges(edges => [
        ...edges,
        {
          id:           edgeId,
          source:       serviceId,
          target:       seEntityId,
          sourceHandle: serviceHandleId,
          targetHandle: seEntityHandleId,
          type:         'uses' as const,
          data:         {
            id:         edgeId,
            projectId:  activeProjectId,
            fromNodeId: serviceId,
            toNodeId:   seEntityId,
            type:       EdgeType.USES,
            label:      EdgeType.USES,
            fromHandle: serviceHandleId,
            toHandle:   seEntityHandleId,
          } as unknown as Record<string, unknown>,
          markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--node-svc-accent)', width: 12, height: 12 },
        },
      ])

      setRfNodes(nodes => nodes.map(n =>
        n.id === serviceId
          ? { ...n, data: updatedService as unknown as Record<string, unknown> }
          : n,
      ))
      return
    }

    // ─── Handle Controller↔Service pair — INVOKES edge ──────────
    const isControllerServicePair =
      (sourceType === NodeType.CONTROLLER && targetType === NodeType.SERVICE) ||
      (sourceType === NodeType.SERVICE    && targetType === NodeType.CONTROLLER)

    if (isControllerServicePair) {
      // Normalise: canonical direction is Controller→Service (source=controller, target=service)
      const sourceWasController = sourceType === NodeType.CONTROLLER
      const controllerId = sourceWasController ? sourceNode.id : targetNode.id
      const serviceId    = sourceWasController ? targetNode.id : sourceNode.id

      const controllerHandleId = sourceWasController ? (connection.sourceHandle ?? 'right') : (connection.targetHandle ?? 'left')
      const serviceHandleId    = sourceWasController ? (connection.targetHandle ?? 'left')  : (connection.sourceHandle ?? 'right')

      const controllerRFNode = rfNodes.find(n => n.id === controllerId)
      const serviceRFNode    = rfNodes.find(n => n.id === serviceId)
      if (!controllerRFNode || !serviceRFNode) return

      // Guard: this controller already has an INVOKES edge (one service only)
      const controllerAlreadyHasService = rfEdges.some(e => {
        const edgeData = e.data as { type?: string } | undefined
        return edgeData?.type === EdgeType.INVOKES && e.source === controllerId
      })
      if (controllerAlreadyHasService) return

      const controllerNode = controllerRFNode.data as unknown as ControllerNode
      const serviceNode    = serviceRFNode.data    as unknown as ServiceNode

      const edgeId = generateId()

      await db.edges.add({
        id:         edgeId,
        projectId:  activeProjectId,
        fromNodeId: controllerId,
        toNodeId:   serviceId,
        type:       EdgeType.INVOKES,
        label:      EdgeType.INVOKES,
        fromHandle: controllerHandleId,
        toHandle:   serviceHandleId,
      })

      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.close()

      setRfEdges(edges => [
        ...edges,
        {
          id:           edgeId,
          source:       controllerId,
          target:       serviceId,
          sourceHandle: controllerHandleId,
          targetHandle: serviceHandleId,
          type:         'invokes' as const,
          data:         {
            id:         edgeId,
            projectId:  activeProjectId,
            fromNodeId: controllerId,
            toNodeId:   serviceId,
            type:       EdgeType.INVOKES,
            label:      EdgeType.INVOKES,
            fromHandle: controllerHandleId,
            toHandle:   serviceHandleId,
          } as unknown as Record<string, unknown>,
          markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--node-ctrl-accent)', width: 12, height: 12 },
        },
      ])

      // Toast — structural only, no node data changes
      void controllerNode
      void serviceNode
      return
    }

    // ─── Handle Endpoint↔Controller pair — ROUTES_TO edge ────────
    const isEndpointControllerPair =
      (sourceType === NodeType.API_ENDPOINT && targetType === NodeType.CONTROLLER) ||
      (sourceType === NodeType.CONTROLLER   && targetType === NodeType.API_ENDPOINT)

    if (isEndpointControllerPair) {
      // Normalise: fromNodeId = endpoint, toNodeId = controller
      const sourceWasEndpoint = sourceType === NodeType.API_ENDPOINT
      const endpointId    = sourceWasEndpoint ? sourceNode.id : targetNode.id
      const controllerId  = sourceWasEndpoint ? targetNode.id : sourceNode.id

      const endpointHandleId   = sourceWasEndpoint ? (connection.sourceHandle ?? 'right') : (connection.targetHandle ?? 'left')
      const controllerHandleId = sourceWasEndpoint ? (connection.targetHandle ?? 'left')  : (connection.sourceHandle ?? 'right')

      const endpointRFNode    = rfNodes.find(n => n.id === endpointId)
      const controllerRFNode  = rfNodes.find(n => n.id === controllerId)
      if (!endpointRFNode || !controllerRFNode) return

      // Guard: endpoint already has a ROUTES_TO edge
      const endpointAlreadyRouted = rfEdges.some(e => {
        const edgeData = e.data as { type?: string } | undefined
        return edgeData?.type === EdgeType.ROUTES_TO && e.source === endpointId
      })
      if (endpointAlreadyRouted) return

      const endpointNode = endpointRFNode.data as unknown as APIEndpointNode

      // Auto-populate: success code, pathVar, paginated
      const successCode =
        endpointNode.method === HttpMethod.POST   ? 201
        : endpointNode.method === HttpMethod.DELETE ? 204
        : 200

      const pathVarMatch = endpointNode.path.match(/\{(\w+)\}/)
      const existingVarNames = endpointNode.request.pathVars.map(v => v.name)
      const newPathVars = pathVarMatch && !existingVarNames.includes(pathVarMatch[1])
        ? [...endpointNode.request.pathVars, { name: pathVarMatch[1], type: JavaType.UUID }]
        : endpointNode.request.pathVars

      const paginated = endpointNode.method === HttpMethod.GET && !endpointNode.path.includes('{')
        ? true
        : endpointNode.config.paginated

      const updatedEndpoint: APIEndpointNode = {
        ...endpointNode,
        response: { ...endpointNode.response, successCode },
        config:   { ...endpointNode.config,   paginated },
        request:  { ...endpointNode.request,  pathVars: newPathVars },
      }

      const edgeId = generateId()

      await db.edges.add({
        id:         edgeId,
        projectId:  activeProjectId,
        fromNodeId: endpointId,
        toNodeId:   controllerId,
        type:       EdgeType.ROUTES_TO,
        label:      EdgeType.ROUTES_TO,
        fromHandle: endpointHandleId,
        toHandle:   controllerHandleId,
      })

      await db.nodes.update(endpointId, {
        data:      JSON.stringify(updatedEndpoint),
        updatedAt: Date.now(),
      })

      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
      bc.close()

      setRfEdges(edges => [
        ...edges,
        {
          id:           edgeId,
          source:       endpointId,
          target:       controllerId,
          sourceHandle: endpointHandleId,
          targetHandle: controllerHandleId,
          type:         'routesTo' as const,
          data:         {
            id:         edgeId,
            projectId:  activeProjectId,
            fromNodeId: endpointId,
            toNodeId:   controllerId,
            type:       EdgeType.ROUTES_TO,
            label:      EdgeType.ROUTES_TO,
            fromHandle: endpointHandleId,
            toHandle:   controllerHandleId,
          } as unknown as Record<string, unknown>,
          markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--node-ep-accent)', width: 12, height: 12 },
        },
      ])

      setRfNodes(nodes => nodes.map(n =>
        n.id === endpointId
          ? { ...n, data: updatedEndpoint as unknown as Record<string, unknown> }
          : n,
      ))
      return
    }

    // ─── Handle Endpoint↔DTO pair — ACCEPTS or RETURNS edge ──────
    const isEndpointDTOPair =
      (sourceType === NodeType.API_ENDPOINT && targetType === NodeType.DTO) ||
      (sourceType === NodeType.DTO          && targetType === NodeType.API_ENDPOINT)

    if (isEndpointDTOPair) {
      // Reject if either side is an EntityNode (already guarded by type check above)
      // Normalise: fromNodeId = endpoint, toNodeId = dto
      const sourceWasEndpoint = sourceType === NodeType.API_ENDPOINT
      const endpointId  = sourceWasEndpoint ? sourceNode.id : targetNode.id
      const epDtoId     = sourceWasEndpoint ? targetNode.id : sourceNode.id

      const endpointHandleId = sourceWasEndpoint ? (connection.sourceHandle ?? 'right') : (connection.targetHandle ?? 'left')
      const epDtoHandleId    = sourceWasEndpoint ? (connection.targetHandle ?? 'left')  : (connection.sourceHandle ?? 'right')

      const endpointRFNode = rfNodes.find(n => n.id === endpointId)
      const epDtoRFNode    = rfNodes.find(n => n.id === epDtoId)
      if (!endpointRFNode || !epDtoRFNode) return

      const endpointNode = endpointRFNode.data as unknown as APIEndpointNode
      const dtoNode      = epDtoRFNode.data    as unknown as DTONode

      // Guard: both slots already occupied → reject
      const bodyEmpty   = endpointNode.request.bodyDTOId   === null
      const returnEmpty = endpointNode.response.returnDTOId === null
      if (!bodyEmpty && !returnEmpty) return

      // Determine which slots to fill based on DTO purpose
      const fillBody   = dtoNode.purpose === DTOPurpose.REQUEST  ||
                         dtoNode.purpose === DTOPurpose.BOTH && bodyEmpty
      const fillReturn = dtoNode.purpose === DTOPurpose.RESPONSE ||
                         dtoNode.purpose === DTOPurpose.BOTH && returnEmpty

      // Guard: single-purpose DTO slot already occupied
      if (dtoNode.purpose === DTOPurpose.REQUEST  && !bodyEmpty)   return
      if (dtoNode.purpose === DTOPurpose.RESPONSE && !returnEmpty) return
      if (!fillBody && !fillReturn) return

      // Build updated endpoint
      let updatedEndpoint: APIEndpointNode = endpointNode
      if (fillBody)   updatedEndpoint = { ...updatedEndpoint, request:  { ...updatedEndpoint.request,  bodyDTOId:   epDtoId } }
      if (fillReturn) updatedEndpoint = { ...updatedEndpoint, response: { ...updatedEndpoint.response, returnDTOId: epDtoId } }

      // Create edge(s)
      const makeEdgeRow = (eid: string, type: EdgeType) => ({
        id:         eid,
        projectId:  activeProjectId,
        fromNodeId: endpointId,
        toNodeId:   epDtoId,
        type,
        label:      type,
        fromHandle: endpointHandleId,
        toHandle:   epDtoHandleId,
      })
      const makeRfEdge = (eid: string, type: EdgeType) => ({
        id:           eid,
        source:       endpointId,
        target:       epDtoId,
        sourceHandle: endpointHandleId,
        targetHandle: epDtoHandleId,
        type:         (type === EdgeType.ACCEPTS ? 'accepts' : 'returns') as 'accepts' | 'returns',
        data:         makeEdgeRow(eid, type) as unknown as Record<string, unknown>,
        markerEnd:    { type: MarkerType.ArrowClosed, color: 'var(--node-dto-accent)', width: 12, height: 12 },
      })

      if (fillBody) {
        const eid = generateId()
        await db.edges.add(makeEdgeRow(eid, EdgeType.ACCEPTS))
        setRfEdges(edges => [...edges, makeRfEdge(eid, EdgeType.ACCEPTS)])
      }
      if (fillReturn) {
        const eid = generateId()
        await db.edges.add(makeEdgeRow(eid, EdgeType.RETURNS))
        setRfEdges(edges => [...edges, makeRfEdge(eid, EdgeType.RETURNS)])
      }

      await db.nodes.update(endpointId, { data: JSON.stringify(updatedEndpoint), updatedAt: Date.now() })

      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
      bc.close()

      setRfNodes(nodes => nodes.map(n =>
        n.id === endpointId ? { ...n, data: updatedEndpoint as unknown as Record<string, unknown> } : n,
      ))
      return
    }

    // ─── Handle Entity↔Entity pair — opens RelationshipModal ─────
    if (sourceType === NodeType.ENTITY && targetType === NodeType.ENTITY) {
      openRelationshipModal({
        trigger:      'CANVAS_EDGE',
        entityAId:    connection.source,
        entityBId:    connection.target,
        fieldId:      null,
        sourceHandle: connection.sourceHandle ?? null,
        targetHandle: connection.targetHandle ?? null,
      })
      return  // edge created by modal via applyRelationship
    }

    // ─── Handle Entity/DTO ↔ CustomType pair — USES_CUSTOM_TYPE edge ─
    const isNodeCustomTypePair =
      (sourceType === NodeType.ENTITY      && targetType === NodeType.CUSTOM_TYPE) ||
      (sourceType === NodeType.CUSTOM_TYPE && targetType === NodeType.ENTITY)      ||
      (sourceType === NodeType.DTO         && targetType === NodeType.CUSTOM_TYPE) ||
      (sourceType === NodeType.CUSTOM_TYPE && targetType === NodeType.DTO)

    if (isNodeCustomTypePair) {
      // Canonical direction: source = entity/dto, target = customType
      const isSourceCustomType = sourceType === NodeType.CUSTOM_TYPE
      const hostId   = isSourceCustomType ? targetNode.id : sourceNode.id
      const customId = isSourceCustomType ? sourceNode.id : targetNode.id

      const alreadyExists = rfEdges.some(e => {
        const d = e.data as { type?: string } | undefined
        return d?.type === EdgeType.USES_CUSTOM_TYPE && e.source === hostId && e.target === customId
      })
      if (alreadyExists) return

      const edgeId     = generateId()
      const newEdgeRow = {
        id:         edgeId,
        projectId:  activeProjectId,
        fromNodeId: hostId,
        toNodeId:   customId,
        type:       EdgeType.USES_CUSTOM_TYPE,
        label:      EdgeType.USES_CUSTOM_TYPE,
        fromHandle: isSourceCustomType ? (connection.targetHandle ?? '') : (connection.sourceHandle ?? ''),
        toHandle:   isSourceCustomType ? (connection.sourceHandle ?? '') : (connection.targetHandle ?? ''),
      }
      await db.edges.add(newEdgeRow)
      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.close()
      setRfEdges(edges => [
        ...edges,
        {
          id:     edgeId,
          source: hostId,
          target: customId,
          type:   'usesCustomType' as const,
          data:   newEdgeRow as unknown as Record<string, unknown>,
        },
      ])
      return
    }

    // ─── Handle Entity↔DTO pair — DERIVED_FROM edge ──────────────
    const isEntityDTOPair =
      (sourceType === NodeType.ENTITY && targetType === NodeType.DTO) ||
      (sourceType === NodeType.DTO    && targetType === NodeType.ENTITY)
    if (!isEntityDTOPair) return

    // Normalise: canonical storage is DTO→Entity (source=dto, target=entity)
    const sourceWasDTO = sourceType === NodeType.DTO
    const dtoId    = sourceWasDTO ? sourceNode.id : targetNode.id
    const entityId = sourceWasDTO ? targetNode.id : sourceNode.id

    // Preserve the handle the user actually dragged from/to, mapped to canonical direction
    const dtoHandleId    = sourceWasDTO ? (connection.sourceHandle ?? 'right') : (connection.targetHandle ?? 'left')
    const entityHandleId = sourceWasDTO ? (connection.targetHandle ?? 'left')  : (connection.sourceHandle ?? 'right')

    const dtoRFNode    = rfNodes.find(n => n.id === dtoId)
    const entityRFNode = rfNodes.find(n => n.id === entityId)
    if (!dtoRFNode || !entityRFNode) return

    // One-edge rule: only one edge between a given Entity–DTO pair
    const alreadyExists = rfEdges.some(e =>
      (e.source === dtoId && e.target === entityId) ||
      (e.source === entityId && e.target === dtoId),
    )
    if (alreadyExists) return

    const dtoNode    = dtoRFNode.data    as unknown as DTONode
    const entityNode = entityRFNode.data as unknown as EntityNode

    // Auto-populate: copy entity fields into DTO
    const updatedDto = applyDerivedFromEdge(dtoNode, entityNode)

    // Persist edge to IDB
    const edgeId = generateId()
    await db.edges.add({
      id:         edgeId,
      projectId:  activeProjectId,
      fromNodeId: dtoId,
      toNodeId:   entityId,
      type:       EdgeType.DERIVED_FROM,
      label:      EdgeType.DERIVED_FROM,
      fromHandle: dtoHandleId,
      toHandle:   entityHandleId,
    })

    // Persist updated DTO to IDB
    await db.nodes.update(dtoId, {
      data:      JSON.stringify(updatedDto),
      updatedAt: Date.now(),
    })

    // ── Create USES_TYPE edges for any entity-ref fields added by auto-populate ──
    // Collect unique entity IDs referenced by the new DTO fields (type or arraySubType)
    const existingUsesTypeTargets = new Set(
      rfEdges
        .filter(e => {
          const d = e.data as { type?: string } | undefined
          return d?.type === EdgeType.USES_TYPE && e.source === dtoId
        })
        .map(e => e.target),
    )
    const entityRefsToLink = new Set<string>()
    for (const f of updatedDto.fields) {
      if (f.type === 'ENTITY_REF' && f.entityTypeId && !existingUsesTypeTargets.has(f.entityTypeId)) {
        entityRefsToLink.add(f.entityTypeId)
      }
      if (f.arraySubType === 'ENTITY_REF' && f.arrayEntityTypeId && !existingUsesTypeTargets.has(f.arrayEntityTypeId)) {
        entityRefsToLink.add(f.arrayEntityTypeId)
      }
    }
    const newUsesTypeRfEdges: RFEdge[] = []
    for (const refEntityId of entityRefsToLink) {
      const utEdgeId  = generateId()
      const utEdgeRow = {
        id:         utEdgeId,
        projectId:  activeProjectId,
        fromNodeId: dtoId,
        toNodeId:   refEntityId,
        type:       EdgeType.USES_TYPE,
        label:      EdgeType.USES_TYPE,
        fromHandle: '',
        toHandle:   '',
      }
      await db.edges.add(utEdgeRow)
      newUsesTypeRfEdges.push({
        id:     utEdgeId,
        source: dtoId,
        target: refEntityId,
        type:   'usesType' as const,
        data:   utEdgeRow as unknown as Record<string, unknown>,
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--node-dto-accent)', width: 12, height: 12 },
      })
    }

    // BroadcastChannel cross-tab sync
    const bc = new BroadcastChannel('archflow-sync')
    bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
    bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
    bc.close()

    // Update RF state
    setRfEdges(edges => [
      ...edges,
      {
        id:           edgeId,
        source:       dtoId,
        target:       entityId,
        sourceHandle: dtoHandleId,
        targetHandle: entityHandleId,
        type:         'derivedFrom' as const,
        data:         {
          id:         edgeId,
          projectId:  activeProjectId,
          fromNodeId: dtoId,
          toNodeId:   entityId,
          type:       EdgeType.DERIVED_FROM,
          label:      EdgeType.DERIVED_FROM,
          fromHandle: dtoHandleId,
          toHandle:   entityHandleId,
        } as unknown as Record<string, unknown>,
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--node-dto-accent)', width: 12, height: 12 },
      },
      ...newUsesTypeRfEdges,
    ])

    setRfNodes(nodes => nodes.map(n =>
      n.id === dtoId
        ? { ...n, data: updatedDto as unknown as Record<string, unknown> }
        : n,
    ))

    // ── Fix 2: Sync USES_CUSTOM_TYPE edges for any CUSTOM_TYPE_REF fields
    // inherited from the entity during DERIVED_FROM auto-population.
    // updatedDto.fields may contain CUSTOM_TYPE_REF fields copied from entity —
    // ensure corresponding USES_CUSTOM_TYPE edges exist on the DTO.
    // Note: currentEdges at this point doesn't include the new USES_TYPE edges yet,
    // but syncCustomTypeEdges only looks at USES_CUSTOM_TYPE edges so that is fine.
    syncCustomTypeEdges(
      dtoId,
      updatedDto.fields,
      rfEdges,
      setRfEdges,
      activeProjectId,
    )
  }, [activeProjectId, rfNodes, rfEdges, setRfEdges, setRfNodes, openRelationshipModal])

  const onConnect = useCallback((connection: Connection): void => {
    void handleConnect(connection)
  }, [handleConnect])

  // ─── handleDeleteEdge — removes an edge and cleans up DTO ─────────

  const handleDeleteEdge = useCallback(async (edgeId: string): Promise<void> => {
    if (!activeProjectId) return
    const edge = rfEdges.find(e => e.id === edgeId)
    if (!edge) return

    const dtoId    = edge.source
    const entityId = edge.target

    // Delete from IDB
    await db.edges.delete(edgeId)

    // Remove from RF edges
    setRfEdges(edges => edges.filter(e => e.id !== edgeId))

    // Update DTO: remove entitySource, conditionally strip fields
    const dtoRFNode = rfNodes.find(n => n.id === dtoId)
    if (dtoRFNode) {
      const dtoNode    = dtoRFNode.data as unknown as DTONode
      const newSources = dtoNode.entitySources.filter(s => s.entityId !== entityId)

      // Rule 4: DERIVED DTO → remove fields that came from the removed entity
      // Rule 5: CUSTOM DTO → keep all fields
      const updatedFields = dtoNode.origin === DTOOrigin.DERIVED
        ? dtoNode.fields.filter(f => f.sourceEntityId !== entityId)
        : dtoNode.fields

      const updatedDto: DTONode = {
        ...dtoNode,
        fields:        updatedFields,
        entitySources: newSources,
        origin:        newSources.length === 0 ? DTOOrigin.CUSTOM : dtoNode.origin,
      }

      await db.nodes.update(dtoId, {
        data:      JSON.stringify(updatedDto),
        updatedAt: Date.now(),
      })

      setRfNodes(nodes => nodes.map(n =>
        n.id === dtoId
          ? { ...n, data: updatedDto as unknown as Record<string, unknown> }
          : n,
      ))
    }

    // BroadcastChannel cross-tab sync
    const bc = new BroadcastChannel('archflow-sync')
    bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
    bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
    bc.close()
  }, [activeProjectId, rfEdges, rfNodes, setRfEdges, setRfNodes])

  // ─── handleDeleteUsesEdge — removes USES edge and resets ServiceNode ──

  const handleDeleteUsesEdge = useCallback(async (edgeId: string): Promise<void> => {
    if (!activeProjectId) return
    const edge = rfEdges.find(e => e.id === edgeId)
    if (!edge) return

    const serviceId = edge.source

    await db.edges.delete(edgeId)
    setRfEdges(edges => edges.filter(e => e.id !== edgeId))

    const serviceRFNode = rfNodes.find(n => n.id === serviceId)
    if (serviceRFNode) {
      const serviceNode = serviceRFNode.data as unknown as ServiceNode
      const reset       = resetServiceNode(serviceNode)

      await db.nodes.update(serviceId, {
        data:      JSON.stringify(reset),
        updatedAt: Date.now(),
      })

      setRfNodes(nodes => nodes.map(n =>
        n.id === serviceId
          ? { ...n, data: reset as unknown as Record<string, unknown> }
          : n,
      ))
    }

    const bc = new BroadcastChannel('archflow-sync')
    bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
    bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
    bc.close()
  }, [activeProjectId, rfEdges, rfNodes, setRfEdges, setRfNodes])

  const onEdgeDoubleClick = useCallback((_event: React.MouseEvent, edge: RFEdge): void => {
    const edgeData = edge.data as { type?: string } | undefined
    if (edgeData?.type === EdgeType.USES) {
      void handleDeleteUsesEdge(edge.id)
      return
    }
    if (edgeData?.type === EdgeType.INVOKES) {
      // INVOKES is structural-only — no node reset needed
      void (async (): Promise<void> => {
        await db.edges.delete(edge.id)
        setRfEdges(edges => edges.filter(e => e.id !== edge.id))
        if (activeProjectId) {
          const bc = new BroadcastChannel('archflow-sync')
          bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
          bc.close()
        }
      })()
      return
    }
    // ROUTES_TO — structural only, no node reset
    if (edgeData?.type === EdgeType.ROUTES_TO) {
      void (async (): Promise<void> => {
        await db.edges.delete(edge.id)
        setRfEdges(edges => edges.filter(e => e.id !== edge.id))
        if (activeProjectId) {
          const bc = new BroadcastChannel('archflow-sync')
          bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
          bc.close()
        }
      })()
      return
    }
    // ACCEPTS — clear bodyDTOId on endpoint
    if (edgeData?.type === EdgeType.ACCEPTS) {
      void (async (): Promise<void> => {
        const endpointRFNode = rfNodes.find(n => n.id === edge.source)
        if (endpointRFNode) {
          const ep = endpointRFNode.data as unknown as APIEndpointNode
          const updated: APIEndpointNode = { ...ep, request: { ...ep.request, bodyDTOId: null } }
          setRfNodes(nodes => nodes.map(n =>
            n.id === edge.source ? { ...n, data: updated as unknown as Record<string, unknown> } : n,
          ))
          await db.nodes.update(edge.source, { data: JSON.stringify(updated), updatedAt: Date.now() })
        }
        await db.edges.delete(edge.id)
        setRfEdges(edges => edges.filter(e => e.id !== edge.id))
        if (activeProjectId) {
          const bc = new BroadcastChannel('archflow-sync')
          bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
          bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
          bc.close()
        }
      })()
      return
    }
    // RETURNS — clear returnDTOId on endpoint
    if (edgeData?.type === EdgeType.RETURNS) {
      void (async (): Promise<void> => {
        const endpointRFNode = rfNodes.find(n => n.id === edge.source)
        if (endpointRFNode) {
          const ep = endpointRFNode.data as unknown as APIEndpointNode
          const updated: APIEndpointNode = { ...ep, response: { ...ep.response, returnDTOId: null } }
          setRfNodes(nodes => nodes.map(n =>
            n.id === edge.source ? { ...n, data: updated as unknown as Record<string, unknown> } : n,
          ))
          await db.nodes.update(edge.source, { data: JSON.stringify(updated), updatedAt: Date.now() })
        }
        await db.edges.delete(edge.id)
        setRfEdges(edges => edges.filter(e => e.id !== edge.id))
        if (activeProjectId) {
          const bc = new BroadcastChannel('archflow-sync')
          bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
          bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
          bc.close()
        }
      })()
      return
    }
    if (edgeData?.type === EdgeType.USES_CUSTOM_TYPE) {
      void (async (): Promise<void> => {
        await db.edges.delete(edge.id)
        setRfEdges(edges => edges.filter(e => e.id !== edge.id))
        if (activeProjectId) {
          const bc = new BroadcastChannel('archflow-sync')
          bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
          bc.close()
        }
      })()
      return
    }
    // STORED_IN — clear entityId on TableNode
    if (edgeData?.type === EdgeType.STORED_IN) {
      void (async (): Promise<void> => {
        const tableRFNode = rfNodes.find(n => n.id === edge.target)
        if (tableRFNode) {
          const tableNode = tableRFNode.data as unknown as TableNode
          const updated: TableNode = { ...tableNode, entityId: null }
          await db.nodes.update(edge.target, { data: JSON.stringify(updated), updatedAt: Date.now() })
          setRfNodes(nodes => nodes.map(n =>
            n.id === edge.target ? { ...n, data: updated as unknown as Record<string, unknown> } : n,
          ))
        }
        await db.edges.delete(edge.id)
        setRfEdges(edges => edges.filter(e => e.id !== edge.id))
        if (activeProjectId) {
          const bc = new BroadcastChannel('archflow-sync')
          bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
          bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
          bc.close()
        }
      })()
      return
    }
    // CONNECTS_TO — clear dbNodeId on TableNode
    if (edgeData?.type === EdgeType.CONNECTS_TO) {
      void (async (): Promise<void> => {
        const tableRFNode = rfNodes.find(n => n.id === edge.source)
        if (tableRFNode) {
          const tableNode = tableRFNode.data as unknown as TableNode
          const updated: TableNode = { ...tableNode, dbNodeId: null }
          await db.nodes.update(edge.source, { data: JSON.stringify(updated), updatedAt: Date.now() })
          setRfNodes(nodes => nodes.map(n =>
            n.id === edge.source ? { ...n, data: updated as unknown as Record<string, unknown> } : n,
          ))
        }
        await db.edges.delete(edge.id)
        setRfEdges(edges => edges.filter(e => e.id !== edge.id))
        if (activeProjectId) {
          const bc = new BroadcastChannel('archflow-sync')
          bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
          bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
          bc.close()
        }
      })()
      return
    }
    if (edgeData?.type !== EdgeType.DERIVED_FROM) return
    void handleDeleteEdge(edge.id)
  }, [handleDeleteEdge, handleDeleteUsesEdge, activeProjectId, setRfEdges, rfNodes, setRfNodes])

  // ─── Drag and drop — from left sidebar palette ────────────────────

  const onDragOver = useCallback((e: React.DragEvent): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((e: React.DragEvent): void => {
    e.preventDefault()

    const nodeType = e.dataTransfer.getData('nodeType')
    if (nodeType !== 'entity' && nodeType !== 'dto' && nodeType !== 'db' && nodeType !== 'table' && nodeType !== 'service' && nodeType !== 'controller' && nodeType !== 'endpoint' && nodeType !== 'customType') return

    const msNodes = rfNodes.filter(n => n.type === 'microservice')
    if (msNodes.length === 0) return

    if (!activeProjectId) return

    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })

    // Find the MicroserviceNode whose bounds contain the drop position.
    const targetMs = msNodes.find(ms => {
      const msWidth  = ms.width  ?? 600
      const msHeight = ms.height ?? 400
      return (
        position.x >= ms.position.x &&
        position.x <= ms.position.x + msWidth &&
        position.y >= ms.position.y &&
        position.y <= ms.position.y + msHeight
      )
    })

    // Drop outside every MS → do nothing
    if (!targetMs) return

    // Position relative to parent MS origin
    const relativePosition = {
      x: position.x - targetMs.position.x,
      y: position.y - targetMs.position.y,
    }

    if (nodeType === 'entity') {
      const newNode = createEntityNode({ position: relativePosition, msId: targetMs.id })

      createNode({
        id:        newNode.id,
        projectId: activeProjectId,
        type:      NodeType.ENTITY,
        label:     newNode.label,
        position:  relativePosition,
        size:      newNode.size,
        data:      JSON.stringify(newNode),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      setRfNodes(nodes => [
        ...nodes,
        {
          id:       newNode.id,
          type:     'entity' as const,
          position: relativePosition,
          data:     newNode as EntityNodeData,
          width:    newNode.size.w,
          height:   newNode.size.h,
          measured: { width: newNode.size.w, height: newNode.size.h },
          parentId: targetMs.id,
          extent:   'parent' as const,
        },
      ])
      return
    }

    if (nodeType === 'dto') {
      const newNode = createDTONode({ position: relativePosition, msId: targetMs.id })

      createNode({
        id:        newNode.id,
        projectId: activeProjectId,
        type:      NodeType.DTO,
        label:     newNode.label,
        position:  relativePosition,
        size:      newNode.size,
        data:      JSON.stringify(newNode),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      setRfNodes(nodes => [
        ...nodes,
        {
          id:       newNode.id,
          type:     'dto' as const,
          position: relativePosition,
          data:     newNode as DTONodeData,
          width:    newNode.size.w,
          height:   newNode.size.h,
          measured: { width: newNode.size.w, height: newNode.size.h },
          parentId: targetMs.id,
          extent:   'parent' as const,
        },
      ])
      return
    }

    if (nodeType === 'db') {
      const newDBNode = createDBNode({ position: relativePosition, msId: targetMs.id })

      createNode({
        id:        newDBNode.id,
        projectId: activeProjectId,
        type:      NodeType.DB,
        label:     newDBNode.label,
        position:  relativePosition,
        size:      newDBNode.size,
        data:      JSON.stringify(newDBNode),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      setRfNodes(nodes => [
        ...nodes,
        {
          id:       newDBNode.id,
          type:     'db' as const,
          position: relativePosition,
          data:     newDBNode as DBNodeData,
          width:    newDBNode.size.w,
          height:   newDBNode.size.h,
          measured: { width: newDBNode.size.w, height: newDBNode.size.h },
          parentId: targetMs.id,
          extent:   'parent' as const,
        },
      ])
      return
    }

    if (nodeType === 'table') {
      const newTableNode = createTableNode({ position: relativePosition, msId: targetMs.id })

      createNode({
        id:        newTableNode.id,
        projectId: activeProjectId,
        type:      NodeType.TABLE,
        label:     newTableNode.label,
        position:  relativePosition,
        size:      newTableNode.size,
        data:      JSON.stringify(newTableNode),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      setRfNodes(nodes => [
        ...nodes,
        {
          id:       newTableNode.id,
          type:     'table' as const,
          position: relativePosition,
          data:     newTableNode as TableNodeData,
          width:    newTableNode.size.w,
          height:   newTableNode.size.h,
          measured: { width: newTableNode.size.w, height: newTableNode.size.h },
          parentId: targetMs.id,
          extent:   'parent' as const,
        },
      ])
      return
    }

    if (nodeType === 'service') {
      const newServiceNode = createServiceNode({ position: relativePosition, msId: targetMs.id })

      createNode({
        id:        newServiceNode.id,
        projectId: activeProjectId,
        type:      NodeType.SERVICE,
        label:     newServiceNode.label,
        position:  relativePosition,
        size:      newServiceNode.size,
        data:      JSON.stringify(newServiceNode),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      setRfNodes(nodes => [
        ...nodes,
        {
          id:       newServiceNode.id,
          type:     'service' as const,
          position: relativePosition,
          data:     newServiceNode as ServiceNodeData,
          width:    newServiceNode.size.w,
          height:   newServiceNode.size.h,
          measured: { width: newServiceNode.size.w, height: newServiceNode.size.h },
          parentId: targetMs.id,
          extent:   'parent' as const,
        },
      ])
      return
    }

    if (nodeType === 'endpoint') {
      const newEndpointNode = createAPIEndpointNode({ position: relativePosition, msId: targetMs.id })

      createNode({
        id:        newEndpointNode.id,
        projectId: activeProjectId,
        type:      NodeType.API_ENDPOINT,
        label:     newEndpointNode.label,
        position:  relativePosition,
        size:      newEndpointNode.size,
        data:      JSON.stringify(newEndpointNode),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      setRfNodes(nodes => [
        ...nodes,
        {
          id:       newEndpointNode.id,
          type:     'endpoint' as const,
          position: relativePosition,
          data:     newEndpointNode as APIEndpointNodeData,
          width:    newEndpointNode.size.w,
          height:   newEndpointNode.size.h,
          measured: { width: newEndpointNode.size.w, height: newEndpointNode.size.h },
          parentId: targetMs.id,
          extent:   'parent' as const,
        },
      ])
      return
    }

    if (nodeType === 'customType') {
      const newNode = createCustomTypeNode({ position: relativePosition, msId: targetMs.id })

      createNode({
        id:        newNode.id,
        projectId: activeProjectId,
        type:      NodeType.CUSTOM_TYPE,
        label:     newNode.label,
        position:  relativePosition,
        size:      newNode.size,
        data:      JSON.stringify(newNode),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      setRfNodes(nodes => [
        ...nodes,
        {
          id:       newNode.id,
          type:     'customType' as const,
          position: relativePosition,
          data:     newNode as unknown as Record<string, unknown>,
          width:    newNode.size.w,
          height:   newNode.size.h,
          measured: { width: newNode.size.w, height: newNode.size.h },
          parentId: targetMs.id,
          extent:   'parent' as const,
        },
      ])
      return
    }

    // controller
    const newControllerNode = createControllerNode({ position: relativePosition, msId: targetMs.id })

    createNode({
      id:        newControllerNode.id,
      projectId: activeProjectId,
      type:      NodeType.CONTROLLER,
      label:     newControllerNode.label,
      position:  relativePosition,
      size:      newControllerNode.size,
      data:      JSON.stringify(newControllerNode),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    setRfNodes(nodes => [
      ...nodes,
      {
        id:       newControllerNode.id,
        type:     'controller' as const,
        position: relativePosition,
        data:     newControllerNode as ControllerNodeData,
        width:    newControllerNode.size.w,
        height:   newControllerNode.size.h,
        measured: { width: newControllerNode.size.w, height: newControllerNode.size.h },
        parentId: targetMs.id,
        extent:   'parent' as const,
      },
    ])
  }, [rfNodes, activeProjectId, screenToFlowPosition, createNode, setRfNodes])

  // ─── Node drag end — write new position to IDB ────────────────────

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      if (!activeProjectId) return
      const data = node.data as unknown as MicroserviceNode | EntityNode | DTONode | DBNode
      const w = node.width  ?? data.size.w
      const h = node.height ?? data.size.h
      const newData = { ...data, position: node.position, size: { w, h } }
      updateNode({
        id:        node.id,
        projectId: activeProjectId,
        type:      data.type,
        label:     data.label,
        position:  node.position,
        size:      { w, h },
        data:      JSON.stringify(newData),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      // Keep data.position in sync so inspector writes don't use stale position
      setRfNodes(nodes => nodes.map(n =>
        n.id === node.id
          ? { ...n, data: newData as unknown as Record<string, unknown> }
          : n,
      ))
    },
    [activeProjectId, updateNode, setRfNodes],
  )

  // ─── Keyboard shortcuts ───────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement).tagName

      // Escape → clear selection
      if (e.key === 'Escape') {
        clearSelection()
        return
      }

      // Delete / Backspace → delete selected node (not in input)
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        tag !== 'INPUT' &&
        tag !== 'TEXTAREA' &&
        tag !== 'SELECT'
      ) {
        if (!selectedNodeId || !activeProjectId) return
        const rfNode = rfNodes.find(n => n.id === selectedNodeId)
        if (!rfNode) return
        const data = rfNode.data as unknown as MicroserviceNode | EntityNode | DTONode | DBNode
        const isMicroservice = rfNode.type === 'microservice'
        const childIds = isMicroservice
          ? rfNodes.filter(n => n.parentId === selectedNodeId).map(n => n.id)
          : []
        const allIds = [selectedNodeId, ...childIds]

        const confirmMsg = isMicroservice && childIds.length > 0
          ? `Delete "${data.label}" and its ${childIds.length} child node(s)? This cannot be undone.`
          : `Delete "${data.label}"? This cannot be undone.`
        const confirmed = window.confirm(confirmMsg)
        if (!confirmed) return

        void (async (): Promise<void> => {
          // ── cascade: clean up edges connected to the deleted node(s) ──
          const connectedEdges = rfEdges.filter(
            e => allIds.includes(e.source) || allIds.includes(e.target),
          )

          // For ACCEPTS/RETURNS edges whose *endpoint* survives, null the back-ref
          const nodePatches = new Map<string, Record<string, unknown>>()
          for (const edge of connectedEdges) {
            const edgeType = (edge.data as { type?: EdgeType } | undefined)?.type
            if (edgeType === EdgeType.ACCEPTS && !allIds.includes(edge.source)) {
              const surviving = rfNodes.find(n => n.id === edge.source)
              if (surviving) {
                const ep = surviving.data as unknown as APIEndpointNode
                nodePatches.set(edge.source, { ...ep, request: { ...ep.request, bodyDTOId: null } } as unknown as Record<string, unknown>)
              }
            }
            if (edgeType === EdgeType.RETURNS && !allIds.includes(edge.source)) {
              const surviving = rfNodes.find(n => n.id === edge.source)
              if (surviving) {
                const ep = surviving.data as unknown as APIEndpointNode
                nodePatches.set(edge.source, { ...ep, response: { ...ep.response, returnDTOId: null } } as unknown as Record<string, unknown>)
              }
            }
          }

          if (nodePatches.size > 0) {
            setRfNodes(nodes => nodes.map(n =>
              nodePatches.has(n.id) ? { ...n, data: nodePatches.get(n.id)! } : n,
            ))
            await Promise.all([...nodePatches.entries()].map(([id, patched]) =>
              db.nodes.update(id, { data: JSON.stringify(patched), updatedAt: Date.now() }),
            ))
          }

          if (connectedEdges.length > 0) {
            const edgeIds = connectedEdges.map(e => e.id)
            await db.edges.bulkDelete(edgeIds)
            setRfEdges(edges => edges.filter(e => !edgeIds.includes(e.id)))
          }

          // ── delete the node(s) ──
          if (allIds.length > 1) {
            deleteNodes({ nodeIds: allIds, projectId: activeProjectId })
          } else {
            deleteNode({ nodeId: selectedNodeId, projectId: activeProjectId })
          }
          setRfNodes(nodes => nodes.filter(n => !allIds.includes(n.id)))
          clearSelection()
        })()
        return
      }

      // Cmd+N / Ctrl+N → create new MicroserviceNode
      if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (!activeProjectId) return
        const existingMs = rfNodes.filter(n => n.type === 'microservice')
        const safePos    = findSafeMsPosition(existingMs)
        const newNode    = createMicroserviceNode({ colorIdx: existingMs.length % 5, position: safePos })

        createNode({
          id:        newNode.id,
          projectId: activeProjectId,
          type:      NodeType.MICROSERVICE,
          label:     newNode.label,
          position:  safePos,
          size:      newNode.size,
          data:      JSON.stringify(newNode),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })

        setRfNodes(nodes => [
          ...nodes,
          {
            id:         newNode.id,
            type:       'microservice' as const,
            position:   safePos,
            data:       newNode as MsNodeData,
            dragHandle: '.ms-drag-handle',
            width:      newNode.size.w,
            height:     newNode.size.h,
            style:      { width: newNode.size.w, height: newNode.size.h },
          },
        ])

        setTimeout(() => {
          fitView({ nodes: [{ id: newNode.id }], duration: 400, padding: 0.15, maxZoom: 1 })
        }, 50)
      }
    },
    [
      clearSelection,
      selectedNodeId,
      activeProjectId,
      rfNodes,
      deleteNode,
      deleteNodes,
      setRfNodes,
      createNode,
    ],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return {
    rfNodes,
    rfEdges,
    isPanMode,
    onNodesChange,
    onEdgesChange,
    onNodeClick,
    onEdgeClick,
    onPaneClick,
    onConnect,
    onNodeDragStop,
    onDragOver,
    onDrop,
    onEdgeDoubleClick,
    handleDeleteUsesEdge,
  }
}
