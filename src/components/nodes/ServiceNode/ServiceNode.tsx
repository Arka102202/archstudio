import React from 'react'
import { NodeResizer, Handle, Position } from '@xyflow/react'
import { formatReturnType } from '@utils'
import { useServiceNode } from './useServiceNode'
import type { ServiceNodeProps } from './types'

// ─── ServiceNode ──────────────────────────────────────────────────

const ServiceNode = ({ id, data }: ServiceNodeProps): React.JSX.Element => {
  const {
    node,
    isSelected,
    handleClick,
    connectedEntity,
    visibleMethods,
    hiddenCount,
  } = useServiceNode(id, data)

  const hasConfig =
    node.config.classLevelTransactional || node.config.generateInterface

  return (
    <div
      onClick={handleClick}
      className="relative flex flex-col bg-surface rounded-[var(--radius-md)] shadow-node border transition-all duration-150 select-none"
      style={{
        borderColor: isSelected
          ? 'var(--node-svc-accent)'
          : 'var(--color-canvas-node-border)',
        boxShadow: isSelected
          ? '0 0 0 2px var(--node-svc-accent)22'
          : undefined,
        minWidth:  240,
        minHeight: 140,
        width:     '100%',
        height:    '100%',
      }}
    >
      {/* ── CONNECTION HANDLES — all four sides ─────────────────── */}
      <Handle type="source" position={Position.Top}    id="top"    />
      <Handle type="source" position={Position.Right}  id="right"  />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left}   id="left"   />

      {/* NodeResizer — must be first child */}
      <NodeResizer
        minWidth={240}
        minHeight={140}
        isVisible={isSelected}
        lineStyle={{ border: '1.5px solid var(--node-svc-accent)' }}
        handleStyle={{
          background: 'var(--node-svc-accent)',
          border:     'none',
          width:      8,
          height:     8,
        }}
      />

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)]">
        {/* Icon square */}
        <div
          className="w-6 h-6 rounded-[var(--radius-sm)] flex items-center justify-center text-[9px] font-bold font-mono flex-shrink-0"
          style={{
            background: 'var(--node-svc-icon-bg)',
            color:      'var(--node-svc-icon-fg)',
          }}
        >
          S
        </div>

        {/* Label */}
        <span className="text-[13px] font-bold text-text flex-1 leading-none">
          {node.label}
        </span>
      </div>

      {/* ── BODY SCROLL AREA ────────────────────────────────────── */}
      <div className="node-fields-scroll px-3 py-2 flex flex-col gap-[3px] flex-1 overflow-y-auto min-h-0">

        {/* ── ENTITY ROW — only when connected ─────────────────── */}
        {connectedEntity !== null && (
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Dot */}
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: 'var(--node-entity-accent)' }}
            />
            {/* Entity label */}
            <span className="text-[10px] font-mono text-text flex-1 truncate">
              {connectedEntity.label}
            </span>
            {/* ENTITY badge */}
            <span
              className="text-[8px] font-mono px-1 rounded-sm flex-shrink-0"
              style={{
                background: 'var(--node-entity-icon-bg)',
                color:      'var(--node-entity-icon-fg)',
              }}
            >
              ENTITY
            </span>
          </div>
        )}

        {/* ── METHODS — only when methods exist ───────────────── */}
        {node.methods.length > 0 && (
          <>
            {connectedEntity !== null && (
              <div className="border-t border-[var(--color-border)] my-1" />
            )}
            {visibleMethods.map((method, idx) => (
              <div key={method.id ?? idx} className="flex items-center gap-2 min-w-0 overflow-hidden">
                <span className="text-[11px] font-mono text-text flex-1 truncate min-w-0">
                  {method.name}
                </span>
                <span className="text-[10px] font-mono text-text-2 flex-shrink-0 max-w-[40%] truncate">
                  {`→ ${formatReturnType(method.returnType, connectedEntity?.label)}`}
                </span>
              </div>
            ))}

            {hiddenCount > 0 && (
              <span className="text-[9px] font-mono text-text-3 italic">
                +{hiddenCount} more
              </span>
            )}
          </>
        )}

        {/* ── CONFIG ROW — only when any flag is true ─────────── */}
        {hasConfig && (
          <>
            <div className="border-t border-[var(--color-border)] my-1" />
            <div className="flex items-center gap-1.5 flex-wrap">
              {node.config.classLevelTransactional && (
                <span
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm"
                  style={{
                    background: 'var(--color-success-light)',
                    color:      'var(--node-svc-accent)',
                  }}
                >
                  @Transactional
                </span>
              )}
              {node.config.generateInterface && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm bg-surface-alt text-text-3">
                  interface
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ServiceNode
