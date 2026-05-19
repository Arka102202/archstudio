import { useState, useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useProjectStore } from '@store'
import { db } from '@db'
import type { RoutesToEdgeHook } from './types'

// ─── useRoutesToEdge ──────────────────────────────────────────────
// ROUTES_TO is structural-only — deleting the edge requires no node reset.

export const useRoutesToEdge = (edgeId: string): RoutesToEdgeHook => {
  const [isHovered, setIsHovered] = useState(false)
  const { setEdges, getEdges }    = useReactFlow()
  const activeProjectId           = useProjectStore(s => s.activeProjectId)

  const handleDelete = useCallback((): void => {
    void (async (): Promise<void> => {
      const rfEdges = getEdges()
      const edge    = rfEdges.find(e => e.id === edgeId)
      if (!edge) return

      await db.edges.delete(edgeId)
      setEdges(edges => edges.filter(e => e.id !== edgeId))

      if (activeProjectId) {
        const bc = new BroadcastChannel('archflow-sync')
        bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
        bc.close()
      }
    })()
  }, [edgeId, setEdges, getEdges, activeProjectId])

  return { isHovered, setIsHovered, handleDelete }
}
