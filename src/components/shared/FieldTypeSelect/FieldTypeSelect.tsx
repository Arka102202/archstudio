import React from 'react'
import { JavaType } from '@entity'
import type { FieldTypeSelectProps } from './types'

// All JavaType values as options
const JAVA_TYPE_OPTIONS: JavaType[] = Object.values(JavaType)

const FieldTypeSelect = ({
  value,
  entityTypeId,
  customTypeId,
  entityOptions,
  customTypeOptions = [],
  onChange,
  excludeTypes,
  excludeEntityRef,
}: FieldTypeSelectProps): React.JSX.Element => {
  const javaTypeOptions = excludeTypes?.length
    ? JAVA_TYPE_OPTIONS.filter(t => !excludeTypes.includes(t))
    : JAVA_TYPE_OPTIONS

  const selectValue = value === 'ENTITY_REF'
    ? `entity:${entityTypeId ?? ''}`
    : value === 'CUSTOM_TYPE_REF'
      ? `customType:${customTypeId ?? ''}`
      : (value ?? '')

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const v = e.target.value
    if (v.startsWith('entity:')) {
      onChange('ENTITY_REF', v.replace('entity:', ''), null)
    } else if (v.startsWith('customType:')) {
      onChange('CUSTOM_TYPE_REF', null, v.replace('customType:', ''))
    } else if (v) {
      onChange(v as JavaType, null, null)
    }
  }

  return (
    <select
      value={selectValue}
      onChange={handleChange}
      className="outline-none shrink-0"
      style={{
        background:   'var(--color-surface-alt)',
        border:       '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        padding:      '2px 4px',
        fontSize:     10,
        color:        'var(--color-text)',
        fontFamily:   'var(--font-mono)',
        cursor:       'pointer',
        maxWidth:     120,
      }}
    >
      <option value="">— select type —</option>

      <optgroup label="Java Types">
        {javaTypeOptions.map(jt => (
          <option key={jt} value={jt}>{jt}</option>
        ))}
      </optgroup>

      {!excludeEntityRef && entityOptions.length > 0 && (
        <optgroup label="Entity Types">
          {entityOptions.map(eo => (
            <option
              key={eo.id}
              value={`entity:${eo.id}`}
              disabled={eo.disabled}
            >
              {eo.label}{eo.disabled ? ' ✕' : ''}
            </option>
          ))}
        </optgroup>
      )}

      {customTypeOptions.length > 0 && (
        <optgroup label="Custom Types">
          {customTypeOptions.map(ct => (
            <option key={ct.id} value={`customType:${ct.id}`}>
              {ct.label}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  )
}

export default FieldTypeSelect
