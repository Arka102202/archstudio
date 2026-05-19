import { useCallback } from 'react'
import { useNodes } from '@xyflow/react'
import { useCanvasStore } from '@store'
import { HttpMethod } from '@entity'
import type { APIEndpointNode, DTONode } from '@entity'
import type { MethodChipStyle } from './types'

// ─── Method chip colours — canonical HTTP method colours ──────────

const METHOD_CHIP_STYLES: Record<HttpMethod, MethodChipStyle> = {
  [HttpMethod.GET]:    { background: '#22c55e22', color: '#22c55e' },
  [HttpMethod.POST]:   { background: '#a855f722', color: '#a855f7' },
  [HttpMethod.PUT]:    { background: '#f59e0b22', color: '#f59e0b' },
  [HttpMethod.PATCH]:  { background: '#f59e0b22', color: '#f59e0b' },
  [HttpMethod.DELETE]: { background: '#ef444422', color: '#ef4444' },
}

interface APIEndpointNodeHook {
  node:              APIEndpointNode
  isSelected:        boolean
  handleClick:       () => void
  requestDTOLabel:   string | null
  responseDTOLabel:  string | null
  pathVarSummary:    string | null
  authRuleName:      string | null
  methodChipStyle:   MethodChipStyle
}

export const useAPIEndpointNode = (
  nodeId: string,
  data:   APIEndpointNode,
): APIEndpointNodeHook => {
  const selectedNodeId      = useCanvasStore(s => s.selectedNodeId)
  const { setSelectedNode } = useCanvasStore()

  const allNodes = useNodes()

  const isSelected = selectedNodeId === nodeId

  const handleClick = useCallback((): void => {
    setSelectedNode(nodeId)
  }, [setSelectedNode, nodeId])

  // ─── Resolve request DTO label ────────────────────────────────────
  const requestDTORFNode = data.request.bodyDTOId
    ? allNodes.find(n => n.id === data.request.bodyDTOId)
    : null

  const requestDTOLabel: string | null = requestDTORFNode
    ? (requestDTORFNode.data as unknown as DTONode).label
    : null

  // ─── Resolve response DTO label ───────────────────────────────────
  const responseDTORFNode = data.response.returnDTOId
    ? allNodes.find(n => n.id === data.response.returnDTOId)
    : null

  const responseDTOLabel: string | null = responseDTORFNode
    ? (responseDTORFNode.data as unknown as DTONode).label
    : null

  // ─── Path variable summary ────────────────────────────────────────
  const pathVarSummary: string | null = data.request.pathVars.length > 0
    ? data.request.pathVars[0].name
    : null

  // ─── Auth rule name ───────────────────────────────────────────────
  const authRuleRFNode = data.authRuleId
    ? allNodes.find(n => n.id === data.authRuleId)
    : null

  const authRuleName: string | null = authRuleRFNode
    ? ((authRuleRFNode.data as { ruleName?: string }).ruleName ?? null)
    : null

  // ─── Method chip style ────────────────────────────────────────────
  const methodChipStyle: MethodChipStyle = METHOD_CHIP_STYLES[data.method]

  return {
    node: data,
    isSelected,
    handleClick,
    requestDTOLabel,
    responseDTOLabel,
    pathVarSummary,
    authRuleName,
    methodChipStyle,
  }
}
