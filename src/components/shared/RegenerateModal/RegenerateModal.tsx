import React from 'react'
import ReactDOM from 'react-dom'
import { useRegenerateModal } from './useRegenerateModal'

// ─── RegenerateModal ──────────────────────────────────────────────

const RegenerateModal = (): React.JSX.Element | null => {
  const { isOpen, msLabel, handleDiff, handleFull, handleClose } = useRegenerateModal()

  if (!isOpen) return null

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.6)' }}
        onClick={handleClose}
      />

      <div
        className="relative w-[480px] max-w-[95vw] rounded-[var(--radius-lg)] flex flex-col overflow-hidden"
        style={{
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
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
              Code Already Generated
            </p>
            <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-3)', marginTop: 2 }}>
              {msLabel}
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{
              fontSize:   18,
              lineHeight: 1,
              background: 'transparent',
              border:     'none',
              cursor:     'pointer',
              color:      'var(--color-text-4)',
            }}
          >
            ×
          </button>
        </div>

        {/* Body — two option cards */}
        <div className="px-5 py-5 flex flex-col gap-3">
          {/* Apply Diff card */}
          <button
            onClick={handleDiff}
            className="text-left w-full rounded-[var(--radius-md)] p-4 cursor-pointer transition-all duration-150"
            style={{
              background: 'var(--color-surface-alt)',
              border:     '1px solid var(--color-border)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
          >
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>
              Apply Diff
            </p>
            <p style={{ fontSize: 11, color: 'var(--color-text-3)', lineHeight: 1.5 }}>
              Regenerate only files that changed since the last generation.
              Faster — preserves files that haven't changed.
            </p>
          </button>

          {/* Regenerate All card */}
          <button
            onClick={handleFull}
            className="text-left w-full rounded-[var(--radius-md)] p-4 cursor-pointer transition-all duration-150"
            style={{
              background: 'var(--color-surface-alt)',
              border:     '1px solid var(--color-border)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-error, #ef4444)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
          >
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>
              Regenerate All
            </p>
            <p style={{ fontSize: 11, color: 'var(--color-text-3)', lineHeight: 1.5 }}>
              Discard all previously generated files and regenerate everything from scratch.
            </p>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default RegenerateModal
