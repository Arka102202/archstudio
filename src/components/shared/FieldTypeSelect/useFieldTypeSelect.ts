import { useNodes, useEdges } from '@xyflow/react'
import { EdgeType } from '@entity'
import type { EntityNode, CustomTypeNode } from '@entity'
import type { EntityOption, CustomTypeOption } from './types'

export function useFieldTypeSelect(
  currentNodeId: string,
  _mode:         'entity' | 'dto',
): { entityOptions: EntityOption[]; customTypeOptions: CustomTypeOption[] } {
  const allNodes = useNodes()
  const allEdges = useEdges()

  // Resolve the current node's msId so we only show same-MS entities/custom types
  const currentRFNode   = allNodes.find(n => n.id === currentNodeId)
  const currentNodeData = currentRFNode?.data as unknown as EntityNode | undefined
  const currentMsId     = currentNodeData?.msId ?? null

  const entityOptions: EntityOption[] = allNodes
    .filter(n => {
      if (n.type !== 'entity') return false
      if (n.id === currentNodeId) return false
      // Same-MS filter: only show entities in the same microservice
      if (currentMsId !== null) {
        const entityData = n.data as unknown as EntityNode
        if (entityData.msId !== currentMsId) return false
      }
      return true
    })
    .map(n => {
      const entity   = n.data as unknown as EntityNode
      const hasTable = allEdges.some(e => {
        const d = e.data as { type?: string } | undefined
        return d?.type === EdgeType.STORED_IN && e.source === n.id
      })
      return {
        id:       n.id,
        label:    entity.label,
        hasTable,
        disabled: false,
      }
    })

  const customTypeOptions: CustomTypeOption[] = allNodes
    .filter(n => {
      if (n.type !== 'customType') return false
      // Custom types are allowed to reference themselves (e.g. recursive tree structures)
      if (currentMsId !== null) {
        const ctData = n.data as unknown as CustomTypeNode
        if (ctData.msId !== currentMsId) return false
      }
      return true
    })
    .map(n => {
      const ct = n.data as unknown as CustomTypeNode
      return { id: n.id, label: ct.label }
    })

  return { entityOptions, customTypeOptions }
}
