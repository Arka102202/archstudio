import type { Node, NodeProps } from '@xyflow/react'
import type { DTONode } from '@entity'

// ─── RF-compatible data shape ─────────────────────────────────────
// @xyflow/react requires Node.data to extend Record<string, unknown>.
// DTONode is used as the data field — same pattern as EntityNodeData.

export type DTONodeData = DTONode & Record<string, unknown>

export type DTORFNode = Node<DTONodeData, 'dto'>

export type DTONodeProps = NodeProps<DTORFNode>
