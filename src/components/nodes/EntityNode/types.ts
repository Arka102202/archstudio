import type { Node, NodeProps } from '@xyflow/react'
import type { EntityNode } from '@entity'

// ─── RF-compatible data shape ─────────────────────────────────────
// @xyflow/react requires Node.data to extend Record<string, unknown>.
// EntityNode is used as the data field — same pattern as MsNodeData.

export type EntityNodeData = EntityNode & Record<string, unknown>

export type EntityRFNode = Node<EntityNodeData, 'entity'>

export type EntityNodeProps = NodeProps<EntityRFNode>
