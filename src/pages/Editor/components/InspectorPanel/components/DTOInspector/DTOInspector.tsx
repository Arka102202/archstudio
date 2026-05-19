import React, { useState } from 'react'
import { JavaType, LombokStyle, DTOPurpose, DTOOrigin, ValidationType } from '@entity'
import { SectionLabel, Toggle, FieldTypeSelect, AIPromptBox } from '@components/shared'
import { useDTOInspector } from './useDTOInspector'
import type { DTOInspectorProps, DTOField } from './types'
import type { EntityOption, CustomTypeOption } from '@components/shared'

// ─── Validation types that take a value ──────────────────────────
const VALIDATION_TAKES_VALUE = new Set<ValidationType>([
  ValidationType.MIN,
  ValidationType.MAX,
  ValidationType.SIZE,
  ValidationType.PATTERN,
])

// ─── Allowed validation types per JavaType ────────────────────────
const VALIDATIONS_FOR_TYPE: Record<JavaType, ValidationType[]> = {
  [JavaType.STRING]:    [ValidationType.NOT_NULL, ValidationType.NOT_BLANK, ValidationType.NOT_EMPTY, ValidationType.SIZE, ValidationType.EMAIL, ValidationType.PATTERN],
  [JavaType.TEXT]:      [ValidationType.NOT_NULL, ValidationType.NOT_BLANK, ValidationType.NOT_EMPTY, ValidationType.SIZE, ValidationType.PATTERN],
  [JavaType.INTEGER]:   [ValidationType.NOT_NULL, ValidationType.MIN, ValidationType.MAX, ValidationType.POSITIVE],
  [JavaType.LONG]:      [ValidationType.NOT_NULL, ValidationType.MIN, ValidationType.MAX, ValidationType.POSITIVE],
  [JavaType.DOUBLE]:    [ValidationType.NOT_NULL, ValidationType.MIN, ValidationType.MAX, ValidationType.POSITIVE],
  [JavaType.DECIMAL]:   [ValidationType.NOT_NULL, ValidationType.MIN, ValidationType.MAX, ValidationType.POSITIVE],
  [JavaType.DATETIME]:  [ValidationType.NOT_NULL, ValidationType.FUTURE, ValidationType.PAST],
  [JavaType.DATE]:      [ValidationType.NOT_NULL, ValidationType.FUTURE, ValidationType.PAST],
  [JavaType.LOCALDATE]: [ValidationType.NOT_NULL, ValidationType.FUTURE, ValidationType.PAST],
  [JavaType.UUID]:      [ValidationType.NOT_NULL],
  [JavaType.BOOLEAN]:   [ValidationType.NOT_NULL],
  [JavaType.ENUM]:      [ValidationType.NOT_NULL],
  [JavaType.BLOB]:      [ValidationType.NOT_NULL],
  [JavaType.ARRAY]:     [ValidationType.NOT_NULL, ValidationType.NOT_EMPTY, ValidationType.SIZE],
}

// ─── Divider ──────────────────────────────────────────────────────
const Divider = (): React.JSX.Element => (
  <div style={{ height: 1, background: 'var(--color-border)', margin: '8px 0' }} />
)

// ─── FieldInput ───────────────────────────────────────────────────
const FieldInput = ({
  label,
  value,
  onChange,
  placeholder = '',
  mono        = false,
}: {
  label:        string
  value:        string
  onChange:     (v: string) => void
  placeholder?: string
  mono?:        boolean
}): React.JSX.Element => (
  <div className="px-4 py-1.5">
    <label
      className="block mb-1"
      style={{
        fontSize:      9,
        color:         'var(--color-text-4)',
        fontFamily:    'var(--font-ui)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontWeight:    600,
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
        background:   'var(--color-surface-alt)',
        border:       '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        padding:      '5px 8px',
        fontSize:     11,
        color:        'var(--color-text)',
        fontFamily:   mono ? 'var(--font-mono)' : 'var(--font-ui)',
      }}
    />
  </div>
)

// ─── ToggleRow ────────────────────────────────────────────────────
const ToggleRow = ({
  label,
  value,
  onChange,
}: {
  label:    string
  value:    boolean
  onChange: () => void
}): React.JSX.Element => (
  <div className="px-4 py-2 flex items-center justify-between">
    <span style={{ fontSize: 11, color: 'var(--color-text-2)', fontFamily: 'var(--font-ui)' }}>
      {label}
    </span>
    <Toggle value={value} onChange={onChange} />
  </div>
)

// ─── SelectRow ────────────────────────────────────────────────────
const SelectRow = <T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label:    string
  value:    T
  options:  T[]
  onChange: (v: T) => void
}): React.JSX.Element => (
  <div className="px-4 py-2 flex items-center justify-between">
    <span style={{ fontSize: 11, color: 'var(--color-text-2)', fontFamily: 'var(--font-ui)' }}>
      {label}
    </span>
    <select
      value={value}
      onChange={e => onChange(e.target.value as T)}
      className="outline-none"
      style={{
        background:   'var(--color-surface-alt)',
        border:       '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        padding:      '3px 6px',
        fontSize:     11,
        color:        'var(--color-text)',
        fontFamily:   'var(--font-mono)',
        cursor:       'pointer',
      }}
    >
      {options.map(o => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  </div>
)

// ─── ValidationSubRow — one validation row inside a field ────────
const ValidationSubRow = ({
  fieldId,
  validationIdx,
  type,
  value,
  message,
  onRemove,
  onValueChange,
  onMessageChange,
}: {
  fieldId:         string
  validationIdx:   number
  type:            ValidationType
  value:           string
  message:         string
  onRemove:        (fieldId: string, validationIdx: number) => void
  onValueChange:   (fieldId: string, validationIdx: number, value: string) => void
  onMessageChange: (fieldId: string, validationIdx: number, message: string) => void
}): React.JSX.Element => {
  const takesValue = VALIDATION_TAKES_VALUE.has(type)

  return (
    <div className="flex items-center gap-1 ml-4 mt-0.5 flex-wrap">
      {/* Type badge (non-editable) */}
      <span
        className="text-[9px] font-mono px-1.5 py-px rounded-sm flex-shrink-0"
        style={{
          background: 'var(--color-warning-light)',
          color:      'var(--color-warning)',
        }}
      >
        @{type}
      </span>

      {/* Remove badge button */}
      <button
        type="button"
        onClick={() => onRemove(fieldId, validationIdx)}
        style={{
          background:  'none',
          border:      'none',
          cursor:      'pointer',
          color:       'var(--color-text-4)',
          fontSize:    12,
          lineHeight:  1,
          padding:     '0 2px',
          flexShrink:  0,
        }}
        aria-label={`Remove ${type} validation`}
      >
        ×
      </button>

      {/* Value input — only for types that take a value */}
      {takesValue && (
        <input
          type="text"
          value={value}
          onChange={e => onValueChange(fieldId, validationIdx, e.target.value)}
          placeholder="value"
          className="outline-none"
          style={{
            width:        52,
            background:   'var(--color-surface-alt)',
            border:       '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding:      '2px 4px',
            fontSize:     10,
            color:        'var(--color-text)',
            fontFamily:   'var(--font-mono)',
          }}
        />
      )}

      {/* Message input — always shown */}
      <input
        type="text"
        value={message}
        onChange={e => onMessageChange(fieldId, validationIdx, e.target.value)}
        placeholder="custom message"
        className="outline-none flex-1"
        style={{
          minWidth:     60,
          background:   'var(--color-surface-alt)',
          border:       '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          padding:      '2px 4px',
          fontSize:     10,
          color:        'var(--color-text)',
          fontFamily:   'var(--font-mono)',
        }}
      />
    </div>
  )
}

// ─── AddValidationDropdown — compact dropdown to add a validation ─
const AddValidationDropdown = ({
  fieldId,
  fieldType,
  onAdd,
}: {
  fieldId:   string
  fieldType: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF'
  onAdd:     (fieldId: string, type: ValidationType) => void
}): React.JSX.Element => {
  const [open, setOpen] = useState(false)
  const allowedTypes    = (fieldType === 'ENTITY_REF' || fieldType === 'CUSTOM_TYPE_REF')
    ? [ValidationType.NOT_NULL]
    : (VALIDATIONS_FOR_TYPE[fieldType] ?? [ValidationType.NOT_NULL])

  return (
    <div className="relative ml-4 mt-1" style={{ display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          background:   'var(--color-surface-alt)',
          border:       '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          padding:      '2px 6px',
          fontSize:     9,
          color:        'var(--color-text-3)',
          cursor:       'pointer',
          fontFamily:   'var(--font-ui)',
          display:      'flex',
          alignItems:   'center',
          gap:          3,
        }}
      >
        + Add validation ▾
      </button>
      {open && (
        <div
          className="absolute left-0 z-50 mt-0.5"
          style={{
            background:   'var(--color-surface)',
            border:       '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            boxShadow:    '0 4px 12px rgba(0,0,0,0.12)',
            minWidth:     120,
          }}
        >
          {allowedTypes.map(type => (
            <button
              key={type}
              type="button"
              onClick={() => {
                onAdd(fieldId, type)
                setOpen(false)
              }}
              style={{
                display:    'block',
                width:      '100%',
                textAlign:  'left',
                background: 'none',
                border:     'none',
                padding:    '4px 8px',
                fontSize:   10,
                color:      'var(--color-text)',
                cursor:     'pointer',
                fontFamily: 'var(--font-mono)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-alt)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'none'
              }}
            >
              @{type}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── EnumValuesRow — inline enum value chips + add input ─────────
const EnumValuesRow = ({
  fieldId,
  values,
  onAdd,
  onRemove,
}: {
  fieldId:  string
  values:   string[]
  onAdd:    (fieldId: string, value: string) => void
  onRemove: (fieldId: string, index: number) => void
}): React.JSX.Element => {
  const [input, setInput] = React.useState('')

  const commit = (): void => {
    const trimmed = input.trim()
    if (!trimmed) return
    onAdd(fieldId, trimmed)
    setInput('')
  }

  return (
    <div className="ml-4 mt-0.5 flex flex-wrap items-center gap-1">
      {values.map((v, i) => (
        <span
          key={i}
          className="flex items-center gap-0.5 px-1.5 py-px rounded-sm text-[9px] font-mono"
          style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}
        >
          {v}
          <button
            type="button"
            onClick={() => onRemove(fieldId, i)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1, fontSize: 11 }}
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit() }}
        placeholder="+ value"
        className="outline-none"
        style={{
          width:        60,
          background:   'var(--color-surface-alt)',
          border:       '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          padding:      '2px 4px',
          fontSize:     9,
          color:        'var(--color-text)',
          fontFamily:   'var(--font-mono)',
        }}
      />
    </div>
  )
}

// ─── DTOFieldRow — one field with all its sub-rows ───────────────
const DTOFieldRow = ({
  field,
  entityOptions,
  customTypeOptions,
  onRemove,
  onTypeChange,
  onArraySubTypeChange,
  onMapSubTypeChange,
  onNameChange,
  onAddEnumValue,
  onRemoveEnumValue,
  onJsonPropertyChange,
  onJsonIgnoreToggle,
  onIncludeNonNullToggle,
  onAddValidation,
  onRemoveValidation,
  onValidationValueChange,
  onValidationMessageChange,
}: {
  field:                    DTOField
  entityOptions:            EntityOption[]
  customTypeOptions:        CustomTypeOption[]
  onRemove:                 (id: string) => Promise<void>
  onTypeChange:             (id: string, type: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF', entityId: string | null, customTypeId: string | null) => Promise<void>
  onArraySubTypeChange:     (id: string, subType: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null, entityId: string | null, customTypeId?: string | null) => Promise<void>
  onMapSubTypeChange:       (id: string, slot: 'key' | 'value', subType: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null, entityId: string | null, customTypeId: string | null) => void
  onNameChange:             (id: string, name: string) => void
  onAddEnumValue:           (fieldId: string, value: string) => void
  onRemoveEnumValue:        (fieldId: string, index: number) => void
  onJsonPropertyChange:     (id: string, value: string) => void
  onJsonIgnoreToggle:       (id: string) => void
  onIncludeNonNullToggle:   (id: string) => void
  onAddValidation:          (fieldId: string, type: ValidationType) => void
  onRemoveValidation:       (fieldId: string, idx: number) => void
  onValidationValueChange:  (fieldId: string, idx: number, value: string) => void
  onValidationMessageChange:(fieldId: string, idx: number, message: string) => void
}): React.JSX.Element => {
  const [serializationOpen, setSerializationOpen] = useState(false)

  return (
    <div className="flex flex-col gap-0.5">
      {/* Row 1 — always visible: name · type · × */}
      <div className="flex items-center gap-1.5 min-w-0">
        <input
          type="text"
          value={field.name}
          onChange={e => onNameChange(field.id, e.target.value)}
          className="flex-1 outline-none"
          style={{
            background:   'var(--color-surface-alt)',
            border:       '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding:      '3px 5px',
            fontSize:     11,
            color:        'var(--color-text)',
            fontFamily:   'var(--font-mono)',
            minWidth:     0,
          }}
        />
        {field.type === 'ENTITY_REF' ? (
          <span
            className="text-[10px] font-mono px-1.5 py-px rounded-sm shrink-0"
            style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', color: 'var(--node-dto-accent)' }}
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
            value={field.type}
            entityTypeId={field.entityTypeId}
            customTypeId={field.customTypeId}
            entityOptions={entityOptions}
            customTypeOptions={customTypeOptions}
            onChange={(type, entityId, cid) => void onTypeChange(field.id, type, entityId, cid)}
          />
        )}

        {/* Serialisation caret toggle */}
        <button
          type="button"
          onClick={() => setSerializationOpen(o => !o)}
          title="Serialisation settings"
          style={{
            background: 'none',
            border:     'none',
            cursor:     'pointer',
            color:      serializationOpen ? 'var(--color-accent)' : 'var(--color-text-4)',
            fontSize:   10,
            lineHeight: 1,
            padding:    '0 2px',
            flexShrink: 0,
          }}
          aria-label="Toggle serialisation"
        >
          {'{...}'}
        </button>

        {/* Remove field button */}
        <button
          type="button"
          onClick={() => void onRemove(field.id)}
          style={{
            width:        16,
            height:       16,
            borderRadius: 3,
            background:   'none',
            border:       'none',
            cursor:       'pointer',
            color:        'var(--color-text-4)',
            fontSize:     13,
            lineHeight:   1,
            padding:      0,
            flexShrink:   0,
          }}
          aria-label={`Remove field ${field.name}`}
        >
          ×
        </button>
      </div>

      {/* entityTypeInvalid error banner */}
      {field.entityTypeInvalid && (
        <div
          className="ml-4 px-2 py-1 mt-0.5 rounded-[var(--radius-sm)]"
          style={{ background: 'var(--color-danger-light)' }}
        >
          <span className="text-[9px] font-mono" style={{ color: 'var(--color-danger)' }}>
            ⚠ This entity is now DB-mapped — it cannot be used as a DTO field type.
            Change the field type or disconnect the entity&apos;s table.
          </span>
        </div>
      )}

      {/* Row 1b — Array sub-type (visible only when type === ARRAY) */}
      {field.type === JavaType.ARRAY && (
        <div className="flex items-center gap-1.5 ml-2 mt-0.5">
          <span style={{ fontSize: 10, color: 'var(--color-text-4)', fontFamily: 'var(--font-mono)' }}>
            of
          </span>
          <FieldTypeSelect
            value={field.arraySubType ?? null}
            entityTypeId={field.arrayEntityTypeId ?? null}
            customTypeId={field.arrayCustomTypeId ?? null}
            entityOptions={entityOptions}
            customTypeOptions={customTypeOptions}
            excludeTypes={[JavaType.ARRAY]}
            onChange={(subType, eid, cid) => void onArraySubTypeChange(field.id, subType, eid, cid)}
          />
        </div>
      )}

      {/* Row 1c — Map key + value sub-types (visible only when type === MAP) */}
      {field.type === JavaType.MAP && (
        <div className="flex flex-col gap-1 ml-2 mt-0.5">
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 10, color: 'var(--color-text-4)', fontFamily: 'var(--font-mono)', width: 28 }}>key</span>
            <FieldTypeSelect
              value={field.mapKeyType ?? null}
              entityTypeId={field.mapKeyEntityTypeId ?? null}
              customTypeId={field.mapKeyCustomTypeId ?? null}
              entityOptions={entityOptions}
              customTypeOptions={customTypeOptions}
              excludeTypes={[JavaType.ARRAY, JavaType.MAP]}
              onChange={(t, eid, cid) => onMapSubTypeChange(field.id, 'key', t, eid, cid ?? null)}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 10, color: 'var(--color-text-4)', fontFamily: 'var(--font-mono)', width: 28 }}>val</span>
            <FieldTypeSelect
              value={field.mapValueType ?? null}
              entityTypeId={field.mapValueEntityTypeId ?? null}
              customTypeId={field.mapValueCustomTypeId ?? null}
              entityOptions={entityOptions}
              customTypeOptions={customTypeOptions}
              excludeTypes={[JavaType.ARRAY, JavaType.MAP]}
              onChange={(t, eid, cid) => onMapSubTypeChange(field.id, 'value', t, eid, cid ?? null)}
            />
          </div>
        </div>
      )}

      {/* Row 2 — Serialisation (collapsible) */}
      {serializationOpen && (
        <div className="flex items-center gap-2 ml-2 mt-0.5 flex-wrap">
          <input
            type="text"
            value={field.serialization.jsonProperty}
            onChange={e => onJsonPropertyChange(field.id, e.target.value)}
            placeholder="leave empty to use field name"
            className="outline-none flex-1"
            style={{
              minWidth:     80,
              background:   'var(--color-surface-alt)',
              border:       '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding:      '2px 5px',
              fontSize:     10,
              color:        'var(--color-text)',
              fontFamily:   'var(--font-mono)',
            }}
          />
          <div className="flex items-center gap-1 flex-shrink-0">
            <span style={{ fontSize: 9, color: 'var(--color-text-4)', fontFamily: 'var(--font-ui)' }}>
              Ignore
            </span>
            <Toggle value={field.serialization.jsonIgnore} onChange={() => onJsonIgnoreToggle(field.id)} />
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span style={{ fontSize: 9, color: 'var(--color-text-4)', fontFamily: 'var(--font-ui)' }}>
              NonNull
            </span>
            <Toggle value={field.serialization.includeNonNull} onChange={() => onIncludeNonNullToggle(field.id)} />
          </div>
        </div>
      )}

      {/* Row 2b — Enum values (only when type is ENUM) */}
      {field.type === JavaType.ENUM && (
        <EnumValuesRow
          fieldId={field.id}
          values={Array.isArray(field.enumValues) ? field.enumValues : []}
          onAdd={onAddEnumValue}
          onRemove={onRemoveEnumValue}
        />
      )}

      {/* Row 3 — Validations */}
      {field.validations.map((v, idx) => (
        <ValidationSubRow
          key={idx}
          fieldId={field.id}
          validationIdx={idx}
          type={v.type}
          value={v.value}
          message={v.message}
          onRemove={onRemoveValidation}
          onValueChange={onValidationValueChange}
          onMessageChange={onValidationMessageChange}
        />
      ))}

      {/* Add validation dropdown */}
      <AddValidationDropdown
        fieldId={field.id}
        fieldType={field.type}
        onAdd={onAddValidation}
      />
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
  onAdd: (name: string, type: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF', entityId: string | null, subType?: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null, subEntityId?: string | null, customTypeId?: string | null, subCustomTypeId?: string | null) => Promise<void>
}): React.JSX.Element => {
  const [name,            setName]            = useState<string>('')
  const [type,            setType]            = useState<JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF'>(JavaType.STRING)
  const [entityId,        setEntityId]        = useState<string | null>(null)
  const [customTypeId,    setCustomTypeId]    = useState<string | null>(null)
  const [subType,         setSubType]         = useState<JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null>(null)
  const [subEntityId,     setSubEntityId]     = useState<string | null>(null)
  const [subCustomTypeId, setSubCustomTypeId] = useState<string | null>(null)

  const submit = (): void => {
    if (!name.trim()) return
    void onAdd(name, type, entityId, subType, subEntityId, customTypeId, subCustomTypeId)
    setName('')
    setType(JavaType.STRING)
    setEntityId(null)
    setCustomTypeId(null)
    setSubType(null)
    setSubEntityId(null)
    setSubCustomTypeId(null)
  }

  return (
    <div className="flex flex-col gap-1 mt-2">
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder="field name"
          className="flex-1 outline-none"
          style={{
            background:   'var(--color-surface-alt)',
            border:       '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding:      '4px 6px',
            fontSize:     10,
            color:        'var(--color-text)',
            fontFamily:   'var(--font-mono)',
            minWidth:     0,
          }}
        />
        <FieldTypeSelect
          value={type}
          entityTypeId={entityId}
          customTypeId={customTypeId}
          entityOptions={entityOptions}
          customTypeOptions={customTypeOptions}
          onChange={(t, eid, cid) => {
            setType(t)
            setEntityId(eid)
            setCustomTypeId(cid)
            if (t !== JavaType.ARRAY) { setSubType(null); setSubEntityId(null); setSubCustomTypeId(null) }
          }}
        />
        <button
          type="button"
          onClick={submit}
          style={{
            background:   'var(--color-surface-alt)',
            border:       '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding:      '4px 8px',
            fontSize:     13,
            color:        'var(--color-text-2)',
            cursor:       'pointer',
            flexShrink:   0,
          }}
        >
          +
        </button>
      </div>
      {type === JavaType.ARRAY && (
        <div className="flex items-center gap-1.5 ml-2">
          <span style={{ fontSize: 10, color: 'var(--color-text-4)', fontFamily: 'var(--font-mono)' }}>
            of
          </span>
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

// ─── DTOInspector ────────────────────────────────────────────────

const DTOInspector = (props: DTOInspectorProps): React.JSX.Element | null => {
  const {
    node,
    handleLabelChange,
    handlePurposeChange,
    handleOriginChange,
    handleValidationToggle,
    handleLombokStyleChange,
    handleAddField,
    handleRemoveField,
    handleFieldTypeChange,
    handleFieldArraySubTypeChange,
    handleFieldMapSubTypeChange,
    handleFieldNameChange,
    handleAddEnumValue,
    handleRemoveEnumValue,
    handleJsonPropertyChange,
    handleJsonIgnoreToggle,
    handleIncludeNonNullToggle,
    handleAddValidation,
    handleRemoveValidation,
    handleValidationValueChange,
    handleValidationMessageChange,
    handleAIPromptChange,
    handleAIGenerateToggle,
    handleClose,
    handleDelete,
    connectedEntities,
    handleDeleteEdge,
    entityOptions,
    customTypeOptions,
  } = useDTOInspector(props)

  if (!node) {
    return (
      <div className="flex items-center justify-center h-20">
        <span style={{ fontSize: 11, color: 'var(--color-text-4)' }}>Loading…</span>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{ fontFamily: 'var(--font-ui)' }}
    >
      {/* ── PANEL HEADER ──────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 px-4 py-3 flex items-start justify-between"
        style={{
          background:   'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="inline-flex items-center"
              style={{
                fontSize:      9,
                fontWeight:    700,
                color:         'var(--node-dto-icon-fg)',
                background:    'var(--node-dto-icon-bg)',
                border:        '1px solid var(--color-border)',
                borderRadius:  'var(--radius-sm)',
                padding:       '1px 5px',
                fontFamily:    'var(--font-mono)',
                textTransform: 'uppercase',
              }}
            >
              DTO
            </span>
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', lineHeight: '18px' }}>
            {node.label}
          </p>
          <p style={{ fontSize: 9, color: 'var(--color-text-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            {node.origin} · {node.purpose}
          </p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="flex items-center justify-center shrink-0"
          style={{
            width:        24,
            height:       24,
            borderRadius: 'var(--radius-sm)',
            background:   'none',
            border:       '1px solid var(--color-border)',
            cursor:       'pointer',
            color:        'var(--color-text-3)',
            fontSize:     13,
          }}
          aria-label="Close inspector"
        >
          ×
        </button>
      </div>

      {/* ── SECTION 1: IDENTITY ───────────────────────────────── */}
      <SectionLabel label="Identity" />

      <FieldInput
        label="Label"
        value={node.label}
        onChange={handleLabelChange}
        placeholder="OrderRequest"
      />

      <SelectRow
        label="Purpose"
        value={node.purpose}
        options={Object.values(DTOPurpose)}
        onChange={handlePurposeChange}
      />

      <SelectRow
        label="Origin"
        value={node.origin}
        options={Object.values(DTOOrigin)}
        onChange={handleOriginChange}
      />

      <Divider />

      {/* ── SECTION 2: CONFIG ─────────────────────────────────── */}
      <SectionLabel label="Config" />

      <ToggleRow
        label="Validation enabled"
        value={node.config.validationEnabled}
        onChange={handleValidationToggle}
      />

      <SelectRow
        label="Lombok style"
        value={node.config.lombokStyle}
        options={Object.values(LombokStyle)}
        onChange={handleLombokStyleChange}
      />

      <Divider />

      {/* ── SECTION 3: FIELDS ─────────────────────────────────── */}
      <SectionLabel label="Fields" />

      <div className="px-4 pb-3 flex flex-col gap-3">
        {node.fields.map(field => (
          <DTOFieldRow
            key={field.id}
            field={field}
            entityOptions={entityOptions}
            customTypeOptions={customTypeOptions}
            onRemove={handleRemoveField}
            onTypeChange={handleFieldTypeChange}
            onArraySubTypeChange={handleFieldArraySubTypeChange}
            onMapSubTypeChange={handleFieldMapSubTypeChange}
            onNameChange={handleFieldNameChange}
            onAddEnumValue={handleAddEnumValue}
            onRemoveEnumValue={handleRemoveEnumValue}
            onJsonPropertyChange={handleJsonPropertyChange}
            onJsonIgnoreToggle={handleJsonIgnoreToggle}
            onIncludeNonNullToggle={handleIncludeNonNullToggle}
            onAddValidation={handleAddValidation}
            onRemoveValidation={handleRemoveValidation}
            onValidationValueChange={handleValidationValueChange}
            onValidationMessageChange={handleValidationMessageChange}
          />
        ))}

        <AddFieldRow entityOptions={entityOptions} customTypeOptions={customTypeOptions} onAdd={handleAddField} />
      </div>

      <Divider />

      {/* ── SECTION 4: AI PROMPT ──────────────────────────────── */}
      <SectionLabel label="AI Prompt" />
      <div className="px-4 pb-3">
        <AIPromptBox
          value={node.aiPrompt}
          onChange={handleAIPromptChange}
          onGenerateToggle={handleAIGenerateToggle}
        />
      </div>

      <Divider />

      {/* ── SECTION 5: CONNECTIONS ────────────────────────────── */}
      <SectionLabel label="Connections" />
      <div className="px-3 pb-2">
        {connectedEntities.length === 0 ? (
          <p className="text-[10px] font-mono text-text-4">No entities connected</p>
        ) : (
          <>
            {connectedEntities.map(entity => (
              <div key={entity.edgeId} className="flex items-center gap-2 py-1 text-[11px]">
                <span style={{ color: 'var(--node-entity-accent)' }} className="font-bold">←</span>
                <span className="flex-1 text-text-2 truncate">{entity.entityLabel}</span>
                <span
                  className="text-[8px] font-mono px-1 py-0.5 rounded-sm"
                  style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-3)' }}
                >
                  ENTITY
                </span>
                <button
                  type="button"
                  onClick={() => void handleDeleteEdge(entity.edgeId)}
                  className="leading-none"
                  style={{
                    background: 'none',
                    border:     'none',
                    cursor:     'pointer',
                    color:      'var(--color-text-4)',
                    fontSize:   13,
                    lineHeight: 1,
                    padding:    0,
                  }}
                  aria-label={`Disconnect ${entity.entityLabel}`}
                >
                  ×
                </button>
              </div>
            ))}
            {node.origin === DTOOrigin.DERIVED && (
              <p className="text-[9px] font-mono text-text-4 italic mt-1">
                Fields synced from connected entities
              </p>
            )}
            {node.origin === DTOOrigin.CUSTOM && node.entitySources.length > 0 && (
              <p className="text-[9px] font-mono text-text-4 italic mt-1">
                Fields partially customised
              </p>
            )}
          </>
        )}
      </div>

      <Divider />

      {/* ── SECTION 6: DELETE ─────────────────────────────────── */}
      <div className="px-4 py-3">
        <button
          type="button"
          onClick={handleDelete}
          className="w-full text-center"
          style={{
            background:   'var(--color-danger-light)',
            color:        'var(--color-danger)',
            border:       '1px solid var(--color-danger-border)',
            borderRadius: 'var(--radius-sm)',
            padding:      '8px 16px',
            fontSize:     11,
            fontWeight:   600,
            cursor:       'pointer',
            fontFamily:   'var(--font-ui)',
          }}
        >
          Delete DTO
        </button>
      </div>

      {/* Pulse animation for AI dot */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

export default DTOInspector
