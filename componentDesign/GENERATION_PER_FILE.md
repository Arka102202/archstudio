# Code Generation — Per-File Generation Approach

> Claude Code: this document REPLACES the single-call generation approach.
> Remove generateCode.ts streaming logic entirely.
> This is a complete rewrite of how generation works.
> Read every section before changing any file.

---

## Overview

Generation is split into two phases:

**Phase 1 — File list** (one small API call)
Send the architecture + directory structure to Claude.
Ask for a JSON array of file paths only. Nothing else.
Fast — completes in ~5 seconds.

**Phase 2 — Per-file generation** (one API call per file)
For each path in the list, make one focused API call.
"Generate ONLY this file. Here is the full context."
The entire response body is the file content — no XML tags, no parsing.
Each call completes in 10-30 seconds.

---

## New File Structure

```
src/utils/
├── getFileList.ts          ← Phase 1: get list of files to generate
├── generateSingleFile.ts   ← Phase 2: generate one file
├── generateCode.ts         ← orchestrator: runs Phase 1 then Phase 2 in sequence
└── continueGeneration.ts   ← updated: skips existing files, regenerates incomplete ones
```

---

## `src/utils/getFileList.ts`

```typescript
import DIRECTORY_SPEC     from '@/prompts/springBootDirectory.md?raw'
import { getMessagesUrl } from '@utils/proxyUrl'

const FILE_LIST_SYSTEM_PROMPT = `You are an expert software developer.

You will receive an architecture JSON and a directory structure specification.
Analyse both and return the complete list of files that must be generated.

Return ONLY a valid JSON array of file path strings.
No explanation. No markdown. No code fences. Just the raw JSON array.

Example output:
["school-service/src/main/java/com/admin/SchoolApplication.java","school-service/src/main/java/com/admin/entity/Student.java"]`

export async function getFileList(params: {
  architecture: object
  signal:       AbortSignal
}): Promise<string[]> {

  const userMessage =
`ARCHITECTURE:
${JSON.stringify(params.architecture, null, 2)}

DIRECTORY STRUCTURE:
${DIRECTORY_SPEC}

Return the complete list of files to generate as a JSON array of path strings.`

  const response = await fetch(getMessagesUrl(), {
    method:  'POST',
    signal:  params.signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:    'claude-sonnet-4',
      stream:   false,   // no streaming needed — response is just a small JSON array
      messages: [
        { role: 'system', content: FILE_LIST_SYSTEM_PROMPT },
        { role: 'user',   content: userMessage },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as any).error?.message ?? `HTTP ${response.status}`)
  }

  const data = await response.json()

  // OpenAI response format: choices[0].message.content
  const content = data.choices?.[0]?.message?.content ?? ''

  // Parse the JSON array — strip any accidental markdown fences
  const clean = content
    .replace(/```json/g, '')
    .replace(/```/g,     '')
    .trim()

  try {
    const list = JSON.parse(clean)
    if (!Array.isArray(list)) throw new Error('Not an array')
    return list as string[]
  } catch {
    throw new Error(`Failed to parse file list from Claude response: ${content}`)
  }
}
```

---

## `src/utils/generateSingleFile.ts`

```typescript
import DIRECTORY_SPEC     from '@/prompts/springBootDirectory.md?raw'
import { getMessagesUrl } from '@utils/proxyUrl'
import { db }             from '@db'

const SINGLE_FILE_SYSTEM_PROMPT = `You are an expert software developer.

You will receive:
1. A file path to generate
2. An architecture JSON describing the full microservice
3. A directory structure specification

Generate ONLY the requested file. Complete, production-ready content.

RULES:
- Follow the architecture JSON exactly — no hallucination
- Use exact field names, types, methods, endpoints from the JSON
- Output ONLY the raw file content
- No explanation, no markdown fences, no extra text
- Just the complete file content ready to save`

export async function generateSingleFile(params: {
  filePath:     string
  architecture: object
  msId:         string
  projectId:    string
  signal:       AbortSignal
  onChunk:      (chunk: string) => void   // for live preview in modal
  onComplete:   (content: string) => void
  onError:      (err: Error) => void
}): Promise<void> {

  const userMessage =
`FILE TO GENERATE:
${params.filePath}

ARCHITECTURE:
${JSON.stringify(params.architecture, null, 2)}

DIRECTORY STRUCTURE:
${DIRECTORY_SPEC}

Generate the complete content for: ${params.filePath}`

  let content = ''

  try {
    const response = await fetch(getMessagesUrl(), {
      method:  'POST',
      signal:  params.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:    'claude-sonnet-4',
        stream:   true,
        messages: [
          { role: 'system', content: SINGLE_FILE_SYSTEM_PROMPT },
          { role: 'user',   content: userMessage },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error((err as any).error?.message ?? `HTTP ${response.status}`)
    }

    // Stream the file content
    const reader  = response.body!.getReader()
    const decoder = new TextDecoder()
    let   buffer  = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') continue
        try {
          const event = JSON.parse(data)
          const chunk = event.choices?.[0]?.delta?.content ?? ''
          if (!chunk) continue
          content += chunk
          params.onChunk(chunk)
        } catch { continue }
      }
    }

    // Write to IDB
    await db.generatedFiles.put({
      id:          `${params.msId}:${params.filePath}`,
      msId:        params.msId,
      projectId:   params.projectId,
      filePath:    params.filePath,
      content:     content.trim(),
      generatedAt: Date.now(),
    })

    params.onComplete(content.trim())

  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    params.onError(err as Error)
  }
}
```

---

## `src/utils/generateCode.ts` — Rewrite as Orchestrator

Replace the entire file with:

```typescript
import { getFileList }        from './getFileList'
import { generateSingleFile } from './generateSingleFile'
import { exportArchitecture } from './exportArchitecture'

export async function generateCode(params: {
  architecture:        object
  msId:                string
  projectId:           string
  signal:              AbortSignal
  onFileListReady:     (paths: string[]) => void  // Phase 1 done — list received
  onFileStart:         (path: string) => void
  onFileChunk:         (path: string, chunk: string) => void
  onFileComplete:      (path: string, content: string) => void
  onThinkingChunk?:    (chunk: string) => void   // reuse for "fetching file list..."
  onGenerationStarted?: () => void
  onDone:              () => void
  onError:             (err: Error) => void
}): Promise<void> {

  // ── Phase 1: Get file list ─────────────────────────────────────────────────
  params.onThinkingChunk?.('Analysing architecture and planning file structure...')

  let filePaths: string[]
  try {
    filePaths = await getFileList({
      architecture: params.architecture,
      signal:       params.signal,
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    params.onError(err as Error)
    return
  }

  if (params.signal.aborted) return

  params.onFileListReady(filePaths)
  params.onGenerationStarted?.()

  // ── Phase 2: Generate each file sequentially ───────────────────────────────
  for (const filePath of filePaths) {
    if (params.signal.aborted) break

    params.onFileStart(filePath)

    let fileErrored = false
    await generateSingleFile({
      filePath,
      architecture: params.architecture,
      msId:         params.msId,
      projectId:    params.projectId,
      signal:       params.signal,
      onChunk:      chunk => params.onFileChunk(filePath, chunk),
      onComplete:   content => params.onFileComplete(filePath, content),
      onError:      err => {
        fileErrored = true
        console.error(`[archflow] Failed to generate ${filePath}:`, err.message)
        // Mark as error in progress but continue with remaining files
        params.onFileComplete(filePath, `// Error generating this file: ${err.message}`)
      },
    })

    if (params.signal.aborted) break
  }

  if (!params.signal.aborted) {
    params.onDone()
  }
}
```

---

## `src/utils/continueGeneration.ts` — Updated

Continue now:
1. Gets the full file list from Claude (Phase 1)
2. Filters out files that are already complete in IDB
3. Marks files that are incomplete (in IDB but truncated)
4. Generates incomplete files first, then missing files

```typescript
import { getFileList }        from './getFileList'
import { generateSingleFile } from './generateSingleFile'
import { db }                 from '@db'

export async function continueGeneration(params: {
  architecture:    object
  msId:            string
  projectId:       string
  signal:          AbortSignal
  onFileListReady: (paths: string[]) => void
  onFileStart:     (path: string, changeType: 'incomplete' | 'missing') => void
  onFileChunk:     (path: string, chunk: string) => void
  onFileComplete:  (path: string, content: string) => void
  onDone:          () => void
  onError:         (err: Error) => void
}): Promise<void> {

  // 1. Get the complete expected file list
  let allPaths: string[]
  try {
    allPaths = await getFileList({
      architecture: params.architecture,
      signal:       params.signal,
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    params.onError(err as Error)
    return
  }

  if (params.signal.aborted) return

  // 2. Load all existing files from IDB
  const existingRows = await db.generatedFiles
    .where('msId').equals(params.msId)
    .toArray()

  const existingFiles: Record<string, string> = {}
  existingRows.forEach(row => {
    existingFiles[row.filePath] = row.content
  })

  // 3. Classify each expected file
  const incompleteFiles: string[] = []
  const missingFiles:    string[] = []

  for (const path of allPaths) {
    const content = existingFiles[path]

    if (!content) {
      // File does not exist at all
      missingFiles.push(path)
    } else if (isFileIncomplete(content, path)) {
      // File exists but is truncated
      incompleteFiles.push(path)
    }
    // else: file is complete — skip
  }

  const todoFiles = [...incompleteFiles, ...missingFiles]
  params.onFileListReady(todoFiles)

  if (todoFiles.length === 0) {
    params.onDone()
    return
  }

  // 4. Generate incomplete files first, then missing files
  for (const filePath of todoFiles) {
    if (params.signal.aborted) break

    const changeType = incompleteFiles.includes(filePath) ? 'incomplete' : 'missing'
    params.onFileStart(filePath, changeType)

    await generateSingleFile({
      filePath,
      architecture: params.architecture,
      msId:         params.msId,
      projectId:    params.projectId,
      signal:       params.signal,
      onChunk:      chunk   => params.onFileChunk(filePath, chunk),
      onComplete:   content => params.onFileComplete(filePath, content),
      onError:      err     => {
        console.error(`[archflow] Continue failed for ${filePath}:`, err.message)
        params.onFileComplete(filePath, `// Error: ${err.message}`)
      },
    })
  }

  if (!params.signal.aborted) {
    params.onDone()
  }
}

// ── Helper: detect incomplete file content ──────────────────────────────────

function isFileIncomplete(content: string, filePath: string): boolean {
  const trimmed = content.trim()
  if (!trimmed) return true

  const ext = filePath.split('.').at(-1)?.toLowerCase()

  if (ext === 'java') {
    // Java file must end with a closing brace
    return !trimmed.endsWith('}')
  }

  if (ext === 'yml' || ext === 'yaml') {
    // YAML file is likely incomplete if it ends mid-line (no newline at end)
    return !trimmed.includes('\n') && trimmed.length < 20
  }

  if (ext === 'xml') {
    // XML must end with a closing tag
    return !trimmed.endsWith('>')
  }

  if (ext === 'gradle') {
    return !trimmed.endsWith('}')
  }

  // For any other type, if content is very short it's probably incomplete
  return trimmed.length < 10
}
```

---

## `codeEditorStore` — Add `onFileListReady` handler

Add to `makeGenerationCallbacks` in `src/utils/generationCallbacks.ts`:

```typescript
onFileListReady: (paths: string[]) => {
  // Pre-populate fileProgress with all files as 'waiting'
  const items: FileProgressItem[] = paths.map(path => ({
    path,
    fileName:   path.split('/').at(-1) ?? path,
    category:   categoryFromPath(path),
    status:     'waiting' as const,
    liveLines:  [],
    changeType: 'full' as const,
  }))
  codeStore.setFileProgress(items)
},
```

For `continueGeneration`, the `onFileStart` callback also receives `changeType`:

```typescript
onFileStart: (path: string, changeType: 'incomplete' | 'missing') => {
  codeStore.updateFileProgress(path, {
    status:     'streaming',
    changeType: changeType,
  })
},
```

---

## Progress Modal — Phase 1 display

During Phase 1 (file list being fetched), show the thinking UI:

```
⟳  Planning files...
   Analysing architecture and planning file structure...
```

Once `onFileListReady` fires, all files appear as `·` waiting immediately —
the user sees the full list before generation starts. Then they fill in one
by one as each file completes.

---

## Summary of Files Changed / Created

### New files
```
src/utils/getFileList.ts
src/utils/generateSingleFile.ts
```

### Rewritten files
```
src/utils/generateCode.ts       ← now orchestrates Phase 1 + Phase 2
src/utils/continueGeneration.ts ← uses getFileList + generateSingleFile
                                   includes isFileIncomplete helper
```

### Updated files
```
src/utils/generationCallbacks.ts
  → add onFileListReady handler
  → update onFileStart to handle changeType from continueGeneration

src/utils/regenerateWithDiff.ts
  → use generateSingleFile for each affected file instead of streaming
  → no more <file> tag parsing in diff path either
```

---

## Verification

### Phase 1 — File list
- [ ] Click Generate → modal shows "Planning files..." thinking indicator
- [ ] After ~5 seconds → all expected file paths appear as · waiting items
- [ ] File list matches the architecture — correct entity, service, controller files
- [ ] File count shown: "0 / 48 files"

### Phase 2 — Per file generation
- [ ] Files generate one by one — each transitions waiting → streaming → done
- [ ] Live code preview shows the current file being streamed
- [ ] Each file appears in the Code tab explorer as it completes
- [ ] No `<file>` tag parsing anywhere — response IS the content
- [ ] No XML corruption possible

### Abort
- [ ] Click Stop mid-generation → current file in progress is saved
- [ ] Remaining files stay as · waiting (not errored)
- [ ] Continue picks up from where it stopped

### Continue
- [ ] Run generation, abort at file 20/48
- [ ] Click Continue → Phase 1 runs → file list returned
- [ ] 20 complete files skipped automatically
- [ ] Any incomplete file detected and marked as 'incomplete' (amber INCOMPLETE badge)
- [ ] Missing files marked as 'missing' (green NEW badge)
- [ ] Only incomplete + missing files generated

### Error resilience
- [ ] If one file fails → error message stored, generation continues to next file
- [ ] Failed file shown with error state in modal
- [ ] Other files not affected by one failure
