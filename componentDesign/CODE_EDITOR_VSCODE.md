# VS Code Web Editor — Design & Build Specification

> Claude Code: read this in full before writing a single line.
> This REPLACES CODE_EDITOR.md entirely.
> Remove all previous CodeEditor component code before implementing this.
> The Canvas tab must remain completely unaffected.

---

## 1. What This Builds

A pixel-perfect VS Code experience in the "Code" tab using
`@codingame/monaco-vscode-api` with the full workbench service.
This gives you the real VS Code shell — actual Explorer panel, real tab bar,
real status bar, real activity bar, real theme engine — not a custom-built imitation.

The workbench renders inside a dedicated container div that takes over the full
screen when the "Code" tab is active.

---

## 2. Package Installation

```bash
npm install @codingame/monaco-vscode-api
npm install monaco-editor@npm:@codingame/monaco-vscode-editor-api
npm install @codingame/monaco-vscode-workbench-service-override
npm install @codingame/monaco-vscode-files-service-override
npm install @codingame/monaco-vscode-textmate-service-override
npm install @codingame/monaco-vscode-theme-service-override
npm install @codingame/monaco-vscode-languages-service-override
npm install @codingame/monaco-vscode-configuration-service-override
npm install @codingame/monaco-vscode-keybindings-service-override
npm install @codingame/monaco-vscode-notifications-service-override
npm install @codingame/monaco-vscode-dialogs-service-override

# Default language extensions for Java + config files
npm install @codingame/monaco-vscode-java-default-extension
npm install @codingame/monaco-vscode-xml-default-extension
npm install @codingame/monaco-vscode-yaml-default-extension
npm install @codingame/monaco-vscode-groovy-default-extension

# Default VS Code themes
npm install @codingame/monaco-vscode-theme-defaults-default-extension

# Required build plugin
npm install -D @codingame/esbuild-import-meta-url-plugin
```

**Uninstall** the old packages — they conflict:
```bash
npm uninstall @monaco-editor/react monaco-editor
```

---

## 3. Vite Configuration

Update `vite.config.ts` — this is critical, the workbench will not build without it:

```typescript
import { defineConfig }            from 'vite'
import react                       from '@vitejs/plugin-react'
import importMetaUrlPlugin          from '@codingame/esbuild-import-meta-url-plugin'

export default defineConfig({
  plugins: [react()],

  optimizeDeps: {
    esbuildOptions: {
      plugins: [importMetaUrlPlugin],
    },
    // These packages use dynamic imports that confuse Vite's pre-bundler
    exclude: [
      '@codingame/monaco-vscode-api',
      'monaco-editor',
      '@codingame/monaco-vscode-workbench-service-override',
      '@codingame/monaco-vscode-files-service-override',
    ],
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vscode-workbench': [
            '@codingame/monaco-vscode-api',
            '@codingame/monaco-vscode-workbench-service-override',
            'monaco-editor',
          ],
        },
      },
    },
  },

  // Required to handle VSCode CSS imports
  plugins: [
    react(),
    {
      name: 'load-vscode-css-as-string',
      enforce: 'pre',
      async resolveId(source, importer, options) {
        const resolved = await this.resolve(source, importer, options)
        if (!resolved) return null
        if (
          resolved.id.match(
            /node_modules\/(@codingame\/monaco-vscode|vscode|monaco-editor).*\.css$/
          )
        ) {
          return { ...resolved, id: resolved.id + '?inline' }
        }
        return null
      },
    },
  ],
})
```

---

## 4. VS Code Initialisation — `src/lib/vscodeSetup.ts`

VS Code can only be initialised **once** per page load. This module handles
the singleton initialisation and must be imported before any editor is used.

```typescript
import { initialize }                    from '@codingame/monaco-vscode-api'
import getWorkbenchServiceOverride, {
  WorkbenchState,
  BrowserStorageService,
}                                        from '@codingame/monaco-vscode-workbench-service-override'
import getFilesServiceOverride           from '@codingame/monaco-vscode-files-service-override'
import getTextMateServiceOverride        from '@codingame/monaco-vscode-textmate-service-override'
import getThemeServiceOverride           from '@codingame/monaco-vscode-theme-service-override'
import getLanguagesServiceOverride       from '@codingame/monaco-vscode-languages-service-override'
import getConfigurationServiceOverride,
       { updateUserConfiguration }       from '@codingame/monaco-vscode-configuration-service-override'
import getKeybindingsServiceOverride     from '@codingame/monaco-vscode-keybindings-service-override'
import getNotificationsServiceOverride   from '@codingame/monaco-vscode-notifications-service-override'
import getDialogsServiceOverride         from '@codingame/monaco-vscode-dialogs-service-override'

// Language extensions — import side-effects only
import '@codingame/monaco-vscode-java-default-extension'
import '@codingame/monaco-vscode-xml-default-extension'
import '@codingame/monaco-vscode-yaml-default-extension'
import '@codingame/monaco-vscode-groovy-default-extension'
import '@codingame/monaco-vscode-theme-defaults-default-extension'

let initialised = false

export async function initVSCode(containerElement: HTMLElement): Promise<void> {
  if (initialised) return
  initialised = true

  await initialize(
    {
      ...getWorkbenchServiceOverride({
        container:        containerElement,
        serviceInitialized: async () => {
          // Apply VS Code user settings after services are ready
          await updateUserConfiguration(`{
            "editor.fontFamily": "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
            "editor.fontSize": 13,
            "editor.lineHeight": 22,
            "editor.tabSize": 4,
            "editor.renderLineHighlight": "all",
            "editor.minimap.enabled": true,
            "editor.bracketPairColorization.enabled": true,
            "editor.guides.bracketPairs": true,
            "editor.smoothScrolling": true,
            "editor.cursorSmoothCaretAnimation": "on",
            "editor.formatOnSave": false,
            "editor.readOnly": true,
            "workbench.colorTheme": "Default Dark+",
            "workbench.iconTheme": "vs-seti",
            "explorer.compactFolders": false,
            "breadcrumbs.enabled": true
          }`)
        },
      }),
      ...getFilesServiceOverride(),
      ...getTextMateServiceOverride(),
      ...getThemeServiceOverride(),
      ...getLanguagesServiceOverride(),
      ...getConfigurationServiceOverride(),
      ...getKeybindingsServiceOverride(),
      ...getNotificationsServiceOverride(),
      ...getDialogsServiceOverride(),
    },
    // Workbench HTML element — VS Code renders INTO this div
    containerElement,
    {
      // Workbench startup configuration
      workspaceProvider: {
        trusted:  true,
        async open() { return false },
        workspace: {
          folderUri: { scheme: 'memory', path: '/archflow' },
        },
      },
    }
  )
}
```

The `memory` filesystem scheme means files live in browser memory.
We write file contents into it programmatically (Section 6).

---

## 5. File Structure

```
src/pages/Editor/components/CodeEditor/
├── CodeEditor.tsx          ← mounts the VS Code container div
├── useCodeEditor.ts        ← initialises VS Code, populates files
├── types.ts
└── index.ts
```

The old sub-components (Explorer, TabBar, EditorPane) are **removed entirely**.
VS Code renders all of that itself inside the container div.

---

## 6. `useCodeEditor.ts`

```typescript
import { useEffect, useRef, useState } from 'react'
import { initVSCode }                  from '@/lib/vscodeSetup'
import { buildFileTree }               from '@utils/buildFileTree'
import { exportArchitecture }          from '@utils/exportArchitecture'
import { useCodeEditorStore }          from '@store'

export function useCodeEditor(msId: string, projectId: string) {
  const containerRef       = useRef<HTMLDivElement>(null)
  const [ready, setReady]  = useState(false)
  const generatedFiles     = useCodeEditorStore(s => s.generatedFiles)

  // ── Initialise VS Code once container is mounted ────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    initVSCode(containerRef.current).then(() => setReady(true))
  }, [])

  // ── Populate file tree when architecture is available ───────────────────
  useEffect(() => {
    if (!ready || !msId || !projectId) return

    exportArchitecture(msId, projectId).then(async arch => {
      const tree = buildFileTree(arch as ArchitectureExport)
      await populateVSCodeFiles(tree, generatedFiles)
    })
  }, [ready, msId, projectId, generatedFiles])

  return { containerRef, ready }
}
```

### `populateVSCodeFiles` — write files into VS Code's memory filesystem

```typescript
import { URI }                          from 'monaco-editor'
import { RegisteredFileSystemProvider,
         RegisteredReadOnlyFile,
         registerFileSystemOverlay }    from '@codingame/monaco-vscode-files-service-override'

export async function populateVSCodeFiles(
  tree:           FileNode,
  generatedFiles: Record<string, string>,
): Promise<void> {
  const provider = new RegisteredFileSystemProvider(false)

  // Walk the tree and register each file
  const walk = (node: FileNode) => {
    if (node.type === 'file') {
      const content  = generatedFiles[node.path] ?? node.content
      const bytes    = new TextEncoder().encode(content)
      const uri      = URI.parse(`memory:///archflow/${node.path}`)
      provider.registerFile(new RegisteredReadOnlyFile(uri, () => bytes))
    }
    node.children.forEach(walk)
  }
  walk(tree)

  registerFileSystemOverlay(1, provider)
}
```

This writes every file into VS Code's in-memory filesystem at
`memory:///archflow/src/main/java/...` — VS Code's Explorer will show them
exactly as they are in a real workspace.

---

## 7. `CodeEditor.tsx`

```tsx
import { useRef, useEffect }  from 'react'
import { useCodeEditor }      from './useCodeEditor'

interface Props {
  msId:      string | null
  projectId: string
}

export function CodeEditor({ msId, projectId }: Props) {
  const { containerRef, ready } = useCodeEditor(msId ?? '', projectId)

  if (!msId) {
    return (
      <div className="flex-1 flex items-center justify-center"
           style={{ background: 'var(--color-surface)' }}>
        <p className="text-[12px] font-mono text-text-4">
          Add a Microservice node on the canvas first
        </p>
      </div>
    )
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* VS Code renders itself into this div */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ overflow: 'hidden' }}
      />

      {/* Loading overlay — shown until VS Code is ready */}
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center z-10"
             style={{ background: 'var(--color-surface)' }}>
          <div className="flex flex-col items-center gap-3">
            <span className="text-[24px] animate-pulse">⬡</span>
            <p className="text-[11px] font-mono text-text-4">
              Loading VS Code editor...
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## 8. Theme Sync with App Theme

VS Code manages its own theme internally. Sync it with the app's dark/light mode:

```typescript
// In useCodeEditor.ts, after VS Code is ready:
import { updateUserConfiguration } from '@codingame/monaco-vscode-configuration-service-override'

useEffect(() => {
  if (!ready) return
  const isDark = document.documentElement.dataset.theme === 'dark'
  updateUserConfiguration(`{
    "workbench.colorTheme": "${isDark ? 'Default Dark+' : 'Default Light+'}"
  }`)
}, [ready, appTheme])
```

Listen for `data-theme` changes using the same `MutationObserver` approach from
`src/hooks/useTheme.ts`.

---

## 9. Wire into Editor page

**No changes needed** to how `CodeEditor` is used in `Editor.tsx`.
The same props interface (`msId`, `projectId`) applies.

The critical rule: **Canvas is `display: none`, not unmounted**, when Code tab
is active. VS Code also must not be unmounted when switching tabs — it cannot
be re-initialised. Both use `display: none` / `display: flex` toggling.

```tsx
{/* Canvas — hidden not unmounted */}
<div style={{ display: activeTab === 'canvas' ? 'flex' : 'none' }}
     className="flex-1 overflow-hidden">
  <Canvas projectId={projectId} />
</div>

{/* VS Code editor — hidden not unmounted once mounted */}
<div style={{ display: activeTab === 'code' ? 'flex' : 'none' }}
     className="flex-1 overflow-hidden">
  {selectedMsId && (
    <CodeEditor msId={selectedMsId} projectId={projectId} />
  )}
</div>
```

**Why not conditional rendering (`activeTab === 'code' && ...`):**
VS Code initialises once and cannot be destroyed + re-created. Using `display: none`
keeps it mounted after first render. On first switch to Code tab it initialises,
on subsequent switches it just becomes visible again instantly.

---

## 10. Generated Files — Live Update

When Claude generates code (from CODE_GENERATION.md), `codeEditorStore.generatedFiles`
is updated. The `useCodeEditor` hook watches this and re-calls `populateVSCodeFiles`
with the updated content.

VS Code will automatically show the new content in the editor because the memory
filesystem provider is updated. If the file is already open in a tab, VS Code
refreshes it automatically.

---

## 11. Remove Old Files

Delete these files — they are replaced by VS Code's built-in UI:

```
src/pages/Editor/components/CodeEditor/components/Explorer/
src/pages/Editor/components/CodeEditor/components/TabBar/
src/pages/Editor/components/CodeEditor/components/EditorPane/
src/store/codeEditorStore.ts  ← keep but remove openFilePaths, collapsedFolders, explorerWidth
                               (VS Code manages these internally)
```

Keep in `codeEditorStore`:
```typescript
// These are still needed for code generation
isGenerating:     boolean
generatingMsId:   string | null
generatedFiles:   Record<string, string>
setGenerating:    (msId: string | null) => void
setGeneratedFile: (path: string, content: string) => void
clearGeneratedFiles: (msId: string) => void
```

Remove from `codeEditorStore`:
```typescript
// VS Code manages these internally — remove them
openFilePaths
activeFilePath
collapsedFolders
explorerWidth
openFile
closeFile
setActiveFile
toggleFolder
setExplorerWidth
```

---

## 12. Files Created / Updated

### New files
```
src/lib/vscodeSetup.ts
src/lib/populateVSCodeFiles.ts
```

### Updated files
```
vite.config.ts
  → add esbuild-import-meta-url-plugin
  → add CSS inline loader plugin
  → add workbench to optimizeDeps.exclude
  → add manualChunks for vscode-workbench

package.json
  → add all @codingame/* packages
  → remove @monaco-editor/react

src/pages/Editor/components/CodeEditor/CodeEditor.tsx
  → replace old layout with single container div

src/pages/Editor/components/CodeEditor/useCodeEditor.ts
  → replace file-tree/tab logic with initVSCode + populateVSCodeFiles

src/store/codeEditorStore.ts
  → remove VS Code UI state (openFilePaths, etc.)
  → keep generatedFiles + generation state

src/pages/Editor/Editor.tsx
  → change CodeEditor from conditional render to display:none toggle
```

### Deleted files
```
src/pages/Editor/components/CodeEditor/components/Explorer/
src/pages/Editor/components/CodeEditor/components/TabBar/
src/pages/Editor/components/CodeEditor/components/EditorPane/
src/hooks/useTheme.ts  ← keep if used elsewhere, remove if only used for Monaco theme
```

---

## 13. Verification

### Build
```bash
npm run build
```
No errors. The `vscode-workbench` chunk will be large (~10MB) — this is expected.

```bash
npm run dev
```
No console errors on startup.

### VS Code appearance

- [ ] Switch to "Code" tab → loading spinner shown briefly → full VS Code UI appears
- [ ] Activity bar visible on far left (Explorer, Search icons)
- [ ] Explorer panel shows the project file tree
- [ ] Files have correct language icons (☕ Java, ⚙ YAML, etc.)
- [ ] Click a file → opens in VS Code tab with syntax highlighting
- [ ] Java files have proper syntax highlighting (keywords coloured, brackets matched)
- [ ] Tab bar matches VS Code exactly — active tab accent, × close button
- [ ] Status bar at the bottom shows language mode and line/column
- [ ] Breadcrumb bar above editor shows file path
- [ ] Minimap visible on right side
- [ ] `Ctrl+P` opens file quick-open palette
- [ ] `F1` / `Ctrl+Shift+P` opens command palette

### Theme sync

- [ ] App is dark → VS Code uses "Default Dark+" theme
- [ ] Toggle app to light → VS Code switches to "Default Light+" immediately
- [ ] Fonts match: JetBrains Mono used in editor

### Canvas preservation

- [ ] Switch Canvas → Code → Canvas → all nodes still in exact positions
- [ ] RF pan/zoom state preserved
- [ ] No re-render flash on canvas when switching back

### Generated code

- [ ] After clicking Generate on MS node → Code tab auto-switches
- [ ] Generated files appear in VS Code Explorer
- [ ] File content streams into the open editor live as Claude generates
- [ ] After generation completes → all files readable with syntax highlighting

### VS Code persistence

- [ ] Open a file in VS Code, switch to Canvas, switch back → file still open
- [ ] VS Code does not re-initialise on tab switch (no loading spinner on second visit)
