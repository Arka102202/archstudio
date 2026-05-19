import React from 'react'
import { Toggle } from '../Toggle'
import { useErrorHandling } from './useErrorHandling'
import type { ErrorHandlingSectionProps } from './types'
import type { ErrorDefinition } from '@entity'

// ─── StatusChip — colour-coded HTTP status badge ──────────────────

function StatusChip({ status }: { status: number }): React.JSX.Element {
  const is5xx = status >= 500
  const is4xx = status >= 400 && status < 500

  return (
    <span
      className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm flex-shrink-0"
      style={{
        background: is5xx
          ? 'var(--color-danger-light)'
          : is4xx
            ? 'var(--color-warning-light)'
            : 'var(--color-surface-alt)',
        color: is5xx
          ? 'var(--color-danger)'
          : is4xx
            ? 'var(--color-warning)'
            : 'var(--color-text-3)',
      }}
    >
      {status}
    </span>
  )
}

// ─── ErrorCard — collapsible single error definition ─────────────

interface ErrorCardProps {
  error:                 ErrorDefinition
  isExpanded:            boolean
  onToggle:              () => void
  onRemove:              () => void
  onDescriptionChange:   (value: string) => void
  onHttpStatusChange:    (value: number) => void
  onMessageChange:       (value: string) => void
  onTimestampToggle:     () => void
  onAddField:            () => void
  onRemoveField:         (idx: number) => void
  onFieldKeyChange:      (idx: number, key: string) => void
  onFieldValueChange:    (idx: number, value: string) => void
}

function ErrorCard({
  error,
  isExpanded,
  onToggle,
  onRemove,
  onDescriptionChange,
  onHttpStatusChange,
  onMessageChange,
  onTimestampToggle,
  onAddField,
  onRemoveField,
  onFieldKeyChange,
  onFieldValueChange,
}: ErrorCardProps): React.JSX.Element {
  return (
    <div
      className="rounded-[var(--radius-sm)] border transition-colors"
      style={{ borderColor: 'var(--color-border)' }}
    >
      {/* ── Collapsed header ── */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:border-[var(--color-border-strong)]"
        onClick={onToggle}
      >
        <StatusChip status={error.httpStatus} />
        <span className="text-[11px] font-mono text-text-2 flex-1 truncate">
          {error.description
            ? error.description
            : <span className="text-text-4 italic">no description</span>
          }
        </span>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onRemove() }}
          className="text-[10px] text-text-4 hover:text-[var(--color-danger)] transition-colors flex-shrink-0 bg-transparent border-none cursor-pointer"
          aria-label="Remove error"
        >
          ×
        </button>
      </div>

      {/* ── Expanded body ── */}
      {isExpanded && (
        <div
          className="px-3 pb-3 pt-2 flex flex-col gap-2"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          {/* Description textarea */}
          <textarea
            value={error.description}
            onChange={e => onDescriptionChange(e.target.value)}
            placeholder="Describe when this error occurs — e.g. User not found in the database"
            rows={3}
            className="w-full text-[11px] font-mono text-text bg-surface-alt
                       border border-[var(--color-border)] rounded-[var(--radius-sm)]
                       px-2 py-1.5 resize-none focus:border-[var(--color-border-focus)]
                       outline-none placeholder:text-text-4"
          />

          {/* HTTP status */}
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-text-3">HTTP status</label>
            <input
              type="number"
              value={error.httpStatus}
              min={100}
              max={599}
              onChange={e => onHttpStatusChange(Number(e.target.value))}
              className="w-20 text-[11px] font-mono text-text bg-surface-alt
                         border border-[var(--color-border)] rounded-[var(--radius-sm)]
                         px-2 py-1 text-right outline-none
                         focus:border-[var(--color-border-focus)]"
            />
          </div>

          {/* Message */}
          <div className="flex items-center justify-between gap-2">
            <label className="text-[10px] text-text-3 flex-shrink-0">Message</label>
            <input
              type="text"
              value={error.message}
              onChange={e => onMessageChange(e.target.value)}
              placeholder="Client-facing error message"
              className="flex-1 text-[11px] font-mono text-text bg-surface-alt
                         border border-[var(--color-border)] rounded-[var(--radius-sm)]
                         px-2 py-1 outline-none focus:border-[var(--color-border-focus)]
                         placeholder:text-text-4"
            />
          </div>

          {/* Include timestamp toggle */}
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-text-3">Include timestamp</label>
            <Toggle value={error.includeTimestamp} onChange={onTimestampToggle} />
          </div>

          {/* Response fields sub-section */}
          <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--color-border)]">
            <p className="text-[9px] font-mono font-bold text-text-4 uppercase">
              Response Fields
            </p>

            {error.fields.map((field, idx) => (
              <div key={idx} className="flex items-center gap-1.5 min-w-0">
                <input
                  value={field.key}
                  onChange={e => onFieldKeyChange(idx, e.target.value)}
                  placeholder="key"
                  className="w-24 flex-shrink-0 text-[10px] font-mono text-text bg-surface-alt
                             border border-[var(--color-border)] rounded-[var(--radius-sm)]
                             px-2 py-1 outline-none focus:border-[var(--color-border-focus)]
                             placeholder:text-text-4"
                />
                <input
                  value={field.value}
                  onChange={e => onFieldValueChange(idx, e.target.value)}
                  placeholder="value"
                  className="flex-1 text-[10px] font-mono text-text bg-surface-alt
                             border border-[var(--color-border)] rounded-[var(--radius-sm)]
                             px-2 py-1 outline-none focus:border-[var(--color-border-focus)]
                             placeholder:text-text-4"
                />
                <button
                  type="button"
                  onClick={() => onRemoveField(idx)}
                  className="text-[10px] text-text-4 hover:text-[var(--color-danger)]
                             transition-colors flex-shrink-0 bg-transparent border-none cursor-pointer"
                  aria-label="Remove field"
                >
                  ×
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={onAddField}
              className="text-[10px] font-mono text-text-4 hover:text-[var(--color-accent)]
                         transition-colors text-left bg-transparent border-none cursor-pointer"
            >
              + add field
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ErrorHandlingSection ─────────────────────────────────────────

export function ErrorHandlingSection({
  errors,
  onChange,
  sectionLabel = 'ERROR HANDLING',
}: ErrorHandlingSectionProps): React.JSX.Element {
  const {
    expandedId,
    setExpandedId,
    handleAdd,
    handleRemove,
    handleDescriptionChange,
    handleHttpStatusChange,
    handleMessageChange,
    handleTimestampToggle,
    handleAddField,
    handleRemoveField,
    handleFieldKeyChange,
    handleFieldValueChange,
  } = useErrorHandling(errors, onChange)

  return (
    <div className="flex flex-col gap-2">

      {/* Section header */}
      <p className="text-[9px] font-mono font-bold text-text-3 uppercase tracking-wider">
        {sectionLabel}
      </p>

      {/* Error cards */}
      {errors.map(error => (
        <ErrorCard
          key={error.id}
          error={error}
          isExpanded={expandedId === error.id}
          onToggle={() => setExpandedId(expandedId === error.id ? null : error.id)}
          onRemove={() => handleRemove(error.id)}
          onDescriptionChange={v => handleDescriptionChange(error.id, v)}
          onHttpStatusChange={v => handleHttpStatusChange(error.id, v)}
          onMessageChange={v => handleMessageChange(error.id, v)}
          onTimestampToggle={() => handleTimestampToggle(error.id)}
          onAddField={() => handleAddField(error.id)}
          onRemoveField={i => handleRemoveField(error.id, i)}
          onFieldKeyChange={(i, k) => handleFieldKeyChange(error.id, i, k)}
          onFieldValueChange={(i, v) => handleFieldValueChange(error.id, i, v)}
        />
      ))}

      {/* Add error button */}
      <button
        type="button"
        onClick={handleAdd}
        className="w-full py-1.5 text-[11px] font-semibold border border-dashed
                   border-[var(--color-border-strong)] rounded-[var(--radius-sm)]
                   text-text-3 hover:border-[var(--color-accent)]
                   hover:text-[var(--color-accent)] transition-colors bg-transparent cursor-pointer"
      >
        + Add error handler
      </button>
    </div>
  )
}
