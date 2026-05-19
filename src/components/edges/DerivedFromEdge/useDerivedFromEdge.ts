import { useState, useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useProjectStore } from '@store'
import { db } from '@db'
import type { DerivedFromEdgeHook } from './types'

export const useDerivedFromEdge = (edgeId: string): DerivedFromEdgeHook => {
  const [isHovered, setIsHovered] = useState(false)
  const { setEdges }       = useReactFlow()
  const activeProjectId    = useProjectStore(s => s.activeProjectId)

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

  return { isHovered, setIsHovered, handleDelete }
}
