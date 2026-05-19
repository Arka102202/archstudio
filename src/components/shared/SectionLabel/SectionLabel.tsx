import React from 'react'
import type { SectionLabelProps } from './types'

// ─── SectionLabel ─────────────────────────────────────────────────
// Used as section headings inside the inspector panel.

const SectionLabel = ({ label }: SectionLabelProps): React.JSX.Element => (
  <p
    className="text-[9px] font-bold tracking-[0.10em] uppercase px-4 pt-4 pb-2"
    style={{ color: 'var(--color-text-4)', fontFamily: 'var(--font-ui)' }}
  >
    {label}
  </p>
)

export default SectionLabel
