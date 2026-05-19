# Code Editor — Design & Build Specification

> Claude Code: read this in full before writing a single line.
> Follow every rule in CLAUDE.md alongside this document.
> This step builds the full VS Code-like editor in the "Code" tab.
> No actual code generation in this step — files are stubs.
> The Canvas tab and its state must be completely unaffected.

---

## 1. What This Builds

A full Monaco Editor environment inside the "Code" tab of the Editor page.
When the user clicks "Code" in the top nav, the canvas is hidden (not unmounted)
and the code editor takes over the full remaining space.

Features:
- Monaco Editor (the VS Code engine) — full experience
- Explorer panel (file tree) on the left — collapsible folders
- Multi-tab file opening — click file → opens in a tab
- Tab bar above the editor — close tabs with ×
- Syntax highlighting for Java, XML, YAML, Properties
- Minimap, line numbers, bracket matching, code folding — all on
- Read-only — no editing in this phase
- Theme follows app's `data-theme` (dark/light)
- State persists across tab switches via Zustand

---

## 2. Install Monaco Editor

```bash
npm install @monaco-editor/react monaco-editor
```

Monaco's web workers must be configured. Add to `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['monaco-editor'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'monaco-editor': ['monaco-editor'],
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
})
```

---

## 3. Zustand Store — `codeEditorStore`

Create `src/store/codeEditorStore.ts`:

```typescript
import { create } from 'zustand'

export interface CodeEditorStore {
  // Tab management
  openFilePaths:  string[]                         // ordered list of open tabs
  activeFilePath: string | null                    // currently focused tab

  // Explorer state
  collapsedFolders: Record<string, boolean>        // path → collapsed
  explorerWidth:    number                         // px, resizable, default 220

  // Actions
  openFile:         (path: string) => void         // open tab or focus if already open
  closeFile:        (path: string) => void         // remove from open tabs
  setActiveFile:    (path: string) => void
  toggleFolder:     (path: string) => void
  setExplorerWidth: (width: number) => void
}

export const useCodeEditorStore = create<CodeEditorStore>((set, get) => ({
  openFilePaths:    [],
  activeFilePath:   null,
  collapsedFolders: {},
  explorerWidth:    220,

  openFile: (path) => {
    const { openFilePaths } = get()
    if (!openFilePaths.includes(path)) {
      set({ openFilePaths: [...openFilePaths, path], activeFilePath: path })
    } else {
      set({ activeFilePath: path })
    }
  },

  closeFile: (path) => {
    const { openFilePaths, activeFilePath } = get()
    const idx     = openFilePaths.indexOf(path)
    const updated = openFilePaths.filter(p => p !== path)
    let newActive = activeFilePath
    if (activeFilePath === path) {
      newActive = updated[Math.min(idx, updated.length - 1)] ?? null
    }
    set({ openFilePaths: updated, activeFilePath: newActive })
  },

  setActiveFile:    path   => set({ activeFilePath: path }),
  toggleFolder:     path   => set(s => ({
    collapsedFolders: {
      ...s.collapsedFolders,
      [path]: !s.collapsedFolders[path],
    },
  })),
  setExplorerWidth: width  => set({ explorerWidth: width }),
}))
```

Export from `src/store/index.ts`.

---

## 4. File Tree — Virtual File System

The file tree is built from the architecture — not from real generated code.
Every file is a **stub** whose content is a comment: `// Code generation coming soon`.

### `src/utils/buildFileTree.ts`

This is a **pure function** that takes the `exportArchitecture()` output and
returns a tree of `FileNode` objects.

```typescript
export interface FileNode {
  name:     string           // display name e.g. "Order.java"
  path:     string           // full virtual path e.g. "src/main/java/com/example/entity/Order.java"
  type:     'file' | 'folder'
  language: string           // 'java' | 'yaml' | 'xml' | 'properties'
  content:  string           // stub content for now
  children: FileNode[]       // only for folders
}
```

### Package path derivation

Use the MS node's `packageName` (e.g. `com.example.orderservice`) to build paths.
Convert package to path: `com.example.orderservice` → `com/example/orderservice`.

### Stub content for each file type

```typescript
const javaStub = (className: string, kind: string) =>
`// ─── ${className}.java ──────────────────────────────────────────────────────
// Code generation coming soon.
// This file will be generated from your ${kind} definition.
`

const yamlStub = (name: string) =>
`# ─── ${name} ──────────────────────────────────────────────────────────────────
# Code generation coming soon.
`
```

### Tree structure built from architecture

```
src/
└── main/
    ├── java/
    │   └── {packagePath}/
    │       ├── entity/
    │       │   └── {EntityLabel}.java         ← one per entity
    │       ├── dto/
    │       │   └── {DTOLabel}.java            ← one per DTO
    │       ├── repository/
    │       │   └── {EntityLabel}Repository.java  ← one per entity (if generateRepository)
    │       ├── service/
    │       │   ├── {ServiceLabel}.java
    │       │   └── {ServiceLabel}Impl.java    ← if generateInterface = true
    │       ├── controller/
    │       │   └── {ControllerLabel}.java
    │       └── config/
    │           └── ApplicationConfig.java
    └── resources/
        ├── application.yml
        └── application-dev.yml
pom.xml                                        ← if MAVEN build tool
build.gradle                                   ← if GRADLE build tool
Dockerfile                                     ← if docker.generateDockerfile = true
```

### `buildFileTree` function

```typescript
export function buildFileTree(architecture: ArchitectureExport): FileNode {
  const ms          = architecture.microservice as MicroserviceNode
  const packagePath = ms.packageName.replace(/\./g, '/')
  const basePath    = `src/main/java/${packagePath}`

  const entityFiles     = architecture.entities.map(e => ({
    name:     `${e.label}.java`,
    path:     `${basePath}/entity/${e.label}.java`,
    type:     'file' as const,
    language: 'java',
    content:  javaStub(e.label, 'Entity'),
    children: [],
  }))

  const dtoFiles = architecture.dtos.map(d => ({
    name:     `${d.label}.java`,
    path:     `${basePath}/dto/${d.label}.java`,
    type:     'file' as const,
    language: 'java',
    content:  javaStub(d.label, 'DTO'),
    children: [],
  }))

  const repoFiles = architecture.entities
    .filter(e => e.config.generateRepository)
    .map(e => ({
      name:     `${e.label}Repository.java`,
      path:     `${basePath}/repository/${e.label}Repository.java`,
      type:     'file' as const,
      language: 'java',
      content:  javaStub(`${e.label}Repository`, 'Repository'),
      children: [],
    }))

  const serviceFiles = architecture.services.flatMap(s => {
    const files = [{
      name:     `${s.label}.java`,
      path:     `${basePath}/service/${s.label}.java`,
      type:     'file' as const,
      language: 'java',
      content:  javaStub(s.label, 'Service'),
      children: [],
    }]
    if (s.config.generateInterface) {
      files.push({
        name:     `${s.label}Impl.java`,
        path:     `${basePath}/service/${s.label}Impl.java`,
        type:     'file' as const,
        language: 'java',
        content:  javaStub(`${s.label}Impl`, 'Service Implementation'),
        children: [],
      })
    }
    return files
  })

  const controllerFiles = architecture.controllers.map(c => ({
    name:     `${c.label}.java`,
    path:     `${basePath}/controller/${c.label}.java`,
    type:     'file' as const,
    language: 'java',
    content:  javaStub(c.label, 'Controller'),
    children: [],
  }))

  const resourceFiles: FileNode[] = [
    {
      name: 'application.yml', path: 'src/main/resources/application.yml',
      type: 'file', language: 'yaml', content: yamlStub('application.yml'), children: [],
    },
    {
      name: 'application-dev.yml', path: 'src/main/resources/application-dev.yml',
      type: 'file', language: 'yaml', content: yamlStub('application-dev.yml'), children: [],
    },
  ]

  // Build tree as root folder
  const root: FileNode = {
    name: ms.serviceName, path: '/',
    type: 'folder', language: '', content: '', children: [
      {
        name: 'src', path: 'src', type: 'folder', language: '', content: '',
        children: [
          {
            name: 'main', path: 'src/main', type: 'folder', language: '', content: '',
            children: [
              {
                name: 'java', path: 'src/main/java', type: 'folder', language: '', content: '',
                children: [
                  {
                    name: packagePath.split('/').at(-1)!, path: basePath,
                    type: 'folder', language: '', content: '',
                    children: [
                      { name: 'entity',     path: `${basePath}/entity`,     type: 'folder', language: '', content: '', children: entityFiles },
                      { name: 'dto',        path: `${basePath}/dto`,        type: 'folder', language: '', content: '', children: dtoFiles },
                      { name: 'repository', path: `${basePath}/repository`, type: 'folder', language: '', content: '', children: repoFiles },
                      { name: 'service',    path: `${basePath}/service`,    type: 'folder', language: '', content: '', children: serviceFiles },
                      { name: 'controller', path: `${basePath}/controller`, type: 'folder', language: '', content: '', children: controllerFiles },
                    ],
                  },
                ],
              },
              { name: 'resources', path: 'src/main/resources', type: 'folder', language: '', content: '', children: resourceFiles },
            ],
          },
        ],
      },
      // Build tool file
      ms.build.tool === 'MAVEN'
        ? { name: 'pom.xml', path: 'pom.xml', type: 'file', language: 'xml', content: yamlStub('pom.xml'), children: [] }
        : { name: 'build.gradle', path: 'build.gradle', type: 'file', language: 'groovy', content: yamlStub('build.gradle'), children: [] },
      // Dockerfile
      ...(ms.docker.generateDockerfile ? [{
        name: 'Dockerfile', path: 'Dockerfile', type: 'file' as const,
        language: 'dockerfile', content: yamlStub('Dockerfile'), children: [],
      }] : []),
    ],
  }

  return root
}
```

Export from `src/utils/index.ts`.

---

## 5. File Structure

```
src/pages/Editor/components/CodeEditor/
├── CodeEditor.tsx             ← root layout: explorer + editor area
├── useCodeEditor.ts           ← loads architecture, builds file tree, exposes state
├── types.ts
├── index.ts
└── components/
    ├── Explorer/
    │   ├── Explorer.tsx       ← file tree panel
    │   ├── useExplorer.ts
    │   ├── ExplorerItem.tsx   ← recursive tree node (file or folder)
    │   └── index.ts
    ├── TabBar/
    │   ├── TabBar.tsx         ← open file tabs above the editor
    │   ├── useTabBar.ts
    │   └── index.ts
    └── EditorPane/
        ├── EditorPane.tsx     ← Monaco Editor wrapper
        ├── useEditorPane.ts
        └── index.ts
```

---

## 6. `useCodeEditor.ts`

```typescript
export function useCodeEditor(msId: string, projectId: string) {
  const store        = useCodeEditorStore()
  const theme        = useTheme()           // reads data-theme from html element
  const [tree, setTree] = useState<FileNode | null>(null)

  // Flatten tree to a map for O(1) file content lookup
  const fileMap = useMemo(() => {
    if (!tree) return {}
    const map: Record<string, FileNode> = {}
    const walk = (node: FileNode) => {
      if (node.type === 'file') map[node.path] = node
      node.children.forEach(walk)
    }
    walk(tree)
    return map
  }, [tree])

  // Load architecture from IDB and build file tree
  useEffect(() => {
    exportArchitecture(msId, projectId).then(arch => {
      setTree(buildFileTree(arch as ArchitectureExport))
    })
  }, [msId, projectId])

  const activeFileNode = store.activeFilePath
    ? fileMap[store.activeFilePath] ?? null
    : null

  return {
    tree,
    fileMap,
    activeFileNode,
    openFilePaths:    store.openFilePaths,
    activeFilePath:   store.activeFilePath,
    collapsedFolders: store.collapsedFolders,
    explorerWidth:    store.explorerWidth,
    monacoTheme:      theme === 'dark' ? 'vs-dark' : 'vs',
    openFile:         store.openFile,
    closeFile:        store.closeFile,
    setActiveFile:    store.setActiveFile,
    toggleFolder:     store.toggleFolder,
    setExplorerWidth: store.setExplorerWidth,
  }
}
```

---

## 7. `CodeEditor.tsx` — Root Layout

```tsx
export function CodeEditor({ msId, projectId }: { msId: string; projectId: string }) {
  const editor = useCodeEditor(msId, projectId)

  return (
    <div className="flex h-full w-full overflow-hidden bg-surface">

      {/* Explorer panel */}
      <div
        className="flex-shrink-0 h-full border-r border-[var(--color-border)] overflow-hidden"
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
      <ExplorerResizeHandle
        onResize={editor.setExplorerWidth}
        currentWidth={editor.explorerWidth}
      />

      {/* Editor area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <TabBar
          openFilePaths={editor.openFilePaths}
          activeFilePath={editor.activeFilePath}
          fileMap={editor.fileMap}
          onTabClick={editor.setActiveFile}
          onTabClose={editor.closeFile}
        />
        <EditorPane
          fileNode={editor.activeFileNode}
          monacoTheme={editor.monacoTheme}
        />
      </div>
    </div>
  )
}
```

### Explorer resize handle

A 4px wide drag handle between explorer and editor. On mousedown, track mousemove
to resize. Min width 160px, max 400px.

---

## 8. `Explorer.tsx` — File Tree

```tsx
export function Explorer({ tree, activeFilePath, collapsedFolders, onFileClick, onFolderToggle }) {
  if (!tree) return (
    <div className="p-3 text-[10px] font-mono text-text-4 italic">
      Loading file tree...
    </div>
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 text-[9px] font-mono font-bold text-text-3
                      uppercase tracking-wider border-b border-[var(--color-border)]
                      flex-shrink-0">
        EXPLORER
      </div>
      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        <ExplorerItem
          node={tree}
          depth={0}
          activeFilePath={activeFilePath}
          collapsedFolders={collapsedFolders}
          onFileClick={onFileClick}
          onFolderToggle={onFolderToggle}
        />
      </div>
    </div>
  )
}
```

### `ExplorerItem.tsx` — Recursive Tree Node

```tsx
export function ExplorerItem({ node, depth, activeFilePath, collapsedFolders, onFileClick, onFolderToggle }) {
  const isCollapsed = collapsedFolders[node.path] ?? false
  const isActive    = node.path === activeFilePath
  const indent      = depth * 12   // px indentation per level

  if (node.type === 'folder') {
    return (
      <div>
        {/* Folder row */}
        <div
          className="flex items-center gap-1 py-0.5 px-2 cursor-pointer
                     hover:bg-[var(--color-surface-alt)] transition-colors"
          style={{ paddingLeft: 8 + indent }}
          onClick={() => onFolderToggle(node.path)}
        >
          {/* Caret */}
          <span className="text-[10px] text-text-4 w-3 flex-shrink-0">
            {isCollapsed ? '▶' : '▼'}
          </span>
          {/* Folder icon */}
          <span className="text-[11px]">{isCollapsed ? '📁' : '📂'}</span>
          {/* Name */}
          <span className="text-[11px] font-mono text-text-2 truncate">
            {node.name}
          </span>
        </div>
        {/* Children */}
        {!isCollapsed && node.children.map(child => (
          <ExplorerItem
            key={child.path}
            node={child}
            depth={depth + 1}
            activeFilePath={activeFilePath}
            collapsedFolders={collapsedFolders}
            onFileClick={onFileClick}
            onFolderToggle={onFolderToggle}
          />
        ))}
      </div>
    )
  }

  // File row
  const fileIcon = getFileIcon(node.language)

  return (
    <div
      className="flex items-center gap-1 py-0.5 px-2 cursor-pointer transition-colors"
      style={{
        paddingLeft:  8 + indent,
        background:   isActive ? 'var(--color-accent-light)' : undefined,
        color:        isActive ? 'var(--color-accent)' : undefined,
      }}
      onClick={() => onFileClick(node.path)}
    >
      <span className="text-[11px] w-3 flex-shrink-0">{fileIcon}</span>
      <span className="text-[11px] font-mono truncate">{node.name}</span>
    </div>
  )
}

function getFileIcon(language: string): string {
  switch (language) {
    case 'java':       return '☕'
    case 'yaml':       return '⚙'
    case 'xml':        return '📄'
    case 'properties': return '⚙'
    case 'dockerfile': return '🐳'
    default:           return '📄'
  }
}
```

---

## 9. `TabBar.tsx`

```tsx
export function TabBar({ openFilePaths, activeFilePath, fileMap, onTabClick, onTabClose }) {
  if (openFilePaths.length === 0) return null

  return (
    <div className="flex items-center overflow-x-auto flex-shrink-0 border-b border-[var(--color-border)]"
         style={{ background: 'var(--color-surface-alt)' }}>
      {openFilePaths.map(path => {
        const file     = fileMap[path]
        const isActive = path === activeFilePath
        return (
          <div
            key={path}
            className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer
                       border-r border-[var(--color-border)] flex-shrink-0
                       transition-colors"
            style={{
              background:  isActive ? 'var(--color-surface)'     : 'transparent',
              borderTop:   isActive ? `2px solid var(--color-accent)` : '2px solid transparent',
              color:       isActive ? 'var(--color-text)'         : 'var(--color-text-3)',
            }}
            onClick={() => onTabClick(path)}
          >
            {/* File icon */}
            <span className="text-[10px]">{getFileIcon(file?.language ?? '')}</span>
            {/* File name */}
            <span className="text-[11px] font-mono">{file?.name ?? path.split('/').at(-1)}</span>
            {/* Close button */}
            <button
              className="text-[10px] text-text-4 hover:text-text transition-colors
                         bg-transparent border-none cursor-pointer ml-0.5"
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

## 10. `EditorPane.tsx`

```tsx
import Editor from '@monaco-editor/react'

export function EditorPane({ fileNode, monacoTheme }: { fileNode: FileNode | null; monacoTheme: string }) {
  if (!fileNode) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-3"
           style={{ background: 'var(--color-surface)' }}>
        <span className="text-[32px]">📂</span>
        <p className="text-[12px] font-mono text-text-4">
          Select a file from the explorer to view its content
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
        theme={monacoTheme}
        options={{
          readOnly:              true,
          minimap:               { enabled: true },
          fontSize:              13,
          fontFamily:            "'JetBrains Mono', 'Fira Code', monospace",
          lineNumbers:           'on',
          scrollBeyondLastLine:  false,
          renderLineHighlight:   'all',
          bracketPairColorization: { enabled: true },
          folding:               true,
          automaticLayout:       true,   // resize correctly when panel resizes
          scrollbar: {
            verticalScrollbarSize:   6,
            horizontalScrollbarSize: 6,
          },
          padding: {
            top:    16,
            bottom: 16,
          },
        }}
      />
    </div>
  )
}
```

---

## 11. Wire into Editor page

### `Editor.tsx` — Tab switching

The Editor page already has a tab switcher (Canvas / Code / Preview).
The current active tab must be tracked in state.

```typescript
const [activeTab, setActiveTab] = useState<'canvas' | 'code' | 'preview'>('canvas')
```

In the render:

```tsx
{/* Canvas — hidden not unmounted when not active */}
<div style={{ display: activeTab === 'canvas' ? 'flex' : 'none' }}
     className="flex-1 overflow-hidden">
  <Canvas projectId={projectId} />
</div>

{/* Code editor — rendered when active */}
{activeTab === 'code' && (
  <div className="flex-1 overflow-hidden">
    <CodeEditor msId={selectedMsId} projectId={projectId} />
  </div>
)}

{/* Preview — placeholder */}
{activeTab === 'preview' && (
  <div className="flex-1 flex items-center justify-center">
    <p className="text-[12px] font-mono text-text-4">Preview coming soon</p>
  </div>
)}
```

**Canvas is `display: none` not unmounted** — this preserves all React Flow state,
node positions, pan/zoom etc. when switching back to Canvas.

### `selectedMsId`

`CodeEditor` needs to know which microservice to show the file tree for.
Use `canvasStore.selectedNodeId` — if the selected node is a MicroserviceNode,
use that. Otherwise use the first MicroserviceNode in rfNodes.

```typescript
const selectedMsId = useMemo(() => {
  const selected = rfNodes.find(n =>
    n.id === canvasStore.selectedNodeId &&
    (n.data as BaseNode).type === NodeType.MICROSERVICE
  )
  if (selected) return selected.id
  return rfNodes.find(n => (n.data as BaseNode).type === NodeType.MICROSERVICE)?.id ?? null
}, [rfNodes, canvasStore.selectedNodeId])
```

If no MS exists, show an empty state:

```tsx
{activeTab === 'code' && !selectedMsId && (
  <div className="flex-1 flex items-center justify-center">
    <p className="text-[12px] font-mono text-text-4">
      Add a Microservice node on the canvas first
    </p>
  </div>
)}
```

### Top nav tab buttons

```tsx
{(['canvas', 'code', 'preview'] as const).map(tab => (
  <button
    key={tab}
    onClick={() => setActiveTab(tab)}
    className="px-4 py-1.5 text-[12px] font-semibold rounded-[var(--radius-sm)]
               transition-all duration-150 capitalize cursor-pointer border-none"
    style={{
      background: activeTab === tab ? 'var(--color-surface)' : 'transparent',
      color:      activeTab === tab ? 'var(--color-text)'    : 'var(--color-text-3)',
      boxShadow:  activeTab === tab ? 'var(--shadow-sm)'     : 'none',
    }}
  >
    {tab.charAt(0).toUpperCase() + tab.slice(1)}
  </button>
))}
```

---

## 12. Theme Sync

Monaco's built-in themes:
- Dark app theme → `'vs-dark'`
- Light app theme → `'vs'`

Detect the current theme from the `<html>` element:

```typescript
function useTheme(): 'dark' | 'light' {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  })

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

Put this hook in `src/hooks/useTheme.ts` and export from `src/hooks/index.ts`.

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
    ├── Explorer/
    │   ├── Explorer.tsx
    │   ├── useExplorer.ts
    │   ├── ExplorerItem.tsx
    │   └── index.ts
    ├── TabBar/
    │   ├── TabBar.tsx
    │   ├── useTabBar.ts
    │   └── index.ts
    └── EditorPane/
        ├── EditorPane.tsx
        ├── useEditorPane.ts
        └── index.ts

src/store/codeEditorStore.ts
src/utils/buildFileTree.ts
src/hooks/useTheme.ts
```

### Updated files
```
src/store/index.ts
  → export codeEditorStore

src/utils/index.ts
  → export buildFileTree

src/hooks/index.ts
  → export useTheme

src/pages/Editor/Editor.tsx
  → add activeTab state
  → hide canvas with display:none instead of unmounting
  → render CodeEditor when activeTab === 'code'
  → pass selectedMsId to CodeEditor

vite.config.ts
  → Monaco Editor optimizeDeps and worker config

package.json
  → @monaco-editor/react
  → monaco-editor
```

---

## 14. Verification

### TypeScript
```bash
npx tsc --noEmit
```
Zero errors.

### Install check
```bash
npm run dev
```
No Monaco-related build errors.

### Tab switching

- [ ] Click "Code" tab → canvas disappears, editor appears
- [ ] Click "Canvas" tab → editor disappears, canvas reappears with all nodes exactly where they were (not reset)
- [ ] Click "Code" again → same open tabs as before (state preserved via Zustand)
- [ ] Canvas pan/zoom state preserved after Code → Canvas switch

### File tree

- [ ] Explorer panel shows on the left
- [ ] Root folder is the MS service name
- [ ] `src/main/java/{package}/entity/` contains one file per EntityNode
- [ ] `src/main/java/{package}/service/` contains one file per ServiceNode
- [ ] `src/main/java/{package}/controller/` contains one file per ControllerNode
- [ ] `src/main/java/{package}/dto/` contains one file per DTONode
- [ ] `src/main/java/{package}/repository/` contains one file per Entity where `generateRepository = true`
- [ ] `src/main/resources/application.yml` exists
- [ ] `pom.xml` exists when build tool is MAVEN
- [ ] `Dockerfile` exists when `docker.generateDockerfile = true`
- [ ] Click folder → toggles open/closed
- [ ] Collapsed state persists when switching Canvas → Code → Canvas → Code

### Editor

- [ ] Click file → opens in tab bar + content shown in Monaco
- [ ] Active tab has blue top border + light background
- [ ] Click × on tab → tab closes, adjacent tab becomes active
- [ ] Close all tabs → welcome/empty state shown
- [ ] Content shows stub comment with file name
- [ ] Line numbers visible
- [ ] Minimap visible on right side
- [ ] Syntax highlighting active (Java files have coloured keywords)
- [ ] Code folding works (click gutter arrows)
- [ ] Editor is read-only (cannot type)

### Theme

- [ ] Toggle to dark mode → Monaco switches to `vs-dark` theme immediately
- [ ] Toggle to light mode → Monaco switches to `vs` theme immediately
