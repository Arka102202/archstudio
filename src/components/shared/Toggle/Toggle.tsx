import React from 'react'
import type { ToggleProps } from './types'

// ─── Toggle ───────────────────────────────────────────────────────
// A pure boolean switch using CSS custom properties from the design system.
// No internal state — fully controlled.

const Toggle = ({ value, onChange, disabled = false }: ToggleProps): React.JSX.Element => (
  <button
    type="button"
    role="switch"
    aria-checked={value}
    disabled={disabled}
    onClick={() => onChange(!value)}
    className="relative shrink-0 flex items-center w-9 h-5 rounded-full p-0 outline-none transition-colors duration-200"
    style={{
      background: value ? 'var(--toggle-on-bg)' : 'var(--toggle-off-bg)',
      border:     value ? 'none' : '1px solid var(--toggle-off-border)',
      cursor:     disabled ? 'not-allowed' : 'pointer',
      opacity:    disabled ? 0.5 : 1,
    }}
  >
    <span
      className="absolute w-4 h-4 rounded-full transition-transform duration-200 top-0.5 shadow-sm"
      style={{
        left:       value ? 18 : 2,
        background: 'var(--toggle-knob)',
        boxShadow:  '0 1px 3px rgba(0,0,0,0.20)',
      }}
    />
  </button>
)

export default Toggle
