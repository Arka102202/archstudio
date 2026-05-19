import React, { useEffect, useRef } from 'react'
import { useCodeChat } from './useCodeChat'
import { CodeChatInput }   from './components/CodeChatInput'
import { CodeChatMessage } from './components/CodeChatMessage'
import type { CodeChatProps } from './types'

const CodeChat = ({ projectId }: CodeChatProps): React.JSX.Element => {
  const {
    sessions,
    activeSessionId,
    messages,
    isLoading,
    isSendingArchitecture,
    activeMsId,
    generatedFiles,
    attachedFiles,
    isHistoryOpen,
    handleSend,
    handleAbort,
    attachFile,
    detachFile,
    newSession,
    switchSession,
    deleteSession,
    setHistoryOpen,
    setIsSendingArchitecture,
  } = useCodeChat(projectId)

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const availableFiles = Object.keys(generatedFiles)

  const formatTime = (ts: number): string => {
    const d = new Date(ts)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  return (
    <div
      className="flex flex-col h-full flex-shrink-0 relative"
      style={{
        width:      340,
        borderLeft: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-3 py-2.5 flex-shrink-0 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>
            Code Chat
          </span>
          {activeMsId && (
            <span
              className="px-1.5 py-0.5 rounded-sm text-[9px] font-mono"
              style={{ background: 'var(--color-accent)22', color: 'var(--color-accent)' }}
            >
              active
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* History button */}
          <button
            onClick={() => setHistoryOpen(!isHistoryOpen)}
            title="Chat history"
            className="flex items-center justify-center w-6 h-6 rounded-[var(--radius-sm)] cursor-pointer border-none transition-colors"
            style={{
              background: isHistoryOpen ? 'var(--color-surface-alt)' : 'transparent',
              color:      'var(--color-text-3)',
            }}
            onMouseEnter={e => { if (!isHistoryOpen) e.currentTarget.style.background = 'var(--color-surface-alt)' }}
            onMouseLeave={e => { if (!isHistoryOpen) e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>

          {/* New chat button */}
          <button
            onClick={newSession}
            title="New chat"
            className="flex items-center justify-center w-6 h-6 rounded-[var(--radius-sm)] cursor-pointer border-none transition-colors"
            style={{ background: 'transparent', color: 'var(--color-text-3)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-alt)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── No MS selected warning ─────────────────────────────── */}
      {!activeMsId && (
        <div
          className="mx-3 mt-3 px-3 py-2 rounded-[var(--radius-sm)] text-[11px] flex-shrink-0"
          style={{ background: 'var(--color-warning-light)', color: 'var(--color-warning)', fontFamily: 'var(--font-mono)' }}
        >
          Select a microservice above to enable code generation.
        </div>
      )}

      {/* ── Messages ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-4 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'var(--color-accent)22' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
                Code assistant
              </p>
              <p style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 4, lineHeight: 1.5 }}>
                Ask me to create, update, or delete files. Toggle&nbsp;
                <span style={{ fontFamily: 'var(--font-mono)' }}>Arch</span>
                &nbsp;to include your diagram context.
              </p>
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <CodeChatMessage key={msg.id} message={msg} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ──────────────────────────────────────────────── */}
      <CodeChatInput
        onSend={handleSend}
        isLoading={isLoading}
        isSendingArchitecture={isSendingArchitecture}
        hasActiveMsId={activeMsId !== null}
        attachedFiles={attachedFiles}
        availableFiles={availableFiles}
        onToggleArchitecture={setIsSendingArchitecture}
        onAbort={handleAbort}
        onAttachFile={attachFile}
        onDetachFile={detachFile}
      />

      {/* ── History panel (slide-in overlay) ───────────────────── */}
      {isHistoryOpen && (
        <div
          className="absolute inset-0 flex flex-col z-30"
          style={{ background: 'var(--color-surface)' }}
        >
          {/* History header */}
          <div
            className="flex items-center justify-between px-3 py-2.5 flex-shrink-0 border-b"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>
              History
            </span>
            <button
              onClick={() => setHistoryOpen(false)}
              className="flex items-center justify-center w-6 h-6 rounded-[var(--radius-sm)] cursor-pointer border-none transition-colors"
              style={{ background: 'transparent', color: 'var(--color-text-3)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-alt)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* New chat row */}
          <button
            onClick={() => { newSession(); setHistoryOpen(false) }}
            className="flex items-center gap-2 px-3 py-2.5 cursor-pointer border-none border-b text-left transition-colors flex-shrink-0"
            style={{
              background:  'transparent',
              borderColor: 'var(--color-border)',
              color:       'var(--color-accent)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-alt)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              New chat
            </span>
          </button>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto flex flex-col">
            {sessions.length === 0 ? (
              <div
                className="flex items-center justify-center flex-1 text-[11px] font-mono"
                style={{ color: 'var(--color-text-4)' }}
              >
                No sessions yet
              </div>
            ) : (
              [...sessions].reverse().map(session => (
                <div
                  key={session.id}
                  className="flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b"
                  style={{
                    borderColor: 'var(--color-border)',
                    background:  session.id === activeSessionId ? 'var(--color-surface-alt)' : 'transparent',
                  }}
                  onClick={() => { switchSession(session.id); setHistoryOpen(false) }}
                  onMouseEnter={e => {
                    if (session.id !== activeSessionId)
                      (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-alt)'
                  }}
                  onMouseLeave={e => {
                    if (session.id !== activeSessionId)
                      (e.currentTarget as HTMLElement).style.background = 'transparent'
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className="truncate"
                      style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text)', fontWeight: session.id === activeSessionId ? 600 : 400 }}
                    >
                      {session.title}
                    </p>
                    <p style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--color-text-4)', marginTop: 1 }}>
                      {formatTime(session.createdAt)} · {session.messages.length} message{session.messages.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Delete session button */}
                  {sessions.length > 1 && (
                    <button
                      onClick={e => { e.stopPropagation(); deleteSession(session.id) }}
                      title="Delete session"
                      className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded cursor-pointer border-none opacity-0 transition-opacity"
                      style={{ background: 'transparent', color: 'var(--color-text-3)' }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--color-danger)' }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '0'; e.currentTarget.style.color = 'var(--color-text-3)' }}
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default CodeChat
