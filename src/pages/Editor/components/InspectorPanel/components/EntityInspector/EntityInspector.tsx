import React, { useState } from 'react'
import { JavaType, FieldConstraint, LombokStyle, RelationType, CascadeType, FetchType } from '@entity'
import { SectionLabel, Toggle, FieldTypeSelect, AIPromptBox } from '@components/shared'
import { useEntityInspector } from './useEntityInspector'
import type { EntityInspectorProps, EntityField } from './types'
import type { EntityOption, CustomTypeOption } from '@components/shared'
import type { Relation } from '@entity'

// ─── Local inline sub-components ─────────────────────────────────
// All small enough to be inline per CLAUDE.md single-use rules.

const Divider = (): React.JSX.Element => (
  <div style={{ height: 1, background: 'var(--color-border)', margin: '8px 0' }} />
)

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

const ConstraintBadgeInline = ({
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
      className="text-[9px] font-bold px-1 py-px rounded-sm shrink-0"
      style={styles[constraint]}
    >
      {constraint}
    </span>
  )
}

// ─── FieldRow — a single field row in the fields list ────────────
const FieldRow = ({
  field,
  entityOptions,
  customTypeOptions,
  keyFieldsByEntityId,
  onRemove,
  onTypeChange,
  onArraySubTypeChange,
  onRelationshipChange,
  onAddEnumValue,
  onRemoveEnumValue,
}: {
  field:                EntityField
  entityOptions:        EntityOption[]
  customTypeOptions:    CustomTypeOption[]
  keyFieldsByEntityId:  Record<string, string[]>
  onRemove:             (id: string) => void
  onTypeChange:         (id: string, type: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF', entityId: string | null, customTypeId: string | null) => Promise<void>
  onArraySubTypeChange: (id: string, subType: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null, entityId: string | null, customTypeId: string | null) => Promise<void>
  onRelationshipChange: (fieldId: string, patch: Partial<Relation>) => void
  onAddEnumValue:       (fieldId: string, value: string) => void
  onRemoveEnumValue:    (fieldId: string, index: number) => void
}): React.JSX.Element => {
  const [enumInput,       setEnumInput]       = useState<string>('')
  const [relationExpanded, setRelationExpanded] = useState<boolean>(true)

  const submitEnumValue = (): void => {
    if (!enumInput.trim()) return
    onAddEnumValue(field.id, enumInput)
    setEnumInput('')
  }

  return (
    <div className="flex flex-col">
      {/* Main row */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className="flex-1 truncate text-[11px] font-mono"
          style={{ color: 'var(--color-text-2)' }}
        >
          {field.name}
        </span>
        {field.type === 'ENTITY_REF' ? (
          // Single scalar entity reference — show plain "EntityName"
          <span
            className="text-[10px] font-mono px-1.5 py-px rounded-sm shrink-0"
            style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', color: 'var(--node-entity-accent)' }}
          >
            {entityOptions.find(e => e.id === field.entityTypeId)?.label ?? 'Entity'}
          </span>
        ) : field.type === 'CUSTOM_TYPE_REF' ? (
          // Custom type reference — show "CTName" badge
          <span
            className="text-[10px] font-mono px-1.5 py-px rounded-sm shrink-0"
            style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', color: 'var(--node-entity-accent)' }}
          >
            {customTypeOptions.find(c => c.id === field.customTypeId)?.label ?? 'CT'}
          </span>
        ) : field.type === JavaType.ARRAY && field.arraySubType === 'ENTITY_REF' ? (
          // Collection entity reference — show unified "EntityName[]"
          <span
            className="text-[10px] font-mono px-1.5 py-px rounded-sm shrink-0"
            style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', color: 'var(--node-entity-accent)' }}
          >
            {entityOptions.find(e => e.id === field.arrayEntityTypeId)?.label ?? 'Entity'}[]
          </span>
        ) : field.type === JavaType.ARRAY && field.arraySubType === 'CUSTOM_TYPE_REF' ? (
          // Collection custom type reference — show unified "CTName[]"
          <span
            className="text-[10px] font-mono px-1.5 py-px rounded-sm shrink-0"
            style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', color: 'var(--node-entity-accent)' }}
          >
            {customTypeOptions.find(c => c.id === field.arrayCustomTypeId)?.label ?? 'CT'}[]
          </span>
        ) : (
          <FieldTypeSelect
            value={field.type}
            entityTypeId={field.entityTypeId}
            customTypeId={field.customTypeId}
            entityOptions={entityOptions}
            customTypeOptions={customTypeOptions}
            excludeEntityRef
            onChange={(type, entityId, cid) => void onTypeChange(field.id, type, entityId, cid)}
          />
        )}
        <ConstraintBadgeInline constraint={field.constraint} />
        <button
          type="button"
          onClick={() => onRemove(field.id)}
          className="shrink-0 flex items-center justify-center"
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
          }}
          aria-label={`Remove field ${field.name}`}
        >
          ×
        </button>
      </div>

      {/* Warning banner — both entities have tables, JPA config needed */}
      {(field.type === 'ENTITY_REF' || (field.type === JavaType.ARRAY && field.arraySubType === 'ENTITY_REF')) && field.entityTypeWarning && !field.relation && (
        <div
          className="ml-4 px-2 py-1.5 mt-1 rounded-[var(--radius-sm)] flex items-center gap-2"
          style={{ background: 'var(--color-warning-light)' }}
        >
          <span className="text-[9px]" style={{ color: 'var(--color-warning)' }}>⚠</span>
          <span className="text-[9px] font-mono flex-1" style={{ color: 'var(--color-warning)' }}>
            JPA relationship required — set the relationship kind below
          </span>
          <select
            value=""
            onChange={e => {
              if (e.target.value) {
                onRelationshipChange(field.id, { type: e.target.value as RelationType })
              }
            }}
            className="outline-none"
            style={{
              background:   'var(--color-surface-alt)',
              border:       '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding:      '2px 4px',
              fontSize:     9,
              color:        'var(--color-text)',
              fontFamily:   'var(--font-mono)',
              cursor:       'pointer',
            }}
          >
            <option value="">— kind —</option>
            {Object.values(RelationType).map(rt => (
              <option key={rt} value={rt}>{rt}</option>
            ))}
          </select>
        </div>
      )}

      {/* Relationship config row */}
      {(field.type === 'ENTITY_REF' || (field.type === JavaType.ARRAY && field.arraySubType === 'ENTITY_REF')) && field.relation && (
        <div
          className="ml-4 mt-1 border border-[var(--color-border)] rounded-[var(--radius-sm)] overflow-hidden"
        >
          {/* Collapsible header */}
          <button
            type="button"
            onClick={() => setRelationExpanded(v => !v)}
            className="w-full flex items-center justify-between px-2 py-1.5"
            style={{
              background: 'var(--color-surface-alt)',
              border:     'none',
              cursor:     'pointer',
            }}
          >
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
              @{field.relation.type.replace(/_/g, '').toLowerCase().replace(/^(.)/, c => c.toUpperCase())}
            </span>
            <span style={{ fontSize: 9, color: 'var(--color-text-4)' }}>
              {relationExpanded ? '▲' : '▼'}
            </span>
          </button>

          {/* Collapsible body */}
          {relationExpanded && (
            <div className="p-2 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 9, color: 'var(--color-text-4)', fontFamily: 'var(--font-mono)', width: 64 }}>Kind</span>
                <select
                  value={field.relation.type}
                  onChange={e => onRelationshipChange(field.id, { type: e.target.value as RelationType })}
                  className="outline-none flex-1"
                  style={{
                    background:   'var(--color-surface-alt)',
                    border:       '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding:      '2px 4px',
                    fontSize:     9,
                    color:        'var(--color-text)',
                    fontFamily:   'var(--font-mono)',
                    cursor:       'pointer',
                  }}
                >
                  {Object.values(RelationType).map(rt => (
                    <option key={rt} value={rt}>{rt}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 9, color: 'var(--color-text-4)', fontFamily: 'var(--font-mono)', width: 64 }}>Mapped by</span>
                <select
                  value={field.relation.mappedBy}
                  onChange={e => onRelationshipChange(field.id, { mappedBy: e.target.value })}
                  className="outline-none flex-1"
                  style={{
                    background:   'var(--color-surface-alt)',
                    border:       '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding:      '2px 4px',
                    fontSize:     9,
                    color:        'var(--color-text)',
                    fontFamily:   'var(--font-mono)',
                    cursor:       'pointer',
                  }}
                >
                  <option value="">— none —</option>
                  {(keyFieldsByEntityId[field.relation.targetEntityId] ?? []).map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 9, color: 'var(--color-text-4)', fontFamily: 'var(--font-mono)', width: 64 }}>Cascade</span>
                <select
                  value={field.relation.cascade}
                  onChange={e => onRelationshipChange(field.id, { cascade: e.target.value as CascadeType })}
                  className="outline-none flex-1"
                  style={{
                    background:   'var(--color-surface-alt)',
                    border:       '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding:      '2px 4px',
                    fontSize:     9,
                    color:        'var(--color-text)',
                    fontFamily:   'var(--font-mono)',
                    cursor:       'pointer',
                  }}
                >
                  {Object.values(CascadeType).map(ct => (
                    <option key={ct} value={ct}>{ct}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 9, color: 'var(--color-text-4)', fontFamily: 'var(--font-mono)', width: 64 }}>Fetch</span>
                <select
                  value={field.relation.fetch}
                  onChange={e => onRelationshipChange(field.id, { fetch: e.target.value as FetchType })}
                  className="outline-none flex-1"
                  style={{
                    background:   'var(--color-surface-alt)',
                    border:       '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding:      '2px 4px',
                    fontSize:     9,
                    color:        'var(--color-text)',
                    fontFamily:   'var(--font-mono)',
                    cursor:       'pointer',
                  }}
                >
                  {Object.values(FetchType).map(ft => (
                    <option key={ft} value={ft}>{ft}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 9, color: 'var(--color-text-4)', fontFamily: 'var(--font-mono)', width: 64 }}>Optional</span>
                <Toggle
                  value={field.relation.optional}
                  onChange={() => onRelationshipChange(field.id, { optional: !field.relation?.optional })}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Array sub-type row — hidden when subType is ENTITY_REF or CUSTOM_TYPE_REF (shown as "Name[]" badge) */}
      {field.type === JavaType.ARRAY && field.arraySubType !== 'ENTITY_REF' && field.arraySubType !== 'CUSTOM_TYPE_REF' && (
        <div className="mt-1 ml-2 flex items-center gap-1.5">
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
            excludeEntityRef
            onChange={(subType, eid, cid) => void onArraySubTypeChange(field.id, subType, eid, cid)}
          />
        </div>
      )}

      {/* Enum values sub-row */}
      {field.type === JavaType.ENUM && field.enumValues && (
        <div className="mt-1 ml-2 flex flex-col gap-1">
          {/* Existing values */}
          {field.enumValues.values.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {field.enumValues.values.map((val, idx) => (
                <span
                  key={idx}
                  className="flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-px rounded-sm border"
                  style={{
                    background:   'var(--color-surface-alt)',
                    borderColor:  'var(--color-border)',
                    color:        'var(--color-text-2)',
                  }}
                >
                  {val}
                  <button
                    type="button"
                    onClick={() => onRemoveEnumValue(field.id, idx)}
                    style={{
                      background:  'none',
                      border:      'none',
                      cursor:      'pointer',
                      color:       'var(--color-text-4)',
                      fontSize:    10,
                      lineHeight:  1,
                      padding:     0,
                      marginLeft:  2,
                    }}
                    aria-label={`Remove enum value ${val}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {/* Add enum value */}
          <div className="flex gap-1">
            <input
              type="text"
              value={enumInput}
              onChange={e => setEnumInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitEnumValue() }}
              placeholder="VALUE"
              className="outline-none"
              style={{
                flex:         1,
                background:   'var(--color-surface-alt)',
                border:       '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                padding:      '2px 5px',
                fontSize:     10,
                color:        'var(--color-text)',
                fontFamily:   'var(--font-mono)',
              }}
            />
            <button
              type="button"
              onClick={submitEnumValue}
              style={{
                background:   'var(--color-surface-alt)',
                border:       '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                padding:      '2px 7px',
                fontSize:     12,
                color:        'var(--color-text-2)',
                cursor:       'pointer',
              }}
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── AddFieldRow — the "add new field" row at the bottom ─────────
const AddFieldRow = ({
  entityOptions,
  customTypeOptions,
  onAdd,
}: {
  entityOptions:     EntityOption[]
  customTypeOptions: CustomTypeOption[]
  onAdd: (name: string, type: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF', entityId: string | null, constraint: FieldConstraint, subType?: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null, subEntityId?: string | null, customTypeId?: string | null, subCustomTypeId?: string | null) => Promise<void>
}): React.JSX.Element => {
  const [name,            setName]            = useState<string>('')
  const [type,            setType]            = useState<JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF'>(JavaType.STRING)
  const [entityId,        setEntityId]        = useState<string | null>(null)
  const [customTypeId,    setCustomTypeId]    = useState<string | null>(null)
  const [constraint,      setConstraint]      = useState<FieldConstraint>(FieldConstraint.NONE)
  const [subType,         setSubType]         = useState<JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null>(null)
  const [subEntityId,     setSubEntityId]     = useState<string | null>(null)
  const [subCustomTypeId, setSubCustomTypeId] = useState<string | null>(null)

  const submit = (): void => {
    if (!name.trim()) return
    void onAdd(name, type, entityId, constraint, subType, subEntityId, customTypeId, subCustomTypeId)
    setName('')
    setType(JavaType.STRING)
    setEntityId(null)
    setCustomTypeId(null)
    setConstraint(FieldConstraint.NONE)
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
          excludeEntityRef
          onChange={(t, eid, cid) => {
            setType(t)
            setEntityId(eid)
            setCustomTypeId(cid)
            if (t !== JavaType.ARRAY) { setSubType(null); setSubEntityId(null) }
          }}
        />
        <select
          value={constraint}
          onChange={e => setConstraint(e.target.value as FieldConstraint)}
          className="outline-none shrink-0"
          style={{
            background:   'var(--color-surface-alt)',
            border:       '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding:      '4px 4px',
            fontSize:     10,
            color:        'var(--color-text)',
            fontFamily:   'var(--font-mono)',
            cursor:       'pointer',
          }}
        >
          {Object.values(FieldConstraint).filter(c => c !== FieldConstraint.FK).map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
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
            excludeEntityRef
            onChange={(t, eid, cid) => { setSubType(t); setSubEntityId(eid); setSubCustomTypeId(cid) }}
          />
        </div>
      )}
    </div>
  )
}

// ─── EntityInspector ─────────────────────────────────────────────

const EntityInspector = (props: EntityInspectorProps): React.JSX.Element | null => {
  const {
    node,
    handleLabelChange,
    handleTableNameChange,
    handleAuditingToggle,
    handleSoftDeleteToggle,
    handleGenerateRepositoryToggle,
    handleLombokStyleChange,
    handleAddField,
    handleRemoveField,
    handleFieldTypeChange,
    handleFieldArraySubTypeChange,
    handleFieldRelationshipChange,
    handleAddEnumValue,
    handleRemoveEnumValue,
    handleAIPromptChange,
    handleAIGenerateToggle,
    handleClose,
    handleDelete,
    connectedDTOs,
    handleDeleteEdge,
    connectedTables,
    handleDisconnectTable,
    connectedServices,
    handleDisconnectService,
    entityOptions,
    customTypeOptions,
    keyFieldsByEntityId,
  } = useEntityInspector(props)

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
                color:         'var(--node-entity-icon-fg)',
                background:    'var(--node-entity-icon-bg)',
                border:        '1px solid var(--color-border)',
                borderRadius:  'var(--radius-sm)',
                padding:       '1px 5px',
                fontFamily:    'var(--font-mono)',
                textTransform: 'uppercase',
              }}
            >
              Entity
            </span>
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', lineHeight: '18px' }}>
            {node.label}
          </p>
          <p style={{ fontSize: 9, color: 'var(--color-text-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            {node.tableName}
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
        placeholder="Order"
      />
      <FieldInput
        label="Table name"
        value={node.tableName}
        onChange={handleTableNameChange}
        placeholder="orders"
        mono
      />

      <Divider />

      {/* ── SECTION 2: CONFIG ─────────────────────────────────── */}
      <SectionLabel label="Config" />

      <ToggleRow
        label="Auditing (createdAt/updatedAt)"
        value={node.config.auditing}
        onChange={handleAuditingToggle}
      />
      <ToggleRow
        label="Soft delete (deletedAt)"
        value={node.config.softDelete}
        onChange={handleSoftDeleteToggle}
      />
      <ToggleRow
        label="Generate repository"
        value={node.config.generateRepository}
        onChange={handleGenerateRepositoryToggle}
      />

      <div className="px-4 py-2 flex items-center justify-between">
        <span style={{ fontSize: 11, color: 'var(--color-text-2)', fontFamily: 'var(--font-ui)' }}>
          Lombok style
        </span>
        <select
          value={node.config.lombokStyle}
          onChange={e => handleLombokStyleChange(e.target.value as LombokStyle)}
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
          {Object.values(LombokStyle).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <Divider />

      {/* ── SECTION 3: FIELDS ─────────────────────────────────── */}
      <SectionLabel label="Fields" />

      <div className="px-4 pb-3 flex flex-col gap-2">
        {node.fields.map(field => (
          <FieldRow
            key={field.id}
            field={field}
            entityOptions={entityOptions}
            customTypeOptions={customTypeOptions}
            keyFieldsByEntityId={keyFieldsByEntityId}
            onRemove={handleRemoveField}
            onTypeChange={handleFieldTypeChange}
            onArraySubTypeChange={handleFieldArraySubTypeChange}
            onRelationshipChange={handleFieldRelationshipChange}
            onAddEnumValue={handleAddEnumValue}
            onRemoveEnumValue={handleRemoveEnumValue}
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
        {connectedDTOs.length === 0 && connectedTables.length === 0 && connectedServices.length === 0 ? (
          <p className="text-[10px] font-mono text-text-4">No connections</p>
        ) : (
          <>
            {connectedDTOs.map(dto => (
              <div key={dto.edgeId} className="flex items-center gap-2 py-1 text-[11px]">
                <span style={{ color: 'var(--node-dto-accent)' }} className="font-bold">→</span>
                <span className="flex-1 text-text-2 truncate">{dto.dtoLabel}</span>
                <span
                  className="text-[8px] font-mono px-1 py-0.5 rounded-sm"
                  style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-3)' }}
                >
                  {dto.dtoPurpose}
                </span>
                <button
                  type="button"
                  onClick={() => void handleDeleteEdge(dto.edgeId)}
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
                  aria-label={`Disconnect ${dto.dtoLabel}`}
                >
                  ×
                </button>
              </div>
            ))}
            {connectedTables.map(table => (
              <div key={table.edgeId} className="flex items-center gap-2 py-1 text-[11px]">
                <span style={{ color: 'var(--node-db-accent)' }} className="font-bold">→</span>
                <span className="flex-1 text-text-2 truncate font-mono">{table.tableLabel}</span>
                <span
                  className="text-[8px] font-mono px-1 py-0.5 rounded-sm"
                  style={{ background: 'var(--node-db-icon-bg)', color: 'var(--node-db-icon-fg)' }}
                >
                  TABLE
                </span>
                <button
                  type="button"
                  onClick={() => void handleDisconnectTable(table.edgeId)}
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
                  aria-label={`Disconnect table ${table.tableLabel}`}
                >
                  ×
                </button>
              </div>
            ))}
            {connectedServices.map(svc => (
              <div key={svc.edgeId} className="flex items-center gap-2 py-1 text-[11px]">
                <span style={{ color: 'var(--node-svc-accent)' }} className="font-bold">←</span>
                <span className="flex-1 text-text-2 truncate font-mono">{svc.serviceLabel}</span>
                <span
                  className="text-[8px] font-mono px-1 py-0.5 rounded-sm"
                  style={{ background: 'var(--node-svc-icon-bg)', color: 'var(--node-svc-icon-fg)' }}
                >
                  SERVICE
                </span>
                <button
                  type="button"
                  onClick={() => void handleDisconnectService(svc.edgeId)}
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
                  aria-label={`Disconnect service ${svc.serviceLabel}`}
                >
                  ×
                </button>
              </div>
            ))}
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
          Delete entity
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

export default EntityInspector
