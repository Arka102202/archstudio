import React from 'react'
import type { DepChipProps } from './types'

// ─── DepChip ──────────────────────────────────────────────────────
// Coloured dependency tag.
// - onRemove provided → chip is "added", shows × button
// - onAdd provided    → chip is "not added", shows "+ add", whole chip is clickable
// - neither           → read-only display

const DepChip = ({ label, colorVar, onRemove, onAdd }: DepChipProps): React.JSX.Element => {
  const isAdded   = onRemove !== undefined
  const isAddable = !isAdded && onAdd !== undefined

  const base = 'inline-flex items-center gap-1 rounded-full px-2 font-mono text-[9px] leading-4 select-none'

  const colorStyle: React.CSSProperties = {
    background: `var(${colorVar}-bg)`,
    color:      `var(${colorVar}-text)`,
    border:     `1px solid var(${colorVar}-border)`,
  }

  if (isAddable) {
    return (
      <button
        type="button"
        onClick={onAdd}
        className={`${base} cursor-pointer opacity-65 transition-opacity hover:opacity-100`}
        style={{ ...colorStyle, background: 'none' }}
      >
        <span>{label}</span>
        <span className="opacity-80">+ add</span>
      </button>
    )
  }

  return (
    <div className={`${base} cursor-default`} style={colorStyle}>
      <span>{label}</span>
      {isAdded && (
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center justify-center w-3 h-3 p-0 text-[10px] leading-none bg-transparent border-none cursor-pointer"
          style={{ color: `var(${colorVar}-text)` }}
          aria-label={`Remove ${label}`}
        >
          ×
        </button>
      )}
    </div>
  )
}

export default DepChip
