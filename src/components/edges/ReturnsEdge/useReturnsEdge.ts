import { useState, useCallback } from 'react'
import { useNodes, useReactFlow } from '@xyflow/react'
import { useProjectStore } from '@store'
import { db } from '@db'
import type { APIEndpointNode } from '@entity'
import type { ReturnsEdgeHook } from './types'

// ─── useReturnsEdge ───────────────────────────────────────────────
// On delete: clear endpoint.response.returnDTOId.
// DTO purpose is NOT reverted.

export const useReturnsEdge = (edgeId: string): ReturnsEdgeHook => {
  const [isHovered, setIsHovered] = useState(false)
  const { setEdges, setNodes, getEdges } = useReactFlow()
  const rfNodes         = useNodes()
  const activeProjectId = useProjectStore(s => s.activeProjectId)

  const handleDelete = useCallback((): void => {
    void (async (): Promise<void> => {
      const rfEdges = getEdges()
      const edge    = rfEdges.find(e => e.id === edgeId)
      if (!edge) return

      const endpointId = edge.source

      await db.edges.delete(edgeId)
      setEdges(edges => edges.filter(e => e.id !== edgeId))

      // Clear returnDTOId on the endpoint node
      const endpointRFNode = rfNodes.find(n => n.id === endpointId)
      if (endpointRFNode) {
        const endpointNode = endpointRFNode.data as unknown as APIEndpointNode
        const updated: APIEndpointNode = {
          ...endpointNode,
          response: { ...endpointNode.response, returnDTOId: null },
        }

        setNodes(nodes => nodes.map(n =>
          n.id === endpointId
            ? { ...n, data: updated as unknown as Record<string, unknown> }
            : n,
        ))

        await db.nodes.update(endpointId, {
          data:      JSON.stringify(updated),
          updatedAt: Date.now(),
        })
      }

      if (activeProjectId) {
        const bc = new BroadcastChannel('archflow-sync')
        bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
        bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
        bc.close()
      }
    })()
  }, [edgeId, setEdges, setNodes, getEdges, rfNodes, activeProjectId])

  return { isHovered, setIsHovered, handleDelete }
}
