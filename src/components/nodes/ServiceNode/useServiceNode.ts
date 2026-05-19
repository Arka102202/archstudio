import { useCallback } from 'react'
import { useEdges, useNodes } from '@xyflow/react'
import { useCanvasStore } from '@store'
import { EdgeType } from '@entity'
import type { EntityNode, ServiceMethod, ServiceNode } from '@entity'

interface ConnectedEntity {
  id:    string
  label: string
}

interface ServiceNodeHook {
  node:            ServiceNode
  isSelected:      boolean
  handleClick:     () => void
  connectedEntity: ConnectedEntity | null
  visibleMethods:  ServiceMethod[]
  hiddenCount:     number
}

export const useServiceNode = (
  nodeId: string,
  data:   ServiceNode,
): ServiceNodeHook => {
  const selectedNodeId      = useCanvasStore(s => s.selectedNodeId)
  const { setSelectedNode } = useCanvasStore()

  const allEdges = useEdges()
  const allNodes = useNodes()

  const isSelected = selectedNodeId === nodeId

  const handleClick = useCallback((): void => {
    setSelectedNode(nodeId)
  }, [setSelectedNode, nodeId])

  // Resolve connected entity via USES edge (canonical: source = service, target = entity)
  const usesEdge = allEdges.find(e => {
    const edgeData = e.data as { type?: string } | undefined
    return edgeData?.type === EdgeType.USES && e.source === nodeId
  })

  const entityRFNode = usesEdge
    ? allNodes.find(n => n.id === usesEdge.target)
    : null

  const connectedEntity: ConnectedEntity | null = entityRFNode
    ? { id: entityRFNode.id, label: (entityRFNode.data as unknown as EntityNode).label }
    : null

  // Show first 4 methods, count the rest
  const visibleMethods = data.methods.slice(0, 4)
  const hiddenCount    = Math.max(0, data.methods.length - 4)

  return {
    node: data,
    isSelected,
    handleClick,
    connectedEntity,
    visibleMethods,
    hiddenCount,
  }
}
