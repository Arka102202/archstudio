import React from 'react'
import { useSettings } from './useSettings'

// ─── Settings ─────────────────────────────────────────────────────

const Settings = (): React.JSX.Element => {
  const {
    proxyUrl,
    setProxyUrl,
    saveStatus,
    proxyStatus,
    handleSave,
    handleBack,
  } = useSettings()

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--color-canvas-bg)', color: 'var(--color-text)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-4"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
      >
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 cursor-pointer border-none bg-transparent transition-colors"
          style={{ color: 'var(--color-text-3)', fontSize: 13 }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-text)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-3)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back
        </button>
        <span style={{ fontWeight: 700, fontSize: 16 }}>Settings</span>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-8 max-w-[640px] mx-auto w-full flex flex-col gap-8">

        {/* AI Configuration section */}
        <section>
          <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
            AI Configuration
          </h2>
          <div style={{ height: 1, background: 'var(--color-border)', marginBottom: 20 }} />

          <div className="flex flex-col gap-2">
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-2)' }}>
              Local Proxy URL
            </label>
            <p style={{ fontSize: 11, color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
              Start with: <code>npx claude-max-api-proxy</code>
            </p>

            <input
              type="text"
              value={proxyUrl}
              onChange={e => setProxyUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
              placeholder="http://127.0.0.1:3456"
              style={{
                background:   'var(--color-surface)',
                border:       '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                padding:      '8px 12px',
                fontSize:     13,
                fontFamily:   'var(--font-mono)',
                color:        'var(--color-text)',
                outline:      'none',
                width:        '100%',
                boxSizing:    'border-box',
              }}
            />

            <div className="flex items-center gap-3 mt-1">
              <button
                onClick={handleSave}
                style={{
                  background:   saveStatus === 'saved' ? 'var(--color-success-light)' : 'var(--color-accent)',
                  color:        saveStatus === 'saved' ? 'var(--color-success)' : '#fff',
                  border:       'none',
                  borderRadius: 'var(--radius-sm)',
                  padding:      '6px 16px',
                  fontSize:     12,
                  fontWeight:   600,
                  cursor:       'pointer',
                  transition:   'all 0.15s',
                }}
              >
                {saveStatus === 'saved' ? 'Saved ✓' : 'Save'}
              </button>

              {/* Proxy status indicator */}
              <span
                style={{
                  fontSize:   11,
                  fontFamily: 'var(--font-mono)',
                  color: proxyStatus === 'online'
                    ? 'var(--color-success)'
                    : proxyStatus === 'offline'
                    ? 'var(--color-error, #ef4444)'
                    : 'var(--color-text-4)',
                }}
              >
                {proxyStatus === 'online'  && '● Connected'}
                {proxyStatus === 'offline' && '✕ Not reachable'}
                {proxyStatus === 'unknown' && '○ Checking…'}
              </span>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section>
          <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: 'var(--color-error, #ef4444)' }}>
            Danger Zone
          </h2>
          <div style={{ height: 1, background: 'var(--color-border)', marginBottom: 20 }} />

          <div className="flex items-center justify-between">
            <span style={{ fontSize: 13, color: 'var(--color-text-2)' }}>
              Clear all generated code
            </span>
            <button
              onClick={() => {
                if (window.confirm('Clear all generated code? This cannot be undone.')) {
                  // Clearing IDB generatedFiles is done in useSettings if needed
                  // For now, clear localStorage proxy URL too? No — just show warning.
                  window.alert('To clear generated files, use the Clear button in the Code tab.')
                }
              }}
              style={{
                background:   'transparent',
                color:        'var(--color-error, #ef4444)',
                border:       '1px solid var(--color-error, #ef4444)',
                borderRadius: 'var(--radius-sm)',
                padding:      '5px 14px',
                fontSize:     12,
                fontWeight:   600,
                cursor:       'pointer',
              }}
            >
              Clear
            </button>
          </div>
        </section>

      </div>
    </div>
  )
}

export default Settings
