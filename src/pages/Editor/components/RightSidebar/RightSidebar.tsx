import React from 'react'
import { useCanvasStore, useProjectStore } from '@store'
import { InspectorPanel } from '../InspectorPanel'
import { ChatPanel } from '../ChatPanel'
import { useRightSidebar } from './useRightSidebar'

// ─── ResizeHandle — left edge ─────────────────────────────────────
const ResizeHandle = ({
  onMouseDown,
}: {
  onMouseDown: (e: React.MouseEvent) => void
}): React.JSX.Element => (
  <div
    onMouseDown={onMouseDown}
    className="absolute top-0 -left-[3px] w-[6px] h-full cursor-col-resize z-10 flex items-center justify-center right-resize-handle"
  >
    <style>{`
      .right-resize-handle:hover .right-resize-bar { opacity: 1 !important; }
    `}</style>
    <div
      className="right-resize-bar w-[2px] h-8 bg-border-strong rounded-[2px] opacity-0 transition-opacity duration-150"
    />
  </div>
)

// ─── RightSidebar ─────────────────────────────────────────────────
const RightSidebar = (): React.JSX.Element => {
  const { width, handleResizeStart } = useRightSidebar()
  const selectedNodeId               = useCanvasStore(s => s.selectedNodeId)
  const rightPanelTab                = useCanvasStore(s => s.rightPanelTab)
  const setRightPanelTab             = useCanvasStore(s => s.setRightPanelTab)
  const projectId                    = useProjectStore(s => s.activeProjectId)
  const isOpen                       = selectedNodeId !== null || rightPanelTab === 'chat'

  return (
    <div
      className="relative shrink-0 transition-[width] duration-200"
      style={{ width: isOpen ? width : 0, overflow: isOpen ? 'visible' : 'hidden' }}
    >
      {isOpen && <ResizeHandle onMouseDown={handleResizeStart} />}
      <aside
        className="w-full h-full bg-surface border-l border-border flex flex-col overflow-hidden"
      >
        <div style={{
          display: 'flex',
          padding: '8px 10px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
          gap: 2,
        }}>
          {(['inspector', 'chat'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setRightPanelTab(tab)}
              style={{
                flex: 1,
                padding: '4px 0',
                fontSize: 11,
                fontWeight: 500,
                fontFamily: 'var(--font-ui)',
                background: rightPanelTab === tab ? 'var(--color-surface-alt)' : 'transparent',
                color: rightPanelTab === tab ? 'var(--color-text)' : 'var(--color-text-3)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {tab === 'inspector' ? 'Inspector' : 'Chat'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'hidden', display: rightPanelTab === 'inspector' ? 'block' : 'none' }}>
          <InspectorPanel />
        </div>

        {projectId && (
          <div style={{
            flex: 1,
            overflow: 'hidden',
            display: rightPanelTab === 'chat' ? 'flex' : 'none',
            flexDirection: 'column',
          }}>
            <ChatPanel projectId={projectId} />
          </div>
        )}
      </aside>
    </div>
  )
}

export default RightSidebar
