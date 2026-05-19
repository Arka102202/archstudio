import React, { useState } from 'react'
import { HttpMethod, JavaType } from '@entity'
import { SectionLabel, Toggle, ErrorHandlingSection } from '@components/shared'
import { useAPIEndpointInspector } from './useAPIEndpointInspector'
import type { APIEndpointInspectorProps } from './types'

// ─── Local inline sub-components ─────────────────────────────────

const Divider = (): React.JSX.Element => (
  <div style={{ height: 1, background: 'var(--color-border)', margin: '8px 0' }} />
)

const LabelStyle = {
  fontSize:      9,
  color:         'var(--color-text-4)',
  fontFamily:    'var(--font-ui)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  fontWeight:    600,
}

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
    <label className="block mb-1" style={LabelStyle}>{label}</label>
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

// ─── Method chip colour helper ────────────────────────────────────

const METHOD_COLOURS: Record<HttpMethod, { bg: string; fg: string }> = {
  [HttpMethod.GET]:    { bg: '#22c55e22', fg: '#22c55e' },
  [HttpMethod.POST]:   { bg: '#a855f722', fg: '#a855f7' },
  [HttpMethod.PUT]:    { bg: '#f59e0b22', fg: '#f59e0b' },
  [HttpMethod.PATCH]:  { bg: '#f59e0b22', fg: '#f59e0b' },
  [HttpMethod.DELETE]: { bg: '#ef444422', fg: '#ef4444' },
}

// ─── APIEndpointInspector ─────────────────────────────────────────

const APIEndpointInspector = ({ nodeId }: APIEndpointInspectorProps): React.JSX.Element | null => {
  const {
    node,
    connectedController,
    connectedRequestDTO,
    connectedResponseDTO,
    availableRequestDTOs,
    availableResponseDTOs,
    availableControllerNodes,
    queryParamsExpanded,
    setQueryParamsExpanded,
    authRuleName,
    authRuleEffect,
    handleLabelChange,
    handleMethodChange,
    handlePathChange,
    handleDescriptionChange,
    handleBodyDTOChange,
    handleAddPathVar,
    handleRemovePathVar,
    handleAddQueryParam,
    handleRemoveQueryParam,
    handleReturnDTOChange,
    handleSuccessCodeChange,
    handlePaginatedToggle,
    handleDeprecatedToggle,
    handleInheritFromControllerToggle,
    handleErrorsChange,
    handleDisconnectController,
    handleDisconnectRequestDTO,
    handleDisconnectResponseDTO,
    handleQuickConnect,
    handleClose,
    handleDelete,
  } = useAPIEndpointInspector({ nodeId })

  // Local state for inline add rows
  const [newPathVar,        setNewPathVar]        = useState('')
  const [newQueryParamName, setNewQueryParamName] = useState('')
  const [newQueryParamType, setNewQueryParamType] = useState<JavaType>(JavaType.STRING)
  const [quickConnectId,    setQuickConnectId]    = useState('')

  if (!node) return null

  const methodColour = METHOD_COLOURS[node.method]

  // Build success code options
  const SUCCESS_CODES = [200, 201, 204, 400, 401, 403, 404, 500]

  return (
    <div className="h-full overflow-y-auto flex flex-col" style={{ fontFamily: 'var(--font-ui)' }}>

      {/* ── STICKY HEADER ──────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 px-4 pt-3 pb-2"
        style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm" style={{ background: 'var(--node-ep-icon-bg)', color: 'var(--node-ep-icon-fg)' }}>
            ENDPOINT
          </span>
          <span className="flex-1" />
          <button type="button" onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-4)', fontSize: 16, lineHeight: 1, padding: 0 }} aria-label="Close inspector">×</button>
        </div>
        <p className="truncate" style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.2 }}>{node.label}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm" style={{ background: methodColour.bg, color: methodColour.fg }}>{node.method}</span>
          <span className="text-[10px] font-mono text-text-4">{node.path}</span>
        </div>
      </div>

      {/* ── SECTION 1: LABEL ───────────────────────────────────── */}
      <SectionLabel label="Label" />
      <FieldInput label="Label" value={node.label} onChange={handleLabelChange} />

      <Divider />

      {/* ── SECTION 2: HTTP ────────────────────────────────────── */}
      <SectionLabel label="HTTP" />
      <div className="px-4 py-1.5 flex gap-2">
        {/* Method select */}
        <div style={{ width: 90, flexShrink: 0 }}>
          <label className="block mb-1" style={LabelStyle}>Method</label>
          <select
            value={node.method}
            onChange={e => handleMethodChange(e.target.value as HttpMethod)}
            className="outline-none w-full"
            style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '5px 8px', fontSize: 11, color: methodColour.fg, fontFamily: 'var(--font-mono)' }}
          >
            {Object.values(HttpMethod).map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        {/* Path input */}
        <div className="flex-1">
          <label className="block mb-1" style={LabelStyle}>Path</label>
          <input
            type="text"
            value={node.path}
            placeholder="/"
            onChange={e => handlePathChange(e.target.value)}
            className="w-full outline-none"
            style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '5px 8px', fontSize: 11, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}
          />
        </div>
      </div>
      <FieldInput label="Description" value={node.config.description} onChange={handleDescriptionChange} placeholder="e.g. Create order" />

      <Divider />

      {/* ── SECTION 3: REQUEST ─────────────────────────────────── */}
      <SectionLabel label="Request" />

      {/* Body DTO dropdown */}
      <div className="px-4 py-1.5">
        <label className="block mb-1" style={LabelStyle}>Body DTO (REQUEST)</label>
        <select
          value={node.request.bodyDTOId ?? ''}
          onChange={e => handleBodyDTOChange(e.target.value === '' ? null : e.target.value)}
          className="outline-none w-full"
          style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '5px 8px', fontSize: 11, color: 'var(--color-text)', fontFamily: 'var(--font-ui)' }}
        >
          <option value="">None</option>
          {availableRequestDTOs.map(dto => (
            <option key={dto.id} value={dto.id}>{dto.label}</option>
          ))}
        </select>
      </div>

      {/* Path variables */}
      <div className="px-4 py-1.5">
        <p className="mb-1" style={LabelStyle}>Path variables</p>
        {node.request.pathVars.map((pv, idx) => (
          <div key={idx} className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-text-2 flex-1">{'{'}{pv.name}{'}'}</span>
            <span className="text-[9px] font-mono text-text-4">{pv.type}</span>
            <button type="button" onClick={() => handleRemovePathVar(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-4)', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
          </div>
        ))}
        <div className="flex gap-1 mt-1">
          <input
            type="text"
            value={newPathVar}
            onChange={e => setNewPathVar(e.target.value)}
            placeholder="name e.g. id"
            className="outline-none flex-1"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '4px 6px', fontSize: 10, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}
          />
          <button
            type="button"
            onClick={() => { handleAddPathVar(newPathVar); setNewPathVar('') }}
            style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: 12, cursor: 'pointer', color: 'var(--color-text-2)' }}
          >+</button>
        </div>
      </div>

      {/* Query params — collapsible */}
      <div className="px-4 py-1.5">
        <button
          type="button"
          onClick={() => setQueryParamsExpanded(!queryParamsExpanded)}
          className="flex items-center gap-1 w-full"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <span style={{ ...LabelStyle, display: 'block' }}>Query params</span>
          <span style={{ fontSize: 8, color: 'var(--color-text-4)', display: 'inline-block', transform: queryParamsExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.12s', marginLeft: 4 }}>▶</span>
        </button>
        {queryParamsExpanded && (
          <>
            {node.request.queryParams.map((qp, idx) => (
              <div key={idx} className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-mono text-text-2 flex-1">{qp.name}</span>
                <span className="text-[9px] font-mono text-text-4">{qp.type}</span>
                <button type="button" onClick={() => handleRemoveQueryParam(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-4)', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
              </div>
            ))}
            <div className="flex gap-1 mt-1">
              <input
                type="text"
                value={newQueryParamName}
                onChange={e => setNewQueryParamName(e.target.value)}
                placeholder="param name"
                className="outline-none flex-1"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '4px 6px', fontSize: 10, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}
              />
              <select
                value={newQueryParamType}
                onChange={e => setNewQueryParamType(e.target.value as JavaType)}
                className="outline-none"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '4px 6px', fontSize: 10, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}
              >
                {Object.values(JavaType).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button
                type="button"
                onClick={() => { handleAddQueryParam(newQueryParamName, newQueryParamType, '', false); setNewQueryParamName('') }}
                style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: 12, cursor: 'pointer', color: 'var(--color-text-2)' }}
              >+</button>
            </div>
          </>
        )}
      </div>

      <Divider />

      {/* ── SECTION 4: RESPONSE ────────────────────────────────── */}
      <SectionLabel label="Response" />

      <div className="px-4 py-1.5">
        <label className="block mb-1" style={LabelStyle}>Return DTO (RESPONSE)</label>
        <select
          value={node.response.returnDTOId ?? ''}
          onChange={e => handleReturnDTOChange(e.target.value === '' ? null : e.target.value)}
          className="outline-none w-full"
          style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '5px 8px', fontSize: 11, color: 'var(--color-text)', fontFamily: 'var(--font-ui)' }}
        >
          <option value="">None</option>
          {availableResponseDTOs.map(dto => (
            <option key={dto.id} value={dto.id}>{dto.label}</option>
          ))}
        </select>
      </div>

      <div className="px-4 py-1.5 flex items-center gap-2">
        <label className="block" style={{ ...LabelStyle, margin: 0, flexShrink: 0 }}>Success code</label>
        <select
          value={node.response.successCode}
          onChange={e => handleSuccessCodeChange(parseInt(e.target.value, 10))}
          className="outline-none flex-1"
          style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '5px 8px', fontSize: 11, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}
        >
          {SUCCESS_CODES.map(code => <option key={code} value={code}>{code}</option>)}
        </select>
      </div>

      <ToggleRow label="Paginated (Page<>)" value={node.config.paginated} onChange={handlePaginatedToggle} />
      <ToggleRow label="Deprecated" value={node.config.deprecated} onChange={handleDeprecatedToggle} />

      <Divider />

      {/* ── SECTION 5: SECURITY ────────────────────────────────── */}
      <div className="flex flex-col gap-2 px-4 py-3 border-t border-[var(--color-border)]">
        <p className="text-[9px] font-mono font-bold text-text-3 uppercase tracking-wider">SECURITY</p>
        {authRuleName !== null ? (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)]"
            style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}
          >
            <span style={{ color: 'var(--node-auth-rule-accent, var(--color-accent))' }}>🔒</span>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[11px] font-mono text-text truncate">{authRuleName}</span>
              {authRuleEffect !== null && (
                <span className="text-[9px] font-mono text-text-4">{authRuleEffect}</span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-[9px] font-mono text-text-4 italic">No security rule — connect an Auth Rule node via SECURES edge</p>
        )}
      </div>

      <Divider />

      {/* ── SECTION 6: ERROR HANDLING ──────────────────────────── */}
      <SectionLabel label="Error Handling" />
      <div className="flex flex-col gap-3 px-4 py-3">

        {/* Inherit toggle */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-3">Inherit from controller</span>
          <Toggle
            value={node.errorHandling.inheritFromController}
            onChange={handleInheritFromControllerToggle}
          />
        </div>

        {/* Only show error cards when not inheriting */}
        {!node.errorHandling.inheritFromController && (
          <ErrorHandlingSection
            errors={node.errorHandling.errors}
            onChange={handleErrorsChange}
            sectionLabel="ENDPOINT ERRORS"
          />
        )}
      </div>

      <Divider />

      {/* ── SECTION 7: CONNECTIONS ─────────────────────────────── */}
      <SectionLabel label="Connections" />
      <div className="px-3 pb-2 flex flex-col gap-1">

        {connectedController !== null ? (
          <div className="flex items-center gap-2 py-1 text-[11px]">
            <span style={{ color: 'var(--node-ep-accent)', fontSize: 12 }}>→</span>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--node-ctrl-accent)' }} />
            <span className="flex-1 font-mono text-text-2 truncate">{connectedController.label}</span>
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-sm flex-shrink-0" style={{ background: 'var(--color-accent-light)', color: 'var(--node-ep-accent)' }}>ROUTES TO</span>
            <button type="button" onClick={handleDisconnectController} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-4)', fontSize: 13, lineHeight: 1, padding: 0 }} aria-label="Disconnect controller">×</button>
          </div>
        ) : (
          <p className="text-[10px] font-mono text-text-4 italic px-1">No controller connected</p>
        )}

        {connectedRequestDTO !== null && (
          <div className="flex items-center gap-2 py-1 text-[11px]">
            <span style={{ color: 'var(--node-ep-accent)', fontSize: 12 }}>→</span>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--node-dto-accent)' }} />
            <span className="flex-1 font-mono text-text-2 truncate">{connectedRequestDTO.label}</span>
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-sm flex-shrink-0" style={{ background: 'var(--color-accent-light)', color: 'var(--node-dto-accent)' }}>ACCEPTS</span>
            <button type="button" onClick={handleDisconnectRequestDTO} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-4)', fontSize: 13, lineHeight: 1, padding: 0 }} aria-label="Disconnect request DTO">×</button>
          </div>
        )}

        {connectedResponseDTO !== null && (
          <div className="flex items-center gap-2 py-1 text-[11px]">
            <span style={{ color: 'var(--node-ep-accent)', fontSize: 12 }}>→</span>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--node-dto-accent)' }} />
            <span className="flex-1 font-mono text-text-2 truncate">{connectedResponseDTO.label}</span>
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-sm flex-shrink-0" style={{ background: 'var(--color-accent-light)', color: 'var(--node-dto-accent)' }}>RETURNS</span>
            <button type="button" onClick={handleDisconnectResponseDTO} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-4)', fontSize: 13, lineHeight: 1, padding: 0 }} aria-label="Disconnect response DTO">×</button>
          </div>
        )}

        {/* Quick-connect dropdown */}
        {(availableControllerNodes.length > 0 || availableRequestDTOs.length > 0 || availableResponseDTOs.length > 0) && (
          <div className="flex gap-1 mt-1">
            <select
              value={quickConnectId}
              onChange={e => setQuickConnectId(e.target.value)}
              className="outline-none flex-1"
              style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '5px 8px', fontSize: 10, color: 'var(--color-text)', fontFamily: 'var(--font-ui)' }}
            >
              <option value="">+ connect to node…</option>
              {availableControllerNodes.map(n => (
                <option key={n.id} value={n.id}>{n.label} (Controller)</option>
              ))}
              {[...new Map([...availableRequestDTOs, ...availableResponseDTOs].map(d => [d.id, d])).values()].map(dto => (
                <option key={dto.id} value={dto.id}>{dto.label} (DTO)</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => { if (quickConnectId) { handleQuickConnect(quickConnectId); setQuickConnectId('') } }}
              disabled={!quickConnectId}
              style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: 11, cursor: quickConnectId ? 'pointer' : 'not-allowed', color: 'var(--color-text-2)', opacity: quickConnectId ? 1 : 0.4 }}
            >→</button>
          </div>
        )}
      </div>

      <Divider />

      {/* ── SECTION 8: DELETE ──────────────────────────────────── */}
      <div className="px-4 py-3">
        <button
          type="button"
          onClick={handleDelete}
          className="w-full text-center"
          style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger)', border: '1px solid var(--color-danger-border)', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
        >
          Delete endpoint
        </button>
      </div>

    </div>
  )
}

export default APIEndpointInspector
