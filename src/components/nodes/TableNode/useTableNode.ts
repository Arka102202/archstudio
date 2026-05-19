import { useCallback } from 'react'
import { useNodes } from '@xyflow/react'
import { useCanvasStore } from '@store'
import type { TableNode } from '@entity'
import type { TableNodeHook } from './types'

export const useTableNode = (
  nodeId: string,
  data:   TableNode,
): TableNodeHook => {
  const selectedNodeId      = useCanvasStore(s => s.selectedNodeId)
  const { setSelectedNode } = useCanvasStore()
  const rfNodes             = useNodes()

  const isSelected = selectedNodeId === nodeId

  const handleClick = useCallback((): void => {
    setSelectedNode(nodeId)
  }, [setSelectedNode, nodeId])

  // Resolve entity label from RF nodes using entityId stored in data
  const entityRFNode = data.entityId !== null
    ? rfNodes.find(n => n.id === data.entityId)
    : undefined
  const entityLabel: string | null = entityRFNode
    ? ((entityRFNode.data as { label?: string }).label ?? null)
    : null

  // Resolve DB label from RF nodes using dbNodeId stored in data
  const dbRFNode = data.dbNodeId !== null
    ? rfNodes.find(n => n.id === data.dbNodeId)
    : undefined
  const dbLabel: string | null = dbRFNode
    ? ((dbRFNode.data as { dbName?: string; label?: string }).dbName
        ?? (dbRFNode.data as { label?: string }).label
        ?? null)
    : null

  const queryCount = data.customQueries.length

  return {
    node: data,
    isSelected,
    handleClick,
    entityLabel,
    dbLabel,
    queryCount,
  }
}
