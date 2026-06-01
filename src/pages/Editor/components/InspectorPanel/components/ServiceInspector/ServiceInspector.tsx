import React, { useState } from 'react'
import { JavaType } from '@entity'
import { SectionLabel, Toggle, AIPromptBox, FieldTypeSelect } from '@components/shared'
import { formatReturnType } from '@utils'
import { useServiceInspector } from './useServiceInspector'
import type { ServiceInspectorProps, ServiceMethod } from './types'
import type { AIPrompt } from '@entity'

// ─── Local inline sub-components ─────────────────────────────────

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

// ─── MethodCard — collapsible method editor ───────────────────────

const MethodCard = ({
  method,
  isExpanded,
  onToggle,
  onRemove,
  onNameChange,
  onReturnTypeChange,
  onReturnEntityChange:    _onReturnEntityChange,
  onReturnPrimitiveChange: _onReturnPrimitiveChange,
  onReturnIsListToggle,
  onReturnIsPageToggle,
  onReturnIsOptionalToggle,
  onReturnIsVoidToggle,
  onAddParam,
  onRemoveParam,
  onParamIsPageableToggle,
  onMethodTransactionalToggle,
  onMethodAsyncToggle,
  onAddError,
  onRemoveError,
  onErrorCreateExceptionToggle,
  onMethodAIPromptChange,
  onMethodAIGenerateToggle,
  availableEntities,
  availableCustomTypes,
  entityLabel,
}: {
  method:                     ServiceMethod
  isExpanded:                 boolean
  onToggle:                   () => void
  onRemove:                   (id: string) => void
  onNameChange:               (id: string, v: string) => void
  onReturnTypeChange:         (id: string, type: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null, entityTypeId: string | null, customTypeId?: string | null, arraySubType?: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null, arrayEntityTypeId?: string | null, arrayCustomTypeId?: string | null) => void
  onReturnEntityChange:       (id: string, entityId: string | null) => void
  onReturnPrimitiveChange:    (id: string, type: JavaType | null) => void
  onReturnIsListToggle:       (id: string) => void
  onReturnIsPageToggle:       (id: string) => void
  onReturnIsOptionalToggle:   (id: string) => void
  onReturnIsVoidToggle:       (id: string) => void
  onAddParam:                 (id: string, name: string, type: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF', entityTypeId: string | null, customTypeId?: string | null, arraySubType?: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null, arrayEntityTypeId?: string | null, arrayCustomTypeId?: string | null, enumValues?: string[] | null) => void
  onRemoveParam:              (id: string, idx: number) => void
  onParamIsPageableToggle:    (id: string, idx: number) => void
  onMethodTransactionalToggle: (id: string) => void
  onMethodAsyncToggle:        (id: string) => void
  onAddError:                 (id: string, exClass: string) => void
  onRemoveError:              (id: string, idx: number) => void
  onErrorCreateExceptionToggle: (id: string, idx: number) => void
  onMethodAIPromptChange:     (id: string, field: keyof AIPrompt, v: string) => void
  onMethodAIGenerateToggle:   (id: string) => void
  availableEntities:    { id: string; label: string }[]
  availableCustomTypes: { id: string; label: string }[]
  entityLabel:          string | undefined
}): React.JSX.Element => {
  const [newParamName,           setNewParamName]           = useState('')
  const [newParamType,           setNewParamType]           = useState<JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF'>(JavaType.STRING)
  const [newParamEntityTypeId,   setNewParamEntityTypeId]   = useState<string | null>(null)
  const [newParamCustomTypeId,   setNewParamCustomTypeId]   = useState<string | null>(null)
  const [newParamSubType,        setNewParamSubType]        = useState<JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF' | null>(null)
  const [newParamSubEntityId,    setNewParamSubEntityId]    = useState<string | null>(null)
  const [newParamSubCustomTypeId,setNewParamSubCustomTypeId]= useState<string | null>(null)
  const [newParamEnumInput,      setNewParamEnumInput]      = useState('')
  const [newParamEnumValues,     setNewParamEnumValues]     = useState<string[]>([])
  const [newErrorClass, setNewErrorClass] = useState('')

  const entityOptions = availableEntities.map(e => ({
    id:       e.id,
    label:    e.label,
    hasTable: true,
    disabled: false,
  }))
  const customTypeOptions = availableCustomTypes

  const rtArrayEntityLabel = availableEntities.find(e => e.id === method.returnType.arrayEntityTypeId)?.label
  const returnLabel = formatReturnType(method.returnType, entityLabel, rtArrayEntityLabel)

  return (
    <div
      className="rounded-[var(--radius-sm)] border overflow-hidden mb-2"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-alt)' }}
    >
      {/* ── Collapsed header ── */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onClick={onToggle}
        style={{ background: 'var(--color-surface)' }}
      >
        <span
          style={{
            fontSize:   8,
            color:      'var(--color-text-4)',
            transition: 'transform 0.12s',
            display:    'inline-block',
            transform:  isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          ▶
        </span>
        <span className="text-[11px] font-mono text-text flex-1 truncate">
          {method.name || 'unnamed'}
        </span>
        <span className="text-[9px] font-mono text-text-4 flex-shrink-0">
          {returnLabel}
        </span>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onRemove(method.id) }}
          style={{
            background: 'none',
            border:     'none',
            cursor:     'pointer',
            color:      'var(--color-text-4)',
            fontSize:   13,
            lineHeight: 1,
            padding:    0,
          }}
          aria-label="Remove method"
        >
          ×
        </button>
      </div>

      {/* ── Expanded body ── */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-2 flex flex-col gap-2">

          {/* Name */}
          <div>
            <label className="block mb-1" style={{ fontSize: 9, color: 'var(--color-text-4)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              Method name
            </label>
            <input
              type="text"
              value={method.name}
              onChange={e => onNameChange(method.id, e.target.value)}
              className="w-full outline-none"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '5px 8px', fontSize: 11, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}
            />
          </div>

          {/* Return type */}
          <div>
            <p className="mb-1" style={{ fontSize: 9, color: 'var(--color-text-4)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              Return type
            </p>
            <div className="flex flex-col gap-1">
              <FieldTypeSelect
                value={method.returnType.type}
                entityTypeId={method.returnType.entityTypeId}
                customTypeId={method.returnType.customTypeId}
                entityOptions={entityOptions}
                customTypeOptions={customTypeOptions}
                onChange={(t, eid, cid) => onReturnTypeChange(method.id, t, eid, cid)}
              />
              {method.returnType.type === JavaType.ARRAY && (
                <div className="flex items-center gap-1.5 ml-2">
                  <span style={{ fontSize: 10, color: 'var(--color-text-4)', fontFamily: 'var(--font-mono)' }}>of</span>
                  <FieldTypeSelect
                    value={method.returnType.arraySubType}
                    entityTypeId={method.returnType.arrayEntityTypeId}
                    customTypeId={method.returnType.arrayCustomTypeId}
                    entityOptions={entityOptions}
                    customTypeOptions={customTypeOptions}
                    excludeTypes={[JavaType.ARRAY]}
                    onChange={(t, eid, cid) => onReturnTypeChange(method.id, JavaType.ARRAY, null, null, t, eid, cid)}
                  />
                </div>
              )}
            </div>
            {/* Shape toggles */}
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {(
                [
                  { label: 'List',     active: method.returnType.isList,     onToggle: () => onReturnIsListToggle(method.id) },
                  { label: 'Page',     active: method.returnType.isPage,     onToggle: () => onReturnIsPageToggle(method.id) },
                  { label: 'Optional', active: method.returnType.isOptional, onToggle: () => onReturnIsOptionalToggle(method.id) },
                  { label: 'void',     active: method.returnType.isVoid,     onToggle: () => onReturnIsVoidToggle(method.id) },
                ] as const
              ).map(chip => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={chip.onToggle}
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm"
                  style={{
                    background: chip.active ? 'var(--color-accent-light)' : 'var(--color-surface)',
                    color:      chip.active ? 'var(--color-accent)'       : 'var(--color-text-4)',
                    border:     `1px solid ${chip.active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    cursor:     'pointer',
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Params */}
          <div>
            <p className="mb-1" style={{ fontSize: 9, color: 'var(--color-text-4)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              Parameters
            </p>
            {(method.params ?? []).map((param, idx) => (
              <div key={idx} className="mb-1">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-mono text-text-2 flex-1 truncate">
                    {param.name}: {
                      param.type === 'ENTITY_REF'
                        ? (availableEntities.find(e => e.id === param.entityTypeId)?.label ?? 'Entity')
                        : param.type === 'CUSTOM_TYPE_REF'
                          ? (availableCustomTypes.find(c => c.id === param.customTypeId)?.label ?? 'CustomType')
                          : param.type
                    }{param.type === JavaType.ARRAY && param.arraySubType
                      ? `<${
                          param.arraySubType === 'ENTITY_REF'
                            ? (availableEntities.find(e => e.id === param.arrayEntityTypeId)?.label ?? 'Entity')
                            : param.arraySubType === 'CUSTOM_TYPE_REF'
                              ? (availableCustomTypes.find(c => c.id === param.arrayCustomTypeId)?.label ?? 'CustomType')
                              : param.arraySubType
                        }>`
                      : ''
                    }
                    {param.isPageable ? ', Pageable' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => onParamIsPageableToggle(method.id, idx)}
                    className="text-[8px] font-mono px-1 py-0.5 rounded-sm"
                    style={{
                      background: param.isPageable ? 'var(--color-accent-light)' : 'var(--color-surface)',
                      color:      param.isPageable ? 'var(--color-accent)'       : 'var(--color-text-4)',
                      border:     '1px solid var(--color-border)',
                      cursor:     'pointer',
                    }}
                    title="Toggle Pageable"
                  >
                    PG
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveParam(method.id, idx)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-4)', fontSize: 13, lineHeight: 1, padding: 0 }}
                    aria-label="Remove param"
                  >
                    ×
                  </button>
                </div>
                {param.type === JavaType.ENUM && param.enumValues && param.enumValues.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-0.5 pl-2">
                    {param.enumValues.map(v => (
                      <span
                        key={v}
                        style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--color-text-4)', background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 3, padding: '1px 4px' }}
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {/* Add param row */}
            <div className="flex flex-col gap-1 mt-1">
              <div className="flex gap-1">
                <input
                  type="text"
                  value={newParamName}
                  onChange={e => setNewParamName(e.target.value)}
                  placeholder="name"
                  className="outline-none"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '3px 5px', fontSize: 10, color: 'var(--color-text)', fontFamily: 'var(--font-mono)', width: 60 }}
                />
                <FieldTypeSelect
                  value={newParamType}
                  entityTypeId={newParamEntityTypeId}
                  customTypeId={newParamCustomTypeId}
                  entityOptions={entityOptions}
                  customTypeOptions={customTypeOptions}
                  onChange={(t, eid, cid) => {
                    setNewParamType(t)
                    setNewParamEntityTypeId(eid)
                    setNewParamCustomTypeId(cid)
                    if (t !== JavaType.ARRAY) { setNewParamSubType(null); setNewParamSubEntityId(null); setNewParamSubCustomTypeId(null) }
                    if (t !== JavaType.ENUM) { setNewParamEnumInput(''); setNewParamEnumValues([]) }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    onAddParam(method.id, newParamName, newParamType, newParamEntityTypeId, newParamCustomTypeId, newParamSubType, newParamSubEntityId, newParamSubCustomTypeId, newParamType === JavaType.ENUM ? newParamEnumValues : null)
                    setNewParamName('')
                    setNewParamType(JavaType.STRING)
                    setNewParamEntityTypeId(null)
                    setNewParamCustomTypeId(null)
                    setNewParamSubType(null)
                    setNewParamSubEntityId(null)
                    setNewParamSubCustomTypeId(null)
                    setNewParamEnumInput('')
                    setNewParamEnumValues([])
                  }}
                  style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '3px 6px', fontSize: 10, cursor: 'pointer', color: 'var(--color-text-2)', flexShrink: 0 }}
                >
                  +
                </button>
              </div>
              {newParamType === JavaType.ARRAY && (
                <div className="flex items-center gap-1.5 ml-2">
                  <span style={{ fontSize: 10, color: 'var(--color-text-4)', fontFamily: 'var(--font-mono)' }}>of</span>
                  <FieldTypeSelect
                    value={newParamSubType}
                    entityTypeId={newParamSubEntityId}
                    customTypeId={newParamSubCustomTypeId}
                    entityOptions={entityOptions}
                    customTypeOptions={customTypeOptions}
                    excludeTypes={[JavaType.ARRAY]}
                    onChange={(t, eid, cid) => { setNewParamSubType(t); setNewParamSubEntityId(eid); setNewParamSubCustomTypeId(cid) }}
                  />
                </div>
              )}
              {newParamType === JavaType.ENUM && (
                <div className="flex flex-col gap-1 ml-2">
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newParamEnumInput}
                      onChange={e => setNewParamEnumInput(e.target.value.toUpperCase())}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newParamEnumInput.trim()) {
                          const v = newParamEnumInput.trim()
                          if (!newParamEnumValues.includes(v)) setNewParamEnumValues(prev => [...prev, v])
                          setNewParamEnumInput('')
                        }
                      }}
                      placeholder="VALUE (Enter to add)"
                      className="outline-none flex-1"
                      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '3px 5px', fontSize: 10, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                  {newParamEnumValues.length > 0 && (
                    <div className="flex flex-wrap gap-0.5">
                      {newParamEnumValues.map(v => (
                        <span
                          key={v}
                          onClick={() => setNewParamEnumValues(prev => prev.filter(x => x !== v))}
                          style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--color-text-3)', background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 3, padding: '1px 4px', cursor: 'pointer' }}
                          title="Click to remove"
                        >
                          {v} ×
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Method flags */}
          <div className="flex gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Toggle value={method.transactional} onChange={() => onMethodTransactionalToggle(method.id)} />
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-3)' }}>@Transactional</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Toggle value={method.async} onChange={() => onMethodAsyncToggle(method.id)} />
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-3)' }}>async</span>
            </label>
          </div>

          {/* Errors */}
          <div>
            <p className="mb-1" style={{ fontSize: 9, color: 'var(--color-text-4)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              Throws
            </p>
            {(method.throwsErrors ?? []).map((err, idx) => (
              <div key={idx} className="flex items-center gap-1 mb-1">
                <span className="text-[10px] font-mono text-text-3 flex-1 truncate">{err.exceptionClass}</span>
                <button
                  type="button"
                  onClick={() => onErrorCreateExceptionToggle(method.id, idx)}
                  className="text-[8px] font-mono px-1 py-0.5 rounded-sm"
                  style={{
                    background: err.createException ? 'var(--color-success-light)' : 'var(--color-surface)',
                    color:      err.createException ? 'var(--color-success)'       : 'var(--color-text-4)',
                    border:     '1px solid var(--color-border)',
                    cursor:     'pointer',
                  }}
                  title="Create exception class"
                >
                  gen
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveError(method.id, idx)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-4)', fontSize: 13, lineHeight: 1, padding: 0 }}
                >
                  ×
                </button>
              </div>
            ))}
            <div className="flex gap-1 mt-1">
              <input
                type="text"
                value={newErrorClass}
                onChange={e => setNewErrorClass(e.target.value)}
                placeholder="ExceptionClass"
                className="outline-none flex-1"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '3px 5px', fontSize: 10, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}
              />
              <button
                type="button"
                onClick={() => {
                  onAddError(method.id, newErrorClass)
                  setNewErrorClass('')
                }}
                style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '3px 6px', fontSize: 10, cursor: 'pointer', color: 'var(--color-text-2)' }}
              >
                +
              </button>
            </div>
          </div>

          {/* Per-method AI prompt */}
          <AIPromptBox
            value={method.aiPrompt}
            onChange={(field, v) => onMethodAIPromptChange(method.id, field, v)}
            onGenerateToggle={() => onMethodAIGenerateToggle(method.id)}
          />
        </div>
      )}
    </div>
  )
}

// ─── ServiceInspector ─────────────────────────────────────────────

const ServiceInspector = ({ nodeId }: ServiceInspectorProps): React.JSX.Element | null => {
  const {
    node,
    connectedEntity,
    connectedControllers,
    handleLabelChange,
    handleDisconnectEntity,
    handleDisconnectController,
    handleTransactionalToggle,
    handleAsyncToggle,
    handleGenerateInterfaceToggle,
    expandedMethodId,
    setExpandedMethodId,
    handleAddMethod,
    handleRemoveMethod,
    handleMethodNameChange,
    handleReturnTypeChange,
    handleReturnEntityChange,
    handleReturnPrimitiveChange,
    handleReturnIsListToggle,
    handleReturnIsPageToggle,
    handleReturnIsOptionalToggle,
    handleReturnIsVoidToggle,
    handleAddParam,
    handleRemoveParam,
    handleParamIsPageableToggle,
    handleMethodTransactionalToggle,
    handleMethodAsyncToggle,
    handleAddError,
    handleRemoveError,
    handleErrorCreateExceptionToggle,
    handleMethodAIPromptChange,
    handleMethodAIGenerateToggle,
    handleAIPromptChange,
    handleAIGenerateToggle,
    handleClose,
    handleDelete,
    availableEntities,
    availableCustomTypes,
  } = useServiceInspector({ nodeId })

  if (!node) return null

  return (
    <div
      className="h-full overflow-y-auto flex flex-col"
      style={{ fontFamily: 'var(--font-ui)' }}
    >
      {/* ── STICKY HEADER ──────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 px-4 pt-3 pb-2"
        style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm"
            style={{ background: 'var(--node-svc-icon-bg)', color: 'var(--node-svc-icon-fg)' }}
          >
            SERVICE
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={handleClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-4)', fontSize: 16, lineHeight: 1, padding: 0 }}
            aria-label="Close inspector"
          >
            ×
          </button>
        </div>
        <p
          className="truncate"
          style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.2 }}
        >
          {node.label}
        </p>
        <p style={{ fontSize: 10, color: 'var(--color-text-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
          {connectedEntity ? `connected to: ${connectedEntity.label}` : 'not connected'}
        </p>
      </div>

      {/* ── SECTION 1: IDENTITY ────────────────────────────────── */}
      <SectionLabel label="Identity" />
      <FieldInput
        label="Label"
        value={node.label}
        onChange={handleLabelChange}
      />

      <Divider />

      {/* ── SECTION 2: ENTITY CONNECTION ───────────────────────── */}
      <SectionLabel label="Entity Connection" />
      <div className="px-3 pb-2">
        {connectedEntity !== null ? (
          <div className="flex items-center gap-2 py-1 text-[11px]">
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: 'var(--node-entity-accent)' }}
            />
            <span className="flex-1 font-mono text-text-2 truncate">{connectedEntity.label}</span>
            <span
              className="text-[8px] font-mono px-1 py-0.5 rounded-sm flex-shrink-0"
              style={{ background: 'var(--node-entity-icon-bg)', color: 'var(--node-entity-icon-fg)' }}
            >
              ENTITY
            </span>
            <button
              type="button"
              onClick={handleDisconnectEntity}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-4)', fontSize: 13, lineHeight: 1, padding: 0 }}
              aria-label="Disconnect entity"
            >
              ×
            </button>
          </div>
        ) : (
          <p className="text-[10px] font-mono text-text-4 italic">
            Draw an edge to an Entity node on the canvas
          </p>
        )}
      </div>

      {/* ── SECTION 2b: CONTROLLER CONNECTIONS ─────────────────── */}
      {connectedControllers.length > 0 && (
        <>
          <Divider />
          <SectionLabel label="Called by" />
          <div className="px-3 pb-2">
            {connectedControllers.map(ctrl => (
              <div key={ctrl.edgeId} className="flex items-center gap-2 py-1 text-[11px]">
                <span style={{ color: 'var(--node-ctrl-accent)', fontSize: 12 }}>←</span>
                <span className="flex-1 font-mono text-text-2 truncate">{ctrl.label}</span>
                <span
                  className="text-[8px] font-mono px-1 py-0.5 rounded-sm flex-shrink-0"
                  style={{ background: 'var(--node-ctrl-icon-bg)', color: 'var(--node-ctrl-icon-fg)' }}
                >
                  CONTROLLER
                </span>
                <button
                  type="button"
                  onClick={() => handleDisconnectController(ctrl.edgeId)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-4)', fontSize: 13, lineHeight: 1, padding: 0 }}
                  aria-label="Disconnect controller"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── SECTION 3: CONFIG — hidden when not connected ──────── */}
      {connectedEntity !== null && (
        <>
          <Divider />
          <SectionLabel label="Config" />
          <ToggleRow
            label="Class-level @Transactional"
            value={node.config.classLevelTransactional}
            onChange={handleTransactionalToggle}
          />
          <ToggleRow
            label="Class-level async"
            value={node.config.classLevelAsync}
            onChange={handleAsyncToggle}
          />
          <ToggleRow
            label="Generate interface"
            value={node.config.generateInterface}
            onChange={handleGenerateInterfaceToggle}
          />
        </>
      )}

      {/* ── SECTION 4: METHODS — hidden when not connected ─────── */}
      {connectedEntity !== null && (
        <>
          <Divider />
          <SectionLabel label="Methods" />
          <div className="px-3 pb-2">
            {node.methods.map(method => (
              <MethodCard
                key={method.id}
                method={method}
                isExpanded={expandedMethodId === method.id}
                onToggle={() => setExpandedMethodId(expandedMethodId === method.id ? null : method.id)}
                onRemove={handleRemoveMethod}
                onNameChange={handleMethodNameChange}
                onReturnTypeChange={handleReturnTypeChange}
                onReturnEntityChange={handleReturnEntityChange}
                onReturnPrimitiveChange={handleReturnPrimitiveChange}
                onReturnIsListToggle={handleReturnIsListToggle}
                onReturnIsPageToggle={handleReturnIsPageToggle}
                onReturnIsOptionalToggle={handleReturnIsOptionalToggle}
                onReturnIsVoidToggle={handleReturnIsVoidToggle}
                onAddParam={handleAddParam}
                onRemoveParam={handleRemoveParam}
                onParamIsPageableToggle={handleParamIsPageableToggle}
                onMethodTransactionalToggle={handleMethodTransactionalToggle}
                onMethodAsyncToggle={handleMethodAsyncToggle}
                onAddError={handleAddError}
                onRemoveError={handleRemoveError}
                onErrorCreateExceptionToggle={handleErrorCreateExceptionToggle}
                onMethodAIPromptChange={handleMethodAIPromptChange}
                onMethodAIGenerateToggle={handleMethodAIGenerateToggle}
                availableEntities={availableEntities}
                availableCustomTypes={availableCustomTypes}
                entityLabel={connectedEntity?.label}
              />
            ))}

            <button
              type="button"
              onClick={handleAddMethod}
              className="w-full text-center mt-1"
              style={{
                background:   'var(--color-surface-alt)',
                border:       '1px dashed var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                padding:      '6px 12px',
                fontSize:     11,
                cursor:       'pointer',
                color:        'var(--color-text-3)',
                fontFamily:   'var(--font-ui)',
              }}
            >
              + Add method
            </button>
          </div>
        </>
      )}

      <Divider />

      {/* ── SECTION 5: AI PROMPT ───────────────────────────────── */}
      <SectionLabel label="AI Prompt" />
      <div className="px-4 pb-3">
        <AIPromptBox
          value={node.aiPrompt}
          onChange={handleAIPromptChange}
          onGenerateToggle={handleAIGenerateToggle}
        />
      </div>

      <Divider />

      {/* ── SECTION 6: DELETE ──────────────────────────────────── */}
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
          Delete service
        </button>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

export default ServiceInspector
