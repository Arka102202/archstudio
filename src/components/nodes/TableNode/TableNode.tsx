import React from 'react'
import { NodeResizer, Handle, Position } from '@xyflow/react'
import { useTableNode } from './useTableNode'
import type { TableNodeProps } from './types'

// ─── TableNode ────────────────────────────────────────────────────

const TableNode = ({ id, data }: TableNodeProps): React.JSX.Element => {
  const { node, isSelected, handleClick, entityLabel, dbLabel, queryCount } = useTableNode(id, data)

  return (
    <div
      onClick={handleClick}
      className="relative flex flex-col bg-surface rounded-[var(--radius-md)] shadow-node border transition-all duration-150 select-none"
      style={{
        borderColor: isSelected
          ? 'var(--node-db-accent)'
          : 'var(--color-canvas-node-border)',
        boxShadow: isSelected
          ? '0 0 0 2px var(--node-db-accent)22'
          : undefined,
        minWidth:  200,
        minHeight: 120,
        width:     '100%',
        height:    '100%',
      }}
    >
      {/* ── CONNECTION HANDLES — all four sides ─────────────────── */}
      <Handle type="source" position={Position.Top}    id="top"    />
      <Handle type="source" position={Position.Right}  id="right"  />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left}   id="left"   />

      {/* NodeResizer — must be a direct child */}
      <NodeResizer
        minWidth={200}
        minHeight={120}
        isVisible={isSelected}
        lineStyle={{ border: '1.5px solid var(--node-db-accent)' }}
        handleStyle={{ background: 'var(--node-db-accent)', border: 'none', width: 8, height: 8 }}
      />

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)]">
        {/* Icon square */}
        <div
          className="w-6 h-6 rounded-[var(--radius-sm)] flex items-center justify-center font-mono text-[8px] font-bold flex-shrink-0"
          style={{
            background: 'var(--node-db-icon-bg)',
            color:      'var(--node-db-icon-fg)',
          }}
        >
          T
        </div>

        {/* tableName */}
        <span className="text-[13px] font-bold text-text font-mono flex-1 truncate">
          {node.tableName}
        </span>
      </div>

      {/* ── CONNECTION ROWS ─────────────────────────────────────── */}
      <div className="px-3 py-1.5 flex flex-col gap-1 border-b border-[var(--color-border)]">
        {/* Entity row */}
        {entityLabel !== null ? (
          <div className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: 'var(--node-entity-accent)' }}
            />
            <span className="text-[10px] font-mono text-text-2 flex-1 truncate">
              {entityLabel}
            </span>
            <span
              className="text-[8px] font-mono px-1 rounded-sm"
              style={{
                background: 'var(--node-entity-icon-bg)',
                color:      'var(--node-entity-icon-fg)',
              }}
            >
              ENTITY
            </span>
          </div>
        ) : (
          <div className="text-[9px] font-mono text-text-4 italic">No entity linked</div>
        )}

        {/* DB row */}
        {dbLabel !== null ? (
          <div className="flex items-center gap-1.5">
            <span
              className="flex-shrink-0 text-[10px] font-mono leading-none"
              style={{ color: 'var(--node-db-accent)' }}
            >
              ▪
            </span>
            <span className="text-[10px] font-mono text-text-2 flex-1 truncate">
              {dbLabel}
            </span>
            <span
              className="text-[8px] font-mono px-1 rounded-sm"
              style={{
                background: 'var(--node-db-icon-bg)',
                color:      'var(--node-db-icon-fg)',
              }}
            >
              DATABASE
            </span>
          </div>
        ) : (
          <div className="text-[9px] font-mono text-text-4 italic">No database linked</div>
        )}
      </div>

      {/* ── QUERY COUNT ROW ─────────────────────────────────────── */}
      {queryCount > 0 && (
        <div className="px-3 py-1.5 text-[9px] font-mono text-text-4">
          {queryCount} quer{queryCount === 1 ? 'y' : 'ies'}
        </div>
      )}
    </div>
  )
}

export default TableNode
