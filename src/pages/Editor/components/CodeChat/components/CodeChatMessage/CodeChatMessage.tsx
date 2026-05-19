import React, { useState } from 'react'
import type { CodeChatMessageProps } from './types'
import type { CodeChatFileOp } from '@store'

// ─── Loading dots ─────────────────────────────────────────────────

const LoadingDots = (): React.JSX.Element => (
  <div className="flex items-center gap-1 py-0.5">
    {[0, 160, 320].map((delay, i) => (
      <span
        key={i}
        className="rounded-full"
        style={{
          width:            6,
          height:           6,
          background:       'var(--color-text-3)',
          display:          'inline-block',
          animation:        'codeChatBounce 1s ease-in-out infinite',
          animationDelay:   `${delay}ms`,
        }}
      />
    ))}
    <style>{`
      @keyframes codeChatBounce {
        0%, 80%, 100% { transform: translateY(0);   opacity: 0.4; }
        40%            { transform: translateY(-5px); opacity: 1;   }
      }
    `}</style>
  </div>
)

// ─── File op badge helpers ────────────────────────────────────────

const opColor = (op: CodeChatFileOp['op']): string => {
  if (op === 'delete') return 'var(--color-danger)'
  if (op === 'update') return 'var(--color-warning)'
  return 'var(--color-success)'
}
const opLabel = (op: CodeChatFileOp['op']): string =>
  op === 'delete' ? 'DEL' : op === 'update' ? 'UPD' : 'NEW'

const fileName = (path: string): string => path.split('/').pop() ?? path

// ─── FileOpList ────────────────────────────────────────────────────

const FileOpList = ({ fileOps }: { fileOps: CodeChatFileOp[] }): React.JSX.Element => {
  const [open, setOpen] = useState(true)
  if (fileOps.length === 0) return <></>

  return (
    <div
      className="mt-2 rounded-[var(--radius-sm)] overflow-hidden"
      style={{ border: '1px solid var(--color-border)' }}
    >
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 cursor-pointer border-none text-left"
        style={{ background: 'var(--color-surface-alt)' }}
      >
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-3)', fontWeight: 600 }}>
          {fileOps.length} file{fileOps.length !== 1 ? 's' : ''} changed
        </span>
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          stroke="var(--color-text-3)" strokeWidth="1.5"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
        >
          <polyline points="2,3 5,7 8,3" />
        </svg>
      </button>

      {open && (
        <div className="flex flex-col">
          {fileOps.map((op, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-2.5 py-1.5"
              style={{ borderTop: i > 0 ? '1px solid var(--color-border)' : 'none' }}
            >
              <span
                className="text-[8px] font-mono font-bold flex-shrink-0 px-1 rounded-sm"
                style={{ background: `${opColor(op.op)}22`, color: opColor(op.op) }}
              >
                {opLabel(op.op)}
              </span>
              <span
                className="text-[10px] font-mono truncate flex-1"
                style={{ color: 'var(--color-text-2)' }}
                title={op.path}
              >
                {fileName(op.path)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── CodeChatMessage ──────────────────────────────────────────────

const CodeChatMessage = ({ message }: CodeChatMessageProps): React.JSX.Element => {
  const isUser      = message.role === 'user'
  const showLoading = !isUser && message.isStreaming && message.content === '' && message.fileOps.length === 0
  const displayContent = message.content.replace(/\n{3,}/g, '\n\n').trim()

  return (
    <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
      <span className="text-[9px] font-mono px-1" style={{ color: 'var(--color-text-4)' }}>
        {isUser ? 'You' : 'Assistant'}
      </span>

      <div
        className="max-w-full rounded-[var(--radius-md)] px-3 py-2 text-[12px] leading-relaxed"
        style={{
          background: isUser ? 'var(--color-accent)' : 'var(--color-surface-alt)',
          color:      isUser ? '#fff' : 'var(--color-text)',
          border:     isUser ? 'none' : '1px solid var(--color-border)',
          whiteSpace: 'pre-wrap',
          wordBreak:  'break-word',
        }}
      >
        {showLoading ? (
          <LoadingDots />
        ) : (
          <>
            {message.isError
              ? <span style={{ color: 'var(--color-danger)' }}>{displayContent}</span>
              : displayContent
            }
            {message.isStreaming && (
              <span
                className="inline-block ml-0.5 rounded-sm animate-pulse"
                style={{
                  width:          5,
                  height:         12,
                  background:     isUser ? 'rgba(255,255,255,0.7)' : 'var(--color-text-3)',
                  verticalAlign:  'middle',
                }}
              />
            )}
          </>
        )}
      </div>

      {!isUser && message.fileOps.length > 0 && (
        <div className="w-full">
          <FileOpList fileOps={message.fileOps} />
        </div>
      )}
    </div>
  )
}

export default CodeChatMessage
