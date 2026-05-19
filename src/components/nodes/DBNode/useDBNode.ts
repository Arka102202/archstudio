import { useCallback } from 'react'
import { useEdges } from '@xyflow/react'
import { useCanvasStore } from '@store'
import { EdgeType } from '@entity'
import type { DBNode } from '@entity'
import type { DBNodeHook } from './types'

export const useDBNode = (
  nodeId: string,
  data:   DBNode,
): DBNodeHook => {
  const selectedNodeId      = useCanvasStore(s => s.selectedNodeId)
  const { setSelectedNode } = useCanvasStore()
  const allEdges            = useEdges()

  const isSelected = selectedNodeId === nodeId

  // DBNode is the TARGET of CONNECTS_TO edges (TableNode → DBNode)
  const tableCount = allEdges.filter(
    e => e.data?.type === EdgeType.CONNECTS_TO && e.target === nodeId
  ).length

  const handleClick = useCallback((): void => {
    setSelectedNode(nodeId)
  }, [setSelectedNode, nodeId])

  return {
    node: data,
    isSelected,
    tableCount,
    handleClick,
  }
}
