# Code Generation — Design & Build Specification

> Claude Code: read this in full before writing a single line.
> Follow every rule in CLAUDE.md alongside this document.
> Prerequisites: CODE_EDITOR.md must be implemented (Monaco editor in Code tab).
> MS_EXPORT_BUTTON.md must be implemented (exportArchitecture function).
> The versioning system (versions IDB table, saveVersion) must be implemented.

---

## 1. What This Builds

1. **Settings page** (`/settings`) — local proxy URL configuration
2. **Generate button** on MicroserviceNode header
3. **`generateCode.ts`** — streams all files from Claude API in one call
4. **`regenerateWithDiff.ts`** — diff-based regeneration for subsequent runs
5. **Confirmation modal** — shown on subsequent generate attempts
6. **Live streaming UI** — files appear in Code tab as Claude writes them

> **How the API connection works:**
> This app uses [claude-max-api-proxy](https://www.npmjs.com/package/claude-max-api-proxy)
> to route API calls through your locally-installed Claude Code CLI.
> No Anthropic API key is needed. Your Claude Code / Max subscription covers the cost.
>
> **One-time machine setup (run once, not part of the app build):**
> ```bash
> npm install -g claude-max-api-proxy
> ```
> **Before using Generate (run each session):**
> ```bash
> claude-max-api-proxy
> # Starts a local proxy on http://127.0.0.1:3456
> # Keep this terminal open while using archflow
> ```
> The app's Settings page lets users change the proxy URL if they run it on a different port.

---

## 2. Settings Page

### Route

Add to `src/routes/AppRouter.tsx`:
```typescript
<Route path="/settings" element={<SettingsPage />} />
```

Add `SETTINGS = '/settings'` to `src/constants/routes.ts`.

### File structure

```
src/pages/Settings/
├── Settings.tsx
├── useSettings.ts
├── types.ts
└── index.ts
```

### Layout

```
┌────────────────────────────────────────────────────────────┐
│  ←  Settings                                               │  ← top bar with back button
├────────────────────────────────────────────────────────────┤
│                                                            │
│  AI Configuration                                          │
│  ─────────────────────────────────────────────────────     │
│                                                            │
│  Local Proxy URL                                           │
│  archflow routes AI calls through claude-max-api-proxy     │
│  running on your machine. Start it with:                   │
│    npx claude-max-api-proxy                                │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  http://127.0.0.1:3456                               │  │
│  └──────────────────────────────────────────────────────┘  │
│  [Save]                                                    │
│                                                            │
│  ● Connected                                               │  ← shown when proxy reachable
│  ✕ Proxy not reachable — is claude-max-api-proxy running?  │  ← shown when not reachable
│                                                            │
├────────────────────────────────────────────────────────────┤
│  Danger Zone                                               │
│  ─────────────────────────────────────────────────────     │
│  Clear all generated code          [Clear]                 │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### `useSettings.ts`

```typescript
const PROXY_URL_KEY        = 'archflow_proxy_url'
const DEFAULT_PROXY_URL    = 'http://127.0.0.1:3456'

export function useSettings() {
  const navigate = useNavigate()

  const [proxyUrl,    setProxyUrl]    = useState(() =>
    localStorage.getItem(PROXY_URL_KEY) ?? DEFAULT_PROXY_URL
  )
  const [saveStatus,  setSaveStatus]  = useState<'idle' | 'saved'>('idle')
  const [proxyStatus, setProxyStatus] = useState<'unknown' | 'online' | 'offline'>('unknown')

  // Check if the proxy is reachable
  const checkProxy = useCallback(async (url: string) => {
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) })
      setProxyStatus(res.ok ? 'online' : 'offline')
    } catch {
      setProxyStatus('offline')
    }
  }, [])

  // Check on mount and whenever URL changes
  useEffect(() => {
    checkProxy(proxyUrl)
  }, [proxyUrl, checkProxy])

  const handleSave = () => {
    const trimmed = proxyUrl.trim().replace(/\/$/, '')   // strip trailing slash
    localStorage.setItem(PROXY_URL_KEY, trimmed)
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
    checkProxy(trimmed)
  }

  const handleReset = () => {
    setProxyUrl(DEFAULT_PROXY_URL)
    localStorage.setItem(PROXY_URL_KEY, DEFAULT_PROXY_URL)
    checkProxy(DEFAULT_PROXY_URL)
  }

  return {
    proxyUrl, setProxyUrl,
    saveStatus, proxyStatus,
    handleSave, handleReset,
    handleBack: () => navigate(-1),
  }
}
```

### Accessing the proxy URL anywhere

Create `src/utils/proxyUrl.ts`:

```typescript
const PROXY_URL_KEY     = 'archflow_proxy_url'
const DEFAULT_PROXY_URL = 'http://127.0.0.1:3456'

export function getProxyUrl(): string {
  return localStorage.getItem(PROXY_URL_KEY) ?? DEFAULT_PROXY_URL
}

export function getMessagesUrl(): string {
  // claude-max-api-proxy exposes OpenAI-compatible endpoint, not Anthropic /v1/messages
  return `${getProxyUrl()}/v1/chat/completions`
}
```

Export from `src/utils/index.ts`.

### Navigation to Settings

Add a gear icon button to the top navigation bar of the Editor page and the
Project List page:

```tsx
<button
  onClick={() => navigate('/settings')}
  title="Settings"
  className="..."
>
  ⚙
</button>
```

---

## 3. Generate Button on MicroserviceNode

### Placement in header

Four buttons in the MS node header, left to right before the badges:

```
[MS icon]  Order Service   [↗ Export] [💾 Save] [⟷ Diff] [▶ Generate]  [Spring Boot]  [:8080]
```

### Button spec

```tsx
<button
  onClick={handleGenerate}
  disabled={isGenerating}
  title="Generate Spring Boot code"
  
  className="flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)]
             cursor-pointer transition-all duration-150 border-none
             disabled:opacity-40 disabled:cursor-not-allowed"
  style={{
    background: isGenerating ? 'var(--color-accent-light)' : 'var(--color-accent)',
    color:      'var(--color-accent-text)',
    fontSize:   9,
    fontFamily: 'var(--font-mono)',
    fontWeight: 600,
  }}
>
  {isGenerating ? (
    <>
      <span className="animate-spin text-[10px]">⟳</span>
      Generating...
    </>
  ) : (
    <>
      {/* Play/sparkle icon */}
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
      </svg>
      Generate
    </>
  )}
</button>
```

### `isGenerating` state

Add to `codeEditorStore`:

```typescript
isGenerating:    boolean
generatingMsId:  string | null   // which MS is currently generating
setGenerating:   (msId: string | null) => void
```

### `hasGeneratedFiles` — how to know if files exist

Add to `codeEditorStore`:

```typescript
generatedFiles: Record<string, string>
// key = virtual file path, value = generated content
// Empty object = no generated files yet
setGeneratedFile:   (path: string, content: string) => void
clearGeneratedFiles: (msId: string) => void
```

The Generate button checks: `Object.keys(generatedFiles).length > 0`

---

## 4. Confirmation Modal (Subsequent Runs)

### File structure

```
src/components/shared/RegenerateModal/
├── RegenerateModal.tsx
├── useRegenerateModal.ts
├── types.ts
└── index.ts
```

### Appearance

```
┌───────────────────────────────────────────────────────────┐
│  Regenerate Code?                                    [×]  │
│                                                           │
│  You have previously generated code for this             │
│  microservice. How would you like to proceed?            │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  ⟷  Apply Diff                                       │  │
│  │  Only regenerate files that changed since the        │  │
│  │  last saved version. Faster and more precise.        │  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  ↺  Regenerate All                                   │  │
│  │  Regenerate all files from scratch. Overwrites       │  │
│  │  all existing generated code.                        │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│                                    [Cancel]               │
└───────────────────────────────────────────────────────────┘
```

Both options are clickable cards, not plain buttons.
Active/hovered card gets `border: 1px solid var(--color-accent)`.

### Zustand store — `regenerateModalStore`

```typescript
interface RegenerateModalStore {
  isOpen:  boolean
  msId:    string | null
  open:    (msId: string) => void
  close:   () => void
}
```

Place `<RegenerateModal />` in `Editor.tsx` (always mounted, reads its own state).

---

## 5. `generateCode.ts` — Full Generation

### File location

`src/utils/generateCode.ts`

### Signature

```typescript
export async function generateCode(params: {
  architecture:    object          // from exportArchitecture()
  onFileStart:     (path: string) => void
  onFileChunk:     (path: string, chunk: string) => void
  onFileComplete:  (path: string, content: string) => void
  onDone:          () => void
  onError:         (err: Error) => void
}): Promise<void>
```

### System prompt

```typescript
const SYSTEM_PROMPT = `You are a Spring Boot code generator. 
You will receive a JSON object describing a microservice architecture.
Generate complete, production-ready Spring Boot code for all files.

Rules:
- Use Spring Boot 3.x and Java 17+
- Use Lombok annotations where specified
- Use proper JPA annotations for all entities
- Use @RestController and @RequestMapping for controllers
- Generate complete implementations, not stubs
- Use the exact package name from the architecture JSON
- Use the exact class names from the architecture JSON

Output format — you MUST use this exact format for every file:
<file path="FULL_FILE_PATH">
FILE_CONTENT_HERE
</file>

Generate files in this order:
1. Entity classes
2. Repository interfaces  
3. DTO classes
4. Service interfaces (if generateInterface = true)
5. Service implementations
6. Controller classes
7. application.yml
8. pom.xml or build.gradle
9. Dockerfile (if required)

Do not include any text outside of <file> tags.
Do not include markdown code fences inside <file> tags.`
```

### API call with streaming

```typescript
export async function generateCode(params) {
  const userMessage = `Generate complete Spring Boot code for this microservice architecture:

${JSON.stringify(params.architecture, null, 2)}`

  // Routes through claude-max-api-proxy running locally on the user's machine.
  // No API key needed — auth is handled by the proxy via the Claude Code CLI session.
  // The proxy exposes an OpenAI-compatible endpoint, so we use OpenAI message format.
  const response = await fetch(getMessagesUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model:   'claude-sonnet-4',   // proxy routes this to Claude Code CLI
      stream:  true,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userMessage },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error?.message ?? 'API call failed')
  }

  // Stream parsing
  const reader  = response.body!.getReader()
  const decoder = new TextDecoder()
  let   buffer  = ''

  // File parsing state
  let currentPath    = ''
  let currentContent = ''
  let insideFile     = false

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
        // OpenAI streaming format: choices[0].delta.content
        const chunk = event.choices?.[0]?.delta?.content ?? ''
        if (!chunk) continue

        // Parse file tags from streamed text
        parseStreamChunk(chunk, {
          currentPath,    currentContent, insideFile,
          onUpdate: (state) => {
            currentPath    = state.currentPath
            currentContent = state.currentContent
            insideFile     = state.insideFile
          },
          onFileStart:    params.onFileStart,
          onFileChunk:    params.onFileChunk,
          onFileComplete: params.onFileComplete,
        })
      } catch {
        // malformed JSON line — skip
      }
    }
  }

  params.onDone()
}
```

### Stream chunk parser

```typescript
function parseStreamChunk(
  chunk:     string,
  state:     ParseState,
) {
  // Process character by character looking for <file path="..."> and </file> tags
  // This handles the case where tags arrive split across multiple chunks

  let remaining = chunk

  while (remaining.length > 0) {
    if (!state.insideFile) {
      // Look for opening tag
      const openMatch = remaining.match(/<file path="([^"]+)">/s)
      if (openMatch) {
        const idx  = remaining.indexOf(openMatch[0])
        const path = openMatch[1]
        state.onUpdate({ ...state, currentPath: path, currentContent: '', insideFile: true })
        state.onFileStart(path)
        remaining = remaining.slice(idx + openMatch[0].length)
      } else {
        break
      }
    } else {
      // Look for closing tag
      const closeIdx = remaining.indexOf('</file>')
      if (closeIdx === -1) {
        // No closing tag yet — everything is file content
        state.currentContent += remaining
        state.onFileChunk(state.currentPath, remaining)
        state.onUpdate({ ...state })
        break
      } else {
        // Found closing tag
        const content = remaining.slice(0, closeIdx)
        state.currentContent += content
        if (content) state.onFileChunk(state.currentPath, content)
        state.onFileComplete(state.currentPath, state.currentContent)
        state.onUpdate({
          ...state,
          currentPath:    '',
          currentContent: '',
          insideFile:     false,
        })
        remaining = remaining.slice(closeIdx + '</file>'.length)
      }
    }
  }
}
```

---

## 6. `regenerateWithDiff.ts` — Diff-based Regeneration

### File location

`src/utils/regenerateWithDiff.ts`

### Signature

```typescript
export async function regenerateWithDiff(params: {
  currentArchitecture: object      // current exportArchitecture() output
  lastVersion:         object      // last saved version snapshot from IDB
  existingFiles:       Record<string, string>  // currently generated file contents
  onFileStart:         (path: string) => void
  onFileChunk:         (path: string, chunk: string) => void
  onFileComplete:      (path: string, content: string) => void
  onDone:              () => void
  onError:             (err: Error) => void
}): Promise<void>
```

### System prompt for diff

```typescript
const DIFF_SYSTEM_PROMPT = `You are a Spring Boot code generator.
You will receive:
1. A diff showing what changed in the architecture since last generation
2. The existing generated files that are affected by those changes

Update ONLY the files that need to change based on the diff.
Do not regenerate files that are unaffected.

Use the same output format:
<file path="FULL_FILE_PATH">
UPDATED_FILE_CONTENT
</file>

Only output files that have changed. Do not include unchanged files.`
```

### Building the diff prompt

```typescript
const diff = diffArchitecture(params.lastVersion, params.currentArchitecture)

const affectedFiles = findAffectedFiles(diff, params.existingFiles)

const userMessage = `Architecture changes since last generation:
${JSON.stringify(diff, null, 2)}

Existing files that may need updating:
${Object.entries(affectedFiles)
  .map(([path, content]) => `<existing-file path="${path}">\n${content}\n</existing-file>`)
  .join('\n\n')}

Update only the files that changed. Generate complete updated file contents.`
```

### `findAffectedFiles`

```typescript
function findAffectedFiles(
  diff:          DiffResult,
  existingFiles: Record<string, string>,
): Record<string, string> {
  const affected: Record<string, string> = {}

  // If entities changed → affected: entity files, repository files, service files
  if (diff.changed.entities || diff.added.entities || diff.removed.entities) {
    Object.entries(existingFiles).forEach(([path, content]) => {
      if (path.includes('/entity/') || path.includes('/repository/') || path.includes('/service/')) {
        affected[path] = content
      }
    })
  }

  // If DTOs changed → affected: DTO files, controller files
  if (diff.changed.dtos || diff.added.dtos || diff.removed.dtos) {
    Object.entries(existingFiles).forEach(([path, content]) => {
      if (path.includes('/dto/') || path.includes('/controller/')) {
        affected[path] = content
      }
    })
  }

  // If services changed → affected: service files
  if (diff.changed.services || diff.added.services || diff.removed.services) {
    Object.entries(existingFiles).forEach(([path, content]) => {
      if (path.includes('/service/')) {
        affected[path] = content
      }
    })
  }

  // If controllers changed → affected: controller files
  if (diff.changed.controllers || diff.added.controllers || diff.removed.controllers) {
    Object.entries(existingFiles).forEach(([path, content]) => {
      if (path.includes('/controller/')) {
        affected[path] = content
      }
    })
  }

  return affected
}
```

The API call itself is identical to `generateCode` — same streaming, same
`<file>` tag parser, same `onFile*` callbacks.

---

## 7. Wiring Generate into `useMicroserviceNode.ts`

```typescript
import { generateCode }         from '@utils/generateCode'
import { regenerateWithDiff }   from '@utils/regenerateWithDiff'
import { exportArchitecture }   from '@utils/exportArchitecture'
import { useCodeEditorStore }   from '@store'
import { useRegenerateModalStore } from '@store'
import { db }                   from '@db'

const codeStore    = useCodeEditorStore()
const regenModal   = useRegenerateModalStore()
const projectId    = useProjectStore(s => s.activeProjectId)

const isGenerating = codeStore.generatingMsId === props.id

const handleGenerate = useCallback(async (e: React.MouseEvent) => {
  e.stopPropagation()
  if (!projectId) return

  const hasExisting = Object.keys(codeStore.generatedFiles).length > 0

  if (hasExisting) {
    // Show confirmation modal — let the user choose Diff or Regenerate All
    regenModal.open(props.id)
    return
  }

  // First time — generate all
  await runFullGeneration(props.id, projectId, codeStore, node.label)
}, [props.id, projectId, codeStore, regenModal, node.label])
```

### `runFullGeneration` (shared by both full and "Regenerate All" paths)

```typescript
async function runFullGeneration(
  msId:      string,
  projectId: string,
  codeStore: CodeEditorStore,
  msLabel:   string,
) {
  codeStore.setGenerating(msId)
  codeStore.clearGeneratedFiles(msId)

  // Switch to Code tab automatically
  // Use a custom event so Editor.tsx can respond
  window.dispatchEvent(new CustomEvent('archflow-switch-tab', { detail: 'code' }))

  try {
    const architecture = await exportArchitecture(msId, projectId)

    await generateCode({
      architecture,
      onFileStart: (path) => {
        // File appears in explorer immediately (with empty content)
        codeStore.setGeneratedFile(path, '// Generating...')
        codeStore.openFile(path)
      },
      onFileChunk: (path, chunk) => {
        // Append streamed content
        const existing = codeStore.generatedFiles[path] ?? ''
        const cleaned  = existing === '// Generating...' ? chunk : existing + chunk
        codeStore.setGeneratedFile(path, cleaned)
      },
      onFileComplete: (path, content) => {
        codeStore.setGeneratedFile(path, content)
        console.log(`[archflow] Generated: ${path}`)
      },
      onDone: () => {
        codeStore.setGenerating(null)
        console.log(`[archflow] Code generation complete for ${msLabel}`)
      },
      onError: (err) => {
        codeStore.setGenerating(null)
        console.error('[archflow] Generation failed:', err.message)
      },
    })
  } catch (err) {
    codeStore.setGenerating(null)
    console.error('[archflow] Generation failed:', err)
  }
}
```

---

## 8. Tab auto-switch on Generate

In `Editor.tsx`, listen for the custom event:

```typescript
useEffect(() => {
  const handler = (e: CustomEvent) => setActiveTab(e.detail as 'canvas' | 'code' | 'preview')
  window.addEventListener('archflow-switch-tab', handler as EventListener)
  return () => window.removeEventListener('archflow-switch-tab', handler as EventListener)
}, [])
```

---

## 9. `CodeEditor.tsx` — Use Generated Files

Update `buildFileTree` to use generated file content when available.
If `codeStore.generatedFiles[path]` exists, use that as the file content instead
of the stub.

In `useCodeEditor.ts`:

```typescript
const generatedFiles = useCodeEditorStore(s => s.generatedFiles)

// Override stub content with generated content
const fileMap = useMemo(() => {
  if (!tree) return {}
  const map: Record<string, FileNode> = {}
  const walk = (node: FileNode) => {
    if (node.type === 'file') {
      map[node.path] = {
        ...node,
        content: generatedFiles[node.path] ?? node.content,
      }
    }
    node.children.forEach(walk)
  }
  walk(tree)
  return map
}, [tree, generatedFiles])
```

### Live streaming in the editor

When `isGenerating` is true and the active file is currently being written,
the Monaco editor content updates as chunks arrive. Monaco handles this correctly
when the `value` prop changes — it re-renders with the new content.

Add a pulsing "Generating..." indicator in the tab bar for files currently being
streamed:

```tsx
{isGenerating && codeStore.generatedFiles[path]?.endsWith('// Generating...') && (
  <span className="text-[8px] font-mono animate-pulse"
        style={{ color: 'var(--color-accent)' }}>
    ●
  </span>
)}
```

---

## 10. Files Created / Updated

### New files
```
src/pages/Settings/
├── Settings.tsx
├── useSettings.ts
├── types.ts
└── index.ts

src/utils/generateCode.ts
src/utils/regenerateWithDiff.ts

src/components/shared/RegenerateModal/
├── RegenerateModal.tsx
├── useRegenerateModal.ts
├── types.ts
└── index.ts
```

### Updated files
```
src/routes/AppRouter.tsx
  → add /settings route

src/constants/routes.ts
  → add SETTINGS = '/settings'

src/store/codeEditorStore.ts
  → add generatedFiles, isGenerating, generatingMsId
  → add setGeneratedFile, clearGeneratedFiles, setGenerating

src/store/index.ts
  → add regenerateModalStore

src/utils/index.ts
  → export generateCode, regenerateWithDiff, getProxyUrl, getMessagesUrl

src/utils/proxyUrl.ts  (new)
  → getProxyUrl(), getMessagesUrl()

src/pages/Editor/Editor.tsx
  → listen for 'archflow-switch-tab' custom event
  → render <RegenerateModal />

src/components/nodes/MicroserviceNode/useMicroserviceNode.ts
  → add handleGenerate
  → add isGenerating derived from codeEditorStore

src/components/nodes/MicroserviceNode/MicroserviceNode.tsx
  → add Generate button to header

src/pages/Editor/components/CodeEditor/useCodeEditor.ts
  → use generatedFiles from codeEditorStore to override stub content
```

---

## 11. Verification

### Settings page

- [ ] Navigate to `/settings` → page renders
- [ ] Back button → returns to previous page
- [ ] Paste invalid key (not starting with `sk-ant-`) → error state shown
- [ ] Paste valid key → Save → "● Key saved" indicator appears
- [ ] Refresh page → key still present (localStorage persists)
- [ ] Click "Remove key" → key cleared, input empty

### Generate button

- [ ] No API key → Generate button disabled with tooltip "Add API key in Settings first"
- [ ] API key set → Generate button enabled
- [ ] Click Generate with no existing files → generation starts immediately (no modal)
- [ ] Code tab switches automatically when generation starts
- [ ] Button shows "⟳ Generating..." during generation
- [ ] Files appear in explorer one by one as Claude generates them
- [ ] File content streams live in Monaco editor as chunks arrive
- [ ] Pulsing dot on active tab during streaming
- [ ] Generation completes → button returns to normal state
- [ ] All generated files readable in Monaco with syntax highlighting

### Confirmation modal (subsequent runs)

- [ ] Click Generate when files already exist → confirmation modal opens
- [ ] Modal shows "Apply Diff" and "Regenerate All" options
- [ ] Cancel → nothing changes
- [ ] Regenerate All → full generation starts, existing files overwritten
- [ ] Apply Diff → diff computed, only changed files sent to Claude, only those files updated

### Diff regeneration

- [ ] Change an entity field name → Save Version → Apply Diff → only entity + related files regenerated
- [ ] Add a new endpoint to a controller → Apply Diff → only controller file regenerated
- [ ] Unaffected files (e.g. unrelated entity) not regenerated

### Error handling

- [ ] Invalid API key → generation fails → error in console → button returns to normal
- [ ] Network error → same
- [ ] No architecture (empty MS) → generation proceeds with empty structure
