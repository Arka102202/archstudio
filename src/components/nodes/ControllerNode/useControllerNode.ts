import { useCallback } from 'react'
import { useEdges, useNodes } from '@xyflow/react'
import { useCanvasStore } from '@store'
import { EdgeType } from '@entity'
import type { ControllerNode, ServiceNode } from '@entity'

interface ConnectedService {
  id:    string
  label: string
}

interface ControllerNodeHook {
  node:             ControllerNode
  isSelected:       boolean
  handleClick:      () => void
  connectedService: ConnectedService | null
  authRuleName:     string | null
}

export const useControllerNode = (
  nodeId: string,
  data:   ControllerNode,
): ControllerNodeHook => {
  const selectedNodeId      = useCanvasStore(s => s.selectedNodeId)
  const { setSelectedNode } = useCanvasStore()

  const allEdges = useEdges()
  const allNodes = useNodes()

  const isSelected = selectedNodeId === nodeId

  const handleClick = useCallback((): void => {
    setSelectedNode(nodeId)
  }, [setSelectedNode, nodeId])

  // Resolve connected service via INVOKES edge (canonical: source = controller, target = service)
  const invokesEdge = allEdges.find(e => {
    const edgeData = e.data as { type?: string } | undefined
    return edgeData?.type === EdgeType.INVOKES && e.source === nodeId
  })

  const serviceRFNode = invokesEdge
    ? allNodes.find(n => n.id === invokesEdge.target)
    : null

  const connectedService: ConnectedService | null = serviceRFNode
    ? { id: serviceRFNode.id, label: (serviceRFNode.data as unknown as ServiceNode).label }
    : null

  // Resolve auth rule name from authRuleId
  const authRuleRFNode = data.authRuleId
    ? allNodes.find(n => n.id === data.authRuleId)
    : null

  const authRuleName: string | null = authRuleRFNode
    ? ((authRuleRFNode.data as { ruleName?: string }).ruleName ?? null)
    : null

  return {
    node: data,
    isSelected,
    handleClick,
    connectedService,
    authRuleName,
  }
}
