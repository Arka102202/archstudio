import React from 'react'
import { NodeResizer, Handle, Position } from '@xyflow/react'
import { DTOPurpose, DTOOrigin } from '@entity'
import { useDTONode } from './useDTONode'
import type { DTONodeProps } from './types'

// ─── Purpose badge — inline sub-component ─────────────────────────
// Tiny, single-use → inline per CLAUDE.md rules.

const PurposeBadge = ({
  purpose,
}: {
  purpose: DTOPurpose
}): React.JSX.Element => {
  const styleMap: Record<DTOPurpose, React.CSSProperties> = {
    [DTOPurpose.REQUEST]:  { background: 'var(--color-accent-light)',  color: 'var(--color-accent)'  },
    [DTOPurpose.RESPONSE]: { background: 'var(--color-success-light)', color: 'var(--color-success)' },
    [DTOPurpose.BOTH]:     { background: 'var(--color-warning-light)', color: 'var(--color-warning)' },
  }

  return (
    <span
      className="text-[8px] font-bold font-mono px-1.5 py-0.5 rounded-sm flex-shrink-0"
      style={styleMap[purpose]}
    >
      {purpose}
    </span>
  )
}

// ─── DTONode ───────────────────────────────────────────────────────

const DTONode = ({ id, data }: DTONodeProps): React.JSX.Element => {
  const { node, isSelected, handleClick, entityLabelById, customTypeLabelById } = useDTONode(id, data)

  return (
    <div
      onClick={handleClick}
      className="relative flex flex-col bg-surface rounded-[var(--radius-md)] shadow-node border transition-all duration-150 select-none"
      style={{
        borderColor: isSelected
          ? 'var(--node-dto-accent)'
          : 'var(--color-canvas-node-border)',
        boxShadow: isSelected
          ? '0 0 0 2px var(--node-dto-accent)22'
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
        lineStyle={{ border: '1.5px solid var(--node-dto-accent)' }}
        handleStyle={{ background: 'var(--node-dto-accent)', border: 'none', width: 8, height: 8 }}
      />

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)]">
        {/* Icon square */}
        <div
          className="w-6 h-6 rounded-[var(--radius-sm)] flex items-center justify-center text-[9px] font-bold font-mono flex-shrink-0"
          style={{
            background: 'var(--node-dto-icon-bg)',
            color:      'var(--node-dto-icon-fg)',
          }}
        >
          D
        </div>

        {/* Label */}
        <span className="text-[13px] font-bold text-text flex-1 leading-none truncate">
          {node.label}
        </span>

        {/* Purpose badge */}
        <PurposeBadge purpose={node.purpose} />
      </div>

      {/* ── FIELDS LIST ─────────────────────────────────────────── */}
      <div className="node-fields-scroll px-3 py-2 flex flex-col gap-[3px] flex-1 overflow-y-auto min-h-0">
        {node.fields.length === 0 ? (
          <span className="text-[10px] font-mono text-text-4 italic">
            no fields
          </span>
        ) : (
          node.fields.map((field, idx) => (
            <div key={field.id ?? idx} className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-mono text-text-2 flex-1 truncate">
                {field.name}
              </span>
              <span className="text-[10px] font-mono text-text-3 flex-shrink-0">
                {field.type === 'ENTITY_REF'
                  ? (entityLabelById(field.entityTypeId) ?? 'Entity')
                  : field.type === 'CUSTOM_TYPE_REF'
                    ? (customTypeLabelById(field.customTypeId) ?? 'CustomType')
                    : field.type === 'ARRAY' && field.arraySubType === 'CUSTOM_TYPE_REF'
                      ? `List<${customTypeLabelById(field.arrayCustomTypeId) ?? 'CustomType'}>`
                      : field.type === 'ARRAY' && field.arraySubType === 'ENTITY_REF'
                        ? `List<${entityLabelById(field.arrayEntityTypeId) ?? 'Entity'}>`
                        : field.type === 'MAP'
                          ? (() => {
                              const k = field.mapKeyType === 'ENTITY_REF'      ? (entityLabelById(field.mapKeyEntityTypeId) ?? 'Entity')
                                      : field.mapKeyType === 'CUSTOM_TYPE_REF' ? (customTypeLabelById(field.mapKeyCustomTypeId) ?? 'CT')
                                      : (field.mapKeyType ?? '?')
                              const v = field.mapValueType === 'ENTITY_REF'      ? (entityLabelById(field.mapValueEntityTypeId) ?? 'Entity')
                                      : field.mapValueType === 'CUSTOM_TYPE_REF' ? (customTypeLabelById(field.mapValueCustomTypeId) ?? 'CT')
                                      : (field.mapValueType ?? '?')
                              return `Map<${k}, ${v}>`
                            })()
                          : field.type}
              </span>
              {field.type === 'ENTITY_REF' && field.entityTypeInvalid && (
                <span
                  className="text-[8px] font-mono px-1 rounded-sm flex-shrink-0"
                  style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger)' }}
                  title="This entity is now DB-mapped — cannot be used as DTO field type"
                >
                  ⚠ invalid
                </span>
              )}
              {field.type !== 'ENTITY_REF' && field.validations.length > 0 && (
                <span className="text-[8px] font-mono px-1 rounded-sm flex-shrink-0 bg-[var(--color-warning-light)] text-[var(--color-warning)]">
                  @{field.validations[0].type.replace(/_/g, '')}
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── ORIGIN BADGE ─────────────────────────────────────────── */}
      <div className="px-3 pb-2 flex-shrink-0 border-t border-[var(--color-border)]">
        {node.origin === DTOOrigin.DERIVED ? (
          <span
            className="text-[8px] font-mono"
            style={{ color: 'var(--node-dto-accent)' }}
          >
            DERIVED
          </span>
        ) : (
          <span className="text-[8px] font-mono text-text-4">
            CUSTOM
          </span>
        )}
      </div>
    </div>
  )
}

export default DTONode
