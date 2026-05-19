import React, { useState } from 'react'
import { MessageBubble } from '../MessageBubble'
import { useMessageThread } from './useMessageThread'
import type { MessageThreadProps } from './types'

const SummaryBanner = ({ summary }: { summary: string }): React.JSX.Element => {
  const [collapsed, setCollapsed] = useState(true)

  return (
    <div style={{
      margin: '8px 12px',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-sm)',
      background: 'var(--color-surface-alt)',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setCollapsed(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '6px 10px',
          fontSize: 10,
          fontFamily: 'var(--font-ui)',
          color: 'var(--color-text-3)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <span>── Session summary</span>
        <span>{collapsed ? '▼' : '▲'}</span>
      </button>
      {!collapsed && (
        <div style={{
          padding: '4px 10px 8px',
          fontSize: 11,
          fontFamily: 'var(--font-ui)',
          color: 'var(--color-text-2)',
          whiteSpace: 'pre-wrap',
        }}>
          {summary}
        </div>
      )}
    </div>
  )
}

const ThinkingIndicator = (): React.JSX.Element => (
  <div style={{
    padding: '8px 12px',
    fontSize: 11,
    fontFamily: 'var(--font-ui)',
    color: 'var(--color-text-3)',
  }}>
    ⟳ Thinking...
  </div>
)

const MessageThread = ({ messages, session, isLoading }: MessageThreadProps): React.JSX.Element => {
  const { messagesEndRef, containerRef, handleScroll } = useMessageThread(messages.length)

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
    >
      {session?.summary && <SummaryBanner summary={session.summary} />}

      <div style={{ flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isLoading && messages.length === 0 && <ThinkingIndicator />}
      </div>

      <div ref={messagesEndRef} />
    </div>
  )
}

export default MessageThread
