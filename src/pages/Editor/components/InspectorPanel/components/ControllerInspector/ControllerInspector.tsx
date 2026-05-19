import React, { useState } from 'react'
import { SectionLabel, Toggle, AIPromptBox, ErrorHandlingSection } from '@components/shared'
import { useControllerInspector } from './useControllerInspector'
import type { ControllerInspectorProps } from './types'
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

// ─── ControllerInspector ──────────────────────────────────────────

const ControllerInspector = ({ nodeId }: ControllerInspectorProps): React.JSX.Element | null => {
  const {
    node,
    authRuleName,
    connectedService,
    connectedEndpoints,
    handleLabelChange,
    handleBasePathChange,
    handleDisconnectService,
    handleDisconnectEndpoint,
    handleCrossOriginToggle,
    handleApiVersionChange,
    handleRequestLoggingToggle,
    handleIncludeTimestampToggle,
    handleIncludeRequestPathToggle,
    handleErrorsChange,
    handleAddSwaggerTag,
    handleRemoveSwaggerTag,
    handleAIPromptChange,
    handleAIGenerateToggle,
    handleClose,
    handleDelete,
  } = useControllerInspector({ nodeId })

  // Local state for add-tag row
  const [newTag, setNewTag] = useState('')

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
            style={{ background: 'var(--node-ctrl-icon-bg)', color: 'var(--node-ctrl-icon-fg)' }}
          >
            CONTROLLER
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
          {node.basePath}
        </p>
      </div>

      {/* ── SECTION 1: IDENTITY ────────────────────────────────── */}
      <SectionLabel label="Identity" />
      <FieldInput label="Label" value={node.label} onChange={handleLabelChange} />
      <FieldInput label="Base path" value={node.basePath} onChange={handleBasePathChange} mono placeholder="/api/resource" />

      <Divider />

      {/* ── SECTION 2: SECURITY ────────────────────────────────── */}
      <SectionLabel label="Security" />
      <div className="px-3 pb-2">
        {authRuleName !== null ? (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)]"
            style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}
          >
            <span style={{ color: 'var(--node-auth-rule-accent, var(--color-accent))' }}>🔒</span>
            <span className="text-[11px] font-mono text-text truncate">{authRuleName}</span>
          </div>
        ) : (
          <p className="text-[9px] font-mono text-text-4 italic">
            No security rule — connect an Auth Rule node to secure this controller
          </p>
        )}
      </div>

      <Divider />

      {/* ── SECTION 3: SERVICE CONNECTION ──────────────────────── */}
      <SectionLabel label="Service Connection" />
      <div className="px-3 pb-2">
        {connectedService !== null ? (
          <div className="flex items-center gap-2 py-1 text-[11px]">
            <span style={{ color: 'var(--node-svc-accent)', fontSize: 12 }}>◇</span>
            <span className="flex-1 font-mono text-text-2 truncate">{connectedService.label}</span>
            <span
              className="text-[8px] font-mono px-1 py-0.5 rounded-sm flex-shrink-0"
              style={{ background: 'var(--node-svc-icon-bg)', color: 'var(--node-svc-icon-fg)' }}
            >
              SERVICE
            </span>
            <button
              type="button"
              onClick={handleDisconnectService}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-4)', fontSize: 13, lineHeight: 1, padding: 0 }}
              aria-label="Disconnect service"
            >
              ×
            </button>
          </div>
        ) : (
          <p className="text-[10px] font-mono text-text-4 italic">
            Draw an edge to a Service node
          </p>
        )}
      </div>

      <Divider />

      {/* ── SECTION 4: API ENDPOINTS ───────────────────────────── */}
      <SectionLabel label="API Endpoints" />
      <div className="px-3 pb-2 flex flex-col gap-1">
        {connectedEndpoints.length === 0 ? (
          <p className="text-[10px] font-mono text-text-4 italic">
            Draw an edge from an API Endpoint node
          </p>
        ) : (
          connectedEndpoints.map(ep => {
            const methodColour =
              ep.method === 'GET'    ? { bg: 'var(--color-success-light)', fg: 'var(--color-success)' }   :
              ep.method === 'POST'   ? { bg: 'var(--color-accent-light)',  fg: 'var(--color-accent)' }    :
              ep.method === 'PUT'    ? { bg: 'var(--color-warning-light)', fg: 'var(--color-warning)' }   :
              ep.method === 'DELETE' ? { bg: 'var(--color-danger-light)',  fg: 'var(--color-danger)' }    :
                                       { bg: 'var(--color-surface-alt)',   fg: 'var(--color-text-3)' }

            return (
              <div key={ep.edgeId} className="flex items-center gap-1.5 py-0.5 min-w-0">
                <span
                  className="text-[8px] font-mono font-bold px-1 py-0.5 rounded-sm flex-shrink-0"
                  style={{ background: methodColour.bg, color: methodColour.fg }}
                >
                  {ep.method}
                </span>
                <span className="text-[10px] font-mono text-text-2 flex-1 truncate">
                  {ep.path}
                </span>
                <button
                  type="button"
                  onClick={() => handleDisconnectEndpoint(ep.edgeId)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-4)', fontSize: 13, lineHeight: 1, padding: 0, flexShrink: 0 }}
                  aria-label="Disconnect endpoint"
                >
                  ×
                </button>
              </div>
            )
          })
        )}
      </div>

      <Divider />

      {/* ── SECTION 5: CONFIG ──────────────────────────────────── */}
      <SectionLabel label="Config" />
      <ToggleRow label="CORS (cross-origin)" value={node.config.crossOrigin} onChange={handleCrossOriginToggle} />
      <FieldInput
        label="API version"
        value={node.config.apiVersion ?? ''}
        onChange={handleApiVersionChange}
        placeholder="e.g. v1"
        mono
      />
      <ToggleRow label="Request logging" value={node.config.requestLogging} onChange={handleRequestLoggingToggle} />

      <Divider />

      {/* ── SECTION 6: ERROR HANDLING ──────────────────────────── */}
      <SectionLabel label="Error Handling" />
      <div className="flex flex-col gap-3 px-4 py-3">

        {/* Global toggles */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-3">Include timestamp globally</span>
          <Toggle
            value={node.errorHandlerConfig.includeTimestamp}
            onChange={handleIncludeTimestampToggle}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-3">Include request path globally</span>
          <Toggle
            value={node.errorHandlerConfig.includeRequestPath}
            onChange={handleIncludeRequestPathToggle}
          />
        </div>

        {/* Shared error handling component */}
        <ErrorHandlingSection
          errors={node.errorHandlerConfig.errors}
          onChange={handleErrorsChange}
        />
      </div>

      <Divider />

      {/* ── SECTION 7: SWAGGER TAGS ────────────────────────────── */}
      <SectionLabel label="Swagger" />
      <div className="px-4 pb-2">
        {/* Tag chips */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {node.swaggerTags.map((tag, idx) => (
            <span
              key={idx}
              className="text-[8px] font-mono px-1.5 py-0.5 rounded-sm flex items-center gap-1"
              style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveSwaggerTag(idx)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', fontSize: 10, lineHeight: 1, padding: 0, opacity: 0.7 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        {/* Add tag row */}
        <div className="flex gap-1">
          <input
            type="text"
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                handleAddSwaggerTag(newTag)
                setNewTag('')
              }
            }}
            placeholder="tag name"
            className="outline-none flex-1"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '4px 6px', fontSize: 10, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}
          />
          <button
            type="button"
            onClick={() => { handleAddSwaggerTag(newTag); setNewTag('') }}
            style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: 12, cursor: 'pointer', color: 'var(--color-text-2)' }}
          >
            +
          </button>
        </div>
      </div>

      <Divider />

      {/* ── SECTION 8: AI PROMPT ───────────────────────────────── */}
      <SectionLabel label="AI Prompt" />
      <div className="px-4 pb-3">
        <AIPromptBox
          value={node.aiPrompt}
          onChange={(field: keyof AIPrompt, v: string) => handleAIPromptChange(field, v)}
          onGenerateToggle={handleAIGenerateToggle}
        />
      </div>

      <Divider />

      {/* ── SECTION 9: DELETE ──────────────────────────────────── */}
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
          Delete controller
        </button>
      </div>

      {/* Pulse animation for AI prompt */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

export default ControllerInspector
