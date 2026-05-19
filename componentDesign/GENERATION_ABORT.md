# Generation — Remove Timeout, Add Abort Control

> Claude Code: read this in full before writing a single line.
> This REPLACES the timeout logic from CODE_GENERATION_CONTINUE.md and
> GENERATION_THINKING_UI.md entirely.
> Three things change: generateCode.ts, codeEditorStore, GenerationProgressModal.
> Do not change anything not explicitly mentioned here.

---

## What Changes

1. Remove all timeout logic — no `readWithTimeout`, no `THINKING_TIMEOUT`,
   no `GENERATION_TIMEOUT`, no `streamTimedOut` state
2. Stream reads until `[DONE]` arrives — exactly as the API intends
3. User can abort via Stop button or by closing the modal during generation
4. `AbortController` is the only mechanism for stopping the stream

---

## Change 1 — `codeEditorStore.ts`

### Remove
- `streamTimedOut: boolean`
- `setStreamTimedOut: (v: boolean) => void`

### Add
```typescript
// AbortController ref for the current generation — held in the store
// so the modal Stop button and × button can call abort()
abortController:    AbortController | null
setAbortController: (c: AbortController | null) => void
abortGeneration:    () => void   // calls abort() + cleans up
```

Implementation:
```typescript
abortController: null,

setAbortController: (c) => set({ abortController: c }),

abortGeneration: () => {
  const { abortController } = get()
  if (abortController) {
    abortController.abort()
  }
  set({
    abortController:  null,
    isGenerating:     false,
    generatingMsId:   null,
  })
},
```

---

## Change 2 — `generateCode.ts`

### Remove entirely
- `readWithTimeout` helper function
- All references to `THINKING_TIMEOUT` and `GENERATION_TIMEOUT`
- The try/catch around `reader.read()` that checked for `STREAM_TIMEOUT`
- `onStreamTimeout` callback from params

### Add `signal` to params
```typescript
export async function generateCode(params: {
  architecture:     object
  msId:             string
  projectId:        string
  signal:           AbortSignal    // ← ADD — from AbortController.signal
  onFileStart:      (path: string) => void
  onFileChunk:      (path: string, chunk: string) => void
  onFileComplete:   (path: string, content: string) => void
  onThinkingChunk?: (chunk: string) => void
  onGenerationStarted?: () => void
  onDone:           () => void
  onError:          (err: Error) => void
}): Promise<void>
```

### Pass signal to fetch
```typescript
const response = await fetch(getMessagesUrl(), {
  method:  'POST',
  signal:  params.signal,      // ← ADD
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ... }),
})
```

### Replace stream loop — bare `reader.read()`, no timeout wrapper
```typescript
while (true) {
  const { done, value } = await reader.read()
  // done becomes true when [DONE] arrives and stream closes naturally
  if (done) break

  // ... rest of chunk processing unchanged ...
}

params.onDone()
```

### Handle AbortError
Wrap the entire function body in a try/catch for `AbortError`:

```typescript
try {
  // ... fetch + stream loop ...
  params.onDone()
} catch (err) {
  if ((err as Error).name === 'AbortError') {
    // User aborted — flush any partial file in progress
    if (insideFile && currentContent && currentPath) {
      params.onFileComplete(currentPath, currentContent)
      await db.generatedFiles.put({
        id:          `${params.msId}:${currentPath}`,
        msId:        params.msId,
        projectId:   params.projectId,
        filePath:    currentPath,
        content:     currentContent,
        generatedAt: Date.now(),
      })
    }
    // Do not call onError — abort is intentional, not an error
    return
  }
  params.onError(err as Error)
}
```

### Apply same changes to `continueGeneration.ts` and `regenerateWithDiff.ts`
Both functions get the same `signal` param, same fetch signal, same bare
`reader.read()`, same AbortError catch block.

---

## Change 3 — `makeGenerationCallbacks` + `runFullGeneration`

### In `src/utils/generationCallbacks.ts`
Remove `onStreamTimeout` from the returned callbacks object.

### In `runFullGeneration` and `handleContinue` in `useMicroserviceNode.ts`

Create the `AbortController` before calling `generateCode` / `continueGeneration`,
store it in `codeEditorStore`, and pass its signal:

```typescript
// In runFullGeneration:
const controller = new AbortController()
codeStore.setAbortController(controller)

await generateCode({
  architecture,
  msId,
  projectId,
  signal:   controller.signal,    // ← pass signal
  ...makeGenerationCallbacks({ msId, projectId, diffMode: false }),
})

// Clean up after completion
codeStore.setAbortController(null)
```

Same pattern in `handleContinue` and the diff path in `RegenerateModal`.

---

## Change 4 — `GenerationProgressModal.tsx`

### Add Stop button

When `isGenerating` is true, show a Stop button in the modal footer:

```tsx
{/* Footer — shown during generation */}
{isGenerating && (
  <div className="px-5 pb-4 flex justify-end border-t border-[var(--color-border)] pt-3">
    <button
      onClick={() => {
        codeStore.abortGeneration()
      }}
      className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold
                 rounded-[var(--radius-sm)] cursor-pointer border-none transition-colors"
      style={{
        background: 'var(--color-danger-light)',
        color:      'var(--color-danger)',
      }}
    >
      {/* Stop icon */}
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
      </svg>
      Stop generation
    </button>
  </div>
)}
```

### × button behaviour

When `isGenerating` is true, the × button aborts the generation AND closes
the modal — do not just close without aborting:

```tsx
<button
  onClick={() => {
    if (isGenerating) {
      codeStore.abortGeneration()
    }
    store.close()
  }}
  className="..."
>
  ×
</button>
```

This means the × button is **always enabled** — no more disabling it during
generation. The user can always close and stop at any time.

### Remove "stream interrupted" warning UI

Remove the `streamTimedOut` conditional UI entirely — it no longer exists.

### Add "Generation stopped" state

When generation was aborted (not completed), show a neutral stopped state.
Track this with a local boolean derived from: `!isGenerating && partialFiles`.

Actually, track it simply: add `generationStopped: boolean` to
`generationProgressStore` (not codeEditorStore — this is purely modal UI state):

```typescript
interface GenerationProgressStore {
  isOpen:   boolean
  msLabel:  string
  stopped:  boolean          // ← ADD: true when user aborted
  open:     (msLabel: string) => void
  close:    () => void
  setStopped: (v: boolean) => void
}
```

In `makeGenerationCallbacks`, when abort happens cleanly (no onError called),
set `progressStore.setStopped(true)`.

But actually: since `onDone` is not called on abort, use this to detect it:
in `runFullGeneration`, after `await generateCode(...)` resolves, check if
`controller.signal.aborted` is true:

```typescript
await generateCode({ ..., signal: controller.signal, ... })

if (controller.signal.aborted) {
  progressStore.setStopped(true)
} else {
  // normal completion — stopped stays false
}
codeStore.setAbortController(null)
```

Show in the modal when `progressStore.stopped` is true:

```tsx
{progressStore.stopped && !isGenerating && (
  <div className="px-5 pb-3 flex items-center gap-2"
       style={{ color: 'var(--color-text-3)' }}>
    <span className="text-[11px]">■</span>
    <span className="text-[11px] font-mono">
      Generation stopped — {doneCount} of {totalCount || '?'} files saved
    </span>
  </div>
)}
```

Reset `stopped` to false in `progressStore.open()`.

---

## Summary of Files Changed

```
src/store/codeEditorStore.ts
  → remove streamTimedOut, setStreamTimedOut
  → add abortController, setAbortController, abortGeneration

src/store/generationProgressStore.ts
  → add stopped: boolean
  → add setStopped: (v: boolean) => void
  → reset stopped to false in open()

src/utils/generateCode.ts
  → remove readWithTimeout entirely
  → remove onStreamTimeout from params
  → add signal: AbortSignal to params
  → pass signal to fetch
  → bare reader.read() — no timeout
  → catch AbortError — flush partial file, return cleanly

src/utils/continueGeneration.ts
  → same changes as generateCode.ts

src/utils/regenerateWithDiff.ts
  → same changes as generateCode.ts

src/utils/generationCallbacks.ts
  → remove onStreamTimeout callback

src/components/nodes/MicroserviceNode/useMicroserviceNode.ts
  → create AbortController before each generation call
  → store it via codeStore.setAbortController()
  → pass controller.signal to generateCode / continueGeneration
  → after await resolves, check signal.aborted → progressStore.setStopped
  → codeStore.setAbortController(null) after completion

src/components/shared/GenerationProgressModal/GenerationProgressModal.tsx
  → × button always enabled — aborts if generating, always closes
  → add Stop button in footer during generation
  → remove streamTimedOut warning UI
  → add "Generation stopped" state when progressStore.stopped = true
```

---

## Verification

### Normal completion

- [ ] Click Generate → stream reads until `[DONE]` → `onDone` fires
- [ ] All files appear → modal shows "Generation Complete"
- [ ] No timeout fires during thinking phase — Claude can think as long as needed
- [ ] No timeout fires between files — gaps of any duration are fine

### Stop button

- [ ] During generation → Stop button visible in modal footer
- [ ] Click Stop → fetch aborted → stream stops immediately
- [ ] Partial file in progress is flushed and saved to IDB
- [ ] Modal shows "Generation stopped — X of Y files saved"
- [ ] codeStore.isGenerating becomes false
- [ ] Continue button on MS node is now available to finish

### × button during generation

- [ ] Click × during generation → aborts fetch + closes modal
- [ ] Same cleanup as Stop button
- [ ] Files generated so far are saved in IDB

### × button after completion

- [ ] Click × after "Generation Complete" → just closes modal, no abort

### No timeout anywhere

- [ ] Claude thinks for 90 seconds before first file → no timeout fires
- [ ] Large gap between files → no timeout fires
- [ ] Only `[DONE]` or user action ends the stream
