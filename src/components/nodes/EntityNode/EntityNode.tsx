import React from 'react'
import { NodeResizer, Handle, Position } from '@xyflow/react'
import { FieldConstraint } from '@entity'
import { useEntityNode } from './useEntityNode'
import type { EntityNodeProps } from './types'

// ─── Constraint badge — inline sub-component ─────────────────────
// Small enough + single use → inline per CLAUDE.md rules.

const ConstraintBadge = ({
  constraint,
}: {
  constraint: FieldConstraint
}): React.JSX.Element | null => {
  if (constraint === FieldConstraint.NONE) return null

  const styles: Record<Exclude<FieldConstraint, FieldConstraint.NONE>, React.CSSProperties> = {
    [FieldConstraint.PK]: {
      background: 'var(--color-accent-light)',
      color:      'var(--color-accent)',
    },
    [FieldConstraint.FK]: {
      background: 'var(--color-success-light)',
      color:      'var(--color-success)',
    },
    [FieldConstraint.UNIQUE]: {
      background: 'var(--color-warning-light)',
      color:      'var(--color-warning)',
    },
  }

  return (
    <span
      className="text-[8px] font-bold px-1 rounded-sm flex-shrink-0"
      style={styles[constraint]}
    >
      {constraint}
    </span>
  )
}

// ─── EntityNode ───────────────────────────────────────────────────

const EntityNode = ({ id, data }: EntityNodeProps): React.JSX.Element => {
  const { node, isSelected, handleClick, entityLabelById, customTypeLabelById } = useEntityNode(id, data);

  return (
    <div
      onClick={handleClick}
      className="relative flex flex-col bg-surface rounded-[var(--radius-md)] shadow-node border transition-all duration-150 select-none"
      style={{
        borderColor: isSelected
          ? 'var(--node-entity-accent)'
          : 'var(--color-canvas-node-border)',
        boxShadow: isSelected
          ? '0 0 0 2px var(--node-entity-accent)22'
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
        lineStyle={{ border: '1.5px solid var(--node-entity-accent)' }}
        handleStyle={{
          background: 'var(--node-entity-accent)',
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
            background: 'var(--node-entity-icon-bg)',
            color:      'var(--node-entity-icon-fg)',
          }}
        >
          E
        </div>

        {/* Label */}
        <span className="text-[13px] font-bold text-text flex-1 leading-none">
          {node.label}
        </span>

        {/* Table name */}
        <span className="text-[9px] font-mono text-text-3 flex-shrink-0">
          {node.tableName}
        </span>
      </div>

      {/* ── FIELDS LIST ─────────────────────────────────────────── */}
      <div className="node-fields-scroll px-3 py-2 flex flex-col gap-[3px] flex-1 overflow-y-auto min-h-0">
        {node.fields.map((field, idx) => (
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
                      : field.type}
            </span>
            {field.type === 'ENTITY_REF' && field.entityTypeWarning && (
              <span
                className="text-[9px] flex-shrink-0"
                style={{ color: 'var(--color-warning)' }}
                title="JPA relationship required — both entities are DB-mapped"
              >
                ⚠
              </span>
            )}
            <ConstraintBadge constraint={field.constraint} />
          </div>
        ))}

        {/* Auditing row */}
        {node.config.auditing && (
          <>
            <div className="border-t border-[var(--color-border)] my-1" />
            <span className="text-[9px] font-mono text-text-4 italic px-1">
              + createdAt · updatedAt
            </span>
          </>
        )}

        {/* Soft delete row */}
        {node.config.softDelete && (
          <span
            className="text-[9px] font-mono italic px-1"
            style={{ color: 'var(--color-danger)' }}
          >
            + deletedAt
          </span>
        )}
      </div>
    </div>
  )
}

export default EntityNode
