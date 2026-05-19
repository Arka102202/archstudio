import React from 'react'
import { useCodeEditor }    from './useCodeEditor'
import { Explorer }         from './components/Explorer'
import { TabBar }           from './components/TabBar'
import { EditorPane }       from './components/EditorPane'
import type { CodeEditorProps } from './types'

// ─── CodeEditor ───────────────────────────────────────────────────

export function CodeEditor({ projectId }: CodeEditorProps): React.JSX.Element {
  const editor = useCodeEditor(projectId)

  if (!editor.tree) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ background: 'var(--color-surface)' }}
      >
        <p
          style={{
            fontSize:   11,
            fontFamily: 'var(--font-mono)',
            color:      'var(--color-text-4)',
          }}
        >
          Select a microservice to view its files
        </p>
      </div>
    )
  }

  return (
    <div
      className="flex h-full w-full overflow-hidden"
      style={{ background: 'var(--color-surface)' }}
    >
      {/* Explorer panel */}
      <div
        className="flex-shrink-0 h-full overflow-hidden"
        style={{
          width:       editor.explorerWidth,
          borderRight: '1px solid var(--color-border)',
        }}
      >
        <Explorer
          tree={editor.tree}
          activeFilePath={editor.activeFilePath}
          collapsedFolders={editor.collapsedFolders}
          modifiedFiles={editor.modifiedFiles}
          onFileClick={editor.openFile}
          onFolderToggle={editor.toggleFolder}
        />
      </div>

      {/* Resize handle */}
      <div
        style={{
          width:      4,
          flexShrink: 0,
          cursor:     'col-resize',
          background: 'var(--color-border)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--color-accent)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'var(--color-border)'
        }}
        onMouseDown={editor.handleResizeStart}
      />

      {/* Editor area */}
      <div
        className="flex flex-col h-full overflow-hidden"
        style={{ flex: 1, minWidth: 0 }}
      >
        <TabBar
          openFilePaths={editor.openFilePaths}
          activeFilePath={editor.activeFilePath}
          fileMap={editor.fileMap}
          modifiedFiles={editor.modifiedFiles}
          onTabClick={editor.setActiveFile}
          onTabClose={editor.closeFile}
        />
        <EditorPane fileNode={editor.activeFileNode} onFileChange={editor.onFileChange} />
      </div>
    </div>
  )
}
