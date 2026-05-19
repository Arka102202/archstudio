import { useCallback, useEffect, useRef } from 'react'
import { useCodeChatStore, useCodeEditorStore } from '@store'
import type { CodeChatFileOp, CodeChatMessage } from '@store'
import { sendCodeChatMessage } from '@utils/codeChatApi'
import { exportArchitecture, generateId } from '@utils'
import { syncClaudeContext }             from '@utils/syncClaudeContext'
import { db } from '@db'
import CODE_CHAT_SYSTEM_PROMPT from '@prompts/codeChatSystemPrompt.md?raw'
import SPRING_BOOT_DIRECTORY   from '@prompts/springBootDirectory.md?raw'

export const useCodeChat = (projectId: string) => {
  const store = useCodeChatStore()
  const {
    sessions,
    activeSessionId,
    isLoading,
    isSendingArchitecture,
    attachedFiles,
    isHistoryOpen,
    newSession,
    switchSession,
    deleteSession,
    setSessions,
    addMessage,
    updateLastMessage,
    appendLastMessageText,
    appendLastMessageFileOp,
    clearAttachedFiles,
    attachFile,
    detachFile,
    setLoading,
    setIsSendingArchitecture,
    setHistoryOpen,
  } = store

  const activeMsId          = useCodeEditorStore(s => s.activeMsId)
  const generatedFiles      = useCodeEditorStore(s => s.generatedFiles)
  const setGeneratedFile    = useCodeEditorStore(s => s.setGeneratedFile)
  const deleteGeneratedFile = useCodeEditorStore(s => s.deleteGeneratedFile)

  const abortRef    = useRef<AbortController | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Active session messages ─────────────────────────────────────
  const activeSession  = sessions.find(s => s.id === activeSessionId)
  const messages       = activeSession?.messages ?? []

  // ─── Load sessions from IDB when active MS changes ───────────────
  useEffect(() => {
    if (!activeMsId || !projectId) return
    void (async () => {
      const rows = await db.codeChatSessions
        .where('[msId+projectId]')
        .equals([activeMsId, projectId])
        .sortBy('createdAt')

      if (rows.length === 0) {
        setSessions([], null)
        return
      }

      const loaded = rows.map(row => ({
        id:        row.id,
        title:     row.title,
        createdAt: row.createdAt,
        messages:  JSON.parse(row.messagesJson) as CodeChatMessage[],
      }))
      setSessions(loaded, loaded[loaded.length - 1].id)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMsId, projectId])

  // ─── Save sessions to IDB (debounced, skips during streaming) ────
  useEffect(() => {
    if (!activeMsId || !projectId || isLoading) return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

    saveTimerRef.current = setTimeout(() => {
      const now = Date.now()
      const currentIds = new Set(sessions.map(s => s.id))

      void (async () => {
        await db.codeChatSessions.bulkPut(
          sessions.map(s => ({
            id:           s.id,
            msId:         activeMsId,
            projectId,
            title:        s.title,
            createdAt:    s.createdAt,
            updatedAt:    now,
            messagesJson: JSON.stringify(
              s.messages
                .filter(m => !m.isStreaming)
                .map(m => ({ ...m, fileOps: m.fileOps.map(op => ({ ...op, content: null })) })),
            ),
          })),
        )
        // Remove deleted sessions from IDB
        const allRows = await db.codeChatSessions
          .where('[msId+projectId]').equals([activeMsId, projectId]).toArray()
        const toDelete = allRows.filter(r => !currentIds.has(r.id)).map(r => r.id)
        if (toDelete.length > 0) await db.codeChatSessions.bulkDelete(toDelete)
      })()
    }, 300)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [sessions, isLoading, activeMsId, projectId])

  // ─── Apply file op ────────────────────────────────────────────────
  const applyFileOp = useCallback(async (op: CodeChatFileOp): Promise<void> => {
    if (!activeMsId) return
    if (op.op === 'delete') {
      await db.generatedFiles.delete(`${activeMsId}:${op.path}`)
      deleteGeneratedFile(op.path)
    } else {
      const content = op.content ?? ''
      await db.generatedFiles.put({
        id:          `${activeMsId}:${op.path}`,
        msId:        activeMsId,
        projectId,
        filePath:    op.path,
        content,
        generatedAt: Date.now(),
      })
      setGeneratedFile(op.path, content)
    }
  }, [activeMsId, projectId, setGeneratedFile, deleteGeneratedFile])

  // ─── Build file context block ─────────────────────────────────────
  // Resolves attached files + any @mentions in the text to actual content
  const buildFileContext = useCallback((text: string): string => {
    // Collect paths: explicitly attached + @mention references in text
    const atPaths = Array.from(text.matchAll(/@([\w/.\-]+)/g))
      .map(m => {
        const query = m[1].toLowerCase()
        // Find a matching file path
        return Object.keys(generatedFiles).find(p =>
          p.toLowerCase().endsWith(query) || p.split('/').pop()?.toLowerCase() === query,
        )
      })
      .filter((p): p is string => p !== undefined)

    const allPaths = [...new Set([...attachedFiles.map(f => f.path), ...atPaths])]
    if (allPaths.length === 0) return ''

    const blocks = allPaths
      .map(path => {
        const content = generatedFiles[path]
        if (!content) return null
        const name = path.split('/').pop() ?? path
        const ext  = name.split('.').pop() ?? ''
        const lang = ext === 'java' ? 'java' : ext === 'yml' ? 'yaml' : ext === 'xml' ? 'xml' : ''
        return `### @${name}\n_Path: \`${path}\`_\n\`\`\`${lang}\n${content}\n\`\`\``
      })
      .filter(Boolean)

    return blocks.length > 0
      ? `\n\n---\n## Referenced Files\n\n${blocks.join('\n\n')}`
      : ''
  }, [generatedFiles, attachedFiles])

  // ─── Send ─────────────────────────────────────────────────────────
  const handleSend = useCallback(async (text: string): Promise<void> => {
    if (!text.trim() || isLoading) return

    // Ensure an active session exists
    const { activeSessionId: sid } = useCodeChatStore.getState()
    if (!sid) {
      useCodeChatStore.getState().newSession()
    }

    // Build full user content
    let userContent = text.trim()
    userContent += buildFileContext(text)

    if (isSendingArchitecture && activeMsId) {
      const arch = await exportArchitecture(activeMsId, projectId)
      userContent += `\n\n---\n## Architecture JSON\n\`\`\`json\n${JSON.stringify(arch, null, 2)}\n\`\`\``
    }
    userContent += `\n\n---\n## Directory Structure Rules\n\n${SPRING_BOOT_DIRECTORY}`

    // Add user message (show only typed text in UI)
    addMessage({
      id:          generateId(),
      role:        'user',
      content:     text.trim(),
      fileOps:     [],
      timestamp:   Date.now(),
      isError:     false,
      isStreaming: false,
    })

    // Placeholder assistant message
    addMessage({
      id:          generateId(),
      role:        'assistant',
      content:     '',
      fileOps:     [],
      timestamp:   Date.now(),
      isError:     false,
      isStreaming: true,
    })

    clearAttachedFiles()
    setLoading(true)
    abortRef.current = new AbortController()

    // Grab history snapshot (exclude the placeholder we just added)
    const history = useCodeChatStore.getState()
      .sessions.find(s => s.id === useCodeChatStore.getState().activeSessionId)
      ?.messages.slice(0, -1) ?? []

    await sendCodeChatMessage({
      messages:     history,
      userText:     userContent,
      systemPrompt: CODE_CHAT_SYSTEM_PROMPT,
      signal:       abortRef.current.signal,

      onTextChunk: (chunk) => {
        useCodeChatStore.getState().appendLastMessageText(chunk)
      },

      onFileOp: (op) => {
        useCodeChatStore.getState().appendLastMessageFileOp(op)
        void applyFileOp(op)
      },

      onDone: () => {
        useCodeChatStore.getState().updateLastMessage({ isStreaming: false })
        useCodeChatStore.getState().setLoading(false)
        if (activeMsId) void syncClaudeContext(activeMsId, projectId)
      },

      onError: (err) => {
        useCodeChatStore.getState().updateLastMessage({
          content:     `Error: ${err.message}`,
          isError:     true,
          isStreaming: false,
        })
        useCodeChatStore.getState().setLoading(false)
      },
    })
  }, [
    isLoading,
    isSendingArchitecture,
    activeMsId,
    projectId,
    addMessage,
    setLoading,
    clearAttachedFiles,
    buildFileContext,
    applyFileOp,
  ])

  // ─── Abort ────────────────────────────────────────────────────────
  const handleAbort = useCallback((): void => {
    abortRef.current?.abort()
    updateLastMessage({ isStreaming: false })
    setLoading(false)
  }, [updateLastMessage, setLoading])

  return {
    sessions,
    activeSessionId,
    messages,
    isLoading,
    isSendingArchitecture,
    attachedFiles,
    isHistoryOpen,
    activeMsId,
    generatedFiles,
    // Session
    newSession,
    switchSession,
    deleteSession,
    setHistoryOpen,
    // Message
    handleSend,
    handleAbort,
    // Files
    attachFile,
    detachFile,
    setIsSendingArchitecture,
  }
}
