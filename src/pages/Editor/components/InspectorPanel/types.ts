import type { NodeType } from '@entity'

export interface InspectorPanelHook {
  selectedNodeId: string | null
  nodeType:       NodeType | null
  isOpen:         boolean
}
