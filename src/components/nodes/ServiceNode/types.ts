import type { Node, NodeProps } from '@xyflow/react'
import type { ServiceNode } from '@entity'

export type ServiceNodeData = ServiceNode & Record<string, unknown>

export type ServiceRFNode = Node<ServiceNodeData, 'service'>

export type ServiceNodeProps = NodeProps<ServiceRFNode>
