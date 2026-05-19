import { useCallback } from 'react'
import { useNodes } from '@xyflow/react'
import { useCanvasStore } from '@store'
import type { DTONode } from '@entity'

interface DTONodeHook {
  node:                DTONode
  isSelected:          boolean
  handleClick:         () => void
  entityLabelById:     (entityId: string | null) => string | null
  customTypeLabelById: (customTypeId: string | null) => string | null
}

export const useDTONode = (
  nodeId: string,
  data:   DTONode,
): DTONodeHook => {
  const selectedNodeId      = useCanvasStore(s => s.selectedNodeId)
  const { setSelectedNode } = useCanvasStore()
  const allNodes            = useNodes()

  const isSelected = selectedNodeId === nodeId

  const handleClick = useCallback((): void => {
    setSelectedNode(nodeId)
  }, [setSelectedNode, nodeId])

  const entityLabelById = useCallback((entityId: string | null): string | null => {
    if (!entityId) return null
    const rfNode = allNodes.find(n => n.id === entityId)
    if (!rfNode) return null
    const nodeData = rfNode.data as { label?: string }
    return nodeData.label ?? null
  }, [allNodes])

  const customTypeLabelById = useCallback((customTypeId: string | null): string | null => {
    if (!customTypeId) return null
    const rfNode = allNodes.find(n => n.id === customTypeId)
    if (!rfNode) return null
    const nodeData = rfNode.data as { label?: string }
    return nodeData.label ?? null
  }, [allNodes])

  return {
    node: data,
    isSelected,
    handleClick,
    entityLabelById,
    customTypeLabelById,
  }
}
