import { useCallback, useState } from 'react'
import { useNodes, useReactFlow } from '@xyflow/react'
import { useCanvasStore } from '@store'
import { useProjectStore } from '@store'
import { useUpdateNode } from '@service'
import { useDebounce } from '@hooks'
import { NodeType } from '@entity'
import { db } from '@db'
import type { MicroserviceNode, BuildTool, DockerConfig, AIPrompt, Dependency } from '@entity'
import type { MsNodeData } from '@components/nodes/MicroserviceNode'
import type { MicroserviceInspectorHook, MicroserviceInspectorProps } from './types'

// ─── Auto-format helpers ──────────────────────────────────────────

const toKebabCase = (value: string): string =>
  value
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()

const toDotCase = (value: string): string =>
  value
    .replace(/[A-Z]/g, c => c.toLowerCase())
    .replace(/[\s-_]+/g, '.')
    .replace(/\.{2,}/g, '.')

// ─── Preset deps ──────────────────────────────────────────────────

const SB_GROUP = 'org.springframework.boot'

const PRESET_ARTIFACT_IDS = [
  'spring-boot-starter-web',
  'spring-boot-starter-data-jpa',
  'spring-boot-starter-security',
  'postgresql',
  'lombok',
  'spring-boot-starter-validation',
]

// ─── Hook ─────────────────────────────────────────────────────────

export const useMicroserviceInspector = (
  { nodeId }: MicroserviceInspectorProps,
): MicroserviceInspectorHook => {
  const clearSelection  = useCanvasStore(s => s.clearSelection)
  const activeProjectId = useProjectStore(s => s.activeProjectId)
  const rfNodes                  = useNodes()
  const { setNodes, setEdges }   = useReactFlow()

  const { mutate: updateNode } = useUpdateNode()

  const [isLoading] = useState<boolean>(false)

  // Derive current node from RF state (instant, no query round-trip)
  const rfNode = rfNodes.find(n => n.id === nodeId)
  const node   = (rfNode?.data as unknown as MicroserviceNode | undefined) ?? null

  // ─── Core update helper ─────────────────────────────────────────
  // Updates RF state immediately and debounces the IDB write.

  const writeToIDB = useCallback((updated: MicroserviceNode): void => {
    if (!activeProjectId) return
    updateNode({
      id:        updated.id,
      projectId: activeProjectId,
      type:      NodeType.MICROSERVICE,
      label:     updated.label,
      position:  updated.position,
      size:      updated.size,
      data:      JSON.stringify(updated),
      createdAt: Date.now(), // will be ignored by update mutation
      updatedAt: Date.now(),
    })
  }, [activeProjectId, updateNode])

  const debouncedWrite    = useDebounce(writeToIDB, 300)
  const debouncedWriteSlow = useDebounce(writeToIDB, 500)

  const applyUpdate = useCallback((
    updater:  (prev: MicroserviceNode) => MicroserviceNode,
    debounce: 'fast' | 'slow' = 'fast',
  ): void => {
    if (!node) return
    const updated = updater(node)

    setNodes(nodes => nodes.map(n =>
      n.id === nodeId ? { ...n, data: updated as MsNodeData } : n,
    ))

    if (debounce === 'slow') debouncedWriteSlow(updated)
    else debouncedWrite(updated)
  }, [node, nodeId, setNodes, debouncedWrite, debouncedWriteSlow])

  // ─── Identity ───────────────────────────────────────────────────

  const handleLabelChange = useCallback((value: string): void => {
    applyUpdate(n => ({ ...n, label: value }))
  }, [applyUpdate])

  const handleServiceNameChange = useCallback((value: string): void => {
    applyUpdate(n => ({ ...n, serviceName: toKebabCase(value) }))
  }, [applyUpdate])

  const handlePackageNameChange = useCallback((value: string): void => {
    applyUpdate(n => ({ ...n, packageName: toDotCase(value) }))
  }, [applyUpdate])

  const handlePortChange = useCallback((value: string): void => {
    applyUpdate(n => ({ ...n, port: value }))
  }, [applyUpdate])

  const handleVersionChange = useCallback((value: string): void => {
    applyUpdate(n => ({ ...n, version: value }))
  }, [applyUpdate])

  // ─── Build ──────────────────────────────────────────────────────

  const handleBuildToolChange = useCallback((value: BuildTool): void => {
    applyUpdate(n => ({ ...n, build: { ...n.build, tool: value } }))
  }, [applyUpdate])

  const handleSpringVersionChange = useCallback((value: string): void => {
    applyUpdate(n => ({ ...n, build: { ...n.build, springBootVersion: value } }))
  }, [applyUpdate])

  const handleJavaVersionChange = useCallback((value: '17' | '21'): void => {
    applyUpdate(n => ({ ...n, build: { ...n.build, javaVersion: value } }))
  }, [applyUpdate])

  // ─── Dependencies ───────────────────────────────────────────────

  const handleAddDependency = useCallback((raw: string): void => {
    const trimmed = raw.trim()
    if (!trimmed) return

    let dep: Dependency
    if (trimmed.includes(':')) {
      const [groupId, artifactId, version = ''] = trimmed.split(':')
      dep = { groupId: groupId ?? SB_GROUP, artifactId: artifactId ?? trimmed, version, scope: null }
    } else {
      // Check if it's a preset
      const isPreset = PRESET_ARTIFACT_IDS.includes(trimmed)
      dep = {
        groupId:    isPreset ? SB_GROUP : SB_GROUP,
        artifactId: trimmed,
        version:    '',
        scope:      null,
      }
    }

    applyUpdate(n => ({
      ...n,
      build: {
        ...n.build,
        extraDependencies: [...n.build.extraDependencies, dep],
      },
    }))
  }, [applyUpdate])

  const handleRemoveDependency = useCallback((index: number): void => {
    applyUpdate(n => ({
      ...n,
      build: {
        ...n.build,
        extraDependencies: n.build.extraDependencies.filter((_, i) => i !== index),
      },
    }))
  }, [applyUpdate])

  // ─── Docker ─────────────────────────────────────────────────────

  const handleDockerToggle = useCallback((field: keyof DockerConfig): void => {
    applyUpdate(n => {
      const current = n.docker[field]
      if (typeof current !== 'boolean') return n
      return {
        ...n,
        docker: { ...n.docker, [field]: !current },
      }
    })
  }, [applyUpdate])

  const handleBaseImageChange = useCallback((value: string): void => {
    applyUpdate(n => ({ ...n, docker: { ...n.docker, baseImage: value } }), 'slow')
  }, [applyUpdate])

  // ─── AI Prompt ──────────────────────────────────────────────────

  const handleAIPromptChange = useCallback((field: keyof AIPrompt, value: string): void => {
    applyUpdate(
      n => ({ ...n, aiPrompt: { ...n.aiPrompt, [field]: value } }),
      'slow',
    )
  }, [applyUpdate])

  const handleAIGenerateToggle = useCallback((): void => {
    applyUpdate(n => ({
      ...n,
      aiPrompt: { ...n.aiPrompt, aiGenerate: !n.aiPrompt.aiGenerate },
    }))
  }, [applyUpdate])

  // ─── Lifecycle ──────────────────────────────────────────────────

  const handleClose = useCallback((): void => {
    clearSelection()
  }, [clearSelection])

  const handleDelete = useCallback((): void => {
    if (!node || !activeProjectId) return
    const confirmed = window.confirm(
      `Delete "${node.label}"? All child nodes will also be deleted. This cannot be undone.`,
    )
    if (!confirmed) return

    const childIds  = rfNodes.filter(n => n.parentId === nodeId).map(n => n.id)
    const allIds    = new Set([nodeId, ...childIds])

    // Remove from RF state immediately
    setNodes(nodes => nodes.filter(n => !allIds.has(n.id)))
    setEdges(edges => edges.filter(e => !allIds.has(e.source) && !allIds.has(e.target)))
    clearSelection()

    // Persist deletions to IDB
    void (async () => {
      for (const nid of allIds) {
        await db.nodes.delete(nid)
        await db.edges.where('fromNodeId').equals(nid).delete()
        await db.edges.where('toNodeId').equals(nid).delete()
      }
      const bc = new BroadcastChannel('archflow-sync')
      bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: activeProjectId })
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: activeProjectId })
      bc.close()
    })()
  }, [node, activeProjectId, rfNodes, nodeId, setNodes, setEdges, clearSelection])

  return {
    node,
    isLoading,
    handleLabelChange,
    handleServiceNameChange,
    handlePackageNameChange,
    handlePortChange,
    handleVersionChange,
    handleBuildToolChange,
    handleSpringVersionChange,
    handleJavaVersionChange,
    handleAddDependency,
    handleRemoveDependency,
    handleDockerToggle,
    handleBaseImageChange,
    handleAIPromptChange,
    handleAIGenerateToggle,
    handleClose,
    handleDelete,
  }
}
