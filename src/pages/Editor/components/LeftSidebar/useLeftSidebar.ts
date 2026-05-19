import { useState, useRef, useCallback, useEffect } from 'react'
import type React from 'react'
import { useNodes, useEdges, useReactFlow } from '@xyflow/react'
import { useCanvasStore, useProjectStore, useSettingsStore, SETTINGS_KEYS, SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX } from '@store'
import { db } from '@db'
import { useCreateNode } from '@service'
import { createMicroserviceNode, createEntityNode, createDTONode, createDBNode, createTableNode, createServiceNode, createControllerNode, createAPIEndpointNode, createCustomTypeNode, findSafeMsPosition } from '@utils'
import { NodeType } from '@entity'
import type { MsNodeData } from '@components/nodes/MicroserviceNode'
import type { EntityNodeData } from '@components/nodes/EntityNode'
import type { DTONodeData } from '@components/nodes/DTONode'
import type { DBNodeData } from '@components/nodes/DBNode'
import type { TableNodeData } from '@components/nodes/TableNode'
import type { ServiceNodeData } from '@components/nodes/ServiceNode'
import type { ControllerNodeData } from '@components/nodes/ControllerNode'
import type { APIEndpointNodeData } from '@components/nodes/APIEndpointNode'
import type { NodePaletteItem, MsLayerGroup, ChildLayerItem, LeftSidebarHook } from './types'

// ─── MS colour palette borders — mirrors useMicroserviceNode ──────
// We only need the border colour for the layer dot.

const MS_BORDER_COLORS = [
  '#3860f5',
  '#0a9e6e',
  '#c030e8',
  '#d4580a',
  '#0891b2',
] as const

const ENTITY_DOT_COLOR = 'var(--node-entity-accent)'

// ─── Child node type → badge appearance ──────────────────────────
const CHILD_TYPE_META: Record<string, { abbr: string; iconBg: string; iconFg: string; dotColor: string }> = {
  entity:     { abbr: 'E',  iconBg: '#dbeafe', iconFg: '#1e40af', dotColor: ENTITY_DOT_COLOR },
  dto:        { abbr: 'D',  iconBg: '#cffafe', iconFg: '#164e63', dotColor: '#0891b2' },
  db:         { abbr: 'DB', iconBg: '#ede9fe', iconFg: '#5b21b6', dotColor: '#7c3aed' },
  table:      { abbr: 'T',  iconBg: '#ede9fe', iconFg: '#5b21b6', dotColor: '#7c3aed' },
  auth:       { abbr: 'AG', iconBg: '#fef3c7', iconFg: '#92400e', dotColor: '#d97706' },
  controller: { abbr: 'C',  iconBg: '#ffedd5', iconFg: '#9a3412', dotColor: '#ea580c' },
  service:    { abbr: 'S',  iconBg: '#dcfce7', iconFg: '#166534', dotColor: '#16a34a' },
  endpoint:   { abbr: 'EP', iconBg: '#fae8ff', iconFg: '#6b21a8', dotColor: '#a21caf' },
  customType: { abbr: 'CT', iconBg: '#dbeafe', iconFg: '#1e40af', dotColor: ENTITY_DOT_COLOR },
}

const PALETTE_ITEMS: NodePaletteItem[] = [
  { id: 'microservice', label: 'Microservice', abbr: 'MS', iconBg: '#dde6ff', iconFg: '#3730a3', ready: true  },
  { id: 'entity',       label: 'Entity',       abbr: 'E',  iconBg: '#dbeafe', iconFg: '#1e40af', ready: true  },
  { id: 'dto',          label: 'DTO',           abbr: 'D',  iconBg: '#cffafe', iconFg: '#164e63', ready: true  },
  { id: 'db',           label: 'Database',      abbr: 'DB', iconBg: '#ede9fe', iconFg: '#5b21b6', ready: true  },
  { id: 'table',        label: 'Table',         abbr: 'T',  iconBg: '#ede9fe', iconFg: '#5b21b6', ready: true  },
  { id: 'customType',   label: 'Custom Type',   abbr: 'CT', iconBg: '#dbeafe', iconFg: '#1e40af', ready: true  },
  { id: 'auth',         label: 'Auth Guard',    abbr: 'AG', iconBg: '#fef3c7', iconFg: '#92400e', ready: false },
  { id: 'controller',   label: 'Controller',    abbr: 'C',  iconBg: '#ffedd5', iconFg: '#9a3412', ready: true  },
  { id: 'service',      label: 'Service',       abbr: 'S',  iconBg: '#dcfce7', iconFg: '#166534', ready: true  },
  { id: 'endpoint',     label: 'API Endpoint',  abbr: 'EP', iconBg: '#fae8ff', iconFg: '#6b21a8', ready: true  },
]

export const useLeftSidebar = (): LeftSidebarHook => {
  const width    = useSettingsStore(s => s.sidebarWidth)
  const setWidth = useSettingsStore(s => s.setSidebarWidth)

  const [collapsedMs, setCollapsedMs] = useState<Set<string>>(new Set())

  const isDragging = useRef<boolean>(false)
  const startX     = useRef<number>(0)
  const startWidth = useRef<number>(width)

  const rfNodes             = useNodes()
  const rfEdges             = useEdges()
  const { setNodes, fitView } = useReactFlow()
  const selectedNodeId      = useCanvasStore(s => s.selectedNodeId)
  const { setSelectedNode } = useCanvasStore()
  const activeProjectId     = useProjectStore(s => s.activeProjectId)
  const { mutate: createNode } = useCreateNode()

  // ─── Derived state ────────────────────────────────────────────────

  const hasMicroservice = rfNodes.some(n => n.type === 'microservice')

  const msNodes = rfNodes.filter(n => n.type === 'microservice')

  // ─── Auto-expand parent MS when a child node is selected ─────────

  useEffect(() => {
    if (!selectedNodeId) return
    const selectedNode = rfNodes.find(n => n.id === selectedNodeId)
    if (!selectedNode?.parentId) return
    // The selected node is a child — ensure its parent MS is expanded
    setCollapsedMs(prev => {
      if (!prev.has(selectedNode.parentId!)) return prev
      const next = new Set(prev)
      next.delete(selectedNode.parentId!)
      return next
    })
  }, [selectedNodeId, rfNodes])

  // ─── Build hierarchical layer groups from RF nodes ───────────────

  // Build map: controllerId → endpoint IDs (via ROUTES_TO edges)
  const controllerToEndpoints = new Map<string, string[]>()
  for (const edge of rfEdges) {
    const edgeData = edge.data as { type?: string } | undefined
    if (edgeData?.type === 'ROUTES_TO') {
      const existing = controllerToEndpoints.get(edge.target) ?? []
      controllerToEndpoints.set(edge.target, [...existing, edge.source])
    }
  }
  // Set of endpoint IDs that are nested under a controller
  const nestedEndpointIds = new Set<string>(
    Array.from(controllerToEndpoints.values()).flat(),
  )

  const buildChildItem = (child: ReturnType<typeof rfNodes.find>): ChildLayerItem => {
    if (!child) throw new Error('child is undefined')
    const meta = CHILD_TYPE_META[child.type ?? 'entity'] ?? CHILD_TYPE_META['entity']
    const childData = child.data as { label?: string; purpose?: string; dbName?: string; dbType?: string; tableName?: string; basePath?: string }

    const layerLabel = child.type === 'db'
      ? (childData.dbName ?? childData.label ?? child.id)
      : child.type === 'table'
        ? (childData.tableName ?? childData.label ?? child.id)
        : (childData.label ?? child.id)

    const purposeSlot = child.type === 'dto'
      ? (childData.purpose ?? null)
      : child.type === 'db'
        ? (childData.dbType ?? null)
        : child.type === 'controller'
          ? (childData.basePath ?? null)
          : null

    return {
      id:         child.id,
      label:      layerLabel,
      rfType:     child.type ?? 'entity',
      dotColor:   meta.dotColor,
      abbr:       meta.abbr,
      iconBg:     meta.iconBg,
      iconFg:     meta.iconFg,
      isSelected: child.id === selectedNodeId,
      purpose:    purposeSlot,
      subItems:   [],
    }
  }

  const layerGroups: MsLayerGroup[] = msNodes.map(ms => {
    const data = ms.data as MsNodeData

    // Build children — controllers get their endpoints as subItems; nested endpoints excluded from flat list
    const children: ChildLayerItem[] = rfNodes
      .filter(n => n.parentId === ms.id && !(n.type === 'endpoint' && nestedEndpointIds.has(n.id)))
      .map(child => {
        const item = buildChildItem(child)
        if (child.type === 'controller') {
          const epIds = controllerToEndpoints.get(child.id) ?? []
          item.subItems = epIds
            .map(epId => rfNodes.find(n => n.id === epId))
            .filter((n): n is NonNullable<typeof n> => n !== undefined)
            .map(ep => buildChildItem(ep))
        }
        return item
      })

    const isChildSelected = children.some(c =>
      c.isSelected || c.subItems.some(s => s.isSelected),
    )

    return {
      id:              ms.id,
      label:           data.label,
      port:            data.port,
      dotColor:        MS_BORDER_COLORS[data.colorIdx % 5],
      isSelected:      ms.id === selectedNodeId,
      isChildSelected,
      isCollapsed:     collapsedMs.has(ms.id),
      children,
    }
  })

  // ─── Resize ──────────────────────────────────────────────────────

  const handleResizeStart = (e: React.MouseEvent): void => {
    e.preventDefault()
    isDragging.current = true
    startX.current     = e.clientX
    startWidth.current = width

    const handleMouseMove = (ev: MouseEvent): void => {
      if (!isDragging.current) return
      const delta    = ev.clientX - startX.current
      const newWidth = Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, startWidth.current + delta))
      setWidth(newWidth)
    }

    const handleMouseUp = (): void => {
      isDragging.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup',   handleMouseUp)

      // Persist final width to IDB on drag end
      const finalWidth = useSettingsStore.getState().sidebarWidth
      void db.settings.put({ key: SETTINGS_KEYS.SIDEBAR_WIDTH, value: JSON.stringify(finalWidth) })
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup',   handleMouseUp)
  }

  // ─── Add node from palette click ──────────────────────────────────

  const handleNodeAdd = useCallback((item: NodePaletteItem): void => {
    if (!item.ready || !activeProjectId) return

    if (item.id === 'microservice') {
      const existingMs  = rfNodes.filter(n => n.type === 'microservice')
      const safePos     = findSafeMsPosition(existingMs)
      const newNode     = createMicroserviceNode({ colorIdx: existingMs.length % 5, position: safePos })

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

      setNodes(nodes => [
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
        setSelectedNode(newNode.id)
      }, 50)
      return
    }

    if (item.id === 'entity') {
      // Guard: need at least one microservice
      const currentMsNodes = rfNodes.filter(n => n.type === 'microservice')
      if (currentMsNodes.length === 0) return

      // Find the target microservice:
      // prefer the currently selected MS, otherwise use the last in the array
      const targetMs =
        currentMsNodes.find(n => n.id === selectedNodeId) ??
        currentMsNodes[currentMsNodes.length - 1]

      if (!targetMs) return

      const existingEntityCount = rfNodes.filter(n => n.type === 'entity').length
      // Position is relative to the parent MS node origin
      const position = {
        x: 20 + (existingEntityCount % 4) * 240,
        y: 60 + Math.floor(existingEntityCount / 4) * 200,
      }

      const newNode = createEntityNode({ position, msId: targetMs.id })

      createNode({
        id:        newNode.id,
        projectId: activeProjectId,
        type:      NodeType.ENTITY,
        label:     newNode.label,
        position,
        size:      newNode.size,
        data:      JSON.stringify(newNode),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      setNodes(nodes => [
        ...nodes,
        {
          id:       newNode.id,
          type:     'entity' as const,
          position,
          data:     newNode as EntityNodeData,
          width:    newNode.size.w,
          height:   newNode.size.h,
          parentId: targetMs.id,
          extent:   'parent' as const,
        },
      ])
      return
    }

    if (item.id === 'dto') {
      // Guard: need at least one microservice
      const currentMsNodes = rfNodes.filter(n => n.type === 'microservice')
      if (currentMsNodes.length === 0) return

      // Find the target microservice:
      // prefer the currently selected MS, otherwise use the last in the array
      const targetMs =
        currentMsNodes.find(n => n.id === selectedNodeId) ??
        currentMsNodes[currentMsNodes.length - 1]

      if (!targetMs) return

      const existingDtoCount = rfNodes.filter(n => n.type === 'dto').length
      // Position is relative to the parent MS node origin
      const position = {
        x: 20 + (existingDtoCount % 4) * 230,
        y: 60 + Math.floor(existingDtoCount / 4) * 180,
      }

      const newNode = createDTONode({ position, msId: targetMs.id })

      createNode({
        id:        newNode.id,
        projectId: activeProjectId,
        type:      NodeType.DTO,
        label:     newNode.label,
        position,
        size:      newNode.size,
        data:      JSON.stringify(newNode),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      setNodes(nodes => [
        ...nodes,
        {
          id:       newNode.id,
          type:     'dto' as const,
          position,
          data:     newNode as DTONodeData,
          width:    newNode.size.w,
          height:   newNode.size.h,
          parentId: targetMs.id,
          extent:   'parent' as const,
        },
      ])
      return
    }

    if (item.id === 'db') {
      // Guard: need at least one microservice
      const currentMsNodes = rfNodes.filter(n => n.type === 'microservice')
      if (currentMsNodes.length === 0) return

      const targetMs =
        currentMsNodes.find(n => n.id === selectedNodeId) ??
        currentMsNodes[currentMsNodes.length - 1]

      if (!targetMs) return

      const existingDBCount = rfNodes.filter(n => n.type === 'db').length
      const position = {
        x: 20 + (existingDBCount % 4) * 230,
        y: 60 + Math.floor(existingDBCount / 4) * 180,
      }

      const newNode = createDBNode({ position, msId: targetMs.id })

      createNode({
        id:        newNode.id,
        projectId: activeProjectId,
        type:      NodeType.DB,
        label:     newNode.label,
        position,
        size:      newNode.size,
        data:      JSON.stringify(newNode),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      setNodes(nodes => [
        ...nodes,
        {
          id:       newNode.id,
          type:     'db' as const,
          position,
          data:     newNode as DBNodeData,
          width:    newNode.size.w,
          height:   newNode.size.h,
          parentId: targetMs.id,
          extent:   'parent' as const,
        },
      ])
      return
    }

    if (item.id === 'table') {
      // Guard: need at least one microservice
      const currentMsNodes = rfNodes.filter(n => n.type === 'microservice')
      if (currentMsNodes.length === 0) return

      const targetMs =
        currentMsNodes.find(n => n.id === selectedNodeId) ??
        currentMsNodes[currentMsNodes.length - 1]

      if (!targetMs) return

      const existingTableCount = rfNodes.filter(n => n.type === 'table').length
      const position = {
        x: 20 + (existingTableCount % 4) * 230,
        y: 60 + Math.floor(existingTableCount / 4) * 180,
      }

      const newTableNode = createTableNode({ position, msId: targetMs.id })

      createNode({
        id:        newTableNode.id,
        projectId: activeProjectId,
        type:      NodeType.TABLE,
        label:     newTableNode.label,
        position,
        size:      newTableNode.size,
        data:      JSON.stringify(newTableNode),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      setNodes(nodes => [
        ...nodes,
        {
          id:       newTableNode.id,
          type:     'table' as const,
          position,
          data:     newTableNode as TableNodeData,
          width:    newTableNode.size.w,
          height:   newTableNode.size.h,
          parentId: targetMs.id,
          extent:   'parent' as const,
        },
      ])
      return
    }

    if (item.id === 'service') {
      // Guard: need at least one microservice
      const currentMsNodes = rfNodes.filter(n => n.type === 'microservice')
      if (currentMsNodes.length === 0) return

      const targetMs =
        currentMsNodes.find(n => n.id === selectedNodeId) ??
        currentMsNodes[currentMsNodes.length - 1]

      if (!targetMs) return

      const existingServiceCount = rfNodes.filter(n => n.type === 'service').length
      const position = {
        x: 20 + (existingServiceCount % 4) * 230,
        y: 60 + Math.floor(existingServiceCount / 4) * 180,
      }

      const newServiceNode = createServiceNode({ position, msId: targetMs.id })

      createNode({
        id:        newServiceNode.id,
        projectId: activeProjectId,
        type:      NodeType.SERVICE,
        label:     newServiceNode.label,
        position,
        size:      newServiceNode.size,
        data:      JSON.stringify(newServiceNode),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      setNodes(nodes => [
        ...nodes,
        {
          id:       newServiceNode.id,
          type:     'service' as const,
          position,
          data:     newServiceNode as ServiceNodeData,
          width:    newServiceNode.size.w,
          height:   newServiceNode.size.h,
          parentId: targetMs.id,
          extent:   'parent' as const,
        },
      ])
      return
    }

    if (item.id === 'controller') {
      // Guard: need at least one microservice
      const currentMsNodes = rfNodes.filter(n => n.type === 'microservice')
      if (currentMsNodes.length === 0) return

      const targetMs =
        currentMsNodes.find(n => n.id === selectedNodeId) ??
        currentMsNodes[currentMsNodes.length - 1]

      if (!targetMs) return

      const existingControllerCount = rfNodes.filter(n => n.type === 'controller').length
      const position = {
        x: 20 + (existingControllerCount % 4) * 230,
        y: 60 + Math.floor(existingControllerCount / 4) * 180,
      }

      const newControllerNode = createControllerNode({ position, msId: targetMs.id })

      createNode({
        id:        newControllerNode.id,
        projectId: activeProjectId,
        type:      NodeType.CONTROLLER,
        label:     newControllerNode.label,
        position,
        size:      newControllerNode.size,
        data:      JSON.stringify(newControllerNode),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      setNodes(nodes => [
        ...nodes,
        {
          id:       newControllerNode.id,
          type:     'controller' as const,
          position,
          data:     newControllerNode as ControllerNodeData,
          width:    newControllerNode.size.w,
          height:   newControllerNode.size.h,
          parentId: targetMs.id,
          extent:   'parent' as const,
        },
      ])
      return
    }

    if (item.id === 'endpoint') {
      // Guard: need at least one microservice
      const currentMsNodes = rfNodes.filter(n => n.type === 'microservice')
      if (currentMsNodes.length === 0) return

      const targetMs =
        currentMsNodes.find(n => n.id === selectedNodeId) ??
        currentMsNodes[currentMsNodes.length - 1]

      if (!targetMs) return

      const existingEndpointCount = rfNodes.filter(n => n.type === 'endpoint').length
      const position = {
        x: 20 + (existingEndpointCount % 4) * 240,
        y: 60 + Math.floor(existingEndpointCount / 4) * 160,
      }

      const newEndpointNode = createAPIEndpointNode({ position })

      createNode({
        id:        newEndpointNode.id,
        projectId: activeProjectId,
        type:      NodeType.API_ENDPOINT,
        label:     newEndpointNode.label,
        position,
        size:      newEndpointNode.size,
        data:      JSON.stringify(newEndpointNode),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      setNodes(nodes => [
        ...nodes,
        {
          id:       newEndpointNode.id,
          type:     'endpoint' as const,
          position,
          data:     newEndpointNode as APIEndpointNodeData,
          width:    newEndpointNode.size.w,
          height:   newEndpointNode.size.h,
          parentId: targetMs.id,
          extent:   'parent' as const,
        },
      ])
      return
    }

    if (item.id === 'customType') {
      const currentMsNodes = rfNodes.filter(n => n.type === 'microservice')
      if (currentMsNodes.length === 0) return

      const targetMs =
        currentMsNodes.find(n => n.id === selectedNodeId) ??
        currentMsNodes[currentMsNodes.length - 1]

      if (!targetMs) return

      const existingCTCount = rfNodes.filter(n => n.type === 'customType').length
      const position = {
        x: 20 + (existingCTCount % 4) * 230,
        y: 60 + Math.floor(existingCTCount / 4) * 160,
      }

      const newNode = createCustomTypeNode({ position, msId: targetMs.id })

      createNode({
        id:        newNode.id,
        projectId: activeProjectId,
        type:      NodeType.CUSTOM_TYPE,
        label:     newNode.label,
        position,
        size:      newNode.size,
        data:      JSON.stringify(newNode),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      setNodes(nodes => [
        ...nodes,
        {
          id:       newNode.id,
          type:     'customType' as const,
          position,
          data:     newNode as unknown as Record<string, unknown>,
          width:    newNode.size.w,
          height:   newNode.size.h,
          parentId: targetMs.id,
          extent:   'parent' as const,
        },
      ])
    }
  }, [activeProjectId, rfNodes, selectedNodeId, createNode, setNodes])

  // ─── Drag start from palette ──────────────────────────────────────

  const handleDragStart = useCallback((e: React.DragEvent, type: string): void => {
    e.dataTransfer.setData('nodeType', type)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  // ─── Layer click — select node and fit it in view ─────────────────

  const handleLayerClick = useCallback((id: string): void => {
    setSelectedNode(id)
    fitView({ nodes: [{ id }], duration: 350, padding: 0.25, maxZoom: 1.5 })
  }, [setSelectedNode, fitView])

  // ─── Toggle MS group collapse ─────────────────────────────────────

  const handleToggleCollapse = useCallback((msId: string): void => {
    setCollapsedMs(prev => {
      const next = new Set(prev)
      if (next.has(msId)) next.delete(msId)
      else next.add(msId)
      return next
    })
  }, [])

  return {
    width,
    paletteItems:        PALETTE_ITEMS,
    hasMicroservice,
    layerGroups,
    handleResizeStart,
    handleNodeAdd,
    handleDragStart,
    handleLayerClick,
    handleToggleCollapse,
  }
}
