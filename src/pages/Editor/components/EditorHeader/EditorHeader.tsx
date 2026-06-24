import React from 'react'
import { ThemeToggle } from '@components/shared'
import { MESSAGES } from '@constants/messages'
import { useEditorHeader } from './useEditorHeader'
import type { EditorHeaderProps } from './types'
import type { ActiveTab } from '@pages/Editor/types'

const TABS: { id: ActiveTab; label: string }[] = [
  { id: 'canvas',  label: MESSAGES.editor.tabCanvas  },
  { id: 'code',    label: MESSAGES.editor.tabCode    },
  { id: 'preview', label: MESSAGES.editor.tabPreview },
]

const EditorHeader = ({
  projectName,
  activeTab,
  onTabChange,
  onBack,
  onRename,
}: EditorHeaderProps): React.JSX.Element => {
  const {
    isEditing,
    editValue,
    inputRef,
    startEdit,
    commitEdit,
    handleEditKeyDown,
    setEditValue,
    handleCloneFromExample,
  } = useEditorHeader({ projectName, onRename })

  return (
    <header className="h-12 flex items-center justify-between px-3 bg-surface border-b border-border shrink-0 gap-3">
      {/* Left: back + breadcrumb */}
      <div className="flex items-center gap-2 min-w-0 shrink-0">
        <button
          onClick={onBack}
          aria-label="Back to project list"
          className="w-7 h-7 flex items-center justify-center bg-transparent border border-border rounded-sm cursor-pointer text-sm text-text-2"
        >
          {MESSAGES.editor.backButton}
        </button>

        <span className="text-text-4 text-[13px]">
          {MESSAGES.editor.breadcrumbSeparator}
        </span>

        {isEditing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={handleEditKeyDown}
            onBlur={commitEdit}
            className="text-[13px] font-semibold text-text bg-surface border border-border-focus rounded-sm px-2 py-[2px] outline-none min-w-[120px]"
            style={{ boxShadow: '0 0 0 3px var(--color-accent-mid)' }}
          />
        ) : (
          <span
            onClick={startEdit}
            title="Click to rename"
            className="text-[13px] font-semibold text-text cursor-text px-1 py-[2px] rounded-[4px] whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]"
          >
            {projectName}
          </span>
        )}
      </div>

      {/* Center: tabs */}
      <div className="flex items-center bg-surface-alt rounded-sm p-[3px] gap-[2px] shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={[
              'px-3.5 py-1 text-xs font-medium rounded-sm border-none cursor-pointer',
              'transition-[background,color] duration-150',
              activeTab === tab.id
                ? 'bg-surface text-text'
                : 'bg-transparent text-text-3',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Right: theme toggle + new-from-example + export */}
      <div className="flex items-center gap-2 shrink-0">
        <ThemeToggle />
        <button
          onClick={() => { void handleCloneFromExample() }}
          title="Create a new microservice from the built-in example template"
          className="flex items-center gap-1.5 px-3 py-[5px] border-none rounded-sm text-xs font-semibold cursor-pointer transition-colors"
          style={{
            background: 'var(--color-surface-alt)',
            color:      'var(--color-text-2)',
            border:     '1px solid var(--color-border)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--color-accent-light)'
            e.currentTarget.style.color      = 'var(--color-accent)'
            e.currentTarget.style.borderColor = 'var(--color-accent)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background  = 'var(--color-surface-alt)'
            e.currentTarget.style.color       = 'var(--color-text-2)'
            e.currentTarget.style.borderColor = 'var(--color-border)'
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          New from Example
        </button>
        <button
          onClick={() => alert('Export coming in Phase 2.')}
          className="px-3.5 py-[5px] bg-accent text-accent-text border-none rounded-sm text-xs font-semibold cursor-pointer"
        >
          {MESSAGES.editor.exportButton}
        </button>
      </div>
    </header>
  )
}

export default EditorHeader
