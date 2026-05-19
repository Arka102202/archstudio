import { useState, useCallback } from 'react'
import { useNodes, useReactFlow } from '@xyflow/react'
import { useProjectStore } from '@store'
import { db } from '@db'
import type { TableNode } from '@entity'
import type { ConnectsToEdgeHook } from './types'

export const useConnectsToEdge = (edgeId: string): ConnectsToEdgeHook => {
  const [isHovered, setIsHovered] = useState(false)
  const { setEdges, setNodes, getEdges } = useReactFlow()
  const rfNodes         = useNodes()
  const activeProjectId = useProjectStore(s => s.activeProjectId)

  const handleDelete = useCallback((): void => {
    void (async (): Promise<void> => {
      // Find the edge to get source (table) id
      const rfEdges = getEdges()
      const edge    = rfEdges.find(e => e.id === edgeId)

      await db.edges.delete(edgeId)
      setEdges(edges => edges.filter(e => e.id !== edgeId))

      // Update TableNode: set dbNodeId = null
      if (edge) {
        const tableId = edge.source
        const tableRFNode = rfNodes.find(n => n.id === tableId)
        if (tableRFNode) {
          const tableNode = tableRFNode.data as unknown as TableNode
          const updatedTable: TableNode = { ...tableNode, dbNodeId: null }

          setNodes(nodes => nodes.map(n =>
            n.id === tableId
              ? { ...n, data: updatedTable as unknown as Record<string, unknown> }
              : n,
          ))

          // Write to IDB
          await db.nodes.update(tableId, {
            data:      JSON.stringify(updatedTable),
            updatedAt: Date.now(),
          })
        }
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
