# Code Editor (Simple) — Monaco Editor with Syntax Highlighting

> Claude Code: this REPLACES CODE_EDITOR_VSCODE.md and CODE_EDITOR.md entirely.
> No @codingame packages. No workbench. No Vite config changes.
> Uses only @monaco-editor/react which works cleanly with the existing package.json.

---

## 1. What This Builds

A clean file viewer in the "Code" tab with:
- Left panel: file explorer (collapsible folders, language icons)
- Right panel: Monaco Editor with full syntax highlighting
- MS node dropdown to switch between microservices
- Theme follows app dark/light toggle
- Read-only by default (editable in future)
- Open files in tabs, close with ×

No new Vite configuration needed. No extra dependencies except one.

---

## 2. Install

```bash
npm install @monaco-editor/react
```

That is the only new dependency. Nothing else changes in `package.json`.

---

## 3. File Structure

```
src/pages/Editor/components/CodeEditor/
├── CodeEditor.tsx              ← root layout
├── useCodeEditor.ts            ← state + file tree logic
├── types.ts
├── index.ts
└── components/
    ├── Explorer/
    │   ├── Explorer.tsx        ← file tree panel
    │   ├── ExplorerItem.tsx    ← recursive folder/file row
    │   └── index.ts
    ├── TabBar/
    │   ├── TabBar.tsx          ← open file tabs
    │   └── index.ts
    └── EditorPane/
        ├── EditorPane.tsx      ← Monaco wrapper
        └── index.ts
```

---

## 4. `codeEditorStore.ts`

```typescript
import { create } from 'zustand'
import type { FileProgressItem } from './types'

export interface CodeEditorStore {
  // MS selection
  activeMsId:    string | null
  setActiveMsId: (id: string | null) => void

  // Open tabs
  openFilePaths:  string[]
  activeFilePath: string | null
  openFile:       (path: string) => void
  closeFile:      (path: string) => void
  setActiveFile:  (path: string) => void

  // Explorer
  collapsedFolders: Record<string, boolean>
  explorerWidth:    number
  toggleFolder:     (path: string) => void
  setExplorerWidth: (w: number) => void

  // Generated files (in-memory + loaded from IDB)
  generatedFiles:   Record<string, string>
  setGeneratedFile: (path: string, content: string) => void
  clearGeneratedFiles: () => void

  // Generation state
  isGenerating:    boolean
  generatingMsId:  string | null
  setGenerating:   (msId: string | null) => void

  // Progress
  fileProgress:       FileProgressItem[]
  setFileProgress:    (items: FileProgressItem[]) => void
  updateFileProgress: (path: string, patch: Partial<FileProgressItem>) => void
  appendFileChunk:    (path: string, chunk: string) => void
}

export const useCodeEditorStore = create<CodeEditorStore>((set, get) => ({
  activeMsId:    null,
  setActiveMsId: id => set({ activeMsId: id }),

  openFilePaths:  [],
  activeFilePath: null,
  openFile: path => {
    const { openFilePaths } = get()
    if (!openFilePaths.includes(path)) {
      set({ openFilePaths: [...openFilePaths, path], activeFilePath: path })
    } else {
      set({ activeFilePath: path })
    }
  },
  closeFile: path => {
    const { openFilePaths, activeFilePath } = get()
    const idx     = openFilePaths.indexOf(path)
    const updated = openFilePaths.filter(p => p !== path)
    let active    = activeFilePath
    if (activeFilePath === path) {
      active = updated[Math.min(idx, updated.length - 1)] ?? null
    }
    set({ openFilePaths: updated, activeFilePath: active })
  },
  setActiveFile: path => set({ activeFilePath: path }),

  collapsedFolders: {},
  explorerWidth:    240,
  toggleFolder: path => set(s => ({
    collapsedFolders: { ...s.collapsedFolders, [path]: !s.collapsedFolders[path] }
  })),
  setExplorerWidth: w => set({ explorerWidth: w }),

  generatedFiles:   {},
  setGeneratedFile: (path, content) => set(s => ({
    generatedFiles: { ...s.generatedFiles, [path]: content }
  })),
  clearGeneratedFiles: () => set({ generatedFiles: {} }),

  isGenerating:    false,
  generatingMsId:  null,
  setGenerating:   msId => set({ isGenerating: !!msId, generatingMsId: msId }),

  fileProgress:    [],
  setFileProgress: items => set({ fileProgress: items }),
  updateFileProgress: (path, patch) => set(s => {
    const existing = s.fileProgress.find(i => i.path === path)
    if (existing) {
      return { fileProgress: s.fileProgress.map(i => i.path === path ? { ...i, ...patch } : i) }
    }
    return { fileProgress: [...s.fileProgress, { path, fileName: path.split('/').at(-1)!,
      category: 'other', status: 'waiting', liveLines: [], changeType: 'full', ...patch }] }
  }),
  appendFileChunk: (path, chunk) => set(s => ({
    generatedFiles: {
      ...s.generatedFiles,
      [path]: (s.generatedFiles[path] ?? '') + chunk,
    }
  })),
}))
```

Export from `src/store/index.ts`.

---

## 5. `useCodeEditor.ts`

```typescript
import { useMemo, useEffect, useCallback, useRef } from 'react'
import { useNodes }              from '@xyflow/react'
import { useCodeEditorStore }    from '@store'
import { exportArchitecture }    from '@utils/exportArchitecture'
import { buildFileTree }         from '@utils/buildFileTree'
import { db }                    from '@db'
import type { FileNode, ArchitectureExport } from './types'

export function useCodeEditor(projectId: string) {
  const store        = useCodeEditorStore()
  const rfNodes      = useNodes()
  const [tree, setTree] = useState<FileNode | null>(null)

  // Build file tree when activeMsId changes
  useEffect(() => {
    if (!store.activeMsId || !projectId) return
    exportArchitecture(store.activeMsId, projectId).then(arch => {
      setTree(buildFileTree(arch as ArchitectureExport))
    })
  }, [store.activeMsId, projectId])

  // Load generated files from IDB when activeMsId changes
  useEffect(() => {
    if (!store.activeMsId) return
    store.clearGeneratedFiles()
    db.generatedFiles
      .where('msId').equals(store.activeMsId)
      .toArray()
      .then(rows => rows.forEach(row => store.setGeneratedFile(row.filePath, row.content)))
  }, [store.activeMsId])

  // Build flat file map for O(1) content lookup
  const fileMap = useMemo(() => {
    if (!tree) return {}
    const map: Record<string, FileNode> = {}
    const walk = (node: FileNode) => {
      if (node.type === 'file') {
        map[node.path] = {
          ...node,
          content: store.generatedFiles[node.path] ?? node.content,
        }
      }
      node.children.forEach(walk)
    }
    walk(tree)
    return map
  }, [tree, store.generatedFiles])

  const activeFileNode = store.activeFilePath
    ? fileMap[store.activeFilePath] ?? null
    : null

  // Resizable explorer
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX     = e.clientX
    const startWidth = store.explorerWidth
    const onMove = (ev: MouseEvent) => {
      const w = Math.min(500, Math.max(160, startWidth + ev.clientX - startX))
      store.setExplorerWidth(w)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [store])

  return {
    tree,
    fileMap,
    activeFileNode,
    openFilePaths:    store.openFilePaths,
    activeFilePath:   store.activeFilePath,
    collapsedFolders: store.collapsedFolders,
    explorerWidth:    store.explorerWidth,
    openFile:         store.openFile,
    closeFile:        store.closeFile,
    setActiveFile:    store.setActiveFile,
    toggleFolder:     store.toggleFolder,
    handleResizeStart,
  }
}
```

---

## 6. `CodeEditor.tsx` — Root Layout

```tsx
import { useCodeEditor }  from './useCodeEditor'
import { Explorer }       from './components/Explorer'
import { TabBar }         from './components/TabBar'
import { EditorPane }     from './components/EditorPane'

export function CodeEditor({ projectId }: { projectId: string }) {
  const editor = useCodeEditor(projectId)

  if (!editor.tree) {
    return (
      <div className="flex-1 flex items-center justify-center"
           style={{ background: 'var(--color-surface)' }}>
        <p className="text-[11px] font-mono text-text-4">
          Select a microservice to view its files
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full overflow-hidden"
         style={{ background: 'var(--color-surface)' }}>

      {/* Explorer panel */}
      <div
        className="flex-shrink-0 h-full overflow-hidden border-r border-[var(--color-border)]"
        style={{ width: editor.explorerWidth }}
      >
        <Explorer
          tree={editor.tree}
          activeFilePath={editor.activeFilePath}
          collapsedFolders={editor.collapsedFolders}
          onFileClick={editor.openFile}
          onFolderToggle={editor.toggleFolder}
        />
      </div>

      {/* Resize handle */}
      <div
        className="w-[4px] flex-shrink-0 cursor-col-resize transition-colors"
        style={{ background: 'var(--color-border)' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-accent)'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--color-border)'}
        onMouseDown={editor.handleResizeStart}
      />

      {/* Editor area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        <TabBar
          openFilePaths={editor.openFilePaths}
          activeFilePath={editor.activeFilePath}
          fileMap={editor.fileMap}
          onTabClick={editor.setActiveFile}
          onTabClose={editor.closeFile}
        />
        <EditorPane
          fileNode={editor.activeFileNode}
        />
      </div>
    </div>
  )
}
```

---

## 7. `Explorer.tsx` + `ExplorerItem.tsx`

### Explorer.tsx

```tsx
export function Explorer({ tree, activeFilePath, collapsedFolders, onFileClick, onFolderToggle }) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-3 py-2 text-[9px] font-mono font-bold text-text-3
                      uppercase tracking-wider border-b border-[var(--color-border)]
                      flex-shrink-0">
        EXPLORER
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {tree && (
          <ExplorerItem
            node={tree}
            depth={0}
            activeFilePath={activeFilePath}
            collapsedFolders={collapsedFolders}
            onFileClick={onFileClick}
            onFolderToggle={onFolderToggle}
          />
        )}
      </div>
    </div>
  )
}
```

### ExplorerItem.tsx

```tsx
const FILE_ICONS: Record<string, string> = {
  java:       '☕',
  yaml:       '⚙',
  yml:        '⚙',
  xml:        '📄',
  properties: '⚙',
  gradle:     '🐘',
  dockerfile: '🐳',
  md:         '📝',
}

function getIcon(language: string): string {
  return FILE_ICONS[language] ?? '📄'
}

export function ExplorerItem({ node, depth, activeFilePath, collapsedFolders, onFileClick, onFolderToggle }) {
  const isCollapsed = collapsedFolders[node.path] ?? false
  const isActive    = node.path === activeFilePath
  const paddingLeft = 8 + depth * 12

  if (node.type === 'folder') {
    return (
      <div>
        <div
          className="flex items-center gap-1 py-[3px] cursor-pointer select-none
                     hover:bg-[var(--color-surface-alt)] transition-colors"
          style={{ paddingLeft }}
          onClick={() => onFolderToggle(node.path)}
        >
          <span className="text-[9px] text-text-4 w-3 flex-shrink-0 text-center">
            {isCollapsed ? '▶' : '▼'}
          </span>
          <span className="text-[11px] font-mono text-text-2 truncate">
            {node.name}
          </span>
        </div>
        {!isCollapsed && node.children.map(child => (
          <ExplorerItem key={child.path} node={child} depth={depth + 1}
            activeFilePath={activeFilePath} collapsedFolders={collapsedFolders}
            onFileClick={onFileClick} onFolderToggle={onFolderToggle} />
        ))}
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-1.5 py-[3px] cursor-pointer select-none
                 transition-colors"
      style={{
        paddingLeft,
        background: isActive ? 'var(--color-accent-light)' : undefined,
        color:      isActive ? 'var(--color-accent)'       : undefined,
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--color-surface-alt)' }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = '' }}
      onClick={() => onFileClick(node.path)}
    >
      <span className="text-[11px] w-4 text-center flex-shrink-0">
        {getIcon(node.language)}
      </span>
      <span className="text-[11px] font-mono truncate">
        {node.name}
      </span>
    </div>
  )
}
```

---

## 8. `TabBar.tsx`

```tsx
export function TabBar({ openFilePaths, activeFilePath, fileMap, onTabClick, onTabClose }) {
  if (openFilePaths.length === 0) return null

  return (
    <div className="flex items-center overflow-x-auto flex-shrink-0 border-b border-[var(--color-border)]"
         style={{ background: 'var(--color-surface-alt)', minHeight: 35 }}>
      {openFilePaths.map(path => {
        const file     = fileMap[path]
        const isActive = path === activeFilePath
        return (
          <div
            key={path}
            className="flex items-center gap-1.5 px-3 flex-shrink-0 cursor-pointer
                       border-r border-[var(--color-border)] h-[35px] transition-colors"
            style={{
              background:  isActive ? 'var(--color-surface)'     : 'transparent',
              borderTop:   isActive ? `2px solid var(--color-accent)` : '2px solid transparent',
              color:       isActive ? 'var(--color-text)'         : 'var(--color-text-3)',
            }}
            onClick={() => onTabClick(path)}
          >
            <span className="text-[10px]">{FILE_ICONS[file?.language ?? ''] ?? '📄'}</span>
            <span className="text-[11px] font-mono whitespace-nowrap">
              {file?.name ?? path.split('/').at(-1)}
            </span>
            <button
              className="text-[11px] text-text-4 hover:text-text ml-0.5
                         bg-transparent border-none cursor-pointer leading-none"
              onClick={e => { e.stopPropagation(); onTabClose(path) }}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
```

---

## 9. `EditorPane.tsx`

```tsx
import Editor from '@monaco-editor/react'
import { useTheme } from '@hooks/useTheme'

export function EditorPane({ fileNode }: { fileNode: FileNode | null }) {
  const theme = useTheme()   // 'dark' | 'light'

  if (!fileNode) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 select-none"
           style={{ background: '#1e1e1e' }}>
        <p className="text-[11px] font-mono"
           style={{ color: '#858585' }}>
          Select a file from the explorer
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-hidden">
      <Editor
        height="100%"
        language={fileNode.language}
        value={fileNode.content}
        theme={theme === 'dark' ? 'vs-dark' : 'vs'}
        options={{
          readOnly:                true,
          minimap:                 { enabled: true },
          fontSize:                13,
          fontFamily:              "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontLigatures:           true,
          lineNumbers:             'on',
          scrollBeyondLastLine:    false,
          renderLineHighlight:     'all',
          bracketPairColorization: { enabled: true },
          folding:                 true,
          automaticLayout:         true,
          padding:                 { top: 12, bottom: 12 },
          scrollbar: {
            verticalScrollbarSize:   6,
            horizontalScrollbarSize: 6,
          },
        }}
      />
    </div>
  )
}
```

---

## 10. MS Dropdown + Download ZIP in `Editor.tsx`

### Code tab header bar

Add this bar between the top nav and the CodeEditor component when Code tab is active:

```tsx
{activeTab === 'code' && (
  <div className="flex items-center gap-3 px-4 py-2 flex-shrink-0 border-b
                  border-[var(--color-border)]"
       style={{ background: 'var(--color-surface-alt)' }}>

    {/* MS selector */}
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-mono text-text-4 uppercase tracking-wider">
        Microservice
      </span>
      <select
        value={codeStore.activeMsId ?? ''}
        onChange={e => codeStore.setActiveMsId(e.target.value || null)}
        className="text-[11px] font-mono text-text bg-surface border
                   border-[var(--color-border)] rounded-[var(--radius-sm)]
                   px-2 py-1 outline-none"
      >
        {msNodes.length === 0 && <option value="">No microservices yet</option>}
        {msNodes.map(n => (
          <option key={n.id} value={n.id}>
            {(n.data as MicroserviceNode).label}
          </option>
        ))}
      </select>
    </div>

    <div className="flex-1" />

    {/* Download ZIP — only shown when files exist */}
    {hasGeneratedFiles && (
      <button
        onClick={handleDownloadZip}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold
                   rounded-[var(--radius-sm)] cursor-pointer border-none transition-colors"
        style={{ background: 'var(--color-success-light)', color: 'var(--color-success)' }}
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
```

### Auto-select active MS when switching to Code tab

```typescript
useEffect(() => {
  if (activeTab !== 'code') return
  if (codeStore.activeMsId) return   // already selected

  const selectedMs = msNodes.find(n => n.id === canvasStore.selectedNodeId)
  const target     = selectedMs ?? msNodes[0]
  if (target) codeStore.setActiveMsId(target.id)
}, [activeTab, msNodes])
```

---

## 11. `useTheme.ts`

Create `src/hooks/useTheme.ts`:

```typescript
import { useState, useEffect } from 'react'

export function useTheme(): 'dark' | 'light' {
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  )
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  return theme
}
```

Export from `src/hooks/index.ts`.

---

## 12. Wire Into `Editor.tsx`

```tsx
{/* Canvas — hidden not unmounted */}
<div style={{ display: activeTab === 'canvas' ? 'flex' : 'none' }}
     className="flex-1 overflow-hidden">
  <Canvas projectId={projectId} />
</div>

{/* Code tab */}
{activeTab === 'code' && (
  <div className="flex-1 flex flex-col overflow-hidden">
    {/* MS dropdown + download bar */}
    <CodeTabHeader
      msNodes={msNodes}
      activeMsId={codeStore.activeMsId}
      onMsChange={codeStore.setActiveMsId}
      hasGeneratedFiles={hasGeneratedFiles}
      onDownloadZip={handleDownloadZip}
    />
    <CodeEditor projectId={projectId} />
  </div>
)}
```

---

## 13. Files Created / Updated

### New files
```
src/pages/Editor/components/CodeEditor/
├── CodeEditor.tsx
├── useCodeEditor.ts
├── types.ts
├── index.ts
└── components/
    ├── Explorer/Explorer.tsx
    ├── Explorer/ExplorerItem.tsx
    ├── Explorer/index.ts
    ├── TabBar/TabBar.tsx
    ├── TabBar/index.ts
    ├── EditorPane/EditorPane.tsx
    └── EditorPane/index.ts

src/hooks/useTheme.ts
```

### Updated files
```
package.json
  → add @monaco-editor/react (only change)

src/store/codeEditorStore.ts
  → full implementation above

src/store/index.ts
  → export useCodeEditorStore

src/hooks/index.ts
  → export useTheme

src/pages/Editor/Editor.tsx
  → add Code tab header bar with MS dropdown
  → activeMsId auto-select logic
  → pass projectId to CodeEditor
```

---

## 14. Verification

```bash
npm install
npm run dev
```
No errors. No Vite config changes needed.

- [ ] Switch to Code tab → file explorer visible on left
- [ ] File explorer shows correct Spring Boot folder structure
- [ ] Click a `.java` file → opens in Monaco with Java syntax highlighting
- [ ] Click a `.yml` file → YAML highlighting
- [ ] Click `pom.xml` → XML highlighting
- [ ] Tab appears in tab bar, × closes it
- [ ] Multiple tabs open — click between them
- [ ] Dark mode → Monaco uses `vs-dark` theme
- [ ] Light mode → Monaco uses `vs` theme
- [ ] MS dropdown shows all MS nodes
- [ ] Switch MS → file tree updates to that MS's files
- [ ] Explorer resize handle — drag to resize
- [ ] After generation → Download ZIP button appears
- [ ] Download ZIP → `.zip` with full folder structure
- [ ] Refresh page → previously generated files reload from IDB
