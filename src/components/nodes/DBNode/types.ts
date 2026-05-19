import type { Node, NodeProps } from '@xyflow/react'
import type { DBNode } from '@entity'

export interface DBNodeProps extends Omit<NodeProps, 'data'> {
  data: DBNode
}

export interface DBNodeHook {
  node:        DBNode
  isSelected:  boolean
  tableCount:  number
  handleClick: () => void
}

// DBNode used as the RF data field
export type DBNodeData = DBNode & Record<string, unknown>

export type DBRFNode = Node<DBNodeData, 'db'>
