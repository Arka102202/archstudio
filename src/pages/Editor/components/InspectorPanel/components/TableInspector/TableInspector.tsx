import React, { useState } from 'react'
import { useNodes } from '@xyflow/react'
import { JavaType } from '@entity'
import { QueryType, CacheOp } from '@entity'
import { SectionLabel, Toggle, AIPromptBox } from '@components/shared'
import { useTableInspector } from './useTableInspector'
import type { TableInspectorProps, CustomQuery, QueryReturnType, CacheConfig } from './types'
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

// ─── Query type badge ─────────────────────────────────────────────

const QueryTypeBadge = ({ type }: { type: QueryType | null }): React.JSX.Element => {
  const styles: React.CSSProperties =
    type === QueryType.DERIVED
      ? { background: 'var(--color-success-light)', color: 'var(--color-success)' }
      : type === QueryType.JPQL
        ? { background: 'var(--color-accent-light)',  color: 'var(--color-accent)'  }
        : type === QueryType.NATIVE_SQL
          ? { background: 'var(--color-warning-light)', color: 'var(--color-warning)' }
          : type === QueryType.AI
            ? { background: 'var(--ai-box-border)',      color: 'var(--ai-dot-color)'  }
            : { background: 'var(--color-surface-alt)',  color: 'var(--color-text-4)'  }

  return (
    <span
      className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm flex-shrink-0"
      style={styles}
    >
      {type ?? '—'}
    </span>
  )
}

// ─── QueryCard — collapsible query editor ─────────────────────────

const QueryCard = ({
  query,
  isExpanded,
  onToggle,
  onRemove,
  onMethodNameChange,
  onDescriptionChange,
  onTypeChange,
  onStringChange,
  onTargetEntityChange,
  onNativeToggle,
  onModifyingToggle,
  onAddParam,
  onRemoveParam,
  onReturnTypeChange,
  onCacheToggle,
  onCacheFieldChange,
  onAIPromptChange,
  entityNodes,
  customTypeNodes,
}: {
  query:                CustomQuery
  isExpanded:           boolean
  onToggle:             () => void
  onRemove:             (id: string) => void
  onMethodNameChange:   (id: string, v: string) => void
  onDescriptionChange:  (id: string, v: string) => void
  onTypeChange:         (id: string, v: QueryType | null) => void
  onStringChange:       (id: string, v: string) => void
  onTargetEntityChange: (id: string, entityId: string | null) => void
  onNativeToggle:       (id: string) => void
  onModifyingToggle:    (id: string) => void
  onAddParam:           (id: string, name: string, type: JavaType | 'CUSTOM_TYPE_REF', arraySubType?: JavaType | 'CUSTOM_TYPE_REF' | null, enumValues?: string[] | null, customTypeId?: string | null, arrayCustomTypeId?: string | null) => void
  onRemoveParam:        (id: string, idx: number) => void
  onReturnTypeChange:   (id: string, partial: Partial<QueryReturnType>) => void
  onCacheToggle:        (id: string) => void
  onCacheFieldChange:   (id: string, field: keyof CacheConfig, value: unknown) => void
  onAIPromptChange:     (id: string, field: keyof AIPrompt, value: string | boolean) => void
  entityNodes:          { id: string; label: string }[]
  customTypeNodes:      { id: string; label: string }[]
}): React.JSX.Element => {
  const [newParamName,          setNewParamName]          = useState('')
  const [newParamType,          setNewParamType]          = useState<JavaType | 'CUSTOM_TYPE_REF'>(JavaType.STRING)
  const [newParamCustomTypeId,  setNewParamCustomTypeId]  = useState<string | null>(null)
  const [newParamSubType,       setNewParamSubType]       = useState<JavaType | 'CUSTOM_TYPE_REF'>(JavaType.STRING)
  const [newParamSubCustomTypeId, setNewParamSubCustomTypeId] = useState<string | null>(null)
  const [newParamEnumInput,     setNewParamEnumInput]     = useState('')
  const [newParamEnumValues,    setNewParamEnumValues]    = useState<string[]>([])

  const cardStyle: React.CSSProperties = {
    borderRadius: 'var(--radius-sm)',
    border:       '1px solid var(--color-border)',
    overflow:     'hidden',
    marginBottom: 6,
  }

  const showQueryString = query.type === QueryType.JPQL || query.type === QueryType.NATIVE_SQL
  const showParams      = query.type !== null && query.type !== QueryType.DERIVED
  const showAIPrompt    = true

  return (
    <div style={cardStyle}>
      {/* Collapsed / expanded header row */}
      <div
        className="p-2 cursor-pointer"
        style={{ background: isExpanded ? 'var(--color-surface-alt)' : undefined }}
        onClick={onToggle}
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className="flex-1 text-[11px] font-mono font-bold truncate"
            style={{ color: 'var(--color-text)' }}
          >
            {query.methodName}
          </span>
          <QueryTypeBadge type={query.type} />
          <span
            className="text-[10px]"
            style={{ color: 'var(--color-text-4)' }}
          >
            {isExpanded ? '▼' : '▶'}
          </span>
        </div>
        {query.description && (
          <div
            className="text-[10px] truncate"
            style={{ color: 'var(--color-text-3)', fontFamily: 'var(--font-ui)' }}
          >
            {query.description}
          </div>
        )}
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div className="p-2 flex flex-col gap-2" style={{ borderTop: '1px solid var(--color-border)' }}>
          {/* Method name */}
          <div>
            <label
              className="block mb-0.5"
              style={{ fontSize: 9, color: 'var(--color-text-4)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}
            >
              Method name
            </label>
            <input
              type="text"
              value={query.methodName}
              onChange={e => onMethodNameChange(query.id, e.target.value)}
              className="w-full outline-none"
              style={{
                background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)', padding: '4px 7px', fontSize: 11,
                color: 'var(--color-text)', fontFamily: 'var(--font-mono)',
              }}
            />
          </div>

          {/* Description */}
          <div>
            <label
              className="block mb-0.5"
              style={{ fontSize: 9, color: 'var(--color-text-4)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}
            >
              Description
            </label>
            <textarea
              rows={2}
              value={query.description}
              onChange={e => onDescriptionChange(query.id, e.target.value)}
              className="w-full outline-none resize-y"
              style={{
                background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)', padding: '4px 7px', fontSize: 11,
                color: 'var(--color-text)', fontFamily: 'var(--font-ui)', lineHeight: 1.5,
                minHeight: 48,
              }}
            />
          </div>

          {/* Query type */}
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 10, color: 'var(--color-text-3)', fontFamily: 'var(--font-ui)', flex: 1 }}>
              Query type
            </span>
            <select
              value={query.type ?? ''}
              onChange={e => {
                const v = e.target.value
                onTypeChange(query.id, v === '' ? null : v as QueryType)
              }}
              className="outline-none"
              style={{
                background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)', padding: '3px 6px', fontSize: 10,
                color: 'var(--color-text)', fontFamily: 'var(--font-mono)', cursor: 'pointer',
              }}
            >
              <option value="">—</option>
              {Object.values(QueryType).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Target entity (when type is set) */}
          {query.type !== null && (
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 10, color: 'var(--color-text-3)', fontFamily: 'var(--font-ui)', flex: 1 }}>
                Entity
              </span>
              <select
                value={query.targetEntityId ?? ''}
                onChange={e => onTargetEntityChange(query.id, e.target.value || null)}
                className="outline-none"
                style={{
                  background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)', padding: '3px 6px', fontSize: 10,
                  color: 'var(--color-text)', fontFamily: 'var(--font-ui)', cursor: 'pointer',
                  maxWidth: 130,
                }}
              >
                <option value="">None</option>
                {entityNodes.map(e => (
                  <option key={e.id} value={e.id}>{e.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Query string (JPQL / NATIVE_SQL) */}
          {showQueryString && (
            <div>
              <label
                className="block mb-0.5"
                style={{ fontSize: 9, color: 'var(--color-text-4)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}
              >
                Query
              </label>
              <textarea
                rows={3}
                value={query.queryString ?? ''}
                onChange={e => onStringChange(query.id, e.target.value)}
                className="w-full outline-none resize-none"
                style={{
                  background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)', padding: '4px 7px', fontSize: 10,
                  color: 'var(--color-text)', fontFamily: 'var(--font-mono)', lineHeight: 1.5,
                }}
              />
            </div>
          )}

          {/* Native / Modifying toggles */}
          {showQueryString && (
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: 10, color: 'var(--color-text-3)', fontFamily: 'var(--font-ui)' }}>Native</span>
                <Toggle value={query.nativeQuery} onChange={() => onNativeToggle(query.id)} />
              </div>
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: 10, color: 'var(--color-text-3)', fontFamily: 'var(--font-ui)' }}>Modifying</span>
                <Toggle value={query.modifying} onChange={() => onModifyingToggle(query.id)} />
              </div>
            </div>
          )}

          {/* Params sub-section */}
          {showParams && (
            <div>
              <p style={{ fontSize: 9, color: 'var(--color-text-4)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 4 }}>
                Params
              </p>
              {query.params.map((param, idx) => (
                <div key={idx} className="mb-1">
                  <div className="flex items-center gap-1">
                    <span className="flex-1 text-[10px] font-mono text-text-2 truncate">{param.name}</span>
                    <span className="text-[9px] font-mono text-text-4">
                      {param.type === JavaType.ARRAY
                        ? `List<${param.arraySubType === 'CUSTOM_TYPE_REF' ? (customTypeNodes.find(c => c.id === param.arrayCustomTypeId)?.label ?? 'CT') : (param.arraySubType ?? JavaType.STRING)}>`
                        : param.type === 'CUSTOM_TYPE_REF'
                          ? (customTypeNodes.find(c => c.id === param.customTypeId)?.label ?? 'CT')
                          : param.type}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveParam(query.id, idx)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-4)', fontSize: 13, lineHeight: 1, padding: 0 }}
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
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={newParamName}
                    onChange={e => setNewParamName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newParamName.trim()) {
                        onAddParam(query.id, newParamName, newParamType, newParamType === JavaType.ARRAY ? newParamSubType : null, newParamType === JavaType.ENUM ? newParamEnumValues : null, newParamCustomTypeId, newParamSubCustomTypeId)
                        setNewParamName(''); setNewParamType(JavaType.STRING); setNewParamCustomTypeId(null)
                        setNewParamSubType(JavaType.STRING); setNewParamSubCustomTypeId(null)
                        setNewParamEnumInput(''); setNewParamEnumValues([])
                      }
                    }}
                    placeholder="name"
                    className="outline-none"
                    style={{
                      flex: 1, background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)', padding: '3px 5px', fontSize: 10,
                      color: 'var(--color-text)', fontFamily: 'var(--font-mono)', minWidth: 0,
                    }}
                  />
                  <select
                    value={newParamType === 'CUSTOM_TYPE_REF' ? (newParamCustomTypeId ?? '') : newParamType}
                    onChange={e => {
                      const v = e.target.value
                      const isJava = Object.values(JavaType as Record<string, string>).includes(v)
                      if (isJava) { setNewParamType(v as JavaType); setNewParamCustomTypeId(null) }
                      else        { setNewParamType('CUSTOM_TYPE_REF'); setNewParamCustomTypeId(v) }
                      setNewParamEnumInput(''); setNewParamEnumValues([])
                    }}
                    className="outline-none"
                    style={{
                      background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)', padding: '3px 4px', fontSize: 10,
                      color: 'var(--color-text)', fontFamily: 'var(--font-mono)', cursor: 'pointer',
                    }}
                  >
                    <optgroup label="Primitives">
                      {Object.values(JavaType).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </optgroup>
                    {customTypeNodes.length > 0 && (
                      <optgroup label="Custom Types">
                        {customTypeNodes.map(ct => (
                          <option key={ct.id} value={ct.id}>{ct.label}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newParamName.trim()) return
                      onAddParam(query.id, newParamName, newParamType, newParamType === JavaType.ARRAY ? newParamSubType : null, newParamType === JavaType.ENUM ? newParamEnumValues : null, newParamCustomTypeId, newParamSubCustomTypeId)
                      setNewParamName(''); setNewParamType(JavaType.STRING); setNewParamCustomTypeId(null)
                      setNewParamSubType(JavaType.STRING); setNewParamSubCustomTypeId(null)
                      setNewParamEnumInput(''); setNewParamEnumValues([])
                    }}
                    style={{
                      background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)', padding: '3px 7px', fontSize: 13,
                      color: 'var(--color-text-2)', cursor: 'pointer',
                    }}
                  >
                    +
                  </button>
                </div>
                {/* Subtype row — only when ARRAY is selected */}
                {newParamType === JavaType.ARRAY && (
                  <div className="flex items-center gap-1.5 pl-1">
                    <span style={{ fontSize: 9, color: 'var(--color-text-4)', fontFamily: 'var(--font-ui)' }}>
                      Element type
                    </span>
                    <select
                      value={newParamSubType === 'CUSTOM_TYPE_REF' ? (newParamSubCustomTypeId ?? '') : newParamSubType}
                      onChange={e => {
                        const v = e.target.value
                        const isJava = Object.values(JavaType as Record<string, string>).includes(v)
                        if (isJava) { setNewParamSubType(v as JavaType); setNewParamSubCustomTypeId(null) }
                        else        { setNewParamSubType('CUSTOM_TYPE_REF'); setNewParamSubCustomTypeId(v) }
                      }}
                      className="outline-none"
                      style={{
                        background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)', padding: '3px 4px', fontSize: 10,
                        color: 'var(--color-text)', fontFamily: 'var(--font-mono)', cursor: 'pointer',
                      }}
                    >
                      <optgroup label="Primitives">
                        {Object.values(JavaType).filter(t => t !== JavaType.ARRAY).map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </optgroup>
                      {customTypeNodes.length > 0 && (
                        <optgroup label="Custom Types">
                          {customTypeNodes.map(ct => (
                            <option key={ct.id} value={ct.id}>{ct.label}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                )}
                {/* Enum values row — only when ENUM is selected */}
                {newParamType === JavaType.ENUM && (
                  <div className="flex flex-col gap-1 pl-1">
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
                        style={{
                          background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-sm)', padding: '3px 5px', fontSize: 10,
                          color: 'var(--color-text)', fontFamily: 'var(--font-mono)',
                        }}
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
          )}

          {/* Return type sub-section */}
          <div>
            <p style={{ fontSize: 9, color: 'var(--color-text-4)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 4 }}>
              Returns
            </p>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 10, color: 'var(--color-text-3)', fontFamily: 'var(--font-ui)' }}>List</span>
                <Toggle
                  value={query.returnType?.isList ?? false}
                  onChange={() => onReturnTypeChange(query.id, {
                    isList:  !(query.returnType?.isList ?? false),
                    isPage:  false,
                  })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 10, color: 'var(--color-text-3)', fontFamily: 'var(--font-ui)' }}>Page</span>
                <Toggle
                  value={query.returnType?.isPage ?? false}
                  onChange={() => onReturnTypeChange(query.id, {
                    isPage: !(query.returnType?.isPage ?? false),
                    isList: false,
                  })}
                />
              </div>
              {!(query.returnType?.isList) && !(query.returnType?.isPage) && (
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 10, color: 'var(--color-text-3)', fontFamily: 'var(--font-ui)' }}>Optional</span>
                  <Toggle
                    value={query.returnType?.isOptional ?? false}
                    onChange={() => onReturnTypeChange(query.id, { isOptional: !(query.returnType?.isOptional ?? false) })}
                  />
                </div>
              )}
              <div>
                <input
                  type="text"
                  value={query.returnType?.projectionClass ?? ''}
                  onChange={e => onReturnTypeChange(query.id, { projectionClass: e.target.value })}
                  placeholder="Projection class (optional)"
                  className="w-full outline-none"
                  style={{
                    background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)', padding: '3px 6px', fontSize: 10,
                    color: 'var(--color-text)', fontFamily: 'var(--font-ui)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Cache sub-section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p style={{ fontSize: 9, color: 'var(--color-text-4)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                Cache
              </p>
              <Toggle value={query.cache?.enabled ?? false} onChange={() => onCacheToggle(query.id)} />
            </div>
            {query.cache !== null && query.cache.enabled && (
              <div className="flex flex-col gap-1.5">
                <input
                  type="text"
                  value={query.cache.cacheName}
                  onChange={e => onCacheFieldChange(query.id, 'cacheName', e.target.value)}
                  placeholder="Cache name"
                  className="w-full outline-none"
                  style={{
                    background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)', padding: '3px 6px', fontSize: 10,
                    color: 'var(--color-text)', fontFamily: 'var(--font-mono)',
                  }}
                />
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 10, color: 'var(--color-text-3)', fontFamily: 'var(--font-ui)', flex: 1 }}>TTL (s)</span>
                  <input
                    type="number"
                    value={query.cache.ttlSeconds}
                    onChange={e => onCacheFieldChange(query.id, 'ttlSeconds', parseInt(e.target.value, 10) || 0)}
                    className="outline-none"
                    style={{
                      width: 70, background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)', padding: '3px 6px', fontSize: 10,
                      color: 'var(--color-text)', fontFamily: 'var(--font-mono)',
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 10, color: 'var(--color-text-3)', fontFamily: 'var(--font-ui)', flex: 1 }}>Operation</span>
                  <select
                    value={query.cache.operation}
                    onChange={e => onCacheFieldChange(query.id, 'operation', e.target.value as CacheOp)}
                    className="outline-none"
                    style={{
                      background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)', padding: '3px 5px', fontSize: 10,
                      color: 'var(--color-text)', fontFamily: 'var(--font-mono)', cursor: 'pointer',
                    }}
                  >
                    {Object.values(CacheOp).map(op => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Per-query AI Prompt — always shown */}
          {showAIPrompt && query.aiPrompt && (
            <AIPromptBox
              value={query.aiPrompt}
              onChange={(field, value) => onAIPromptChange(query.id, field, value)}
              onGenerateToggle={() => onAIPromptChange(query.id, 'aiGenerate', !(query.aiPrompt?.aiGenerate ?? true))}
            />
          )}

          {/* Remove query */}
          <button
            type="button"
            onClick={() => onRemove(query.id)}
            className="w-full text-center mt-1"
            style={{
              background:   'none',
              border:       '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding:      '4px 8px',
              fontSize:     10,
              color:        'var(--color-text-4)',
              cursor:       'pointer',
              fontFamily:   'var(--font-ui)',
            }}
          >
            Remove query
          </button>
        </div>
      )}
    </div>
  )
}

// ─── TableInspector ───────────────────────────────────────────────

const TableInspector = (props: TableInspectorProps): React.JSX.Element | null => {
  const {
    node,
    connectedEntity,
    connectedDB,
    handleDisconnectEntity,
    handleDisconnectDB,
    handleLabelChange,
    handleTableNameChange,
    expandedQueryId,
    setExpandedQueryId,
    handleAddQuery,
    handleRemoveQuery,
    handleQueryMethodNameChange,
    handleQueryDescriptionChange,
    handleQueryTypeChange,
    handleQueryStringChange,
    handleQueryTargetEntityChange,
    handleQueryNativeToggle,
    handleQueryModifyingToggle,
    handleAddQueryParam,
    handleRemoveQueryParam,
    handleQueryReturnTypeChange,
    handleQueryCacheToggle,
    handleQueryCacheFieldChange,
    handleQueryAIPromptChange,
    handleAIPromptChange,
    handleAIGenerateToggle,
    connectedDTOs,
    connectedTables,
    handleDeleteEdge,
    handleDisconnectTable,
    handleClose,
    handleDelete,
  } = useTableInspector(props)

  // Gather entity + custom type nodes for query selectors
  const allRFNodes = useNodes()
  const entityNodes = allRFNodes
    .filter(n => n.type === 'entity')
    .map(n => ({
      id:    n.id,
      label: (n.data as { label?: string }).label ?? n.id,
    }))
  const customTypeNodes = allRFNodes
    .filter(n => n.type === 'customType')
    .map(n => ({
      id:    n.id,
      label: (n.data as { label?: string }).label ?? n.id,
    }))

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
                color:         'var(--node-db-icon-fg)',
                background:    'var(--node-db-icon-bg)',
                border:        '1px solid var(--color-border)',
                borderRadius:  'var(--radius-sm)',
                padding:       '1px 5px',
                fontFamily:    'var(--font-mono)',
                textTransform: 'uppercase',
              }}
            >
              Table
            </span>
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', lineHeight: '18px' }}>
            {node.label}
          </p>
          <p style={{ fontSize: 9, color: 'var(--color-text-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            {node.tableName}
            {' · '}
            {connectedEntity !== null ? connectedEntity.entityLabel : 'No entity'}
            {' · '}
            {connectedDB !== null ? connectedDB.dbLabel : 'No database'}
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
        placeholder="Orders Table"
      />
      <FieldInput
        label="Table name"
        value={node.tableName}
        onChange={handleTableNameChange}
        placeholder="orders"
        mono
      />

      <Divider />

      {/* ── SECTION 2: CONNECTIONS ───────────────────────────── */}
      <SectionLabel label="Connections" />
      <div className="px-3 pb-2">
        {/* Entity row (STORED_IN) */}
        {connectedEntity !== null ? (
          <div className="flex items-center gap-2 py-1 text-[11px]">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: 'var(--node-entity-accent)' }}
            />
            <span className="flex-1 text-text-2 truncate font-mono">{connectedEntity.entityLabel}</span>
            <span
              className="text-[8px] font-mono px-1 py-0.5 rounded-sm"
              style={{ background: 'var(--node-entity-icon-bg)', color: 'var(--node-entity-icon-fg)' }}
            >
              ENTITY
            </span>
            <button
              type="button"
              onClick={() => void handleDisconnectEntity(connectedEntity.edgeId)}
              className="leading-none"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-text-4)', fontSize: 13, lineHeight: 1, padding: 0,
              }}
              aria-label="Disconnect entity"
            >
              ×
            </button>
          </div>
        ) : (
          <p className="text-[10px] font-mono text-text-4 py-1">No entity linked</p>
        )}

        {/* DB row (CONNECTS_TO) */}
        {connectedDB !== null ? (
          <div className="flex items-center gap-2 py-1 text-[11px]">
            <span
              className="flex-shrink-0 text-[10px] font-mono leading-none"
              style={{ color: 'var(--node-db-accent)' }}
            >
              ▪
            </span>
            <span className="flex-1 text-text-2 truncate font-mono">{connectedDB.dbLabel}</span>
            <span
              className="text-[8px] font-mono px-1 py-0.5 rounded-sm"
              style={{ background: 'var(--node-db-icon-bg)', color: 'var(--node-db-icon-fg)' }}
            >
              DATABASE
            </span>
            <button
              type="button"
              onClick={() => void handleDisconnectDB(connectedDB.edgeId)}
              className="leading-none"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-text-4)', fontSize: 13, lineHeight: 1, padding: 0,
              }}
              aria-label="Disconnect database"
            >
              ×
            </button>
          </div>
        ) : (
          <p className="text-[10px] font-mono text-text-4 py-1">No database linked</p>
        )}
      </div>

      <Divider />

      {/* ── SECTION 3: CUSTOM QUERIES ─────────────────────────── */}
      <SectionLabel label="Custom Queries" />
      <div className="px-3 pb-3">
        {node.customQueries.map(query => (
          <QueryCard
            key={query.id}
            query={query}
            isExpanded={expandedQueryId === query.id}
            onToggle={() => setExpandedQueryId(expandedQueryId === query.id ? null : query.id)}
            onRemove={handleRemoveQuery}
            onMethodNameChange={handleQueryMethodNameChange}
            onDescriptionChange={handleQueryDescriptionChange}
            onTypeChange={handleQueryTypeChange}
            onStringChange={handleQueryStringChange}
            onTargetEntityChange={handleQueryTargetEntityChange}
            onNativeToggle={handleQueryNativeToggle}
            onModifyingToggle={handleQueryModifyingToggle}
            onAddParam={handleAddQueryParam}
            onRemoveParam={handleRemoveQueryParam}
            onReturnTypeChange={handleQueryReturnTypeChange}
            onCacheToggle={handleQueryCacheToggle}
            onCacheFieldChange={handleQueryCacheFieldChange}
            onAIPromptChange={handleQueryAIPromptChange}
            entityNodes={entityNodes}
            customTypeNodes={customTypeNodes}
          />
        ))}

        <button
          type="button"
          onClick={handleAddQuery}
          className="w-full py-1.5 text-[11px] font-semibold border border-dashed border-[var(--color-border-strong)] rounded-[var(--radius-sm)] text-text-3 hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
        >
          + Add query
        </button>
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
        {connectedEntity === null && connectedDB === null && connectedDTOs.length === 0 && connectedTables.length === 0 ? (
          <p className="text-[10px] font-mono text-text-4">No connections</p>
        ) : (
          <>
            {connectedEntity !== null && (
              <div className="flex items-center gap-2 py-1 text-[11px]">
                <span style={{ color: 'var(--node-entity-accent)' }} className="font-bold">→</span>
                <span className="flex-1 text-text-2 truncate font-mono">{connectedEntity.entityLabel}</span>
                <span
                  className="text-[8px] font-mono px-1 py-0.5 rounded-sm"
                  style={{ background: 'var(--node-entity-icon-bg)', color: 'var(--node-entity-icon-fg)' }}
                >
                  ENTITY
                </span>
                <button
                  type="button"
                  onClick={() => void handleDisconnectEntity(connectedEntity.edgeId)}
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
                  aria-label="Disconnect entity"
                >
                  ×
                </button>
              </div>
            )}
            {connectedDB !== null && (
              <div className="flex items-center gap-2 py-1 text-[11px]">
                <span style={{ color: 'var(--node-db-accent)' }} className="font-bold">→</span>
                <span className="flex-1 text-text-2 truncate font-mono">{connectedDB.dbLabel}</span>
                <span
                  className="text-[8px] font-mono px-1 py-0.5 rounded-sm"
                  style={{ background: 'var(--node-db-icon-bg)', color: 'var(--node-db-icon-fg)' }}
                >
                  DATABASE
                </span>
                <button
                  type="button"
                  onClick={() => void handleDisconnectDB(connectedDB.edgeId)}
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
                  aria-label="Disconnect database"
                >
                  ×
                </button>
              </div>
            )}
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
          Delete table
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

export default TableInspector
