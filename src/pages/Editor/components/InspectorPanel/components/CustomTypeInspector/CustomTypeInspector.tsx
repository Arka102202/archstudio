import React, { useState } from 'react'
import { JavaType } from '@entity'
import type { CustomTypeField } from '@entity'
import { SectionLabel, FieldTypeSelect, AIPromptBox } from '@components/shared'
import { useCustomTypeInspector } from './useCustomTypeInspector'
import type { CustomTypeInspectorProps } from './types'
import type { EntityOption, CustomTypeOption } from '@components/shared'

// ─── Inline sub-components ────────────────────────────────────────

const Divider = (): React.JSX.Element => (
  <div style={{ height: 1, background: 'var(--color-border)', margin: '8px 0' }} />
)

const FieldInput = ({
  label,
  value,
  onChange,
  placeholder = '',
}: {
  label:        string
  value:        string
  onChange:     (v: string) => void
  placeholder?: string
}): React.JSX.Element => (
  <div className="px-4 py-1.5">
    <label
      className="block mb-1"
      style={{
        fontSize: 9, color: 'var(--color-text-4)', fontFamily: 'var(--font-ui)',
        textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
      }}
    >
      {label}
    </label>
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className="w-full outline-none"
      style={{
        background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)', padding: '5px 8px',
        fontSize: 11, color: 'var(--color-text)', fontFamily: 'var(--font-ui)',
      }}
    />
  </div>
)

// ─── EnumSubRow ───────────────────────────────────────────────────

const EnumSubRow = ({
  field,
  onAdd,
  onRemove,
}: {
  field:    CustomTypeField
  onAdd:    (fieldId: string, value: string) => void
  onRemove: (fieldId: string, index: number) => void
}): React.JSX.Element | null => {
  const [enumInput, setEnumInput] = useState('')
  if (field.type !== JavaType.ENUM || !field.enumValues) return null

  const submit = (): void => {
    if (!enumInput.trim()) return
    onAdd(field.id, enumInput)
    setEnumInput('')
  }

  return (
    <div className="mt-1 ml-2 flex flex-col gap-1">
      {field.enumValues.values.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {field.enumValues.values.map((val, idx) => (
            <span
              key={idx}
              className="flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-px rounded-sm border"
              style={{ background: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', color: 'var(--color-text-2)' }}
            >
              {val}
              <button
                type="button"
                onClick={() => onRemove(field.id, idx)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-4)', fontSize: 10, lineHeight: 1, padding: 0, marginLeft: 2 }}
                aria-label={`Remove ${val}`}
              >×</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1">
        <input
          type="text"
          value={enumInput}
          onChange={e => setEnumInput(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder="VALUE"
          className="outline-none"
          style={{
            flex: 1, background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)', padding: '2px 5px', fontSize: 10,
            color: 'var(--color-text)', fontFamily: 'var(--font-mono)',
          }}
        />
        <button
          type="button"
          onClick={submit}
          style={{
            background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)', padding: '2px 7px', fontSize: 12,
            color: 'var(--color-text-2)', cursor: 'pointer',
          }}
        >+</button>
      </div>
    </div>
  )
}

// ─── AddFieldRow ──────────────────────────────────────────────────

const AddFieldRow = ({
  entityOptions,
  customTypeOptions,
  onAdd,
}: {
  entityOptions:     EntityOption[]
  customTypeOptions: CustomTypeOption[]
  onAdd:             (name: string, type: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF', entityId: string | null, customTypeId: string | null, subType?: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null, subEntityId?: string | null, subCustomTypeId?: string | null) => void
}): React.JSX.Element => {
  const [name,            setName]            = useState('')
  const [type,            setType]            = useState<JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null>(null)
  const [entityTypeId,    setEntityTypeId]    = useState<string | null>(null)
  const [customTypeId,    setCustomTypeId]    = useState<string | null>(null)
  const [subType,         setSubType]         = useState<JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null>(null)
  const [subEntityId,     setSubEntityId]     = useState<string | null>(null)
  const [subCustomTypeId, setSubCustomTypeId] = useState<string | null>(null)

  const submit = (): void => {
    if (!name.trim() || !type) return
    onAdd(name.trim(), type, entityTypeId, customTypeId, subType, subEntityId, subCustomTypeId)
    setName(''); setType(null); setEntityTypeId(null); setCustomTypeId(null)
    setSubType(null); setSubEntityId(null); setSubCustomTypeId(null)
  }

  return (
    <div className="flex flex-col gap-1 mt-1">
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder="field name"
          className="flex-1 outline-none min-w-0"
          style={{
            background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)', padding: '3px 6px',
            fontSize: 11, color: 'var(--color-text)', fontFamily: 'var(--font-mono)',
          }}
        />
        <FieldTypeSelect
          value={type}
          entityTypeId={entityTypeId}
          customTypeId={customTypeId}
          entityOptions={entityOptions}
          customTypeOptions={customTypeOptions}
          onChange={(t, eid, cid) => {
            setType(t); setEntityTypeId(eid); setCustomTypeId(cid)
            if (t !== JavaType.ARRAY) { setSubType(null); setSubEntityId(null); setSubCustomTypeId(null) }
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!name.trim() || !type}
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 20, height: 20, borderRadius: 4,
            background: 'var(--node-entity-accent)', border: 'none',
            cursor: !name.trim() || !type ? 'not-allowed' : 'pointer',
            opacity: !name.trim() || !type ? 0.4 : 1,
            color: '#fff', fontSize: 14, fontWeight: 700, lineHeight: 1, padding: 0,
          }}
          aria-label="Add field"
        >
          +
        </button>
      </div>
      {type === JavaType.ARRAY && (
        <div className="flex items-center gap-1.5 ml-2">
          <span style={{ fontSize: 10, color: 'var(--color-text-4)', fontFamily: 'var(--font-mono)' }}>of</span>
          <FieldTypeSelect
            value={subType}
            entityTypeId={subEntityId}
            customTypeId={subCustomTypeId}
            entityOptions={entityOptions}
            customTypeOptions={customTypeOptions}
            excludeTypes={[JavaType.ARRAY]}
            onChange={(t, eid, cid) => { setSubType(t); setSubEntityId(eid); setSubCustomTypeId(cid) }}
          />
        </div>
      )}
    </div>
  )
}

// ─── CustomTypeInspector ──────────────────────────────────────────

const CustomTypeInspector = (props: CustomTypeInspectorProps): React.JSX.Element | null => {
  const {
    node,
    handleLabelChange,
    handleAddField,
    handleRemoveField,
    handleFieldTypeChange,
    handleFieldArraySubTypeChange,
    handleFieldNameChange,
    handleAddEnumValue,
    handleRemoveEnumValue,
    handleAIPromptChange,
    handleAIGenerateToggle,
    entityOptions,
    customTypeOptions,
    handleClose,
    handleDelete,
  } = useCustomTypeInspector(props)

  if (!node) {
    return (
      <div className="flex items-center justify-center h-20">
        <span style={{ fontSize: 11, color: 'var(--color-text-4)' }}>Loading…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ fontFamily: 'var(--font-ui)' }}>
      {/* ── PANEL HEADER ──────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 px-4 py-3 flex items-start justify-between"
        style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm"
              style={{
                background: 'var(--node-entity-icon-bg)',
                color:      'var(--node-entity-icon-fg)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              CustomType
            </span>
          </div>
          <span className="text-[15px] font-bold text-text truncate">{node.label}</span>
          <span
            className="text-[9px] font-mono italic"
            style={{ color: 'var(--color-text-4)' }}
          >
            Custom Type — JSON value object
          </span>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 22, height: 22, borderRadius: 4, background: 'none',
            border: '1px solid var(--color-border)', cursor: 'pointer',
            color: 'var(--color-text-3)', fontSize: 14, lineHeight: 1, padding: 0,
          }}
          aria-label="Close inspector"
        >
          ×
        </button>
      </div>

      {/* ── SECTION 1: IDENTITY ───────────────────────────────── */}
      <SectionLabel label="Identity" />
      <FieldInput label="Label" value={node.label} onChange={handleLabelChange} placeholder="Address" />

      <Divider />

      {/* ── INFO NOTICE ───────────────────────────────────────── */}
      <div className="px-4 py-2">
        <p
          className="text-[9px] font-mono italic"
          style={{ color: 'var(--color-text-4)', lineHeight: 1.6 }}
        >
          ℹ This is a value object — no database table will be created.
          <br />
          Data is stored as a JSON column wherever this type is used.
        </p>
      </div>

      <Divider />

      {/* ── SECTION 2: FIELDS ─────────────────────────────────── */}
      <SectionLabel label="Fields" />

      <div className="px-4 pb-3 flex flex-col gap-2">
        {node.fields.map(field => (
          <div key={field.id} className="flex flex-col gap-1">
            {/* Field name + type row */}
            <div className="flex items-center gap-1.5 min-w-0">
              <input
                type="text"
                value={field.name}
                onChange={e => handleFieldNameChange(field.id, e.target.value)}
                className="flex-1 outline-none min-w-0"
                style={{
                  background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)', padding: '2px 5px',
                  fontSize: 11, color: 'var(--color-text)', fontFamily: 'var(--font-mono)',
                }}
              />
              {field.type === 'ENTITY_REF' ? (
                <span
                  className="text-[10px] font-mono px-1.5 py-px rounded-sm shrink-0"
                  style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', color: 'var(--node-entity-accent)' }}
                >
                  {entityOptions.find(e => e.id === field.entityTypeId)?.label ?? 'Entity'}
                </span>
              ) : field.type === 'CUSTOM_TYPE_REF' ? (
                <span
                  className="text-[10px] font-mono px-1.5 py-px rounded-sm shrink-0"
                  style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', color: 'var(--node-entity-accent)' }}
                >
                  {customTypeOptions.find(c => c.id === field.customTypeId)?.label ?? 'CT'}
                </span>
              ) : (
                <FieldTypeSelect
                  value={field.type as JavaType | null}
                  entityTypeId={field.entityTypeId}
                  customTypeId={field.customTypeId}
                  entityOptions={entityOptions}
                  customTypeOptions={customTypeOptions}
                  onChange={(t, eid, cid) => void handleFieldTypeChange(field.id, t, eid, cid)}
                />
              )}
              <button
                type="button"
                onClick={() => void handleRemoveField(field.id)}
                className="shrink-0 flex items-center justify-center"
                style={{
                  width: 16, height: 16, borderRadius: 3, background: 'none',
                  border: 'none', cursor: 'pointer', color: 'var(--color-text-4)',
                  fontSize: 13, lineHeight: 1, padding: 0,
                }}
                aria-label={`Remove field ${field.name}`}
              >
                ×
              </button>
            </div>
            {field.type === JavaType.ARRAY && (
              <div className="flex items-center gap-1.5 ml-2 mt-0.5">
                <span style={{ fontSize: 10, color: 'var(--color-text-4)', fontFamily: 'var(--font-mono)' }}>of</span>
                <FieldTypeSelect
                  value={field.arraySubType ?? null}
                  entityTypeId={field.arrayEntityTypeId ?? null}
                  customTypeId={field.arrayCustomTypeId ?? null}
                  entityOptions={entityOptions}
                  customTypeOptions={customTypeOptions}
                  excludeTypes={[JavaType.ARRAY]}
                  onChange={(t, eid, cid) => void handleFieldArraySubTypeChange(field.id, t, eid, cid)}
                />
              </div>
            )}
            <EnumSubRow
              field={field}
              onAdd={handleAddEnumValue}
              onRemove={handleRemoveEnumValue}
            />
          </div>
        ))}

        <AddFieldRow
          entityOptions={entityOptions}
          customTypeOptions={customTypeOptions}
          onAdd={(name, type, eid, cid, sub, seid, scid) => void handleAddField(name, type, eid, cid, sub, seid, scid)}
        />
      </div>

      <Divider />

      {/* ── SECTION 3: AI PROMPT ──────────────────────────────── */}
      <SectionLabel label="AI Prompt" />

      <div className="px-4 pb-3">
        <AIPromptBox
          value={node.aiPrompt}
          onChange={handleAIPromptChange}
          onGenerateToggle={handleAIGenerateToggle}
        />
      </div>

      <Divider />

      {/* ── DELETE ────────────────────────────────────────────── */}
      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={handleDelete}
          className="w-full py-2 rounded-[var(--radius-sm)]"
          style={{
            background: 'var(--color-danger-light)', border: '1px solid var(--color-danger)',
            color: 'var(--color-danger)', fontFamily: 'var(--font-ui)', fontSize: 11,
            cursor: 'pointer', fontWeight: 500,
          }}
        >
          Delete custom type
        </button>
      </div>
    </div>
  )
}

export default CustomTypeInspector
