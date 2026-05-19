import React from 'react'
import { NodeResizer, Handle, Position } from '@xyflow/react'
import { useAPIEndpointNode } from './useAPIEndpointNode'
import type { APIEndpointNodeProps } from './types'

// ─── APIEndpointNode ──────────────────────────────────────────────

const APIEndpointNode = ({ id, data }: APIEndpointNodeProps): React.JSX.Element => {
  const {
    node,
    isSelected,
    handleClick,
    requestDTOLabel,
    responseDTOLabel,
    pathVarSummary,
    authRuleName,
    methodChipStyle,
  } = useAPIEndpointNode(id, data)

  return (
    <div
      onClick={handleClick}
      className="relative bg-surface rounded-[var(--radius-lg)] shadow-node transition-all duration-150 select-none"
      style={{
        border: isSelected
          ? '2px solid var(--node-ep-accent)'
          : '1px solid color-mix(in srgb, var(--node-ep-accent) 38%, transparent)',
        boxShadow: isSelected
          ? '0 0 0 3px color-mix(in srgb, var(--node-ep-accent) 13%, transparent), var(--shadow-node)'
          : 'var(--shadow-node)',
        minWidth:  220,
        minHeight: 110,
        width:     '100%',
      }}
    >
      {/* ── CONNECTION HANDLES — all four sides ─────────────────── */}
      <Handle type="source" position={Position.Top}    id="top"    />
      <Handle type="source" position={Position.Right}  id="right"  />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left}   id="left"   />

      {/* NodeResizer */}
      <NodeResizer
        minWidth={220}
        minHeight={110}
        isVisible={isSelected}
        lineStyle={{ border: '2px solid var(--node-ep-accent)' }}
        handleStyle={{
          background: 'var(--node-ep-accent)',
          border:     'none',
          width:      8,
          height:     8,
        }}
      />

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-1">
        {/* EP icon badge */}
        <div
          className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center text-[8px] font-mono font-bold flex-shrink-0"
          style={{
            background: 'var(--node-ep-icon-bg)',
            color:      'var(--node-ep-icon-fg)',
          }}
        >
          EP
        </div>

        {/* Label */}
        <span className="text-[13px] font-bold text-text flex-1 truncate">
          {node.label}
        </span>

        {/* Auth rule badge — only when set */}
        {authRuleName !== null && (
          <span className="text-[8px] font-mono flex-shrink-0" style={{ color: 'var(--node-auth-rule-accent, var(--node-ep-accent))' }}>
            🔒
          </span>
        )}
      </div>

      {/* ── SUB-HEADER — method + path ───────────────────────────── */}
      <div className="px-3 pb-1.5">
        <span className="text-[10px] font-mono text-text-4 truncate block">
          {node.method} {node.path}
        </span>
      </div>

      {/* ── THIN DIVIDER ─────────────────────────────────────────── */}
      <div className="mx-3 border-t border-[var(--color-border)]" />

      {/* ── BODY ─────────────────────────────────────────────────── */}
      <div className="px-3 py-2 flex flex-col gap-1.5">

        {/* Method chip + path */}
        <div className="flex items-center gap-2">
          <span
            className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-sm flex-shrink-0"
            style={methodChipStyle}
          >
            {node.method}
          </span>
          <span className="text-[11px] font-mono text-text-3 flex-1 truncate">
            {node.path}
          </span>
        </div>

        {/* Description — only when non-empty */}
        {node.config.description !== '' && (
          <span className="text-[10px] font-mono text-text-4 truncate">
            {node.config.description}
          </span>
        )}

        {/* Body DTO chip — only when requestDTOLabel is set */}
        {requestDTOLabel !== null && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono text-text-4">body:</span>
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm"
              style={{
                background: 'var(--node-dto-icon-bg)',
                color:      'var(--node-dto-icon-fg)',
              }}
            >
              {requestDTOLabel}
            </span>
          </div>
        )}

        {/* Path variable chip — only when a pathVar exists */}
        {pathVarSummary !== null && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono text-text-4">path:</span>
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm"
              style={{
                background: 'var(--node-dto-icon-bg)',
                color:      'var(--node-dto-icon-fg)',
              }}
            >
              {'{' + pathVarSummary + '}'}
            </span>
          </div>
        )}

        {/* Response row — always shown */}
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] flex-shrink-0"
            style={{ color: 'var(--node-ep-accent)' }}
          >
            →
          </span>
          {responseDTOLabel !== null ? (
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm"
              style={{
                background: 'var(--node-dto-icon-bg)',
                color:      'var(--node-dto-icon-fg)',
              }}
            >
              {responseDTOLabel}
            </span>
          ) : (
            <span className="text-[9px] font-mono text-text-4">—</span>
          )}
          <span className="text-[9px] font-mono px-1 rounded-sm bg-surface-alt text-text-3 flex-shrink-0">
            {node.response.successCode}
          </span>
        </div>

      </div>
    </div>
  )
}

export default APIEndpointNode
