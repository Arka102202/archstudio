import { useState, useCallback } from 'react'
import { useReactFlow, useNodes } from '@xyflow/react'
import { useProjectStore } from '@store'
import { db } from '@db'
import type { EntityNode } from '@entity'
import type { RelatesToEdgeHook } from './types'

export const useRelatesToEdge = (
  edgeId:   string,
  sourceId: string,
  targetId: string,
): RelatesToEdgeHook => {
  const [isHovered, setIsHovered] = useState(false)
  const { setEdges }    = useReactFlow()
  const activeProjectId = useProjectStore(s => s.activeProjectId)
  const allNodes        = useNodes()

  // Derive relation label from the source entity's field that references the target entity
  const sourceNode  = allNodes.find(n => n.id === sourceId)
  const sourceEntity = sourceNode?.data as EntityNode | undefined
  const relatingField = sourceEntity?.fields?.find(
    f => f.type === 'ENTITY_REF' && f.entityTypeId === targetId && f.relation != null,
  )
  const relationLabel = relatingField?.relation != null
    ? `@${relatingField.relation.type.replace(/_/g, '').replace(/([A-Z])/g, '$1').replace(/^(.)/, c => c.toUpperCase())}`
    : 'RELATES TO'

  const handleDelete = useCallback((): void => {
    void (async (): Promise<void> => {
      await db.edges.delete(edgeId)
      setEdges(edges => edges.filter(e => e.id !== edgeId))
      if (activeProjectId) {
        const bc = new BroadcastChannel('archflow-sync')
        bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
        bc.close()
      }
    })()
  }, [edgeId, setEdges, activeProjectId])

  return { isHovered, setIsHovered, handleDelete, relationLabel }
}
