import type { Node, NodeProps } from '@xyflow/react'
import type { ControllerNode } from '@entity'

export type ControllerNodeData = ControllerNode & Record<string, unknown>

export type ControllerRFNode = Node<ControllerNodeData, 'controller'>

export type ControllerNodeProps = NodeProps<ControllerRFNode>
