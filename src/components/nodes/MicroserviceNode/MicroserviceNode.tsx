import React from 'react'
import { NodeResizer, Handle, Position } from '@xyflow/react'
import { useMicroserviceNode } from './useMicroserviceNode'
import type { MicroserviceNodeProps } from './types'

// ─── MicroserviceNode ─────────────────────────────────────────────

const MicroserviceNode = ({ id, data }: MicroserviceNodeProps): React.JSX.Element => {
  const {
    node,
    isSelected,
    hasChildren,
    colorScheme,
    isGenerating,
    hasGeneratedFiles,
    handleClick,
    handleExport,
    handleSaveVersion,
    handleDiff,
    handleGenerate,
    handleContinue,
  } = useMicroserviceNode(id, data)

  const depCount = node.build.extraDependencies.length
  const dockerLabel = node.docker.generateDockerfile ? 'Docker' : 'No Docker'
  const dockerDotColor = node.docker.generateDockerfile
    ? 'var(--dot-docker-on)'
    : 'var(--dot-docker-off)'

  return (
    <div
      onClick={handleClick}
      style={{
        position:       'relative',
        background:     'var(--color-surface)',
        borderRadius:   'var(--radius-lg)',
        border:         isSelected
          ? `1.5px solid ${colorScheme.border}`
          : '1px solid var(--color-canvas-node-border)',
        boxShadow:      isSelected ? `0 0 0 2px ${colorScheme.border}` : 'none',
        overflow:       'visible',
        width:          '100%',
        height:         '100%',
        minWidth:       480,
        minHeight:      300,
        display:        'flex',
        flexDirection:  'column',
        userSelect:     'none',
      }}
    >
      {/* ── CONNECTION HANDLES — all four sides ─────────────────── */}
      <Handle type="source" position={Position.Top}    id="top"    />
      <Handle type="source" position={Position.Right}  id="right"  />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left}   id="left"   />

      {/* NodeResizer — must be first child */}
      <NodeResizer
        minWidth={480}
        minHeight={300}
        isVisible={isSelected}
        lineStyle={{ border: `1px solid ${colorScheme.border}40` }}
        handleStyle={{
          background: colorScheme.border,
          border:     'none',
          width:      6,
          height:     6,
        }}
      />

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div
        className="ms-drag-handle flex items-center gap-3"
        style={{
          padding:       '12px 16px',
          borderBottom:  '1px solid var(--color-border)',
          cursor:        'grab',
        }}
      >
        {/* MS icon square */}
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width:        32,
            height:       32,
            borderRadius: 9,
            background:   colorScheme.iconBg,
            color:        colorScheme.iconFg,
            fontFamily:   'var(--font-mono)',
            fontSize:     10,
            fontWeight:   700,
          }}
        >
          MS
        </div>

        {/* Title block */}
        <div className="flex-1 min-w-0">
          <p
            className="truncate"
            style={{
              fontSize:   13,
              fontWeight: 700,
              color:      'var(--color-text)',
              lineHeight: '18px',
              fontFamily: 'var(--font-ui)',
            }}
          >
            {node.label}
          </p>
          <p
            className="truncate"
            style={{
              fontSize:   10,
              color:      'var(--color-text-3)',
              fontFamily: 'var(--font-mono)',
              lineHeight: '15px',
              marginTop:  1,
            }}
          >
            {node.serviceName} · {node.packageName}
          </p>
        </div>

        {/* Export button */}
        <button
          onClick={handleExport}
          title="Export architecture"
          className="flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)] cursor-pointer transition-all duration-150 border-none"
          style={{
            background: 'var(--color-surface-alt)',
            color:      'var(--color-text-3)',
            fontSize:   9,
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--color-accent-light)'
            e.currentTarget.style.color      = 'var(--color-accent)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--color-surface-alt)'
            e.currentTarget.style.color      = 'var(--color-text-3)'
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Export
        </button>

        {/* Save Version button */}
        <button
          onClick={handleSaveVersion}
          title="Save architecture version"
          className="flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)] cursor-pointer transition-all duration-150 border-none"
          style={{
            background: 'var(--color-surface-alt)',
            color:      'var(--color-text-3)',
            fontSize:   9,
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--color-accent-light)'
            e.currentTarget.style.color      = 'var(--color-accent)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--color-surface-alt)'
            e.currentTarget.style.color      = 'var(--color-text-3)'
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          Save Version
        </button>

        {/* Diff button */}
        <button
          onClick={handleDiff}
          title="Diff against latest saved version"
          className="flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)] cursor-pointer transition-all duration-150 border-none"
          style={{
            background: 'var(--color-surface-alt)',
            color:      'var(--color-text-3)',
            fontSize:   9,
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--color-accent-light)'
            e.currentTarget.style.color      = 'var(--color-accent)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--color-surface-alt)'
            e.currentTarget.style.color      = 'var(--color-text-3)'
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
            <polyline points="12 5 5 12 12 19" transform="translate(0,0)" opacity="0.5"/>
          </svg>
          Diff
        </button>

        {/* Generate button */}
        <button
          onClick={e => { void handleGenerate(e) }}
          disabled={isGenerating}
          title="Generate Spring Boot code"
          className="flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)] cursor-pointer transition-all duration-150 border-none"
          style={{
            background: isGenerating ? 'var(--color-accent-light)' : colorScheme.iconBg,
            color:      isGenerating ? 'var(--color-accent)'       : colorScheme.iconFg,
            fontSize:   9,
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            opacity:    isGenerating ? 0.7 : 1,
            cursor:     isGenerating ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={e => {
            if (!isGenerating) {
              e.currentTarget.style.background = 'var(--color-accent-light)'
              e.currentTarget.style.color      = 'var(--color-accent)'
            }
          }}
          onMouseLeave={e => {
            if (!isGenerating) {
              e.currentTarget.style.background = colorScheme.iconBg
              e.currentTarget.style.color      = colorScheme.iconFg
            }
          }}
        >
          {isGenerating ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                 className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          )}
          {isGenerating ? 'Generating…' : 'Generate'}
        </button>

        {/* Continue button */}
        <button
          onClick={e => { void handleContinue(e) }}
          disabled={isGenerating || !hasGeneratedFiles}
          title={!hasGeneratedFiles
            ? 'Generate code first'
            : 'Continue incomplete generation'}
          className="flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)]
                     cursor-pointer transition-all duration-150 border-none
                     disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: 'var(--color-warning-light)',
            color:      'var(--color-warning)',
            fontSize:   9,
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
               strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 .49-3.57"/>
          </svg>
          Continue
        </button>

        {/* Badges */}
        <div className="flex items-center shrink-0" style={{ gap: 5 }}>
          {/* Spring Boot badge */}
          <span
            style={{
              background:   colorScheme.badgeBg,
              border:       `1px solid ${colorScheme.badgeBorder}`,
              color:        colorScheme.badgeText,
              fontFamily:   'var(--font-mono)',
              fontSize:     9,
              padding:      '2px 6px',
              borderRadius: 'var(--radius-sm)',
              whiteSpace:   'nowrap',
            }}
          >
            Spring Boot {node.build.springBootVersion}
          </span>
          {/* Port badge */}
          <span
            style={{
              background:   'var(--color-surface-alt)',
              border:       '1px solid var(--color-border)',
              color:        'var(--color-text-3)',
              fontFamily:   'var(--font-mono)',
              fontSize:     9,
              padding:      '2px 6px',
              borderRadius: 'var(--radius-sm)',
              whiteSpace:   'nowrap',
            }}
          >
            :{node.port}
          </span>
        </div>
      </div>

      {/* ── INFO STRIP ──────────────────────────────────────────── */}
      <div
        className="flex items-center"
        style={{
          background:   'var(--color-surface-alt)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        {/* Java version */}
        <div
          className="flex items-center gap-1.5"
          style={{
            padding:      '7px 14px',
            borderRight:  '1px solid var(--color-border)',
          }}
        >
          <div style={{ width: 4, height: 4, borderRadius: 9999, background: 'var(--dot-java)', flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-3)' }}>
            Java {node.build.javaVersion}
          </span>
        </div>

        {/* Build tool */}
        <div
          className="flex items-center gap-1.5"
          style={{
            padding:     '7px 14px',
            borderRight: '1px solid var(--color-border)',
          }}
        >
          <div style={{ width: 4, height: 4, borderRadius: 9999, background: 'var(--dot-build)', flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-3)' }}>
            {node.build.tool}
          </span>
        </div>

        {/* Docker */}
        <div
          className="flex items-center gap-1.5"
          style={{
            padding:     '7px 14px',
            borderRight: '1px solid var(--color-border)',
          }}
        >
          <div style={{ width: 4, height: 4, borderRadius: 9999, background: dockerDotColor, flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-3)' }}>
            {dockerLabel}
          </span>
        </div>

        {/* Dep count — right-aligned */}
        <div
          className="flex items-center"
          style={{ padding: '7px 14px', marginLeft: 'auto' }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-3)' }}>
            {depCount} dep{depCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── BODY / DROP ZONE ────────────────────────────────────── */}
      <div
        style={{
          position:  'relative',
          flex:      1,
          minHeight: 200,
        }}
      >
        {/* Empty state hint — only when no children, pointer-events none */}
        {!hasChildren && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ pointerEvents: 'none' }}
          >
            <div
              className="flex flex-col items-center justify-center gap-2"
              style={{
                margin:       16,
                border:       '1.5px dashed var(--color-canvas-drop-hint-border)',
                borderRadius: 'var(--radius-md)',
                padding:      24,
                width:        'calc(100% - 32px)',
                height:       'calc(100% - 32px)',
                boxSizing:    'border-box',
              }}
            >
              <div
                className="flex items-center justify-center"
                style={{
                  width:        32,
                  height:       32,
                  borderRadius: 9999,
                  background:   'var(--color-canvas-drop-hint-icon-bg)',
                  color:        'var(--color-text-4)',
                  fontSize:     18,
                  fontWeight:   300,
                  lineHeight:   1,
                }}
              >
                +
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize:   11,
                  color:      'var(--color-text-4)',
                  textAlign:  'center',
                }}
              >
                Right-click to add nodes
              </span>
              <span
                style={{
                  fontSize:  9,
                  color:     'var(--color-text-4)',
                  textAlign: 'center',
                }}
              >
                Entity · DTO · Service · Controller
              </span>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}

export default MicroserviceNode
