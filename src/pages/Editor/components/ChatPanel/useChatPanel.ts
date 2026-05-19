import { useEffect, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useChatStore, useCodeEditorStore } from '@store'
import {
  createChatSession, loadChatSessions, loadChatMessages, deleteChatSession,
  updateSessionTitle, sendChatMessage, executeCanvasActions, exportArchitecture,
  autoSummariseSession, autoTitleFromMessage, saveChatMessage, generateId,
} from '@utils'
import { db } from '@db'
import { NodeType } from '@entity'
import type { ChatMessage } from '@entity'
import type { ChatPanelHook, MsNodeEntry } from './types'

export const useChatPanel = (projectId: string): ChatPanelHook => {
  const [msNodes, setMsNodes] = useState<MsNodeEntry[]>([])
  const abortControllerRef = useRef<AbortController | null>(null)

  const { setNodes, setEdges, getNodes } = useReactFlow()

  const activeMsId            = useCodeEditorStore(s => s.activeMsId)
  const sessions              = useChatStore(s => s.chatSessions)
  const activeChatSessionId   = useChatStore(s => s.activeChatSessionId)
  const messages              = useChatStore(s => s.activeChatMessages)
  const isLoading             = useChatStore(s => s.isLoading)
  const isSendingArchitecture = useChatStore(s => s.isSendingArchitecture)

  const setChatSessions        = useChatStore(s => s.setChatSessions)
  const setActiveChatSession   = useChatStore(s => s.setActiveChatSession)
  const setActiveChatMessages  = useChatStore(s => s.setActiveChatMessages)
  const toggleSendArchitecture = useChatStore(s => s.toggleSendArchitecture)

  useEffect(() => {
    void (async () => {
      const rows = await db.nodes
        .where('[projectId+type]')
        .equals([projectId, NodeType.MICROSERVICE])
        .toArray()
      const entries: MsNodeEntry[] = rows.map(row => {
        let label = row.label
        try {
          const parsed = JSON.parse(row.data) as { label?: string }
          if (parsed.label) label = parsed.label
        } catch {
          // use row.label as fallback
        }
        return { id: row.id, label }
      })
      setMsNodes(entries)
      if (!useCodeEditorStore.getState().activeMsId && entries.length > 0) {
        useCodeEditorStore.getState().setActiveMsId(entries[0].id)
      }
    })()
  }, [projectId])

  useEffect(() => {
    if (!activeMsId) return
    void (async () => {
      const loaded = await loadChatSessions(activeMsId, projectId)
      if (loaded.length > 0) {
        setChatSessions(loaded)
        setActiveChatSession(loaded[0].id)
        const msgs = await loadChatMessages(loaded[0].id)
        setActiveChatMessages(msgs)
      } else {
        const session = await createChatSession(activeMsId, projectId)
        setChatSessions([session])
        setActiveChatSession(session.id)
        setActiveChatMessages([])
      }
    })()
  }, [activeMsId, projectId, setChatSessions, setActiveChatSession, setActiveChatMessages])

  const handleMsChange = (msId: string): void => {
    useCodeEditorStore.getState().setActiveMsId(msId)
  }

  const handleNewSession = async (): Promise<void> => {
    if (!activeMsId) return
    const session = await createChatSession(activeMsId, projectId)
    setChatSessions([session, ...sessions])
    setActiveChatSession(session.id)
    setActiveChatMessages([])
  }

  const handleSelectSession = async (sessionId: string): Promise<void> => {
    setActiveChatSession(sessionId)
    const msgs = await loadChatMessages(sessionId)
    setActiveChatMessages(msgs)
  }

  const handleDeleteSession = async (sessionId: string): Promise<void> => {
    await deleteChatSession(sessionId)
    const remaining = sessions.filter(s => s.id !== sessionId)
    setChatSessions(remaining)
    if (activeChatSessionId === sessionId) {
      if (remaining.length > 0) {
        setActiveChatSession(remaining[0].id)
        const msgs = await loadChatMessages(remaining[0].id)
        setActiveChatMessages(msgs)
      } else {
        setActiveChatSession(null)
        setActiveChatMessages([])
      }
    }
  }

  const handleRenameSession = async (sessionId: string, newTitle: string): Promise<void> => {
    await updateSessionTitle(sessionId, newTitle)
    setChatSessions(sessions.map(s => s.id === sessionId ? { ...s, title: newTitle } : s))
  }

  useEffect(() => {
    return () => { abortControllerRef.current?.abort() }
  }, [])

  const handleSendMessage = (content: string): void => {
    if (!content.trim() || !activeMsId || !activeChatSessionId || isLoading) return

    const session = sessions.find(s => s.id === activeChatSessionId)
    if (!session) return

    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    const userMsg: ChatMessage = {
      id:        generateId(),
      sessionId: activeChatSessionId,
      projectId,
      msId:      activeMsId,
      role:      'user',
      content:   content.trim(),
      actions:   [],
      timestamp: Date.now(),
      isError:   false,
    }

    const assistantMsg: ChatMessage = {
      id:        generateId(),
      sessionId: activeChatSessionId,
      projectId,
      msId:      activeMsId,
      role:      'assistant',
      content:   '',
      actions:   [],
      timestamp: Date.now() + 1,
      isError:   false,
    }

    useChatStore.getState().addMessage(userMsg)
    useChatStore.getState().addMessage(assistantMsg)
    useChatStore.getState().setIsLoading(true)

    void saveChatMessage(userMsg)

    const last10 = messages.slice(-10)

    void (async (): Promise<void> => {
      let architecture: object | null = null
      if (isSendingArchitecture) {
        try { architecture = await exportArchitecture(activeMsId, projectId) } catch { /* skip */ }
      }

      await sendChatMessage({
        session,
        messages: last10,
        userContent: content.trim(),
        architecture,
        signal: controller.signal,
        onChunk: (chunk) => {
          const current = useChatStore.getState().activeChatMessages
          const last    = current[current.length - 1]
          if (last && last.role === 'assistant') {
            useChatStore.getState().updateLastMessage({ content: last.content + chunk })
          }
        },
        onDone: (fullContent, actions) => {
          useChatStore.getState().updateLastMessage({ content: fullContent, actions })
          useChatStore.getState().setIsLoading(false)
          abortControllerRef.current = null

          const completedMsg: ChatMessage = { ...assistantMsg, content: fullContent, actions }
          void saveChatMessage(completedMsg)

          const currentRfNodes = getNodes()
          void executeCanvasActions({
            actions, msId: activeMsId, projectId,
            rfNodes: currentRfNodes, setNodes, setEdges,
          })

          if (session.title === 'New session') {
            const title = autoTitleFromMessage(content.trim())
            void updateSessionTitle(activeChatSessionId, title)
            useChatStore.getState().setChatSessions(
              useChatStore.getState().chatSessions.map(s =>
                s.id === activeChatSessionId ? { ...s, title } : s,
              ),
            )
          }

          const msgCount = useChatStore.getState().activeChatMessages.length
          if (msgCount >= 20 && !session.summary) {
            void autoSummariseSession(session, useChatStore.getState().activeChatMessages)
          }
        },
        onError: (err) => {
          if (err.name === 'AbortError') {
            useChatStore.getState().setIsLoading(false)
            abortControllerRef.current = null
            return
          }
          useChatStore.getState().updateLastMessage({ isError: true, content: err.message })
          useChatStore.getState().setIsLoading(false)
          abortControllerRef.current = null
          void saveChatMessage({ ...assistantMsg, content: err.message, isError: true })
        },
      })
    })()
  }

  const handleStopGeneration = (): void => {
    abortControllerRef.current?.abort()
  }

  const handleToggleArchitecture = (): void => {
    toggleSendArchitecture()
  }

  return {
    projectId,
    msNodes,
    activeMsId,
    sessions,
    activeChatSessionId,
    messages,
    isLoading,
    isSendingArchitecture,
    handleMsChange,
    handleNewSession,
    handleSelectSession,
    handleDeleteSession,
    handleRenameSession,
    handleSendMessage,
    handleStopGeneration,
    handleToggleArchitecture,
  }
}
