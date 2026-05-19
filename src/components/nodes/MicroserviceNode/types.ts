import type { Node, NodeProps } from '@xyflow/react'
import type { MicroserviceNode } from '@entity'

// ─── RF-compatible data shape ─────────────────────────────────────
// @xyflow/react requires Node.data to extend Record<string, unknown>.
// MicroserviceNode is used as the data — TypeScript allows this at the
// value level (interfaces are structurally compatible), but not at the
// generic constraint level with strict index signatures.
//
// We use `MicroserviceNode & Record<string, unknown>` for RF generics,
// and expose `MicroserviceNode` for domain logic (accessed via .data cast).

export type MsNodeData = MicroserviceNode & Record<string, unknown>

export type MsRFNode = Node<MsNodeData, 'microservice'>

export type MicroserviceNodeProps = NodeProps<MsRFNode>

