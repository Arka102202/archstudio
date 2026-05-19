import { useNodes } from '@xyflow/react'
import { useCanvasStore } from '@store'
import { NodeType } from '@entity'
import type { InspectorPanelHook } from './types'

// ─── RF type string → domain NodeType ────────────────────────────
// RF stores type as lowercase string ('microservice', 'entity', 'dto').
// We map to domain enums so InspectorPanel can switch on NodeType.

const RF_TYPE_MAP: Record<string, NodeType> = {
  microservice: NodeType.MICROSERVICE,
  entity:       NodeType.ENTITY,
  dto:          NodeType.DTO,
  db:           NodeType.DB,
  table:        NodeType.TABLE,
  service:      NodeType.SERVICE,
  controller:   NodeType.CONTROLLER,
  endpoint:     NodeType.API_ENDPOINT,
  customType:   NodeType.CUSTOM_TYPE,
}

export const useInspectorPanel = (): InspectorPanelHook => {
  const selectedNodeId = useCanvasStore(s => s.selectedNodeId)
  const rfNodes        = useNodes()

  const rfNode   = rfNodes.find(n => n.id === selectedNodeId)
  const nodeType = rfNode ? (RF_TYPE_MAP[rfNode.type ?? ''] ?? null) : null

  return {
    selectedNodeId,
    nodeType,
    isOpen: selectedNodeId !== null,
  }
}
