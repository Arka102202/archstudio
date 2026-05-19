# Code Generation — Stream Timeout + Continue Button

> Claude Code: read this in full before writing a single line.
> This document adds two things:
>   1. Stream timeout detection in generateCode.ts
>   2. A "Continue" button on the MS node + continueGeneration.ts
> Do not change anything not explicitly mentioned here.

---

## Fix 1 — Stream Timeout Detection

### Problem

When the proxy closes the connection or Claude stops mid-file, the stream
reader's `done` flag never becomes true. The last file sits in `streaming`
state forever with no indication to the user.

### Fix — add a timeout watchdog in `generateCode.ts`

Wrap the stream reader in a watchdog that fires if no chunk arrives for
30 seconds. If it fires, flush whatever is in the buffer and call `onDone`.

In `parseGenerationStream` (or the inline stream loop in `generateCode.ts`),
replace the bare `reader.read()` call with a race against a timeout:

```typescript
// Add this helper above the stream loop:
function readWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('STREAM_TIMEOUT'))
    }, timeoutMs)

    reader.read().then(result => {
      clearTimeout(timer)
      resolve(result)
    }).catch(err => {
      clearTimeout(timer)
      reject(err)
    })
  })
}
```

Replace the `while (true)` stream loop header:

```typescript
// OLD:
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  ...
}

// NEW:
while (true) {
  let done: boolean
  let value: Uint8Array | undefined

  try {
    const result = await readWithTimeout(reader, 30000)  // 30 second timeout
    done  = result.done
    value = result.value
  } catch (err) {
    if ((err as Error).message === 'STREAM_TIMEOUT') {
      // Stream went silent — flush remaining buffer and finish
      // If there is a partial file in progress, close it out
      if (insideFile && currentContent) {
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
      params.onStreamTimeout?.()   // notify UI
      break
    }
    throw err   // re-throw unexpected errors
  }

  if (done) break
  // ... rest of chunk processing unchanged ...
}
```

### Add `onStreamTimeout` to the params interface

In `generateCode.ts`, add to the params type:

```typescript
export async function generateCode(params: {
  architecture:    object
  msId:            string
  projectId:       string
  onFileStart:     (path: string) => void
  onFileChunk:     (path: string, chunk: string) => void
  onFileComplete:  (path: string, content: string) => void
  onDone:          () => void
  onError:         (err: Error) => void
  onStreamTimeout?: () => void   // ← ADD THIS — called when stream goes silent
}): Promise<void>
```

### Add `streamTimedOut` to `codeEditorStore`

```typescript
streamTimedOut:    boolean
setStreamTimedOut: (v: boolean) => void
```

### Handle `onStreamTimeout` in `makeGenerationCallbacks`

In `src/utils/generationCallbacks.ts`:

```typescript
onStreamTimeout: () => {
  codeStore.setStreamTimedOut(true)
  codeStore.setGenerating(null)
}
```

### Show timeout warning in `GenerationProgressModal`

When `codeStore.streamTimedOut` is true, replace the spinner in the modal
title with a warning state and show an action button:

```tsx
{codeStore.streamTimedOut ? (
  <div className="flex flex-col gap-1">
    <p className="text-[14px] font-bold"
       style={{ color: 'var(--color-warning)' }}>
      ⚠ Stream interrupted
    </p>
    <p className="text-[10px] font-mono text-text-3">
      The connection timed out before all files were generated.
      Use the Continue button on the node to finish.
    </p>
  </div>
) : (
  <p className="text-[14px] font-bold text-text flex items-center gap-2">
    {isGenerating && <span className="animate-pulse ...">●</span>}
    {isGenerating ? 'Generating Code' : 'Generation Complete'}
  </p>
)}
```

Also enable the × close button immediately when `streamTimedOut` is true
(don't make the user wait):

```typescript
const canClose = !isGenerating || codeStore.streamTimedOut
```

---

## Fix 2 — "Continue" Button on MS Node

### Button placement

Four buttons on the MS node header — Export, Save, Diff, Generate, and now Continue:

```
[↗ Export] [💾 Save] [⟷ Diff] [▶ Generate] [⟳ Continue]
```

Continue button spec:
```tsx
<button
  onClick={handleContinue}
  disabled={isGenerating || !hasGeneratedFiles}
  title={!hasGeneratedFiles
    ? 'Generate code first'
    : 'Continue incomplete generation'}
  className="flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)]
             cursor-pointer transition-all duration-150 border-none
             disabled:opacity-40 disabled:cursor-not-allowed"
  style={{
    background: 'var(--color-warning-light)',
    color:      'var(--color-warning)',
    fontSize:   9,
    fontFamily: 'var(--font-mono)',
    fontWeight: 600,
  }}
>
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
       strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/>
    <path d="M3.51 15a9 9 0 1 0 .49-3.57"/>
  </svg>
  Continue
</button>
```

`hasGeneratedFiles`:
```typescript
const hasGeneratedFiles = Object.keys(codeStore.generatedFiles).length > 0
```

### `handleContinue` in `useMicroserviceNode.ts`

```typescript
const handleContinue = useCallback(async (e: React.MouseEvent) => {
  e.stopPropagation()
  if (!projectId) return

  const progressStore = useGenerationProgressStore.getState()
  const codeStore     = useCodeEditorStore.getState()

  codeStore.setGenerating(props.id)
  codeStore.setStreamTimedOut(false)
  progressStore.open(node.label)

  window.dispatchEvent(new CustomEvent('archflow-switch-tab', { detail: 'code' }))

  try {
    const architecture = await exportArchitecture(props.id, projectId)
    const callbacks    = makeGenerationCallbacks({
      msId:      props.id,
      projectId,
      diffMode:  false,
    })

    await continueGeneration({
      architecture,
      msId:      props.id,
      projectId,
      ...callbacks,
    })
  } catch (err) {
    codeStore.setGenerating(null)
    console.error('[archflow] Continue failed:', err)
  }
}, [props.id, projectId, node.label])
```

Add `handleContinue` to the hook's return object.

---

## Fix 3 — `src/utils/continueGeneration.ts`

```typescript
import DIRECTORY_SPEC     from '@/prompts/springBootDirectory.md?raw'
import { getMessagesUrl } from '@utils/proxyUrl'
import { db }             from '@db'
import { parseGenerationStream } from '@utils/generateCode'

// Paste the full text from CONTINUE_SYSTEM_PROMPT.md System Prompt section here:
const CONTINUE_SYSTEM_PROMPT = `You are an expert software developer continuing an incomplete code generation.
... (full text from CONTINUE_SYSTEM_PROMPT.md) ...`

export async function continueGeneration(params: {
  architecture:    object
  msId:            string
  projectId:       string
  onFileStart:     (path: string) => void
  onFileChunk:     (path: string, chunk: string) => void
  onFileComplete:  (path: string, content: string) => void
  onDone:          () => void
  onError:         (err: Error) => void
  onStreamTimeout?: () => void
}): Promise<void> {

  // 1. Load all already-generated files from IDB
  const existingRows = await db.generatedFiles
    .where('msId').equals(params.msId)
    .toArray()

  const existingFiles: Record<string, string> = {}
  existingRows.forEach(row => {
    existingFiles[row.filePath] = row.content
  })

  // 2. Build the already-generated XML block
  const alreadyGeneratedXml = Object.entries(existingFiles)
    .map(([path, content]) =>
      `<existing-file path="${path}">\n${content}\n</existing-file>`)
    .join('\n\n')

  // 3. Build user message
  const userMessage =
`ARCHITECTURE:
${JSON.stringify(params.architecture, null, 2)}

DIRECTORY STRUCTURE:
${DIRECTORY_SPEC}

ALREADY GENERATED FILES (do not regenerate these):
${alreadyGeneratedXml}

Generate ONLY the files that are missing from the complete application.
Compare the directory structure and architecture against the already generated
files above to determine what is missing. Generate only those missing files.`

  // 4. Call the API
  const response = await fetch(getMessagesUrl(), {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:    'claude-sonnet-4',
      stream:   true,
      messages: [
        { role: 'system', content: CONTINUE_SYSTEM_PROMPT },
        { role: 'user',   content: userMessage },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as any).error?.message ?? `HTTP ${response.status}`)
  }

  // 5. Parse the stream — same parser as generateCode
  await parseGenerationStream({
    response,
    msId:            params.msId,
    projectId:       params.projectId,
    onFileStart:     params.onFileStart,
    onFileChunk:     params.onFileChunk,
    onFileComplete:  params.onFileComplete,
    onStreamTimeout: params.onStreamTimeout,
  })

  params.onDone()
}
```

Export from `src/utils/index.ts`:
```typescript
export { continueGeneration } from './continueGeneration'
```

---

## Summary of Files Changed

```
src/utils/generateCode.ts
  → add readWithTimeout() helper
  → replace reader.read() with readWithTimeout(reader, 30000)
  → flush partial file on timeout
  → call params.onStreamTimeout?.() on timeout
  → add onStreamTimeout to params type

src/utils/continueGeneration.ts         ← NEW
  → reads existing files from IDB
  → sends architecture + directory spec + existing files to Claude
  → uses CONTINUE_SYSTEM_PROMPT
  → reuses parseGenerationStream from generateCode.ts

src/utils/generationCallbacks.ts
  → add onStreamTimeout callback that sets codeStore.streamTimedOut = true

src/store/codeEditorStore.ts
  → add streamTimedOut: boolean
  → add setStreamTimedOut: (v: boolean) => void

src/components/shared/GenerationProgressModal/GenerationProgressModal.tsx
  → show ⚠ Stream interrupted warning when streamTimedOut = true
  → enable × close button immediately when streamTimedOut = true
  → show "Use the Continue button on the node to finish" message

src/components/nodes/MicroserviceNode/useMicroserviceNode.ts
  → add handleContinue
  → add hasGeneratedFiles derived from codeStore
  → reset streamTimedOut to false on continue click

src/components/nodes/MicroserviceNode/MicroserviceNode.tsx
  → add Continue button to header

src/prompts/
  → add CONTINUE_SYSTEM_PROMPT.md (copy from componentDesign/)
```

---

## Verification

### Stream timeout

- [ ] Start generation, manually kill the proxy (`Ctrl+C`) mid-generation
- [ ] Within 30 seconds, modal switches from spinning to "⚠ Stream interrupted"
- [ ] "Use the Continue button on the node to finish" message appears
- [ ] × close button becomes enabled immediately
- [ ] Partially generated files are saved to IDB (not lost)
- [ ] No infinite spinner — timeout fires reliably at ~30 seconds

### Continue button

- [ ] Continue button disabled when no files have been generated yet
- [ ] Continue button enabled after any generation (partial or complete)
- [ ] Click Continue → progress modal opens
- [ ] Claude receives all existing files as context
- [ ] Claude generates ONLY the missing files
- [ ] Already-generated files are not regenerated
- [ ] New files appear in the progress modal and Code tab
- [ ] After Continue completes — all files present in the explorer

### Continue after timeout

- [ ] Run generation → proxy times out at 47/48 files
- [ ] Modal shows timeout warning
- [ ] Close modal
- [ ] Click Continue on MS node
- [ ] Modal opens again — shows only the 1 missing file
- [ ] That file gets generated and saved
- [ ] All 48 files now present in IDB and Code tab
