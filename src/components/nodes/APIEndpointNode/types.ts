import type { Node, NodeProps } from '@xyflow/react'
import type { APIEndpointNode } from '@entity'

export type APIEndpointNodeData = APIEndpointNode & Record<string, unknown>

export type APIEndpointRFNode = Node<APIEndpointNodeData, 'endpoint'>

export type APIEndpointNodeProps = NodeProps<APIEndpointRFNode>

// ─── Method chip colour config ────────────────────────────────────

export interface MethodChipStyle {
  background: string
  color:      string
}
