import React from 'react'
import { NodeResizer, Handle, Position } from '@xyflow/react'
import { useDBNode } from './useDBNode'
import type { DBNodeProps } from './types'

// ─── DBNode ───────────────────────────────────────────────────────

const DBNode = ({ id, data }: DBNodeProps): React.JSX.Element => {
  const { node, isSelected, tableCount, handleClick } = useDBNode(id, data)

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
        minWidth:  210,
        minHeight: 130,
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
        minWidth={210}
        minHeight={130}
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
          DB
        </div>

        {/* dbName */}
        <span className="text-[13px] font-bold text-text flex-1 truncate">
          {node.dbName}
        </span>

        {/* dbType badge */}
        <span
          className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm flex-shrink-0"
          style={{
            background: 'var(--node-db-icon-bg)',
            color:      'var(--node-db-icon-fg)',
          }}
        >
          {node.dbType}
        </span>
      </div>

      {/* ── CONNECTION ROW ──────────────────────────────────────── */}
      <div className="px-3 py-1.5 border-b border-[var(--color-border)] flex flex-col gap-0.5">
        <span className="text-[10px] font-mono text-text-2">
          {node.host} : {node.port}
        </span>
        <span className="text-[9px] font-mono text-text-4">
          schema: {node.schema}
        </span>
      </div>

      {/* ── CONFIG ROW ──────────────────────────────────────────── */}
      <div className="px-3 py-1.5 flex items-center gap-2 border-b border-[var(--color-border)]">
        {/* ddlAuto chip */}
        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-sm bg-surface-alt text-text-3">
          {node.config.ddlAuto}
        </span>

        {/* showSql chip */}
        {node.config.showSql ? (
          <span
            className="text-[8px] font-mono px-1.5 py-0.5 rounded-sm"
            style={{ background: 'var(--color-warning-light)', color: 'var(--color-warning)' }}
          >
            SQL
          </span>
        ) : (
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-sm bg-surface-alt text-text-4">
            no SQL
          </span>
        )}

        {/* flyway chip */}
        {node.config.flyway ? (
          <span
            className="text-[8px] font-mono px-1.5 py-0.5 rounded-sm"
            style={{ background: 'var(--color-success-light)', color: 'var(--color-success)' }}
          >
            flyway
          </span>
        ) : (
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-sm bg-surface-alt text-text-4">
            no flyway
          </span>
        )}
      </div>

      {/* ── TABLE COUNT ROW ─────────────────────────────────────── */}
      {tableCount > 0 && (
        <div className="px-3 py-1.5 text-[9px] font-mono text-text-4 border-t border-[var(--color-border)]">
          {tableCount} table{tableCount === 1 ? '' : 's'} connected
        </div>
      )}

    </div>
  )
}

export default DBNode
