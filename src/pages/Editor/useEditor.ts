import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate }                     from 'react-router-dom'
import { useLiveQuery }                               from 'dexie-react-hooks'
import { db }                                         from '@db'
import { ROUTES }                                     from '@constants/routes'
import { useProjectStore, useCodeEditorStore, useCanvasStore } from '@store'
import { downloadAsZip, exportArchitecture, generateClaudeContext } from '@utils'
import { NodeType }                                                  from '@entity'
import type { ActiveTab, EditorProject }              from './types'

// ─── MsNodeEntry ─────────────────────────────────────────────────

export interface MsNodeEntry {
  id:    string
  label: string
}

// ─── EditorHook ──────────────────────────────────────────────────

interface EditorHook {
  project:           EditorProject | null
  isLoading:         boolean
  activeTab:         ActiveTab
  hasGeneratedFiles: boolean
  msNodes:           MsNodeEntry[]
  activeMsId:        string | null
  handleBack:        () => void
  handleRename:      (newName: string) => Promise<void>
  setActiveTab:      (tab: ActiveTab) => void
  handleDownloadZip: () => Promise<void>
  handleClearFiles:  () => Promise<void>
}

export const useEditor = (): EditorHook => {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  const [project,   setProject]   = useState<EditorProject | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [activeTab, setActiveTab] = useState<ActiveTab>('canvas')

  const generatedFiles    = useCodeEditorStore(s => s.generatedFiles)
  const activeMsId        = useCodeEditorStore(s => s.activeMsId)
  const hasGeneratedFiles = Object.keys(generatedFiles).length > 0

  // Load project from IDB
  useEffect(() => {
    if (!projectId) {
      navigate(ROUTES.HOME, { replace: true })
      return
    }

    void (async () => {
      const row = await db.projects.get(projectId)
      if (!row) {
        navigate(ROUTES.HOME, { replace: true })
        return
      }
      setProject({ id: row.id, name: row.name })
      setIsLoading(false)
      useProjectStore.getState().setActiveProject(projectId)
    })()

    return () => {
      useProjectStore.getState().setActiveProject(null)
    }
  }, [projectId, navigate])

  const msRows = useLiveQuery(
    () => projectId
      ? db.nodes.where('[projectId+type]').equals([projectId, NodeType.MICROSERVICE]).toArray()
      : [],
    [projectId],
    [],
  )

  const msNodes = useMemo<MsNodeEntry[]>(() =>
    (msRows ?? []).map(row => {
      try {
        const data = JSON.parse(row.data) as { label?: string }
        return { id: row.id, label: data.label ?? row.label }
      } catch {
        return { id: row.id, label: row.label }
      }
    }),
  [msRows])

  // Auto-select activeMsId when Code tab becomes active
  useEffect(() => {
    if (activeTab !== 'code') return
    if (useCodeEditorStore.getState().activeMsId) return   // already set
    if (msNodes.length === 0) return

    const selectedNodeId = useCanvasStore.getState().selectedNodeId
    const target = msNodes.find(n => n.id === selectedNodeId) ?? msNodes[0]
    useCodeEditorStore.getState().setActiveMsId(target.id)
  }, [activeTab, msNodes])

  // Listen for archflow-switch-tab events
  useEffect(() => {
    const handler = (e: Event): void => {
      const tab = (e as CustomEvent<ActiveTab>).detail
      if (tab === 'canvas' || tab === 'code' || tab === 'preview') {
        setActiveTab(tab)
      }
    }
    window.addEventListener('archflow-switch-tab', handler)
    return () => window.removeEventListener('archflow-switch-tab', handler)
  }, [])

  const handleBack = useCallback((): void => {
    navigate(ROUTES.HOME)
  }, [navigate])

  const handleRename = useCallback(async (newName: string): Promise<void> => {
    if (!projectId) return
    await db.projects.update(projectId, { name: newName, updatedAt: Date.now() })
    setProject(prev => prev ? { ...prev, name: newName } : prev)
  }, [projectId])

  const handleClearFiles = useCallback(async (): Promise<void> => {
    const msId = useCodeEditorStore.getState().activeMsId
    if (!msId) return
    await db.generatedFiles.where('msId').equals(msId).delete()
    useCodeEditorStore.getState().clearGeneratedFiles()
  }, [])

  const handleDownloadZip = useCallback(async (): Promise<void> => {
    const files = useCodeEditorStore.getState().generatedFiles
    if (Object.keys(files).length === 0) return

    const currentMsId = useCodeEditorStore.getState().activeMsId
    const msEntry     = msNodes.find(n => n.id === currentMsId)

    let serviceName = msEntry?.label ?? 'microservice'
    let version     = '1.0.0'

    if (currentMsId) {
      const nodeRow = await db.nodes.get(currentMsId)
      if (nodeRow) {
        try {
          const nodeData = JSON.parse(nodeRow.data) as { serviceName?: string; version?: string }
          if (nodeData.serviceName) serviceName = nodeData.serviceName
          if (nodeData.version)     version     = nodeData.version
        } catch { /* keep defaults */ }
      }
    }

    // Build .claude/ context files from current architecture
    let claudeFiles: Record<string, string> = {}
    if (currentMsId && projectId) {
      try {
        const arch = await exportArchitecture(currentMsId, projectId)
        claudeFiles = generateClaudeContext({ arch, generatedFiles: files })
      } catch { /* non-fatal — zip still exports without .claude/ */ }
    }

    await downloadAsZip({ files, claudeFiles, serviceName, version })
  }, [projectId, msNodes])

  return {
    project,
    isLoading,
    activeTab,
    hasGeneratedFiles,
    msNodes,
    activeMsId,
    handleBack,
    handleRename,
    setActiveTab,
    handleDownloadZip,
    handleClearFiles,
  }
}
