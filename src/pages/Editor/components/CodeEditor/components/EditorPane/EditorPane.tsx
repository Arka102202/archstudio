import React from 'react'
import MonacoEditor from '@monaco-editor/react'
import { useTheme }  from '@hooks/useTheme'
import type { EditorPaneProps } from '../../types'

// ─── EditorPane ───────────────────────────────────────────────────

export function EditorPane({ fileNode, onFileChange }: EditorPaneProps): React.JSX.Element {
  const theme = useTheme()

  if (!fileNode) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center gap-3 select-none"
        style={{ background: '#1e1e1e' }}
      >
        <p
          style={{
            fontSize:   11,
            fontFamily: 'var(--font-mono)',
            color:      '#858585',
          }}
        >
          Select a file from the explorer
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
      <MonacoEditor
        height="100%"
        language={fileNode.language}
        value={fileNode.content}
        theme={theme === 'dark' ? 'vs-dark' : 'vs'}
        onChange={(value) => { onFileChange(fileNode.path, value ?? '') }}
        options={{
          readOnly:             false,
          minimap:              { enabled: true },
          fontSize:             13,
          fontFamily:           "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontLigatures:        true,
          lineNumbers:          'on',
          scrollBeyondLastLine: false,
          renderLineHighlight:  'all',
          bracketPairColorization: { enabled: true },
          folding:              true,
          automaticLayout:      true,
          padding:              { top: 12, bottom: 12 },
          scrollbar: {
            verticalScrollbarSize:   6,
            horizontalScrollbarSize: 6,
          },
        }}
      />
    </div>
  )
}
