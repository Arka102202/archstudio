import { useCallback } from 'react'
import { useNodes } from '@xyflow/react'
import { useCanvasStore } from '@store'
import type { CustomTypeNode } from '@entity'

interface CustomTypeNodeHook {
  node:            CustomTypeNode
  isSelected:      boolean
  handleClick:     () => void
  labelById:       (id: string | null, kind: 'entity' | 'customType') => string | null
}

export const useCustomTypeNode = (
  nodeId: string,
  data:   CustomTypeNode,
): CustomTypeNodeHook => {
  const selectedNodeId      = useCanvasStore(s => s.selectedNodeId)
  const { setSelectedNode } = useCanvasStore()
  const allNodes            = useNodes()

  const isSelected = selectedNodeId === nodeId

  const handleClick = useCallback((): void => {
    setSelectedNode(nodeId)
  }, [setSelectedNode, nodeId])

  const labelById = useCallback((id: string | null, _kind: 'entity' | 'customType'): string | null => {
    if (!id) return null
    const rfNode = allNodes.find(n => n.id === id)
    if (!rfNode) return null
    const d = rfNode.data as { label?: string }
    return d.label ?? null
  }, [allNodes])

  return { node: data, isSelected, handleClick, labelById }
}
