import { useState, useCallback } from 'react'
import { useNodes, useReactFlow } from '@xyflow/react'
import { useProjectStore } from '@store'
import { resetServiceNode } from '@utils'
import { db } from '@db'
import type { ServiceNode } from '@entity'
import type { UsesEdgeHook } from './types'

export const useUsesEdge = (edgeId: string): UsesEdgeHook => {
  const [isHovered, setIsHovered] = useState(false)
  const { setEdges, setNodes, getEdges } = useReactFlow()
  const rfNodes         = useNodes()
  const activeProjectId = useProjectStore(s => s.activeProjectId)

  const handleDelete = useCallback((): void => {
    void (async (): Promise<void> => {
      const rfEdges  = getEdges()
      const edge     = rfEdges.find(e => e.id === edgeId)
      if (!edge) return

      const serviceId = edge.source

      await db.edges.delete(edgeId)
      setEdges(edges => edges.filter(e => e.id !== edgeId))

      // Reset ServiceNode to factory defaults
      const serviceRFNode = rfNodes.find(n => n.id === serviceId)
      if (serviceRFNode) {
        const serviceNode = serviceRFNode.data as unknown as ServiceNode
        const reset       = resetServiceNode(serviceNode)

        setNodes(nodes => nodes.map(n =>
          n.id === serviceId
            ? { ...n, data: reset as unknown as Record<string, unknown> }
            : n,
        ))

        await db.nodes.update(serviceId, {
          data:      JSON.stringify(reset),
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
