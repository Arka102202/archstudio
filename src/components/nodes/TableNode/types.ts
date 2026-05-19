import type { Node, NodeProps } from '@xyflow/react'
import type { TableNode } from '@entity'

export interface TableNodeProps extends Omit<NodeProps, 'data'> {
  data: TableNode
}

export interface TableNodeHook {
  node:        TableNode
  isSelected:  boolean
  handleClick: () => void
  entityLabel: string | null
  dbLabel:     string | null
  queryCount:  number
}

// TableNode used as the RF data field
export type TableNodeData = TableNode & Record<string, unknown>

export type TableRFNode = Node<TableNodeData, 'table'>
