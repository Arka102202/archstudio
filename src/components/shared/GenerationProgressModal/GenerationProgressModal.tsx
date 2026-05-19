import React from 'react'
import ReactDOM from 'react-dom'
import { useGenerationProgressModal } from './useGenerationProgressModal'
import { useCodeEditorStore } from '@store'
import type { FileProgressItem } from './types'

// ─── FileProgressRow ──────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  entity:     'var(--node-entity-accent, #3860f5)',
  repository: 'var(--node-db-accent, #0a9e6e)',
  dto:        'var(--node-dto-accent, #c030e8)',
  service:    'var(--node-svc-accent, #0891b2)',
  controller: 'var(--node-ctrl-accent, #d4580a)',
  config:     'var(--color-text-3)',
  build:      'var(--color-text-3)',
}

const FileProgressRow = React.forwardRef<HTMLDivElement, { item: FileProgressItem }>(
  ({ item }, ref): React.JSX.Element => {
  const iconColor = item.status === 'done'      ? 'var(--color-success, #10b981)'
                  : item.status === 'streaming' ? 'var(--color-accent)'
                  : 'var(--color-text-4)'

  return (
    <div ref={ref} className="flex items-center gap-2 py-0.5">
      <span className="w-4 flex-shrink-0 flex items-center justify-center" style={{ color: iconColor }}>
        {item.status === 'done' && (
          <span className="text-[12px] font-bold">✓</span>
        )}
        {item.status === 'streaming' && (
          <svg className="animate-spin" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25" />
            <path d="M11 6A5 5 0 0 0 6 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
        {item.status === 'waiting' && (
          <span className="text-[12px]">·</span>
        )}
      </span>
      <span className="text-[11px] font-mono flex-1 truncate" style={{ color: 'var(--color-text-2)' }}>
        {item.fileName}
      </span>
      {/* NEW / UPDATED badge for diff runs */}
      {item.changeType !== 'full' && (
        <span
          className="text-[8px] font-mono font-bold px-1 rounded-sm flex-shrink-0"
          style={{
            background: item.changeType === 'new'
              ? 'var(--color-success-light, #d1fae5)'
              : 'var(--color-warning-light, #fef3c7)',
            color: item.changeType === 'new'
              ? 'var(--color-success, #10b981)'
              : 'var(--color-warning, #f59e0b)',
          }}
        >
          {item.changeType === 'new' ? 'NEW' : 'UPDATED'}
        </span>
      )}
      <span
        className="text-[8px] font-mono flex-shrink-0"
        style={{ color: CATEGORY_COLORS[item.category] ?? 'var(--color-text-4)' }}
      >
        {item.category}
      </span>
      {item.status === 'streaming' && (
        <span className="text-[9px] font-mono animate-pulse" style={{ color: 'var(--color-text-4)' }}>
          ···
        </span>
      )}
    </div>
  )
})

FileProgressRow.displayName = 'FileProgressRow'

// ─── MinimisedPill ────────────────────────────────────────────────

const MinimisedPill = ({
  msLabel,
  doneCount,
  totalCount,
  isGenerating,
  onRestore,
  onClose,
}: {
  msLabel:      string
  doneCount:    number
  totalCount:   number
  isGenerating: boolean
  onRestore:    () => void
  onClose:      () => void
}): React.JSX.Element => (
  <div
    className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full cursor-pointer"
    style={{
      background: 'var(--color-surface)',
      border:     '1px solid var(--color-border-strong, var(--color-border))',
      boxShadow:  'var(--shadow-modal, 0 4px 24px rgba(0,0,0,0.3))',
    }}
    onClick={onRestore}
  >
    {isGenerating && (
      <span
        className="inline-block w-2 h-2 rounded-full animate-pulse flex-shrink-0"
        style={{ background: 'var(--color-accent)' }}
      />
    )}
    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-2)', whiteSpace: 'nowrap' }}>
      {isGenerating
        ? `Generating · ${doneCount}/${totalCount > 0 ? totalCount : '?'}`
        : `${msLabel} · ${doneCount} files`}
    </span>
    <button
      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-4)', fontSize: 14, lineHeight: 1, padding: '0 2px' }}
      onClick={e => { e.stopPropagation(); onClose() }}
    >
      ×
    </button>
  </div>
)

// ─── GenerationProgressModal ──────────────────────────────────────

const GenerationProgressModal = (): React.JSX.Element | null => {
  const {
    isOpen,
    isMinimised,
    msLabel,
    isGenerating,
    stopped,
    timedOut,
    continueCallback,
    isThinking,
    thinkingText,
    items,
    doneCount,
    totalCount,
    streaming,
    handleClose,
    handleMinimise,
    handleRestore,
    listRef,
    streamingRowRef,
  } = useGenerationProgressModal()

  if (!isOpen) return null

  if (isMinimised) {
    return ReactDOM.createPortal(
      <MinimisedPill
        msLabel={msLabel}
        doneCount={doneCount}
        totalCount={totalCount}
        isGenerating={isGenerating}
        onRestore={handleRestore}
        onClose={handleClose}
      />,
      document.body
    )
  }

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop — always clickable; handleClose aborts+closes if generating */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.6)' }}
        onClick={handleClose}
      />

      <div
        className="relative w-[520px] max-w-[95vw] rounded-[var(--radius-lg)] flex flex-col overflow-hidden"
        style={{
          height:     620,
          background: 'var(--color-surface)',
          border:     '1px solid var(--color-border-strong, var(--color-border))',
          boxShadow:  'var(--shadow-modal, 0 20px 60px rgba(0,0,0,0.4))',
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <div>
            <p
              className="flex items-center gap-2"
              style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}
            >
              {isGenerating && (
                <span
                  className="inline-block w-3 h-3 rounded-full animate-pulse"
                  style={{ background: 'var(--color-accent)' }}
                />
              )}
              {isGenerating ? 'Generating Code' : timedOut ? 'Request Timed Out' : stopped ? 'Generation Stopped' : 'Generation Complete'}
            </p>
            <p
              className="mt-0.5"
              style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-3)' }}
            >
              {msLabel}  ·  claude-sonnet-4{isThinking ? '  ·  thinking...' : ''}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {/* Minimise — only during generation so user can keep working */}
            {isGenerating && (
              <button
                onClick={handleMinimise}
                title="Minimise"
                style={{
                  fontSize:   15,
                  lineHeight: 1,
                  background: 'transparent',
                  border:     'none',
                  cursor:     'pointer',
                  color:      'var(--color-text-4)',
                  padding:    '0 4px',
                  transition: 'color 0.15s',
                }}
              >
                ─
              </button>
            )}
            <button
              onClick={handleClose}
              style={{
                fontSize:   18,
                lineHeight: 1,
                background: 'transparent',
                border:     'none',
                cursor:     'pointer',
                color:      'var(--color-text-4)',
                transition: 'color 0.15s',
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* File list / Thinking phase — flex-1 fills remaining space */}
        {isThinking ? (
          <div className="px-5 py-3 flex flex-col gap-2 flex-1 overflow-hidden">
            <div className="flex items-center gap-2">
              <span
                className="text-[11px] animate-spin inline-block"
                style={{ color: 'var(--color-accent)' }}
              >
                ⟳
              </span>
              <span
                className="text-[11px] font-mono"
                style={{ color: 'var(--color-text-3)' }}
              >
                Analysing architecture...
              </span>
            </div>

            {thinkingText && (
              <div
                className="rounded-[var(--radius-sm)] p-3 overflow-hidden"
                style={{
                  background: 'var(--color-surface-alt)',
                  border:     '1px solid var(--color-border)',
                }}
              >
                {thinkingText
                  .split('\n')
                  .filter(l => l.trim())
                  .slice(-6)
                  .map((line, i) => (
                    <div
                      key={i}
                      className="truncate leading-relaxed"
                      style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-3)' }}
                    >
                      {line}
                    </div>
                  ))
                }
                <span
                  className="inline-block w-1.5 h-3 ml-0.5 animate-pulse align-middle"
                  style={{ background: 'var(--color-accent)' }}
                />
              </div>
            )}
          </div>
        ) : (
          <div ref={listRef} className="px-5 py-3 flex flex-col gap-1 overflow-y-auto flex-1">
            {items.map(item => (
              <FileProgressRow
                key={item.path}
                item={item}
                ref={item.status === 'streaming' ? streamingRowRef : null}
              />
            ))}
            {items.length === 0 && (
              <p style={{ fontSize: 11, color: 'var(--color-text-4)', fontFamily: 'var(--font-mono)' }}>
                Waiting for first file…
              </p>
            )}
          </div>
        )}

        {/* Progress bar — only shown once files start appearing */}
        {!isThinking && totalCount > 0 && (
        <div className="px-5 pb-2" style={{ flexShrink: 0 }}>
          <div className="flex items-center gap-3">
            <div
              className="flex-1 rounded-full overflow-hidden"
              style={{ height: 6, background: 'var(--color-surface-alt)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width:      totalCount > 0 ? `${(doneCount / totalCount) * 100}%` : '0%',
                  background: 'var(--color-accent)',
                }}
              />
            </div>
            <span
              className="flex-shrink-0"
              style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--color-text-3)', minWidth: 72, textAlign: 'right' }}
            >
              {totalCount > 0 ? `${doneCount} / ${totalCount} files` : ''}
            </span>
          </div>
        </div>
        )}

        {/* Live code preview — always rendered at fixed height, blank when not streaming */}
        <div className="px-5 pb-4" style={{ flexShrink: 0, height: 148 }}>
          <p style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--color-text-4)', marginBottom: 4 }}>
            {streaming ? 'Currently writing:' : '\u00A0'}
          </p>
          <div
            className="rounded-[var(--radius-sm)] p-3 overflow-hidden"
            style={{
              height:     'calc(100% - 17px)',
              boxSizing:  'border-box',
              background: 'var(--color-surface-alt)',
              border:     '1px solid var(--color-border)',
            }}
          >
            {streaming?.liveLines.map((line, i) => (
              <div
                key={i}
                className="truncate"
                style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-2)', lineHeight: '1.6' }}
              >
                {line || '\u00A0'}
              </div>
            ))}
            {streaming && (
              <span
                className="inline-block animate-pulse"
                style={{ width: 6, height: 12, marginLeft: 2, background: 'var(--color-accent)', verticalAlign: 'middle' }}
              />
            )}
          </div>
        </div>

        {/* Timed-out state — show only the Continue button */}
        {timedOut && !isGenerating && (
          <div
            className="px-5 pb-4 flex flex-col items-center gap-3"
            style={{ borderTop: '1px solid var(--color-border)', paddingTop: 14, flexShrink: 0 }}
          >
            <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-3)', textAlign: 'center' }}>
              The request timed out — {doneCount} of {totalCount || '?'} files were saved.
              <br />Click Continue to resume from where it left off.
            </p>
            <button
              onClick={() => { void continueCallback?.() }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-sm)] cursor-pointer border-none"
              style={{
                background: 'var(--color-accent)',
                color:      '#fff',
                fontSize:   12,
                fontWeight: 600,
              }}
            >
              Continue
            </button>
          </div>
        )}

        {/* Stopped state */}
        {stopped && !isGenerating && !timedOut && (
          <div
            className="px-5 pb-3 flex items-center gap-2"
            style={{ borderTop: '1px solid var(--color-border)', paddingTop: 10 }}
          >
            <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>■</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-3)' }}>
              Generation stopped — {doneCount} of {totalCount || '?'} files saved
            </span>
          </div>
        )}

        {/* Stop button — shown during generation */}
        {isGenerating && (
          <div
            className="px-5 pb-4 flex justify-end"
            style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12, flexShrink: 0 }}
          >
            <button
              onClick={() => useCodeEditorStore.getState().abortGeneration()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] cursor-pointer border-none transition-colors"
              style={{
                background: 'var(--color-danger-light)',
                color:      'var(--color-danger)',
                fontSize:   11,
                fontWeight: 600,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
              </svg>
              Stop generation
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export default GenerationProgressModal
