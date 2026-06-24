import { useState, useRef, useCallback } from 'react'
import type React from 'react'
import { useReactFlow, useNodes, type Node as RFNode, type Edge as RFEdge } from '@xyflow/react'
import { useProjectStore } from '@store'
import { db } from '@db'
import type { NodeRow, EdgeRow } from '@db'
import { generateId, findSafeMsPosition, createMicroserviceNode, nodeRowToRfNode, edgeRowToRfEdge } from '@utils'
import type { EditorHeaderProps, EditorHeaderHook } from './types'
import templateNodes from '@assets/nodes.json'
import templateEdges from '@assets/edges.json'

// The original MS ID embedded in every child node's data.msId
const TEMPLATE_MS_ID = '13e95cea-d298-4330-b9c6-aef964f03439'

export const useEditorHeader = (
  { projectName, onRename }: Pick<EditorHeaderProps, 'projectName' | 'onRename'>
): EditorHeaderHook => {
  const [isEditing,  setIsEditing]  = useState<boolean>(false)
  const [editValue,  setEditValue]  = useState<string>(projectName)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const { setNodes, setEdges } = useReactFlow<RFNode, RFEdge>()
  const allNodes = useNodes<RFNode>()
  const activeProjectId = useProjectStore(s => s.activeProjectId)

  const startEdit = (): void => {
    setEditValue(projectName)
    setIsEditing(true)
    setTimeout(() => {
      inputRef.current?.select()
    }, 0)
  }

  const commitEdit = (): void => {
    setIsEditing(false)
    if (editValue.trim() && editValue.trim() !== projectName) {
      void onRename(editValue.trim())
    }
  }

  const cancelEdit = (): void => {
    setIsEditing(false)
    setEditValue(projectName)
  }

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') cancelEdit()
  }

  // Creates a brand-new independent copy of the example template.
  // Every ID is remapped — the clone is fully independent of the original.
  const handleCloneFromExample = useCallback(async (): Promise<void> => {
    if (!activeProjectId) return

    const nodes = templateNodes as NodeRow[]
    const edges = templateEdges as EdgeRow[]

    if (nodes.length === 0) {
      alert('Example template is empty. Add nodes to src/assets/nodes.json first.')
      return
    }

    // ── 1. Build ID map: every old ID → fresh UUID ────────────────
    const newMsId = generateId()
    const idMap   = new Map<string, string>([[TEMPLATE_MS_ID, newMsId]])
    for (const row of nodes) idMap.set(row.id, generateId())

    const remapJson = (json: string): string => {
      let out = json
      idMap.forEach((newId, oldId) => { out = out.split(oldId).join(newId) })
      return out
    }

    // ── 2. Compute MS size from child node bounding box ───────────
    const PADDING = 120
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const row of nodes) {
      minX = Math.min(minX, row.position.x)
      minY = Math.min(minY, row.position.y)
      maxX = Math.max(maxX, row.position.x + row.size.w)
      maxY = Math.max(maxY, row.position.y + row.size.h)
    }
    const msSize = {
      w: Math.max(600, maxX - minX + PADDING * 2),
      h: Math.max(400, maxY - minY + PADDING * 2),
    }

    // ── 3. Position new MS safely below existing ones ─────────────
    const msBounds = allNodes
      .filter(n => n.type === 'microservice')
      .map(n => ({ position: n.position, width: n.width, height: n.height }))
    const newMsPos = findSafeMsPosition(msBounds)

    // ── 4. Build new MS row ───────────────────────────────────────
    const msDef = createMicroserviceNode({
      id:       newMsId,
      label:    'Example Service',
      position: newMsPos,
      size:     msSize,
    })
    const newMsRow: NodeRow = {
      id:        newMsId,
      projectId: activeProjectId,
      type:      'MICROSERVICE',
      label:     msDef.label,
      position:  newMsPos,
      size:      msSize,
      data:      JSON.stringify(msDef),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    // ── 5. Clone child rows ───────────────────────────────────────
    const now = Date.now()
    const newChildRows: NodeRow[] = nodes.map(row => ({
      ...row,
      id:        idMap.get(row.id)!,
      projectId: activeProjectId,
      data:      remapJson(row.data),
      updatedAt: now,
    }))

    // ── 6. Clone edge rows ────────────────────────────────────────
    const newEdgeRows: EdgeRow[] = edges.map(row => ({
      ...row,
      id:         generateId(),
      projectId:  activeProjectId,
      fromNodeId: idMap.get(row.fromNodeId) ?? row.fromNodeId,
      toNodeId:   idMap.get(row.toNodeId)   ?? row.toNodeId,
    }))

    // ── 7. Persist ────────────────────────────────────────────────
    await db.nodes.bulkAdd([newMsRow, ...newChildRows])
    await db.edges.bulkAdd(newEdgeRows)

    // ── 8. Update RF canvas ───────────────────────────────────────
    const newMsRfNode: RFNode = {
      id:         newMsId,
      type:       'microservice',
      position:   newMsPos,
      data:       msDef as unknown as Record<string, unknown>,
      dragHandle: '.ms-drag-handle',
      width:      msSize.w,
      height:     msSize.h,
      style:      { width: msSize.w, height: msSize.h },
    }
    const newChildRfNodes = newChildRows
      .map(nodeRowToRfNode)
      .filter((n): n is RFNode => n !== null)
    const newRfEdges = newEdgeRows.map(edgeRowToRfEdge)

    setNodes((prev: RFNode[]) => [...prev, newMsRfNode, ...newChildRfNodes])
    setEdges((prev: RFEdge[]) => [...prev, ...newRfEdges])
  }, [activeProjectId, allNodes, setNodes, setEdges])

  return {
    isEditing,
    editValue,
    inputRef,
    startEdit,
    commitEdit,
    cancelEdit,
    handleEditKeyDown,
    setEditValue,
    handleCloneFromExample,
  }
}
