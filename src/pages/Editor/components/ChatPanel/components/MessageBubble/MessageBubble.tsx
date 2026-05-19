import React from 'react'
import { ActionChip } from '../ActionChip'
import type { MessageBubbleProps } from './types'

const MessageBubble = ({ message }: MessageBubbleProps): React.JSX.Element => {
  const isUser      = message.role === 'user'
  const isStreaming = !message.content && !message.isError

  const bubbleStyle: React.CSSProperties = {
    background: message.isError
      ? 'var(--color-danger-light)'
      : isUser
        ? 'var(--color-surface-alt)'
        : 'var(--color-accent-light)',
    border: message.isError
      ? '1px solid var(--color-danger)'
      : isUser
        ? '1px solid var(--color-border)'
        : '1px solid var(--color-accent-mid)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 12px',
  }

  const timestamp = new Date(message.timestamp).toLocaleTimeString([], {
    hour:   '2-digit',
    minute: '2-digit',
  })

  return (
    <div style={bubbleStyle}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 4,
      }}>
        <span style={{ fontSize: 10, color: 'var(--color-text-3)', fontFamily: 'var(--font-ui)', fontWeight: 600 }}>
          {isUser ? 'You' : 'Claude'}
        </span>
        <span style={{ fontSize: 10, color: 'var(--color-text-3)', fontFamily: 'var(--font-ui)' }}>
          {timestamp}
        </span>
      </div>

      {isStreaming ? (
        <span style={{ fontSize: 11, color: 'var(--color-text-3)', fontFamily: 'var(--font-ui)' }}>
          ⟳ Thinking...
        </span>
      ) : (
        <p style={{
          margin: 0,
          fontSize: 12,
          color: 'var(--color-text-2)',
          fontFamily: 'var(--font-ui)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {message.content}
        </p>
      )}

      {message.actions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {message.actions.map((action, i) => (
            <ActionChip key={i} action={action} />
          ))}
        </div>
      )}
    </div>
  )
}

export default MessageBubble
