import React from 'react'
import type { TabBarProps } from '../../types'

// ─── File icons map (same as ExplorerItem) ────────────────────────

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

// ─── TabBar ───────────────────────────────────────────────────────

export function TabBar({
  openFilePaths,
  activeFilePath,
  fileMap,
  modifiedFiles,
  onTabClick,
  onTabClose,
}: TabBarProps): React.JSX.Element | null {
  if (openFilePaths.length === 0) return null

  return (
    <div
      className="flex items-center overflow-x-auto flex-shrink-0"
      style={{
        background:   'var(--color-surface-alt)',
        borderBottom: '1px solid var(--color-border)',
        minHeight:    35,
      }}
    >
      {openFilePaths.map(path => {
        const file       = fileMap[path]
        const isActive   = path === activeFilePath
        const isModified = modifiedFiles[path] === true
        const icon       = FILE_ICONS[file?.language ?? ''] ?? '📄'
        const parts      = path.split('/')
        const label      = file?.name ?? parts[parts.length - 1] ?? path

        return (
          <div
            key={path}
            className="flex items-center flex-shrink-0 cursor-pointer transition-colors"
            style={{
              padding:     '0 12px',
              gap:         6,
              height:      35,
              borderRight: '1px solid var(--color-border)',
              borderTop:   isActive
                ? '2px solid var(--color-accent)'
                : '2px solid transparent',
              background:  isActive ? 'var(--color-surface)'  : 'transparent',
              color:       isActive ? 'var(--color-text)'     : 'var(--color-text-3)',
            }}
            onClick={() => onTabClick(path)}
          >
            <span style={{ fontSize: 10 }}>{icon}</span>
            <span
              style={{
                fontSize:   11,
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
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
            <button
              style={{
                fontSize:    12,
                color:       'var(--color-text-4)',
                background:  'transparent',
                border:      'none',
                cursor:      'pointer',
                lineHeight:  1,
                marginLeft:  2,
                padding:     '0 2px',
                borderRadius: 2,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--color-text)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--color-text-4)'
              }}
              onClick={e => {
                e.stopPropagation()
                onTabClose(path)
              }}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
