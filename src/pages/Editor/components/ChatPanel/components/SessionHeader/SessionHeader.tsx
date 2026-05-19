import React from 'react'
import { useSessionHeader, formatTimeAgo } from './useSessionHeader'
import type { SessionHeaderProps } from './types'

const SessionHeader = (props: SessionHeaderProps): React.JSX.Element => {
  const {
    msNodes,
    activeMsId,
    sessions,
    activeChatSessionId,
    isLoading,
    chatView,
    onChatViewChange,
    onMsChange,
    onNewSession,
    onSelectSession,
    onDeleteSession,
    editingSessionId,
    editingTitle,
    openMenuSessionId,
    startRename,
    commitRename,
    setEditingTitle,
    toggleMenu,
    closeMenu,
  } = useSessionHeader(props)

  const activeSession = sessions.find(s => s.id === activeChatSessionId)

  return (
    <div style={{ flexShrink: 0, borderBottom: '1px solid var(--color-border)' }}>
      {/* MS selector row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px 6px' }}>
        <select
          value={activeMsId ?? ''}
          onChange={e => onMsChange(e.target.value)}
          style={{
            flex: 1,
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-text)',
            background: 'var(--color-surface-alt)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 8px',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          {msNodes.length === 0 && <option value="">No microservices</option>}
          {msNodes.map(n => (
            <option key={n.id} value={n.id}>{n.label}</option>
          ))}
        </select>

        <button
          onClick={() => void onNewSession()}
          disabled={!activeMsId || isLoading}
          style={{
            fontSize: 10,
            fontFamily: 'var(--font-ui)',
            background: 'transparent',
            color: 'var(--color-accent)',
            border: '1px solid var(--color-accent)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 8px',
            cursor: !activeMsId || isLoading ? 'not-allowed' : 'pointer',
            opacity: !activeMsId || isLoading ? 0.5 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          + New
        </button>
      </div>

      {/* Chat / History tabs */}
      <div style={{ display: 'flex', padding: '0 10px 6px', gap: 2 }}>
        {(['chat', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => onChatViewChange(tab)}
            style={{
              flex: 1,
              padding: '3px 0',
              fontSize: 10,
              fontWeight: 500,
              fontFamily: 'var(--font-ui)',
              background: chatView === tab ? 'var(--color-surface-alt)' : 'transparent',
              color: chatView === tab ? 'var(--color-text)' : 'var(--color-text-3)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {tab === 'chat' ? 'Chat' : 'History'}
          </button>
        ))}
      </div>

      {/* Active session label — shown only in chat view */}
      {chatView === 'chat' && activeSession && (
        <div style={{
          padding: '0 10px 6px',
          fontSize: 10,
          fontFamily: 'var(--font-ui)',
          color: 'var(--color-text-3)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {activeSession.title}
        </div>
      )}

      {/* History session list */}
      {chatView === 'history' && (
      <div style={{ maxHeight: 140, overflowY: 'auto' }}>
        {sessions.map(session => (
          <div
            key={session.id}
            onClick={() => {
              if (editingSessionId !== session.id) {
                void onSelectSession(session.id)
                closeMenu()
              }
            }}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              padding: '6px 10px',
              cursor: 'pointer',
              background: activeChatSessionId === session.id
                ? 'var(--color-accent-light)'
                : 'transparent',
              borderLeft: activeChatSessionId === session.id
                ? '2px solid var(--color-accent)'
                : '2px solid transparent',
            }}
            onMouseEnter={e => {
              const btn = (e.currentTarget as HTMLDivElement).querySelector<HTMLButtonElement>('.session-menu-btn')
              if (btn) btn.style.opacity = '1'
            }}
            onMouseLeave={e => {
              const btn = (e.currentTarget as HTMLDivElement).querySelector<HTMLButtonElement>('.session-menu-btn')
              if (btn && openMenuSessionId !== session.id) btn.style.opacity = '0'
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              {editingSessionId === session.id ? (
                <input
                  autoFocus
                  value={editingTitle}
                  onChange={e => setEditingTitle(e.target.value)}
                  onBlur={() => void commitRename()}
                  onKeyDown={e => {
                    if (e.key === 'Enter') void commitRename()
                    if (e.key === 'Escape') {
                      setEditingTitle('')
                    }
                  }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: '100%',
                    fontSize: 11,
                    fontFamily: 'var(--font-ui)',
                    color: 'var(--color-text)',
                    background: 'var(--color-surface-alt)',
                    border: '1px solid var(--color-border-focus)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '2px 4px',
                    outline: 'none',
                  }}
                />
              ) : (
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: 'var(--font-ui)',
                    color: activeChatSessionId === session.id
                      ? 'var(--color-accent)'
                      : 'var(--color-text)',
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 140,
                  }}
                >
                  {session.title}
                </span>
              )}
              <span style={{ fontSize: 10, color: 'var(--color-text-3)', fontFamily: 'var(--font-ui)' }}>
                {formatTimeAgo(session.updatedAt)}
              </span>
            </div>

            <button
              className="session-menu-btn"
              onClick={e => {
                e.stopPropagation()
                toggleMenu(session.id)
              }}
              style={{
                opacity: openMenuSessionId === session.id ? 1 : 0,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-3)',
                fontSize: 13,
                padding: '0 2px',
                lineHeight: 1,
                transition: 'opacity 150ms',
                flexShrink: 0,
              }}
            >
              ···
            </button>

            {openMenuSessionId === session.id && (
              <div
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '100%',
                  zIndex: 20,
                  background: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  minWidth: 110,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  overflow: 'hidden',
                }}
                onClick={e => e.stopPropagation()}
              >
                <button
                  onClick={() => startRename(session.id, session.title)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '7px 12px',
                    fontSize: 11,
                    fontFamily: 'var(--font-ui)',
                    color: 'var(--color-text)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Rename
                </button>
                <button
                  onClick={() => {
                    closeMenu()
                    void onDeleteSession(session.id)
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '7px 12px',
                    fontSize: 11,
                    fontFamily: 'var(--font-ui)',
                    color: 'var(--color-danger)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}

        {sessions.length === 0 && activeMsId && (
          <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--color-text-4)', fontFamily: 'var(--font-ui)' }}>
            No sessions yet
          </div>
        )}

        {!activeMsId && (
          <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--color-text-4)', fontFamily: 'var(--font-ui)' }}>
            Select a microservice to start
          </div>
        )}
      </div>
      )}
    </div>
  )
}

export default SessionHeader
