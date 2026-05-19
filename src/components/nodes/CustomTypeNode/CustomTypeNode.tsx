import React from 'react'
import { NodeResizer, Handle, Position } from '@xyflow/react'
import { JavaType } from '@entity'
import { useCustomTypeNode } from './useCustomTypeNode'
import type { CustomTypeNodeProps } from './types'

const CustomTypeNode = ({ id, data }: CustomTypeNodeProps): React.JSX.Element => {
  const { node, isSelected, handleClick, labelById } = useCustomTypeNode(id, data)

  return (
    <div
      onClick={handleClick}
      className="relative flex flex-col bg-surface rounded-[var(--radius-md)] shadow-node transition-all duration-150 select-none"
      style={{
        border: isSelected
          ? '2px dashed var(--node-entity-accent)'
          : '1.5px dashed var(--node-entity-accent)60',
        boxShadow: isSelected
          ? '0 0 0 3px var(--node-entity-accent)15'
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

      {/* NodeResizer */}
      <NodeResizer
        minWidth={200}
        minHeight={120}
        isVisible={isSelected}
        lineStyle={{ border: '1.5px dashed var(--node-entity-accent)' }}
        handleStyle={{ background: 'var(--node-entity-accent)', border: 'none', width: 8, height: 8 }}
      />

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="px-3 pt-2 pb-1 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          {/* CT icon */}
          <div
            className="w-6 h-6 rounded-[var(--radius-sm)] flex items-center justify-center text-[9px] font-bold font-mono flex-shrink-0"
            style={{
              background: 'var(--node-entity-icon-bg)',
              color:      'var(--node-entity-icon-fg)',
            }}
          >
            CT
          </div>
          <span className="text-[13px] font-bold text-text flex-1 truncate">
            {node.label}
          </span>
        </div>
        <div className="text-[9px] font-mono text-text-4 mt-0.5">Custom Type</div>
      </div>

      {/* ── FIELDS LIST ─────────────────────────────────────────── */}
      <div className="px-3 py-2 flex flex-col gap-[3px] flex-1 overflow-y-auto min-h-0">
        {node.fields.length === 0 ? (
          <span className="text-[10px] font-mono text-text-4 italic">no fields</span>
        ) : (
          node.fields.map((field, idx) => {
            let typeLabel: string
            if (field.type === 'ENTITY_REF') {
              typeLabel = labelById(field.entityTypeId, 'entity') ?? 'Entity'
            } else if (field.type === 'CUSTOM_TYPE_REF') {
              const ctLabel = labelById(field.customTypeId, 'customType')
              typeLabel = ctLabel ? `${ctLabel} (CT)` : 'CustomType'
            } else if (field.type === JavaType.ARRAY) {
              if (field.arraySubType === 'ENTITY_REF') {
                const lbl = labelById(field.arrayEntityTypeId, 'entity')
                typeLabel = lbl ? `List<${lbl}>` : 'List'
              } else if (field.arraySubType === 'CUSTOM_TYPE_REF') {
                const lbl = labelById(field.arrayCustomTypeId, 'customType')
                typeLabel = lbl ? `List<${lbl}>` : 'List'
              } else if (field.arraySubType) {
                typeLabel = `List<${field.arraySubType}>`
              } else {
                typeLabel = 'List'
              }
            } else {
              typeLabel = field.type
            }

            return (
              <div key={field.id ?? idx} className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-mono text-text-2 flex-1 truncate">
                  {field.name}
                </span>
                <span className="text-[10px] font-mono text-text-3 flex-shrink-0">
                  {typeLabel}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default CustomTypeNode
