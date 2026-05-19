# Generation UX — Three Features

> Claude Code: read this in full before writing a single line.
> This document covers three independent features.
> Read all sections before changing any file.

---

## Feature 1 — Minimisable Generation Modal

### Overview

The modal gets a minimise button. When minimised, a floating pill appears
at the bottom-right of the screen showing live progress. Clicking the pill
reopens the modal. Generation never stops when minimised.

### Store changes — `generationProgressStore.ts`

```typescript
interface GenerationProgressStore {
  isOpen:      boolean
  isMinimised: boolean   // ← ADD
  msLabel:     string
  stopped:     boolean

  open:        (msLabel: string) => void
  close:       () => void
  minimise:    () => void   // ← ADD — hides modal, keeps generation running
  restore:     () => void   // ← ADD — reopens modal from minimised state
  setStopped:  (v: boolean) => void
}
```

Implementation:
```typescript
isMinimised: false,

minimise: () => set({ isMinimised: true }),

restore:  () => set({ isMinimised: false }),

open: (msLabel) => set({
  isOpen:      true,
  isMinimised: false,   // always open fully when opened fresh
  msLabel,
  stopped:     false,
}),

close: () => set({
  isOpen:      false,
  isMinimised: false,
}),
```

### `GenerationProgressModal.tsx` — Minimise button

Add minimise button in the modal header, between the title and the × button:

```tsx
{/* Header buttons */}
<div className="flex items-center gap-2 flex-shrink-0">

  {/* Minimise button */}
  <button
    onClick={progressStore.minimise}
    title="Minimise — generation continues in background"
    className="text-text-4 hover:text-text transition-colors
               bg-transparent border-none cursor-pointer text-[14px]
               leading-none"
  >
    —
  </button>

  {/* Close / Stop button */}
  <button
    onClick={() => {
      if (isGenerating) codeStore.abortGeneration()
      progressStore.close()
    }}
    className="text-text-4 hover:text-text transition-colors
               bg-transparent border-none cursor-pointer text-[16px]
               leading-none"
  >
    ×
  </button>
</div>
```

### Modal visibility

The modal renders based on `isOpen && !isMinimised`:

```tsx
export function GenerationProgressModal() {
  const progressStore = useGenerationProgressStore()
  const codeStore     = useCodeEditorStore()

  // Always render the floating pill when minimised
  // Only render the full modal when open and not minimised

  return (
    <>
      {/* Full modal */}
      {progressStore.isOpen && !progressStore.isMinimised && (
        ReactDOM.createPortal(<FullModal />, document.body)
      )}

      {/* Floating pill — shown when minimised */}
      {progressStore.isMinimised && (
        ReactDOM.createPortal(<MinimisedPill />, document.body)
      )}
    </>
  )
}
```

### `MinimisedPill` component

```tsx
function MinimisedPill() {
  const progressStore = useGenerationProgressStore()
  const codeStore     = useCodeEditorStore()

  const items      = codeStore.fileProgress
  const doneCount  = items.filter(i => i.status === 'done').length
  const totalCount = items.length
  const isGenerating = codeStore.isGenerating

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2
                 px-4 py-2.5 rounded-full shadow-modal cursor-pointer
                 transition-all duration-150 select-none"
      style={{
        background: 'var(--color-surface)',
        border:     '1px solid var(--color-border-strong)',
      }}
      onClick={progressStore.restore}
    >
      {/* Status indicator */}
      {isGenerating ? (
        <span className="w-2 h-2 rounded-full animate-pulse flex-shrink-0"
              style={{ background: 'var(--color-accent)' }} />
      ) : (
        <span className="text-[10px]">✓</span>
      )}

      {/* Label */}
      <span className="text-[11px] font-mono text-text-2">
        {isGenerating
          ? `Generating... ${doneCount} / ${totalCount} files`
          : `Generation complete — ${doneCount} files`}
      </span>

      {/* Stop button — only during generation */}
      {isGenerating && (
        <button
          onClick={e => {
            e.stopPropagation()   // don't restore modal when stopping
            codeStore.abortGeneration()
            progressStore.close()
          }}
          className="text-[10px] text-text-4 hover:text-[var(--color-danger)]
                     transition-colors bg-transparent border-none cursor-pointer
                     ml-1 flex-shrink-0"
          title="Stop generation"
        >
          ■
        </button>
      )}

      {/* Expand hint */}
      <span className="text-[9px] text-text-4 ml-1">↑</span>
    </div>
  )
}
```

### Pill auto-dismisses after generation completes

When `isGenerating` transitions to false AND `isMinimised` is true,
auto-dismiss the pill after 5 seconds:

```typescript
// In GenerationProgressModal.tsx:
useEffect(() => {
  if (!codeStore.isGenerating && progressStore.isMinimised) {
    const timer = setTimeout(() => {
      progressStore.close()
    }, 5000)
    return () => clearTimeout(timer)
  }
}, [codeStore.isGenerating, progressStore.isMinimised])
```

---

## Feature 2 — Editable Generated Files

### `EditorPane.tsx` — Remove readOnly

Change `readOnly: true` to `readOnly: false` in Monaco options:

```typescript
options={{
  readOnly:   false,   // ← CHANGE from true to false
  minimap:    { enabled: true },
  fontSize:   13,
  // ... rest unchanged ...
}}
```

### Track edits — `useCodeEditor.ts`

When the user edits a file in Monaco, save the changes back to IDB and
update `codeEditorStore.generatedFiles`:

```typescript
// In EditorPane.tsx, add onChange handler to <Editor>:
<Editor
  // ... existing props ...
  onChange={(value) => {
    if (value === undefined) return
    onFileChange(fileNode.path, value)
  }}
/>
```

`onFileChange` from `useCodeEditor.ts`:

```typescript
const onFileChange = useCallback(
  debounce(async (filePath: string, content: string) => {
    // Update in-memory store
    codeStore.setGeneratedFile(filePath, content)

    // Mark file as modified
    codeStore.markFileModified(filePath)

    // Write to IDB
    await db.generatedFiles.put({
      id:          `${codeStore.activeMsId}:${filePath}`,
      msId:        codeStore.activeMsId!,
      projectId,
      filePath,
      content,
      generatedAt: Date.now(),
    })
  }, 500),
  [codeStore, projectId]
)
```

### Track modified files — `codeEditorStore.ts`

```typescript
modifiedFiles:      Set<string>   // paths of files edited by the user
markFileModified:   (path: string) => void
clearModifiedFiles: () => void
```

```typescript
modifiedFiles:    new Set(),
markFileModified: (path) => set(s => ({
  modifiedFiles: new Set([...s.modifiedFiles, path])
})),
clearModifiedFiles: () => set({ modifiedFiles: new Set() }),
```

### Modified indicator in `TabBar.tsx`

Show a dot on tabs for modified files, identical to VS Code:

```tsx
{codeStore.modifiedFiles.has(path) && (
  <span
    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
    style={{ background: 'var(--color-accent)' }}
  />
)}
```

Place the dot between the file icon and the file name.

### Modified indicator in `ExplorerItem.tsx`

Show a dot next to the file name in the explorer:

```tsx
{codeStore.modifiedFiles.has(node.path) && (
  <span
    className="w-1.5 h-1.5 rounded-full flex-shrink-0 ml-auto"
    style={{ background: 'var(--color-accent)' }}
  />
)}
```

### Clear modified state when regenerating

In `runFullGeneration` and `handleContinue`, before starting generation:

```typescript
codeStore.clearModifiedFiles()
```

---

## Feature 3 — Continue Shows All Files with Correct Count

### Problem

`continueGeneration` currently calls `onFileListReady` with only the
incomplete + missing files. The modal starts at 0/8 instead of 40/48.

### Fix — `continueGeneration.ts`

Pass the FULL file list to `onFileListReady`, not just the todo files.
Mark complete files as `done` immediately. Only stream incomplete/missing ones.

```typescript
// After classifying files:
const incompleteFiles: string[] = []
const missingFiles:    string[] = []
const completeFiles:   string[] = []

for (const path of allPaths) {
  const content = existingFiles[path]
  if (!content) {
    missingFiles.push(path)
  } else if (isFileIncomplete(content, path)) {
    incompleteFiles.push(path)
  } else {
    completeFiles.push(path)
  }
}

// Pass ALL paths to onFileListReady — full list, correct total count
params.onFileListReady(allPaths, completeFiles)
//                              ↑ also pass which ones are already done
```

### Update `onFileListReady` signature

In `generationCallbacks.ts` and everywhere `onFileListReady` is defined:

```typescript
onFileListReady: (allPaths: string[], completePaths: string[]) => void
```

In `makeGenerationCallbacks`:

```typescript
onFileListReady: (allPaths: string[], completePaths: string[] = []) => {
  const items: FileProgressItem[] = allPaths.map(path => ({
    path,
    fileName:   path.split('/').at(-1) ?? path,
    category:   categoryFromPath(path),
    // Mark already-complete files as done immediately
    status:     completePaths.includes(path) ? 'done' : 'waiting',
    liveLines:  [],
    changeType: completePaths.includes(path) ? 'full' : 'full',
  }))
  codeStore.setFileProgress(items)
},
```

For full generation (not continue), `completePaths` is empty — all start as `waiting`.
For continue, `completePaths` has the 40 already-done files — they show as `done` from the start.

The progress bar immediately shows `40 / 48` when Continue opens the modal.
The count increments from 40 to 48 as the remaining 8 files complete.

### Update `generateCode.ts` `onFileListReady` call

```typescript
// In generateCode.ts orchestrator:
params.onFileListReady(filePaths, [])  // full gen: no complete files yet
```

### Update `continueGeneration.ts` `onFileListReady` call

```typescript
// In continueGeneration.ts:
params.onFileListReady(allPaths, completeFiles)  // show complete files as done
```

---

## Summary of Files Changed

```
src/store/generationProgressStore.ts
  → add isMinimised: boolean
  → add minimise(), restore() actions
  → reset isMinimised to false in open()

src/components/shared/GenerationProgressModal/GenerationProgressModal.tsx
  → add minimise button (—) in header
  → split into FullModal + MinimisedPill components
  → MinimisedPill: floating bottom-right pill with live count
  → MinimisedPill: stop button aborts + closes
  → auto-dismiss pill 5s after generation completes

src/pages/Editor/components/CodeEditor/EditorPane.tsx
  → readOnly: false
  → add onChange handler → onFileChange callback

src/pages/Editor/components/CodeEditor/useCodeEditor.ts
  → add onFileChange (debounced 500ms)
  → writes to codeEditorStore + IDB on every edit

src/store/codeEditorStore.ts
  → add modifiedFiles: Set<string>
  → add markFileModified, clearModifiedFiles

src/pages/Editor/components/CodeEditor/TabBar.tsx
  → show accent dot on modified tabs

src/pages/Editor/components/CodeEditor/Explorer/ExplorerItem.tsx
  → show accent dot next to modified files

src/utils/continueGeneration.ts
  → classify complete files separately
  → pass allPaths + completeFiles to onFileListReady
  → onFileListReady signature: (allPaths, completePaths)

src/utils/generationCallbacks.ts
  → update onFileListReady signature to accept completePaths
  → mark completePaths items as status: 'done' immediately

src/utils/generateCode.ts
  → update onFileListReady call: pass empty [] as completePaths

src/components/nodes/MicroserviceNode/useMicroserviceNode.ts
  → call codeStore.clearModifiedFiles() before runFullGeneration
  → call codeStore.clearModifiedFiles() before handleContinue
```

---

## Verification

### Feature 1 — Minimise

- [ ] Modal has — button in header
- [ ] Click — → modal disappears, pill appears bottom-right
- [ ] Pill shows "Generating... 12 / 48 files" with pulsing dot
- [ ] Generation continues while minimised — count increments in pill
- [ ] Click pill → modal reopens showing current progress
- [ ] Pill has ■ stop button — click → aborts generation + pill disappears
- [ ] Generation completes while minimised → pill shows "Generation complete — 48 files"
- [ ] Pill auto-dismisses after 5 seconds when generation is done

### Feature 2 — Editable files

- [ ] Click a generated file → Monaco editor is editable (cursor appears)
- [ ] Type a change → dot appears on tab within 500ms
- [ ] Dot appears next to filename in explorer
- [ ] Refresh page → edited content persists (saved to IDB)
- [ ] Click Generate again → modified markers cleared
- [ ] Click Continue → modified markers cleared

### Feature 3 — Continue shows all files

- [ ] Generate 48 files, abort at file 20
- [ ] Click Continue → modal opens
- [ ] Modal immediately shows all 48 files
- [ ] Files 1-19 show ✓ done (green)
- [ ] File 20 shows as incomplete (amber INCOMPLETE badge)
- [ ] Files 21-48 show · waiting
- [ ] Progress bar shows "19 / 48" immediately on open
- [ ] Count increments from 19 as remaining files generate
- [ ] Final count reaches 48 / 48
