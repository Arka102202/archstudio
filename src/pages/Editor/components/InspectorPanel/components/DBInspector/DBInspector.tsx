import React from 'react'
import { DBType, DDLAuto } from '@entity'
import { SectionLabel, Toggle, AIPromptBox } from '@components/shared'
import { useDBInspector } from './useDBInspector'
import type { DBInspectorProps, DBInspectorHook } from './types'

// ─── Local inline sub-components ─────────────────────────────────

const Divider = (): React.JSX.Element => (
  <div className="h-px bg-border my-2" />
)

const labelClass = 'block mb-1 text-[9px] text-text-4 font-ui uppercase tracking-[0.08em] font-semibold'

const inputClass = 'w-full outline-none bg-surface-alt border border-border rounded-sm px-2 py-[5px] text-[11px] text-text'

const FieldInput = ({
  label,
  value,
  onChange,
  placeholder = '',
  mono        = false,
  type        = 'text',
}: {
  label:        string
  value:        string
  onChange:     (v: string) => void
  placeholder?: string
  mono?:        boolean
  type?:        'text' | 'password' | 'number'
}): React.JSX.Element => (
  <div className="px-4 py-1.5">
    <label className={labelClass}>{label}</label>
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className={`${inputClass} ${mono ? 'font-mono' : 'font-ui'}`}
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
    <span className="text-[11px] text-text-2 font-ui">{label}</span>
    <Toggle value={value} onChange={onChange} />
  </div>
)

const SelectRow = ({
  label,
  value,
  options,
  onChange,
}: {
  label:    string
  value:    string
  options:  { value: string; label: string }[]
  onChange: (v: string) => void
}): React.JSX.Element => (
  <div className="px-4 py-2 flex items-center justify-between">
    <span className="text-[11px] text-text-2 font-ui">{label}</span>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="outline-none bg-surface-alt border border-border rounded-sm px-1.5 py-[3px] text-[11px] text-text font-mono cursor-pointer"
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
)

// ─── DBInspector ──────────────────────────────────────────────────

const DBInspector = (props: DBInspectorProps): React.JSX.Element | null => {
  const hook: DBInspectorHook = useDBInspector(props)
  const {
    node,
    handleLabelChange,
    handleDbNameChange,
    handleDbTypeChange,
    handleHostChange,
    handlePortChange,
    handleSchemaChange,
    handleUsernameChange,
    handlePasswordChange,
    showPassword,
    toggleShowPassword,
    handleDdlAutoChange,
    handlePoolSizeChange,
    handleShowSqlToggle,
    handleFlywayToggle,
    handleRedisToggle,
    connectedTables,
    handleDisconnectTable,
    handleAIPromptChange,
    handleAIGenerateToggle,
    handleClose,
    handleDelete,
  } = hook

  if (!node) {
    return (
      <div className="flex items-center justify-center h-20">
        <span className="text-[11px] text-text-4">Loading…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto font-ui">

      {/* ── PANEL HEADER ──────────────────────────────────────── */}
      <div className="sticky top-0 z-10 px-4 py-3 flex items-start justify-between bg-surface border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="inline-flex items-center text-[9px] font-bold font-mono uppercase px-[5px] py-px rounded-sm border border-border"
              style={{ color: 'var(--node-db-icon-fg)', background: 'var(--node-db-icon-bg)' }}
            >
              DBNode
            </span>
          </div>
          <p className="text-[13px] font-bold text-text leading-[18px]">{node.dbName}</p>
          <p className="text-[9px] text-text-4 font-mono mt-0.5">{node.dbType}</p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="flex items-center justify-center shrink-0 w-6 h-6 rounded-sm border border-border bg-transparent text-[13px] text-text-3 cursor-pointer"
          aria-label="Close inspector"
        >
          ×
        </button>
      </div>

      {/* ── SECTION 1: IDENTITY ───────────────────────────────── */}
      <SectionLabel label="Identity" />

      <FieldInput label="DB name"  value={node.dbName}    onChange={handleDbNameChange}  placeholder="app_db"   mono />
      <FieldInput label="Label"    value={node.label}     onChange={handleLabelChange}   placeholder="Database" />

      <SelectRow
        label="DB type"
        value={node.dbType}
        options={Object.values(DBType).map(t => ({ value: t, label: t }))}
        onChange={v => handleDbTypeChange(v as DBType)}
      />

      <Divider />

      {/* ── SECTION 2: CONNECTION ─────────────────────────────── */}
      <SectionLabel label="Connection" />

      <FieldInput label="Host"     value={node.host}           onChange={handleHostChange}     placeholder="localhost"  mono />
      <FieldInput label="Port"     value={String(node.port)}   onChange={handlePortChange}     placeholder="5432"       mono type="number" />
      <FieldInput label="Schema"   value={node.schema}         onChange={handleSchemaChange}   placeholder="public"     mono />
      <FieldInput label="Username" value={node.username}       onChange={handleUsernameChange} placeholder="${DB_USER}" mono />

      {/* Password with show/hide */}
      <div className="px-4 py-1.5">
        <label className={labelClass}>Password</label>
        <div className="flex gap-1.5">
          <input
            type={showPassword ? 'text' : 'password'}
            value={node.password}
            onChange={e => handlePasswordChange(e.target.value)}
            placeholder="${DB_PASS}"
            className="flex-1 outline-none min-w-0 bg-surface-alt border border-border rounded-sm px-2 py-[5px] text-[11px] text-text font-mono"
          />
          <button
            type="button"
            onClick={toggleShowPassword}
            className="shrink-0 bg-surface-alt border border-border rounded-sm px-2 py-1 text-[10px] text-text-3 cursor-pointer font-ui"
          >
            {showPassword ? 'hide' : 'show'}
          </button>
        </div>
      </div>

      <Divider />

      {/* ── SECTION 3: CONFIG ─────────────────────────────────── */}
      <SectionLabel label="Config" />

      <SelectRow
        label="DDL Auto"
        value={node.config.ddlAuto}
        options={Object.values(DDLAuto).map(v => ({ value: v, label: v }))}
        onChange={v => handleDdlAutoChange(v as DDLAuto)}
      />

      <div className="px-4 py-1.5">
        <label className={labelClass}>Pool size</label>
        <input
          type="number"
          value={node.config.poolSize}
          onChange={e => handlePoolSizeChange(e.target.value)}
          className={`${inputClass} font-mono`}
        />
      </div>

      <ToggleRow label="Show SQL"    value={node.config.showSql} onChange={handleShowSqlToggle} />
      <ToggleRow label="Flyway"      value={node.config.flyway}  onChange={handleFlywayToggle} />
      <ToggleRow label="Redis cache" value={node.config.redis}   onChange={handleRedisToggle} />

      <Divider />

      {/* ── SECTION 4: CONNECTIONS ────────────────────────────── */}
      <SectionLabel label="Connections" />
      <div className="px-3 pb-2">
        {connectedTables.length === 0 ? (
          <p className="text-[10px] font-mono text-text-4">No tables connected</p>
        ) : (
          connectedTables.map(entry => (
            <div key={entry.edgeId} className="flex items-center gap-2 py-1 text-[11px]">
              <span className="font-bold" style={{ color: 'var(--node-db-accent)' }}>←</span>
              <span className="flex-1 text-text-2 truncate">{entry.tableLabel}</span>
              <span className="text-[8px] font-mono px-1 py-0.5 rounded-sm bg-surface-alt text-text-3">
                TABLE
              </span>
              <button
                type="button"
                onClick={() => void handleDisconnectTable(entry.edgeId)}
                className="leading-none bg-transparent border-none cursor-pointer text-text-4 text-[13px] p-0"
                aria-label={`Disconnect ${entry.tableLabel}`}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      <Divider />

      {/* ── SECTION 5: AI PROMPT ──────────────────────────────── */}
      <SectionLabel label="AI Prompt" />
      <div className="px-4 pb-3">
        <AIPromptBox
          value={node.aiPrompt}
          onChange={handleAIPromptChange}
          onGenerateToggle={handleAIGenerateToggle}
        />
      </div>

      <Divider />

      {/* ── SECTION 6: DELETE ─────────────────────────────────── */}
      <div className="px-4 py-3">
        <button
          type="button"
          onClick={handleDelete}
          className="w-full text-center rounded-sm px-4 py-2 text-[11px] font-semibold font-ui cursor-pointer border"
          style={{
            background:  'var(--color-danger-light)',
            color:       'var(--color-danger)',
            borderColor: 'var(--color-danger-border)',
          }}
        >
          Delete database
        </button>
      </div>
    </div>
  )
}

export default DBInspector
