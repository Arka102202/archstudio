import React from 'react'
import { NodeResizer, Handle, Position } from '@xyflow/react'
import { useControllerNode } from './useControllerNode'
import type { ControllerNodeProps } from './types'

// ─── ControllerNode ───────────────────────────────────────────────

const ControllerNode = ({ id, data }: ControllerNodeProps): React.JSX.Element => {
  const {
    node,
    isSelected,
    handleClick,
    connectedService,
    authRuleName,
  } = useControllerNode(id, data)

  const hasConfigChip =
    node.config.crossOrigin ||
    node.config.apiVersion !== null ||
    node.config.requestLogging

  return (
    <div
      onClick={handleClick}
      className="relative flex flex-col bg-surface rounded-[var(--radius-md)] shadow-node border transition-all duration-150 select-none"
      style={{
        borderColor: isSelected
          ? 'var(--node-ctrl-accent)'
          : 'var(--color-canvas-node-border)',
        boxShadow: isSelected
          ? '0 0 0 2px var(--node-ctrl-accent)22'
          : undefined,
        minWidth:  210,
        minHeight: 90,
        width:     '100%',
      }}
    >
      {/* ── CONNECTION HANDLES — all four sides ─────────────────── */}
      <Handle type="source" position={Position.Top}    id="top"    />
      <Handle type="source" position={Position.Right}  id="right"  />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left}   id="left"   />

      {/* NodeResizer — must be first child */}
      <NodeResizer
        minWidth={210}
        minHeight={90}
        isVisible={isSelected}
        lineStyle={{ border: '1.5px solid var(--node-ctrl-accent)' }}
        handleStyle={{
          background: 'var(--node-ctrl-accent)',
          border:     'none',
          width:      8,
          height:     8,
        }}
      />

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="px-3 pt-2 pb-1">
        {/* Row 1: icon + label */}
        <div className="flex items-center gap-2">
          {/* Icon square */}
          <div
            className="w-6 h-6 rounded-[var(--radius-sm)] flex items-center justify-center text-[8px] font-mono font-bold flex-shrink-0"
            style={{
              background: 'var(--node-ctrl-icon-bg)',
              color:      'var(--node-ctrl-icon-fg)',
            }}
          >
            C
          </div>

          {/* Label */}
          <span className="text-[13px] font-bold text-text flex-1 truncate">
            {node.label}
          </span>

          {/* Auth rule indicator — shown when an auth rule is connected */}
          {authRuleName !== null && (
            <span
              className="text-[11px] flex-shrink-0"
              title={`Auth rule: ${authRuleName}`}
              style={{ color: 'var(--node-auth-rule-accent, var(--node-ctrl-accent))' }}
            >
              🔒
            </span>
          )}
        </div>

        {/* Row 2: basePath */}
        <p className="text-[10px] font-mono text-text-4 mt-0.5 truncate">
          {node.basePath}
        </p>

        {/* Row 3: auth rule name — only when set */}
        {authRuleName !== null && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[9px]" style={{ color: 'var(--node-auth-rule-accent, var(--node-ctrl-accent))' }}>🔒</span>
            <span className="text-[9px] font-mono truncate" style={{ color: 'var(--node-auth-rule-accent, var(--node-ctrl-accent))' }}>{authRuleName}</span>
          </div>
        )}
      </div>

      {/* ── SERVICE ROW — only when connected ───────────────────── */}
      {connectedService !== null && (
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 border-t border-[var(--color-border)]"
        >
          {/* Glyph ◇ */}
          <span
            className="text-[10px] flex-shrink-0"
            style={{ color: 'var(--node-svc-accent)' }}
          >
            ◇
          </span>
          {/* Service label */}
          <span className="text-[10px] font-mono text-text-2 flex-1 truncate">
            {connectedService.label}
          </span>
          {/* SERVICE badge */}
          <span
            className="text-[8px] font-mono px-1 rounded-sm flex-shrink-0"
            style={{
              background: 'var(--node-svc-icon-bg)',
              color:      'var(--node-svc-icon-fg)',
            }}
          >
            SERVICE
          </span>
        </div>
      )}

      {/* ── CONFIG ROW — only when at least one chip is active ─── */}
      {hasConfigChip && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-[var(--color-border)] flex-wrap">
          {node.config.crossOrigin && (
            <span
              className="text-[8px] font-mono px-1.5 py-0.5 rounded-sm bg-[var(--color-accent-light)]"
              style={{ color: 'var(--color-accent)' }}
            >
              CORS
            </span>
          )}
          {node.config.apiVersion !== null && (
            <span
              className="text-[8px] font-mono px-1.5 py-0.5 rounded-sm bg-[var(--color-accent-light)]"
              style={{ color: 'var(--color-accent)' }}
            >
              v{node.config.apiVersion}
            </span>
          )}
          {node.config.requestLogging && (
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-sm bg-surface-alt text-text-3">
              logging
            </span>
          )}
        </div>
      )}

    </div>
  )
}

export default ControllerNode
