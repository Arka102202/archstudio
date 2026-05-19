import React from 'react'
import { useChatInput } from './useChatInput'
import type { ChatInputProps } from './types'

const ChatInput = (props: ChatInputProps): React.JSX.Element => {
  const { isLoading, isSendingArchitecture, onStop, onToggleArchitecture } = props
  const { value, setValue, textareaRef, handleKeyDown, handleSend, canSend } = useChatInput(props)

  return (
    <div style={{
      flexShrink: 0,
      borderTop: '1px solid var(--color-border)',
      padding: '8px 12px',
      background: 'var(--color-surface)',
    }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        placeholder="Describe what to build..."
        rows={1}
        style={{
          width: '100%',
          resize: 'none',
          outline: 'none',
          minHeight: 36,
          maxHeight: 96,
          overflowY: 'auto',
          background: 'var(--color-surface-alt)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 10px',
          fontSize: 12,
          fontFamily: 'var(--font-ui)',
          color: 'var(--color-text)',
          boxSizing: 'border-box',
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <button
          onClick={onToggleArchitecture}
          title={isSendingArchitecture ? 'Architecture JSON included' : 'Architecture JSON excluded'}
          style={{
            fontSize: 10,
            fontFamily: 'var(--font-ui)',
            background: isSendingArchitecture ? 'var(--color-warning-light)' : 'var(--color-surface-alt)',
            color: isSendingArchitecture ? 'var(--color-warning)' : 'var(--color-text-3)',
            border: isSendingArchitecture
              ? '1px solid rgba(176, 120, 0, 0.3)'
              : '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 8px',
            cursor: 'pointer',
          }}
        >
          🏗 {isSendingArchitecture ? 'Arch on' : 'Arch off'}
        </button>

        {isLoading ? (
          <button
            onClick={onStop}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'var(--font-ui)',
              background: 'var(--color-danger-light, rgba(220,38,38,0.12))',
              color: 'var(--color-danger, #dc2626)',
              border: '1px solid rgba(220,38,38,0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '5px 12px',
              cursor: 'pointer',
            }}
          >
            ■ Stop
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!canSend}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'var(--font-ui)',
              background: canSend ? 'var(--color-accent)' : 'var(--color-surface-alt)',
              color: canSend ? 'var(--color-accent-text)' : 'var(--color-text-4)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '5px 12px',
              cursor: canSend ? 'pointer' : 'not-allowed',
            }}
          >
            ↑ Send
          </button>
        )}
      </div>
    </div>
  )
}

export default ChatInput
