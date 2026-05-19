# Code Editor & Generation — 8 Targeted Fixes

> Claude Code: apply all fixes in this file.
> Do not change anything not explicitly mentioned here.
> Read every section fully before touching any file.

---

## Fix 1 — Resizable Explorer Panel

The VS Code workbench manages its own panel sizes internally via
`@codingame/monaco-vscode-workbench-service-override`.

If the workbench service does not expose a resize handle by default, add a
custom drag handle **outside** the VS Code container that adjusts the container
width via CSS, and pass the `explorerWidth` as a CSS variable into the workbench
container:

In `codeEditorStore.ts`, add:

```typescript
explorerWidth:    number          // default 220
setExplorerWidth: (w: number) => void
```

In `CodeEditor.tsx`, wrap the VS Code container and add a resize handle:

```tsx
<div className="flex h-full w-full overflow-hidden">

  {/* VS Code container — width driven by explorerWidth */}
  <div
    ref={containerRef}
    className="flex-1 h-full overflow-hidden"
    style={{ minWidth: 0 }}
  />

  {/* Drag handle on the right edge of the explorer */}
  <div
    className="w-1 h-full cursor-col-resize flex-shrink-0 hover:bg-[var(--color-accent)]
               transition-colors"
    style={{ background: 'var(--color-border)' }}
    onMouseDown={handleResizeStart}
  />
</div>
```

`handleResizeStart` in `useCodeEditor.ts`:

```typescript
const handleResizeStart = useCallback((e: React.MouseEvent) => {
  e.preventDefault()
  const startX     = e.clientX
  const startWidth = codeStore.explorerWidth

  const onMove = (moveEvent: MouseEvent) => {
    const delta    = moveEvent.clientX - startX
    const newWidth = Math.min(500, Math.max(160, startWidth + delta))
    codeStore.setExplorerWidth(newWidth)
    // Pass to VS Code via configuration
    updateUserConfiguration(`{ "workbench.sideBar.location": "left" }`)
  }

  const onUp = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup',  onUp)
  }

  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup',   onUp)
}, [codeStore])
```

---

## Fix 2 + 3 — MS Node Dropdown in Code Tab Header

### In `codeEditorStore.ts`, add:

```typescript
activeMsId:    string | null
setActiveMsId: (id: string | null) => void
```

### In `Editor.tsx`, add the MS selector dropdown above the VS Code editor:

```tsx
{activeTab === 'code' && (
  <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border)]
                  flex-shrink-0"
       style={{ background: 'var(--color-surface-alt)' }}>

    {/* MS node selector */}
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-mono text-text-4 uppercase tracking-wider">
        Microservice
      </span>
      <select
        value={activeMsId ?? ''}
        onChange={e => {
          const id = e.target.value
          codeStore.setActiveMsId(id)
        }}
        className="text-[11px] font-mono text-text bg-surface border
                   border-[var(--color-border)] rounded-[var(--radius-sm)]
                   px-2 py-1 outline-none focus:border-[var(--color-border-focus)]"
      >
        {msNodes.length === 0 && (
          <option value="">No microservices</option>
        )}
        {msNodes.map(n => (
          <option key={n.id} value={n.id}>
            {(n.data as MicroserviceNode).label}
          </option>
        ))}
      </select>
    </div>

    {/* Download ZIP button */}
    {hasGeneratedFiles && (
      <button onClick={handleDownloadZip} ...>
        ↓ Download ZIP
      </button>
    )}
  </div>
)}
```

### `msNodes` derivation in `Editor.tsx`:

```typescript
const msNodes = rfNodes.filter(n =>
  (n.data as BaseNode).type === NodeType.MICROSERVICE
)
```

### `activeMsId` initialisation logic:

When the Code tab becomes active, if `activeMsId` is null, auto-select:
1. The currently selected MS node on canvas (from `canvasStore.selectedNodeId`)
2. Else the first MS node in `msNodes`

```typescript
useEffect(() => {
  if (activeTab !== 'code') return
  if (codeStore.activeMsId) return   // already set — don't override

  const selected = msNodes.find(n => n.id === canvasStore.selectedNodeId)
  const target   = selected ?? msNodes[0]
  if (target) codeStore.setActiveMsId(target.id)
}, [activeTab, msNodes, canvasStore.selectedNodeId])
```

### Pass `activeMsId` to `CodeEditor`:

```tsx
<CodeEditor
  msId={codeStore.activeMsId}
  projectId={projectId}
/>
```

`CodeEditor` already accepts `msId: string | null` — no change needed there.
When `activeMsId` changes, `useCodeEditor` re-runs the `exportArchitecture` +
`populateVSCodeFiles` calls with the new `msId`.

---

## Fix 4 — Diff Path Opens the Progress Modal

### Extract shared callback setup into `src/utils/generationCallbacks.ts`:

```typescript
import { useCodeEditorStore }         from '@store'
import { useGenerationProgressStore } from '@store'
import type { FileProgressItem }      from '@store'

export function makeGenerationCallbacks(params: {
  msId:      string
  projectId: string
  diffMode:  boolean   // true = diff, false = full generation
}) {
  const codeStore     = useCodeEditorStore.getState()
  const progressStore = useGenerationProgressStore.getState()

  return {
    onFileStart: (path: string) => {
      const item: FileProgressItem = {
        path,
        fileName:   path.split('/').at(-1) ?? path,
        category:   categoryFromPath(path),
        status:     'streaming',
        liveLines:  [],
        changeType: params.diffMode
          ? (codeStore.generatedFiles[path] ? 'updated' : 'new')
          : 'full',
      }
      codeStore.updateFileProgress(path, item)
      codeStore.setGeneratedFile(path, '')
    },

    onFileChunk: (path: string, chunk: string) => {
      codeStore.appendFileChunk(path, chunk)
      const content   = (codeStore.generatedFiles[path] ?? '') + chunk
      const allLines  = content.split('\n')
      const liveLines = allLines.slice(Math.max(0, allLines.length - 5))
      codeStore.updateFileProgress(path, { liveLines })
    },

    onFileComplete: (path: string, content: string) => {
      codeStore.setGeneratedFile(path, content)
      codeStore.updateFileProgress(path, { status: 'done', liveLines: [] })
    },

    onDone: () => {
      codeStore.setGenerating(null)
    },

    onError: (err: Error) => {
      codeStore.setGenerating(null)
      console.error('[archflow] Generation failed:', err.message)
    },
  }
}
```

### Update `runFullGeneration` to use the shared callbacks:

```typescript
async function runFullGeneration(msId, projectId, msLabel) {
  const codeStore     = useCodeEditorStore.getState()
  const progressStore = useGenerationProgressStore.getState()

  codeStore.setGenerating(msId)
  codeStore.clearGeneratedFiles()
  codeStore.setFileProgress([])
  progressStore.open(msLabel)
  window.dispatchEvent(new CustomEvent('archflow-switch-tab', { detail: 'code' }))

  const architecture = await exportArchitecture(msId, projectId)
  const callbacks    = makeGenerationCallbacks({ msId, projectId, diffMode: false })

  try {
    await generateCode({ architecture, msId, projectId, ...callbacks })
  } catch (err) {
    callbacks.onError(err as Error)
  }
}
```

### Update `regenerateWithDiff` to open the modal:

```typescript
export async function regenerateWithDiff(params: {
  msId:                string
  projectId:           string
  msLabel:             string
  currentArchitecture: object
  lastVersion:         object
}) {
  const codeStore     = useCodeEditorStore.getState()
  const progressStore = useGenerationProgressStore.getState()

  // Open the progress modal — same as full generation
  codeStore.setGenerating(params.msId)
  codeStore.setFileProgress([])
  progressStore.open(params.msLabel)         // ← THIS WAS MISSING
  window.dispatchEvent(new CustomEvent('archflow-switch-tab', { detail: 'code' }))

  const callbacks = makeGenerationCallbacks({
    msId:      params.msId,
    projectId: params.projectId,
    diffMode:  true,           // enables NEW / UPDATED badge logic
  })

  try {
    // ... rest of diff logic (see Fix 7 below)
  } catch (err) {
    callbacks.onError(err as Error)
  }
}
```

---

## Fix 5 — New vs Updated Badges in Progress Modal

### In `codeEditorStore.ts`, update `FileProgressItem`:

```typescript
export interface FileProgressItem {
  path:        string
  fileName:    string
  category:    string
  status:      'waiting' | 'streaming' | 'done' | 'error'
  liveLines:   string[]
  changeType:  'full' | 'new' | 'updated'  // ← ADD THIS
}
```

### In `FileProgressRow` inside `GenerationProgressModal.tsx`:

```tsx
{item.changeType !== 'full' && (
  <span
    className="text-[8px] font-mono font-bold px-1 rounded-sm flex-shrink-0"
    style={{
      background: item.changeType === 'new'
        ? 'var(--color-success-light)'
        : 'var(--color-warning-light)',
      color: item.changeType === 'new'
        ? 'var(--color-success)'
        : 'var(--color-warning)',
    }}
  >
    {item.changeType === 'new' ? 'NEW' : 'UPDATED'}
  </span>
)}
```

Place this badge between the file name and the category label in the row.

---

## Fix 6 — Dedicated Diff System Prompt

In `src/utils/regenerateWithDiff.ts`, replace any existing system prompt with:

```typescript
const DIFF_SYSTEM_PROMPT = `You are an expert Spring Boot developer maintaining an existing codebase.

You will receive:
1. A diff showing exactly what changed in the microservice architecture
2. The current content of files affected by those changes
3. The full current architecture for context

Update ONLY the files that need to change based on the diff.
Do NOT output files that are unchanged.
Do NOT regenerate the entire application.

If a change requires a new file that did not exist before, create it.
If a change requires modifying an existing file, output the full updated file.
If a file is unaffected by the changes, do not include it at all.

Output format:
<file path="FULL_PATH">
CONTENT
</file>`
```

---

## Fix 7 — Diff Sends Existing Generated Files as Context

### Full `regenerateWithDiff` implementation:

```typescript
import { db }                    from '@db'
import { diffArchitecture }      from '@utils/diffArchitecture'
import { getMessagesUrl }        from '@utils/proxyUrl'
import { makeGenerationCallbacks } from '@utils/generationCallbacks'
import { parseGenerationStream } from '@utils/generateCode'   // export the stream parser

export async function regenerateWithDiff(params: {
  msId:                string
  projectId:           string
  msLabel:             string
  currentArchitecture: object
  lastVersion:         object
}) {
  const codeStore     = useCodeEditorStore.getState()
  const progressStore = useGenerationProgressStore.getState()

  codeStore.setGenerating(params.msId)
  codeStore.setFileProgress([])
  progressStore.open(params.msLabel)
  window.dispatchEvent(new CustomEvent('archflow-switch-tab', { detail: 'code' }))

  const callbacks = makeGenerationCallbacks({
    msId:      params.msId,
    projectId: params.projectId,
    diffMode:  true,
  })

  try {
    // 1. Compute diff between last saved version and current architecture
    const diff = diffArchitecture(params.lastVersion, params.currentArchitecture)

    // 2. Load all previously generated files from IDB
    const existingRows = await db.generatedFiles
      .where('msId').equals(params.msId)
      .toArray()

    const existingFiles: Record<string, string> = {}
    existingRows.forEach(row => {
      existingFiles[row.filePath] = row.content
    })

    // 3. Find files affected by the diff
    const affectedFiles = findAffectedFiles(diff, existingFiles)

    // 4. Build the user message with diff + existing file contents + full architecture
    const existingFilesXml = Object.entries(affectedFiles)
      .map(([path, content]) =>
        `<existing-file path="${path}">\n${content}\n</existing-file>`
      ).join('\n\n')

    const userMessage = `Architecture changes since last generation:
${JSON.stringify(diff, null, 2)}

Current affected files (update these as needed):
${existingFilesXml}

Full current architecture for context:
${JSON.stringify(params.currentArchitecture, null, 2)}

Generate only files that changed. Skip unchanged files entirely.`

    // 5. Call the API
    const response = await fetch(getMessagesUrl(), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:    'claude-sonnet-4',
        stream:   true,
        // No max_tokens — let Claude use what it needs
        messages: [
          { role: 'system', content: DIFF_SYSTEM_PROMPT },
          { role: 'user',   content: userMessage },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error((err as any).error?.message ?? `HTTP ${response.status}`)
    }

    // 6. Parse the stream — reuse the same buffer-based parser from generateCode.ts
    await parseGenerationStream({
      response,
      msId:           params.msId,
      projectId:      params.projectId,
      onFileStart:    callbacks.onFileStart,
      onFileChunk:    callbacks.onFileChunk,
      onFileComplete: callbacks.onFileComplete,
    })

    callbacks.onDone()

  } catch (err) {
    callbacks.onError(err as Error)
  }
}
```

### Export `parseGenerationStream` from `generateCode.ts`

The buffer-based stream parser (from `CODE_GENERATION_FIXES.md`) needs to be
extracted into a reusable exported function so both `generateCode` and
`regenerateWithDiff` can share it:

```typescript
// In generateCode.ts — extract and export the stream parser:
export async function parseGenerationStream(params: {
  response:       Response
  msId:           string
  projectId:      string
  onFileStart:    (path: string) => void
  onFileChunk:    (path: string, chunk: string) => void
  onFileComplete: (path: string, content: string) => void
}): Promise<void> {
  // ... the full buffer-based parser from CODE_GENERATION_FIXES.md Fix 3 ...
  // (accumulated string, parsedUpTo pointer, full tag detection)
}

// generateCode() calls parseGenerationStream() internally
```

---

## Fix 8 — Remove `max_tokens`

In `src/utils/generateCode.ts`, remove `max_tokens` from the fetch body:

```typescript
// REMOVE this line:
max_tokens: 32000,

// The fetch body becomes:
body: JSON.stringify({
  model:    'claude-sonnet-4',
  stream:   true,
  // no max_tokens — Claude uses however many tokens the response needs
  messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user',   content: userMessage },
  ],
}),
```

Same removal in `regenerateWithDiff.ts` — already done in Fix 7 above
(the diff fetch body has no `max_tokens`).

---

## Summary of Files Changed

```
src/store/codeEditorStore.ts
  → add activeMsId, setActiveMsId
  → add explorerWidth, setExplorerWidth
  → FileProgressItem: add changeType field

src/utils/generationCallbacks.ts    ← NEW
  → makeGenerationCallbacks() shared by full gen + diff

src/utils/generateCode.ts
  → export parseGenerationStream() as standalone function
  → generateCode() calls parseGenerationStream() internally
  → remove max_tokens

src/utils/regenerateWithDiff.ts
  → complete rewrite (Fix 7)
  → reads existing files from IDB
  → sends diff + existing files + full architecture to Claude
  → uses DIFF_SYSTEM_PROMPT (Fix 6)
  → opens progress modal (Fix 4)
  → uses makeGenerationCallbacks (Fix 4)
  → no max_tokens (Fix 8)

src/pages/Editor/Editor.tsx
  → MS node dropdown in Code tab header (Fix 2+3)
  → activeMsId auto-select logic (Fix 2+3)
  → pass activeMsId to CodeEditor

src/pages/Editor/components/CodeEditor/useCodeEditor.ts
  → handleResizeStart for explorer panel (Fix 1)
  → react to activeMsId changes — re-run exportArchitecture + populateVSCodeFiles

src/components/shared/GenerationProgressModal/GenerationProgressModal.tsx
  → FileProgressRow: add NEW / UPDATED badge (Fix 5)
```

---

## Verification

- [ ] Explorer panel has a drag handle — drag it to resize, min 160px max 500px
- [ ] Multiple MS nodes → dropdown shows all of them in Code tab header
- [ ] Selecting different MS in dropdown → file tree switches to that MS's files
- [ ] First Code tab open → auto-selects the currently selected canvas MS node
- [ ] Click Generate → full generation → progress modal opens immediately
- [ ] Click Generate (files exist) → Regenerate modal → Apply Diff → **progress modal opens**
- [ ] Diff generation → only changed files appear in progress modal (not all files)
- [ ] Diff files show `NEW` badge (green) for newly created files
- [ ] Diff files show `UPDATED` badge (amber) for modified existing files
- [ ] Full generation files show no badge
- [ ] No `max_tokens` in any API call — Claude generates until complete
