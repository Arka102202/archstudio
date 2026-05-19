import React from 'react'
import type { ActionChipProps } from './types'
import type { CanvasAction } from '@entity'

function getActionLabel(action: CanvasAction): string {
  switch (action.type) {
    case 'CREATE_NODE': return `Created ${action.label} (${action.nodeType})`
    case 'CREATE_EDGE': return `Connected ${action.fromLabel} → ${action.toLabel}`
    case 'UPDATE_NODE': return `Updated ${action.label}`
    case 'DELETE_NODE': return `Deleted ${action.label}`
    case 'ADD_FIELD':   return `Added field to ${action.nodeLabel}`
  }
}

const ActionChip = ({ action }: ActionChipProps): React.JSX.Element => {
  const actionLabel = getActionLabel(action)

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10,
        fontFamily: 'var(--font-mono)',
        background: 'var(--color-success-light)',
        color: 'var(--color-success)',
        border: '1px solid rgba(10, 158, 110, 0.2)',
        borderRadius: 'var(--radius-sm)',
        padding: '2px 6px',
        cursor: 'default',
      }}
    >
      <span>✓</span>
      <span>{actionLabel}</span>
    </div>
  )
}

export default ActionChip
