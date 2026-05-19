# Code Generation v2 — Design & Build Specification

> Claude Code: this document REPLACES CODE_GENERATION.md entirely.
> Read it in full before writing a single line.
> Follow every rule in CLAUDE.md alongside this document.
> Prerequisites: CODE_EDITOR_VSCODE.md implemented, exportArchitecture implemented,
> versioning system (versions IDB table) implemented.

---

## 1. What This Builds

1. **Settings page** (`/settings`) — local proxy URL configuration
2. **Generate button** on MicroserviceNode header
3. **Generation progress modal** — live streaming progress UI
4. **`generateCode.ts`** — streams all files from Claude API
5. **IDB persistence** — generated files stored in a `generatedFiles` table
6. **Download ZIP button** — in the Code tab header
7. **`regenerateWithDiff.ts`** — diff-based regeneration for subsequent runs
8. **Confirmation modal** — shown on subsequent generate attempts

> **How the API connection works:**
> Uses `claude-max-api-proxy` to route calls through your local Claude Code CLI.
> No Anthropic API key needed.
>
> **Start the proxy before generating (each session):**
> ```bash
> npx claude-max-api-proxy
> # Starts on http://127.0.0.1:3456 — keep terminal open
> ```

---

## 2. New IDB Table — `generatedFiles`

Add to `src/db/db.ts`:

```typescript
// In the Dexie schema — bump version number
this.version(N).stores({
  projects:       'id, updatedAt',
  nodes:          'id, projectId, msId, type, createdAt',
  edges:          'id, projectId, fromNodeId, toNodeId',
  versions:       'id, msId, projectId, version',
  generatedFiles: 'id, msId, projectId',   // id = `${msId}:${filePath}`
})
```

```typescript
// Table row shape
interface GeneratedFileRow {
  id:          string    // `${msId}:${filePath}` e.g. "ms-abc:src/main/java/Order.java"
  msId:        string
  projectId:   string
  filePath:    string    // virtual path e.g. "src/main/java/com/example/Order.java"
  content:     string
  generatedAt: number   // timestamp
}
```

---

## 3. `codeEditorStore` Updates

```typescript
export interface CodeEditorStore {
  // Generation state
  isGenerating:    boolean
  generatingMsId:  string | null

  // Generated file contents — in-memory mirror of IDB generatedFiles table
  generatedFiles:  Record<string, string>   // filePath → content

  // Generation progress — drives the progress modal
  fileProgress:    FileProgressItem[]

  // Actions
  setGenerating:       (msId: string | null) => void
  setGeneratedFile:    (path: string, content: string) => void
  clearGeneratedFiles: () => void
  setFileProgress:     (items: FileProgressItem[]) => void
  updateFileProgress:  (path: string, patch: Partial<FileProgressItem>) => void
  appendFileChunk:     (path: string, chunk: string) => void
}

export interface FileProgressItem {
  path:        string
  fileName:    string   // last segment e.g. "Order.java"
  category:    string   // "entity" | "repository" | "dto" | "service" | "controller" | "config" | "build"
  status:      'waiting' | 'streaming' | 'done' | 'error'
  liveLines:   string[] // last 5 lines of current content — for preview panel
}
```

Derive `category` from the file path:
```typescript
function categoryFromPath(path: string): string {
  if (path.includes('/entity/'))     return 'entity'
  if (path.includes('/repository/')) return 'repository'
  if (path.includes('/dto/'))        return 'dto'
  if (path.includes('/service/'))    return 'service'
  if (path.includes('/controller/')) return 'controller'
  if (path.includes('application'))  return 'config'
  if (path.includes('pom.xml') || path.includes('build.gradle')) return 'build'
  if (path.includes('Dockerfile'))   return 'build'
  return 'other'
}
```

---

## 4. Settings Page

### Route

```typescript
<Route path="/settings" element={<SettingsPage />} />
```

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
│  ←  Settings                                               │
├────────────────────────────────────────────────────────────┤
│  AI Configuration                                          │
│  ─────────────────────────────────────────────────────     │
│  Local Proxy URL                                           │
│  Start with: npx claude-max-api-proxy                      │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  http://127.0.0.1:3456                               │  │
│  └──────────────────────────────────────────────────────┘  │
│  [Save]   ● Connected  /  ✕ Not reachable                  │
│                                                            │
├────────────────────────────────────────────────────────────┤
│  Danger Zone                                               │
│  Clear all generated code          [Clear]                 │
└────────────────────────────────────────────────────────────┘
```

### `useSettings.ts`

```typescript
const PROXY_URL_KEY     = 'archflow_proxy_url'
const DEFAULT_PROXY_URL = 'http://127.0.0.1:3456'

export function useSettings() {
  const navigate = useNavigate()
  const [proxyUrl,    setProxyUrl]    = useState(() =>
    localStorage.getItem(PROXY_URL_KEY) ?? DEFAULT_PROXY_URL
  )
  const [saveStatus,  setSaveStatus]  = useState<'idle' | 'saved'>('idle')
  const [proxyStatus, setProxyStatus] = useState<'unknown' | 'online' | 'offline'>('unknown')

  const checkProxy = useCallback(async (url: string) => {
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) })
      setProxyStatus(res.ok ? 'online' : 'offline')
    } catch { setProxyStatus('offline') }
  }, [])

  useEffect(() => { checkProxy(proxyUrl) }, [proxyUrl, checkProxy])

  const handleSave = () => {
    const trimmed = proxyUrl.trim().replace(/\/$/, '')
    localStorage.setItem(PROXY_URL_KEY, trimmed)
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
    checkProxy(trimmed)
  }

  return { proxyUrl, setProxyUrl, saveStatus, proxyStatus,
           handleSave, handleBack: () => navigate(-1) }
}
```

### `src/utils/proxyUrl.ts`

```typescript
const PROXY_URL_KEY     = 'archflow_proxy_url'
const DEFAULT_PROXY_URL = 'http://127.0.0.1:3456'

export function getProxyUrl():    string { return localStorage.getItem(PROXY_URL_KEY) ?? DEFAULT_PROXY_URL }
export function getMessagesUrl(): string { return `${getProxyUrl()}/v1/chat/completions` }
```

---

## 5. Generation Progress Modal

### File structure

```
src/components/shared/GenerationProgressModal/
├── GenerationProgressModal.tsx
├── useGenerationProgressModal.ts
├── types.ts
└── index.ts
```

### Zustand store — `generationProgressStore`

```typescript
interface GenerationProgressStore {
  isOpen:   boolean
  msLabel:  string
  open:     (msLabel: string) => void
  close:    () => void
}

export const useGenerationProgressStore = create<GenerationProgressStore>(set => ({
  isOpen:  false,
  msLabel: '',
  open:    msLabel => set({ isOpen: true, msLabel }),
  close:   ()      => set({ isOpen: false }),
}))
```

Place `<GenerationProgressModal />` in `Editor.tsx` — always mounted.

### Modal appearance

```
┌─────────────────────────────────────────────────────────┐
│  Generating Code                                        │
│  Order Service  ·  claude-sonnet-4              [done×] │  ← × only enabled after done
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ✓  Order.java                           entity         │
│  ✓  OrderRepository.java                 repository     │
│  ✓  OrderDTO.java                        dto            │
│  ⟳  OrderService.java                    service   ···  │  ← streaming
│  ·  OrderServiceImpl.java                service        │  ← waiting
│  ·  OrderController.java                 controller     │  ← waiting
│  ·  application.yml                      config         │  ← waiting
│  ·  pom.xml                              build          │  ← waiting
│                                                         │
│  ████████████████████░░░░░░░░░░░░  4 / 8 files         │  ← progress bar
│                                                         │
│  Currently writing:                                     │
│  ┌───────────────────────────────────────────────────┐  │
│  │  @Service                                         │  │
│  │  @Transactional                                   │  │  ← live code preview
│  │  public class OrderService {                      │  │
│  │    private final OrderRepository repo;            │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### `GenerationProgressModal.tsx`

Renders as a portal into `document.body`. Backdrop blocks interaction with the
app while generation is in progress.

```tsx
import { useCodeEditorStore }           from '@store'
import { useGenerationProgressStore }   from '@store'

export function GenerationProgressModal() {
  const store      = useGenerationProgressStore()
  const codeStore  = useCodeEditorStore()

  const items      = codeStore.fileProgress
  const isGenerating = codeStore.isGenerating
  const doneCount  = items.filter(i => i.status === 'done').length
  const totalCount = items.length
  const streaming  = items.find(i => i.status === 'streaming')

  if (!store.isOpen) return null

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop — blocks interaction while generating */}
      <div className="absolute inset-0 bg-black/60"
           onClick={isGenerating ? undefined : store.close} />

      <div className="relative w-[520px] max-w-[95vw] rounded-[var(--radius-lg)]
                      shadow-modal flex flex-col overflow-hidden"
           style={{
             background: 'var(--color-surface)',
             border:     '1px solid var(--color-border-strong)',
           }}>

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b
                        border-[var(--color-border)]">
          <div>
            <p className="text-[14px] font-bold text-text flex items-center gap-2">
              {isGenerating && (
                <span className="inline-block w-3 h-3 rounded-full animate-pulse"
                      style={{ background: 'var(--color-accent)' }} />
              )}
              {isGenerating ? 'Generating Code' : 'Generation Complete'}
            </p>
            <p className="text-[10px] font-mono text-text-3 mt-0.5">
              {store.msLabel}  ·  claude-sonnet-4
            </p>
          </div>
          <button
            onClick={store.close}
            disabled={isGenerating}
            className="text-text-4 hover:text-text transition-colors
                       bg-transparent border-none cursor-pointer
                       disabled:opacity-30 disabled:cursor-not-allowed text-[16px]"
          >
            ×
          </button>
        </div>

        {/* File list */}
        <div className="px-5 py-3 flex flex-col gap-1 max-h-[240px] overflow-y-auto">
          {items.map(item => (
            <FileProgressRow key={item.path} item={item} />
          ))}
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="px-5 pb-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                   style={{ background: 'var(--color-surface-alt)' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width:      `${(doneCount / totalCount) * 100}%`,
                    background: 'var(--color-accent)',
                  }}
                />
              </div>
              <span className="text-[9px] font-mono text-text-3 ml-3 flex-shrink-0">
                {doneCount} / {totalCount} files
              </span>
            </div>
          </div>
        )}

        {/* Live code preview — last 5 lines of currently streaming file */}
        {streaming && (
          <div className="px-5 pb-4">
            <p className="text-[9px] font-mono text-text-4 mb-1">Currently writing:</p>
            <div className="rounded-[var(--radius-sm)] p-3 overflow-hidden"
                 style={{ background: 'var(--color-surface-alt)',
                          border: '1px solid var(--color-border)' }}>
              {streaming.liveLines.map((line, i) => (
                <div key={i}
                     className="text-[10px] font-mono text-text-2 leading-relaxed truncate">
                  {line || '\u00A0'}
                </div>
              ))}
              {/* Blinking cursor on last line */}
              <span className="inline-block w-1.5 h-3 ml-0.5 animate-pulse"
                    style={{ background: 'var(--color-accent)', verticalAlign: 'middle' }} />
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
```

### `FileProgressRow` sub-component

```tsx
function FileProgressRow({ item }: { item: FileProgressItem }) {
  const icon = item.status === 'done'      ? '✓'
             : item.status === 'streaming' ? '⟳'
             : '·'

  const iconColor = item.status === 'done'      ? 'var(--color-success)'
                  : item.status === 'streaming' ? 'var(--color-accent)'
                  : 'var(--color-text-4)'

  const categoryBadgeColor: Record<string, string> = {
    entity:     'var(--node-entity-accent)',
    repository: 'var(--node-db-accent)',
    dto:        'var(--node-dto-accent)',
    service:    'var(--node-svc-accent)',
    controller: 'var(--node-ctrl-accent)',
    config:     'var(--color-text-3)',
    build:      'var(--color-text-3)',
  }

  return (
    <div className="flex items-center gap-2 py-0.5">
      <span
        className={`text-[12px] w-4 flex-shrink-0 font-bold
                    ${item.status === 'streaming' ? 'animate-spin' : ''}`}
        style={{ color: iconColor }}
      >
        {icon}
      </span>
      <span className="text-[11px] font-mono text-text-2 flex-1 truncate">
        {item.fileName}
      </span>
      <span className="text-[8px] font-mono flex-shrink-0"
            style={{ color: categoryBadgeColor[item.category] ?? 'var(--color-text-4)' }}>
        {item.category}
      </span>
      {item.status === 'streaming' && (
        <span className="text-[9px] font-mono text-text-4 animate-pulse">···</span>
      )}
    </div>
  )
}
```

---

## 6. `generateCode.ts` — Full Generation with Progress

```typescript
import { getMessagesUrl } from '@utils/proxyUrl'
import { db }             from '@db'

const SYSTEM_PROMPT = `You are a Spring Boot code generator.
Generate complete, production-ready Spring Boot code for all files.
Use Spring Boot 3.x, Java 17+, Lombok, JPA annotations.
Output ONLY in this exact format — no text outside file tags:
<file path="FULL_FILE_PATH">
FILE_CONTENT
</file>
Generate in order: entities, repositories, DTOs, service interfaces,
service implementations, controllers, application.yml, pom.xml/build.gradle, Dockerfile.`

export async function generateCode(params: {
  architecture:   object
  msId:           string
  projectId:      string
  onFileStart:    (path: string) => void
  onFileChunk:    (path: string, chunk: string) => void
  onFileComplete: (path: string, content: string) => void
  onDone:         () => void
  onError:        (err: Error) => void
}): Promise<void> {

  const userMessage = `Generate complete Spring Boot code:\n${JSON.stringify(params.architecture, null, 2)}`

  const response = await fetch(getMessagesUrl(), {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:    'claude-sonnet-4',
      stream:   true,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userMessage },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as any).error?.message ?? `HTTP ${response.status}`)
  }

  const reader  = response.body!.getReader()
  const decoder = new TextDecoder()
  let   buffer  = ''

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
        const chunk = event.choices?.[0]?.delta?.content ?? ''
        if (!chunk) continue

        // Inline state-preserving parser
        let remaining = chunk
        while (remaining.length > 0) {
          if (!insideFile) {
            const m = remaining.match(/<file path="([^"]+)">/)
            if (m) {
              const idx  = remaining.indexOf(m[0])
              currentPath    = m[1]
              currentContent = ''
              insideFile     = true
              params.onFileStart(currentPath)
              remaining = remaining.slice(idx + m[0].length)
            } else break
          } else {
            const closeIdx = remaining.indexOf('</file>')
            if (closeIdx === -1) {
              currentContent += remaining
              params.onFileChunk(currentPath, remaining)
              break
            } else {
              const part = remaining.slice(0, closeIdx)
              currentContent += part
              if (part) params.onFileChunk(currentPath, part)

              // File complete — write to IDB
              const finalContent = currentContent
              const finalPath    = currentPath
              params.onFileComplete(finalPath, finalContent)
              await db.generatedFiles.put({
                id:          `${params.msId}:${finalPath}`,
                msId:        params.msId,
                projectId:   params.projectId,
                filePath:    finalPath,
                content:     finalContent,
                generatedAt: Date.now(),
              })

              insideFile     = false
              currentPath    = ''
              currentContent = ''
              remaining = remaining.slice(closeIdx + '</file>'.length)
            }
          }
        }
      } catch { /* malformed chunk — skip */ }
    }
  }

  params.onDone()
}
```

---

## 7. `runFullGeneration` — Updated

```typescript
import { useGenerationProgressStore } from '@store'

async function runFullGeneration(
  msId:      string,
  projectId: string,
  codeStore: CodeEditorStore,
  msLabel:   string,
) {
  const progressStore = useGenerationProgressStore.getState()

  codeStore.setGenerating(msId)
  codeStore.clearGeneratedFiles()
  codeStore.setFileProgress([])

  // Open progress modal
  progressStore.open(msLabel)

  // Switch to Code tab
  window.dispatchEvent(new CustomEvent('archflow-switch-tab', { detail: 'code' }))

  try {
    const architecture = await exportArchitecture(msId, projectId)

    await generateCode({
      architecture,
      msId,
      projectId,

      onFileStart: (path) => {
        // Add to progress list as 'streaming'
        const item: FileProgressItem = {
          path,
          fileName:  path.split('/').at(-1) ?? path,
          category:  categoryFromPath(path),
          status:    'streaming',
          liveLines: [],
        }
        codeStore.updateFileProgress(path, item)
        // Mark all previous 'waiting' items as such
        codeStore.setGeneratedFile(path, '')
      },

      onFileChunk: (path, chunk) => {
        // Append to in-memory store
        codeStore.appendFileChunk(path, chunk)
        // Update live preview — last 5 lines of current content
        const content   = (codeStore.generatedFiles[path] ?? '') + chunk
        const allLines  = content.split('\n')
        const liveLines = allLines.slice(Math.max(0, allLines.length - 5))
        codeStore.updateFileProgress(path, { liveLines })
      },

      onFileComplete: (path, content) => {
        codeStore.setGeneratedFile(path, content)
        codeStore.updateFileProgress(path, { status: 'done', liveLines: [] })
      },

      onDone: () => {
        codeStore.setGenerating(null)
        // Modal stays open — user reads the result, then clicks ×
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

## 8. Load Generated Files from IDB on Mount

In `useCodeEditor.ts`, after VS Code initialises, load previously generated files:

```typescript
useEffect(() => {
  if (!ready || !msId || !projectId) return

  // Load persisted generated files from IDB
  db.generatedFiles
    .where('msId').equals(msId)
    .toArray()
    .then(rows => {
      rows.forEach(row => {
        codeStore.setGeneratedFile(row.filePath, row.content)
      })
    })
}, [ready, msId])
```

This means: after a page refresh, previously generated files reload automatically
into VS Code without needing to regenerate.

---

## 9. Download ZIP Button

### Install dependencies

```bash
npm install jszip
npm install file-saver
npm install -D @types/file-saver
```

### `src/utils/downloadAsZip.ts`

```typescript
import JSZip    from 'jszip'
import { saveAs } from 'file-saver'

export async function downloadAsZip(params: {
  files:       Record<string, string>   // filePath → content
  serviceName: string                    // e.g. "order-service"
  version:     string                    // e.g. "1.0.0"
}): Promise<void> {
  const zip = new JSZip()

  // Add every file at its full path
  for (const [path, content] of Object.entries(params.files)) {
    zip.file(path, content)
  }

  const blob     = await zip.generateAsync({ type: 'blob' })
  const filename = `${params.serviceName}-${params.version}.zip`
  saveAs(blob, filename)
}
```

Export from `src/utils/index.ts`.

### Download button placement

In the Code tab header area of `Editor.tsx`, show a "Download ZIP" button when
generated files exist for the current MS:

```tsx
{activeTab === 'code' && hasGeneratedFiles && (
  <button
    onClick={handleDownloadZip}
    className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold
               rounded-[var(--radius-sm)] cursor-pointer transition-colors border-none"
    style={{
      background: 'var(--color-success-light)',
      color:      'var(--color-success)',
    }}
  >
    {/* Download icon */}
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    Download ZIP
  </button>
)}
```

### `handleDownloadZip` in `Editor.tsx`

```typescript
const handleDownloadZip = useCallback(async () => {
  const files = codeStore.generatedFiles
  if (Object.keys(files).length === 0) return

  // Get MS node data for filename
  const msNode = rfNodes.find(n =>
    n.id === selectedMsId &&
    (n.data as BaseNode).type === NodeType.MICROSERVICE
  )
  const ms = msNode?.data as MicroserviceNode | undefined

  await downloadAsZip({
    files,
    serviceName: ms?.serviceName ?? 'microservice',
    version:     ms?.version    ?? '1.0.0',
  })
}, [codeStore.generatedFiles, rfNodes, selectedMsId])
```

---

## 10. Confirmation Modal (Subsequent Runs)

Unchanged from original spec — same two-option card modal (Apply Diff / Regenerate All).

---

## 11. `regenerateWithDiff.ts`

Unchanged from original spec. Uses same `generateCode` function internally,
same `onFile*` callbacks, same IDB writes.

---

## 12. Files Created / Updated

### New files
```
src/pages/Settings/
├── Settings.tsx
├── useSettings.ts
├── types.ts
└── index.ts

src/utils/generateCode.ts           ← updated with IDB writes + msId/projectId params
src/utils/regenerateWithDiff.ts
src/utils/downloadAsZip.ts          ← new
src/utils/proxyUrl.ts               ← new

src/components/shared/GenerationProgressModal/
├── GenerationProgressModal.tsx
├── useGenerationProgressModal.ts   (minimal — modal reads from stores directly)
├── types.ts
└── index.ts

src/components/shared/RegenerateModal/
├── RegenerateModal.tsx
├── useRegenerateModal.ts
├── types.ts
└── index.ts
```

### Updated files
```
src/db/db.ts
  → add generatedFiles table, bump schema version

src/store/codeEditorStore.ts
  → add fileProgress: FileProgressItem[]
  → add setFileProgress, updateFileProgress, appendFileChunk

src/store/index.ts
  → export generationProgressStore, regenerateModalStore

src/routes/AppRouter.tsx
  → add /settings route

src/constants/routes.ts
  → add SETTINGS = '/settings'

src/utils/index.ts
  → export generateCode, regenerateWithDiff, downloadAsZip, getProxyUrl, getMessagesUrl

src/pages/Editor/Editor.tsx
  → listen for 'archflow-switch-tab'
  → render <GenerationProgressModal /> and <RegenerateModal />
  → show Download ZIP button when Code tab active and files exist

src/pages/Editor/components/CodeEditor/useCodeEditor.ts
  → load generatedFiles from IDB on mount

src/components/nodes/MicroserviceNode/useMicroserviceNode.ts
  → add handleGenerate (opens progress modal, calls runFullGeneration)
  → add isGenerating

src/components/nodes/MicroserviceNode/MicroserviceNode.tsx
  → add Generate button
```

---

## 13. Verification

### Settings
- [ ] `/settings` renders, proxy URL input pre-filled with `http://127.0.0.1:3456`
- [ ] Save → "● Connected" when proxy running, "✕ Not reachable" when not
- [ ] URL persists in localStorage after refresh

### Generation progress modal
- [ ] Click Generate → progress modal opens immediately (before first file arrives)
- [ ] Modal cannot be closed while generating (× is disabled)
- [ ] Files appear in list one by one as `<file path="...">` tags are parsed
- [ ] Status icons: `·` waiting, `⟳` streaming (spinning), `✓` done (green)
- [ ] Category labels coloured by node type accent colours
- [ ] Progress bar fills correctly: `doneCount / totalCount`
- [ ] Live code preview shows last 5 lines of current streaming file
- [ ] Blinking cursor visible in preview
- [ ] After all files done → title changes to "Generation Complete"
- [ ] × becomes enabled → click → modal closes

### IDB persistence
- [ ] After generation, refresh page → Code tab still shows all generated files
- [ ] Generated files visible in VS Code Explorer after refresh
- [ ] File content intact after refresh

### Download ZIP
- [ ] "Download ZIP" button visible in Code tab header after generation
- [ ] Click → browser downloads `{serviceName}-{version}.zip`
- [ ] ZIP contains full directory structure e.g. `src/main/java/com/example/Order.java`
- [ ] File contents match what VS Code shows

### Regeneration modal (subsequent runs)
- [ ] Click Generate when files already exist → confirmation modal opens
- [ ] Apply Diff → progress modal opens again for changed files only
- [ ] Regenerate All → progress modal opens, all files regenerated
- [ ] IDB updated with new content after either path
