import React from 'react'
import { ReactFlowProvider }     from '@xyflow/react'
import { EditorHeader }          from './components/EditorHeader'
import { LeftSidebar }           from './components/LeftSidebar'
import { RightSidebar }          from './components/RightSidebar'
import { Canvas }                from './components/Canvas'
import { CodeEditor }            from './components/CodeEditor'
import { RelationshipModal, GenerationProgressModal, RegenerateModal } from '@components/shared'
import { useCodeEditorStore }    from '@store'
import { useEditor }             from './useEditor'
import { CodeChat }              from './components/CodeChat'

// ─── Editor ──────────────────────────────────────────────────────
const Editor = (): React.JSX.Element => {
  const {
    project,
    isLoading,
    activeTab,
    hasGeneratedFiles,
    msNodes,
    activeMsId,
    handleBack,
    handleRename,
    setActiveTab,
    handleDownloadZip,
    handleClearFiles,
  } = useEditor()

  if (isLoading || !project) {
    return (
      <div className="h-full flex items-center justify-center text-text-3 text-[13px]">
        Loading…
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <div
        className="flex flex-col h-full"
        style={{ background: 'var(--color-canvas-bg)' }}
      >
        <EditorHeader
          projectName={project.name}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onBack={handleBack}
          onRename={handleRename}
        />

        {/* Code tab toolbar — MS selector + Download ZIP */}
        {activeTab === 'code' && (
          <div
            className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
            style={{
              background:   'var(--color-surface)',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            {/* MS selector */}
            <div className="flex items-center gap-2">
              <span
                style={{
                  fontSize:      9,
                  fontFamily:    'var(--font-mono)',
                  color:         'var(--color-text-4)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                Microservice
              </span>
              <select
                value={activeMsId ?? ''}
                onChange={e => useCodeEditorStore.getState().setActiveMsId(e.target.value || null)}
                style={{
                  fontSize:     11,
                  fontFamily:   'var(--font-mono)',
                  color:        'var(--color-text)',
                  background:   'var(--color-surface-alt)',
                  border:       '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding:      '4px 8px',
                  outline:      'none',
                  cursor:       'pointer',
                }}
              >
                {msNodes.length === 0 && (
                  <option value="">No microservices</option>
                )}
                {msNodes.map(n => (
                  <option key={n.id} value={n.id}>
                    {n.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Clear files */}
            {hasGeneratedFiles && (
              <button
                onClick={() => { void handleClearFiles() }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-sm)] cursor-pointer transition-colors border-none"
                style={{
                  fontSize:   11,
                  fontWeight: 600,
                  background: 'var(--color-danger-light)',
                  color:      'var(--color-danger)',
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14H6L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4h6v2"/>
                </svg>
                Clear files
              </button>
            )}

            {/* Download ZIP */}
            {hasGeneratedFiles && (
              <button
                onClick={() => { void handleDownloadZip() }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-sm)] cursor-pointer transition-colors border-none"
                style={{
                  fontSize:   11,
                  fontWeight: 600,
                  background: 'var(--color-success-light, #d1fae5)',
                  color:      'var(--color-success, #10b981)',
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download ZIP
              </button>
            )}
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {activeTab === 'canvas' && <LeftSidebar />}

          <main className="flex-1 relative overflow-hidden">
            {/* Canvas — always mounted, hidden when not active */}
            <div
              style={{
                position: 'absolute',
                inset:    0,
                display:  activeTab === 'canvas' ? 'block' : 'none',
              }}
            >
              <Canvas projectId={project.id} />
            </div>

            {/* Code tab — always mounted, hidden when not active */}
            <div
              style={{
                position:  'absolute',
                inset:     0,
                display:   activeTab === 'code' ? 'flex' : 'none',
                flexDirection: 'row',
                overflow:  'hidden',
              }}
            >
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <CodeEditor projectId={project.id} />
              </div>
              <CodeChat projectId={project.id} />
            </div>

            {/* Preview tab placeholder */}
            {activeTab === 'preview' && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ color: 'var(--color-text-3)', fontSize: 13 }}
              >
                Preview coming soon
              </div>
            )}
          </main>

          {activeTab === 'canvas' && <RightSidebar />}
        </div>
      </div>

      <RelationshipModal />
      <GenerationProgressModal />
      <RegenerateModal />
    </ReactFlowProvider>
  )
}

export default Editor
