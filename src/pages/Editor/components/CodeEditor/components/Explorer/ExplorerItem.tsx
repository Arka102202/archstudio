import React from 'react'
import type { ExplorerItemProps } from '../../types'

// ─── File icons ───────────────────────────────────────────────────

const FILE_ICONS: Record<string, string> = {
  java:       '☕',
  yaml:       '⚙',
  yml:        '⚙',
  xml:        '📄',
  properties: '⚙',
  gradle:     '🐘',
  dockerfile: '🐳',
  md:         '📝',
  json:       '📋',
  sql:        '🗄',
  kotlin:     '🟣',
}

function getFileIcon(language: string): string {
  return FILE_ICONS[language] ?? '📄'
}

// ─── ExplorerItem ─────────────────────────────────────────────────

export function ExplorerItem({
  node,
  depth,
  activeFilePath,
  collapsedFolders,
  modifiedFiles,
  onFileClick,
  onFolderToggle,
}: ExplorerItemProps): React.JSX.Element {
  const isCollapsed = collapsedFolders[node.path] ?? false
  const isActive    = node.path === activeFilePath
  const isModified  = node.type === 'file' && modifiedFiles[node.path] === true
  const paddingLeft = 8 + depth * 12

  if (node.type === 'folder') {
    return (
      <div>
        <div
          className="flex items-center gap-1 py-[3px] cursor-pointer select-none
                     transition-colors"
          style={{
            paddingLeft,
            paddingRight: 8,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--color-surface-alt)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = ''
          }}
          onClick={() => onFolderToggle(node.path)}
        >
          <span
            style={{
              fontSize:   9,
              color:      'var(--color-text-4)',
              width:      12,
              flexShrink: 0,
              textAlign:  'center',
              lineHeight: 1,
            }}
          >
            {isCollapsed ? '▶' : '▼'}
          </span>
          <span
            style={{
              fontSize:     11,
              fontFamily:   'var(--font-mono)',
              color:        'var(--color-text-2)',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}
          >
            {node.name}
          </span>
        </div>
        {!isCollapsed && node.children.map(child => (
          <ExplorerItem
            key={child.path}
            node={child}
            depth={depth + 1}
            activeFilePath={activeFilePath}
            collapsedFolders={collapsedFolders}
            modifiedFiles={modifiedFiles}
            onFileClick={onFileClick}
            onFolderToggle={onFolderToggle}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className="flex items-center cursor-pointer select-none transition-colors"
      style={{
        paddingLeft,
        paddingRight: 8,
        paddingTop:   3,
        paddingBottom: 3,
        gap:          6,
        background:   isActive ? 'var(--color-accent-light)' : undefined,
        color:        isActive ? 'var(--color-accent)'       : undefined,
      }}
      onMouseEnter={e => {
        if (!isActive) e.currentTarget.style.background = 'var(--color-surface-alt)'
      }}
      onMouseLeave={e => {
        if (!isActive) e.currentTarget.style.background = ''
      }}
      onClick={() => onFileClick(node.path)}
    >
      <span
        style={{
          fontSize:   11,
          width:      16,
          textAlign:  'center',
          flexShrink: 0,
        }}
      >
        {getFileIcon(node.language)}
      </span>
      <span
        style={{
          fontSize:     11,
          fontFamily:   'var(--font-mono)',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
          flex:         1,
        }}
      >
        {node.name}
      </span>
      {isModified && (
        <span
          style={{
            width:        6,
            height:       6,
            borderRadius: '50%',
            flexShrink:   0,
            background:   'var(--color-accent)',
            display:      'inline-block',
          }}
        />
      )}
    </div>
  )
}
