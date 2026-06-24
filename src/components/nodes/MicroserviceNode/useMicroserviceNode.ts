import React, { useCallback, useEffect } from 'react'
import { useReactFlow, useNodes, type Node as RFNode } from '@xyflow/react'
import { useCanvasStore, useProjectStore, useCodeEditorStore, useRegenerateModalStore, useGenerationProgressStore } from '@store'
import type { RegenerateAction } from '@store'
import { useDeleteNodes } from '@service'
import { exportArchitecture, saveVersion, diffArchitecture, regenerateWithDiff } from '@utils'
import { makeGenerationCallbacks, openGenerationSession } from '@utils/generationCallbacks'
import { generateCode }      from '@utils/generateCode'
import { continueGeneration } from '@utils/continueGeneration'
import { db }              from '@db'
import type { MicroserviceNode } from '@entity'
import type { MsPaletteEntry }   from '@constants/theme'

// ─── Colour palette ───────────────────────────────────────────────

const MS_PALETTE = [
  { border: '#3860f5', iconBg: '#dde6ff', iconFg: '#3730a3', badgeBg: '#eff3ff', badgeBorder: '#c7d2fe', badgeText: '#3730a3' },
  { border: '#0a9e6e', iconBg: '#d1fae5', iconFg: '#065f46', badgeBg: '#ecfdf5', badgeBorder: '#a7f3d0', badgeText: '#065f46' },
  { border: '#c030e8', iconBg: '#f3e8ff', iconFg: '#7e22ce', badgeBg: '#fdf4ff', badgeBorder: '#e9d5ff', badgeText: '#6b21a8' },
  { border: '#d4580a', iconBg: '#fed7aa', iconFg: '#9a3412', badgeBg: '#fff7ed', badgeBorder: '#fdba74', badgeText: '#9a3412' },
  { border: '#0891b2', iconBg: '#bae6fd', iconFg: '#075985', badgeBg: '#f0f9ff', badgeBorder: '#7dd3fc', badgeText: '#075985' },
] as const satisfies readonly MsPaletteEntry[]

// ─── Hook interface ───────────────────────────────────────────────

interface MicroserviceNodeHook {
  node:              MicroserviceNode
  isSelected:        boolean
  hasChildren:       boolean
  colorScheme:       MsPaletteEntry
  isGenerating:      boolean
  hasGeneratedFiles: boolean
  handleClick:       () => void
  handleDelete:      () => void
  handleExport:      (e: React.MouseEvent) => void
  handleSaveVersion: (e: React.MouseEvent) => void
  handleDiff:        (e: React.MouseEvent) => void
  handleGenerate:    (e: React.MouseEvent) => void
  handleContinue:    (e: React.MouseEvent) => void
}

export const useMicroserviceNode = (
  nodeId: string,
  data:   MicroserviceNode,
): MicroserviceNodeHook => {
  const selectedNodeId      = useCanvasStore(s => s.selectedNodeId)
  const { setSelectedNode } = useCanvasStore()
  const activeProjectId     = useProjectStore(s => s.activeProjectId)
  const generatingMsId      = useCodeEditorStore(s => s.generatingMsId)
  const generatedFiles      = useCodeEditorStore(s => s.generatedFiles)
  const { setNodes } = useReactFlow<RFNode>()
  const { mutate: deleteNodes } = useDeleteNodes()
  const allNodes = useNodes()

  const isSelected        = selectedNodeId === nodeId
  const hasChildren       = allNodes.some(n => n.parentId === nodeId)
  const colorScheme       = MS_PALETTE[data.colorIdx % 5]
  const isGenerating      = generatingMsId === nodeId
  const hasGeneratedFiles = Object.keys(generatedFiles).length > 0

  const handleClick = useCallback((): void => {
    setSelectedNode(nodeId)
  }, [setSelectedNode, nodeId])

  const handleExport = useCallback(async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (!activeProjectId) return
    const result = await exportArchitecture(nodeId, activeProjectId)
    console.group(`[archflow export] ${data.label}`)
    console.log(result)
    console.groupEnd()
  }, [nodeId, data.label, activeProjectId])

  const handleSaveVersion = useCallback(async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (!activeProjectId) return
    await saveVersion(nodeId, activeProjectId)
  }, [nodeId, activeProjectId])

  const handleDiff = useCallback(async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (!activeProjectId) return

    const current  = await exportArchitecture(nodeId, activeProjectId) as Record<string, unknown>
    const existing = await db.versions.where('msId').equals(nodeId).toArray()
    if (existing.length === 0) {
      console.log('[archflow diff] No saved version to diff against')
      return
    }
    const latest     = existing.reduce((best, row) => row.version > best.version ? row : best)
    const saved      = JSON.parse(latest.snapshot) as Record<string, unknown>
    const diffResult = diffArchitecture(saved, current)

    console.group(`[archflow diff] Current vs v${diffResult.version}`)
    console.log(diffResult)
    console.groupEnd()
  }, [nodeId, activeProjectId])

  // ─── runFullGeneration ───────────────────────────────────────────

  const runContinue = useCallback(async (): Promise<void> => {
    if (!activeProjectId) return
    const codeStore = useCodeEditorStore.getState()
    codeStore.clearModifiedFiles()
    codeStore.setActiveMsId(nodeId)
    openGenerationSession({ msId: nodeId, msLabel: data.label })

    const controller = new AbortController()
    codeStore.setAbortController(controller)

    const callbacks    = makeGenerationCallbacks({ msId: nodeId, projectId: activeProjectId, diffMode: false })
    const architecture = await exportArchitecture(nodeId, activeProjectId)

    await continueGeneration({ architecture, msId: nodeId, projectId: activeProjectId, signal: controller.signal, ...callbacks })

    if (controller.signal.aborted) {
      useGenerationProgressStore.getState().setStopped(true)
    }
    codeStore.setAbortController(null)
  }, [nodeId, activeProjectId, data.label])

  const runFullGeneration = useCallback(async (): Promise<void> => {
    if (!activeProjectId) return

    await db.generatedFiles.where('msId').equals(nodeId).delete()

    useCodeEditorStore.getState().clearModifiedFiles()
    openGenerationSession({ msId: nodeId, msLabel: data.label, clearFiles: true })
    useCodeEditorStore.getState().setActiveMsId(nodeId)

    const controller = new AbortController()
    useCodeEditorStore.getState().setAbortController(controller)

    const callbacks    = makeGenerationCallbacks({ msId: nodeId, projectId: activeProjectId, diffMode: false })
    const architecture = await exportArchitecture(nodeId, activeProjectId)

    await generateCode({ architecture, msId: nodeId, projectId: activeProjectId, signal: controller.signal, ...callbacks })

    if (controller.signal.aborted) {
      useGenerationProgressStore.getState().setStopped(true)
    }
    useCodeEditorStore.getState().setAbortController(null)
  }, [nodeId, activeProjectId, data.label])

  useEffect(() => {
    useGenerationProgressStore.getState().setContinueCallback(runContinue)
  }, [runContinue])

  // ─── handleGenerate ──────────────────────────────────────────────

  const handleGenerate = useCallback(async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (!activeProjectId) return
    if (useCodeEditorStore.getState().isGenerating) return

    useCodeEditorStore.getState().setActiveMsId(nodeId)

    const existingFiles = await db.generatedFiles
      .where('msId').equals(nodeId)
      .count()

    if (existingFiles > 0) {
      const action = await new Promise<RegenerateAction>((resolve) => {
        const modalStore = useRegenerateModalStore.getState()
        modalStore.setResolve(resolve)
        modalStore.open(nodeId, data.label)
      })

      if (action === 'diff') {
        const controller = new AbortController()
        useCodeEditorStore.getState().setAbortController(controller)
        await regenerateWithDiff({ msId: nodeId, projectId: activeProjectId, msLabel: data.label, signal: controller.signal })
        if (controller.signal.aborted) {
          useGenerationProgressStore.getState().setStopped(true)
        }
        useCodeEditorStore.getState().setAbortController(null)
      } else {
        await runFullGeneration()
      }
    } else {
      await runFullGeneration()
    }
  }, [nodeId, activeProjectId, data.label, runFullGeneration])

  const handleContinue = useCallback(async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    await runContinue()
  }, [runContinue])

  const handleDelete = useCallback((): void => {
    const confirmed = window.confirm(
      `Delete "${data.label}"? All nodes inside will also be deleted. This cannot be undone.`,
    )
    if (!confirmed) return

    const childIds = allNodes.filter(n => n.parentId === nodeId).map(n => n.id)
    const allIds   = [nodeId, ...childIds]

    if (activeProjectId) {
      deleteNodes({ nodeIds: allIds, projectId: activeProjectId })
    }
    setNodes((nodes: RFNode[]) => nodes.filter(n => !allIds.includes(n.id)))
  }, [data.label, nodeId, allNodes, activeProjectId, deleteNodes, setNodes])

  return {
    node: data,
    isSelected,
    hasChildren,
    colorScheme,
    isGenerating,
    hasGeneratedFiles,
    handleClick,
    handleDelete,
    handleExport,
    handleSaveVersion,
    handleDiff,
    handleGenerate,
    handleContinue,
  }
}
