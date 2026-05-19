import React from 'react'
import { ExplorerItem } from './ExplorerItem'
import type { ExplorerProps } from '../../types'

// ─── Explorer ─────────────────────────────────────────────────────

export function Explorer({
  tree,
  activeFilePath,
  collapsedFolders,
  modifiedFiles,
  onFileClick,
  onFolderToggle,
}: ExplorerProps): React.JSX.Element {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div
        className="flex-shrink-0"
        style={{
          padding:      '8px 12px',
          fontSize:     9,
          fontFamily:   'var(--font-mono)',
          fontWeight:   700,
          color:        'var(--color-text-4)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        EXPLORER
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        <ExplorerItem
          node={tree}
          depth={0}
          activeFilePath={activeFilePath}
          collapsedFolders={collapsedFolders}
          modifiedFiles={modifiedFiles}
          onFileClick={onFileClick}
          onFolderToggle={onFolderToggle}
        />
      </div>
    </div>
  )
}
