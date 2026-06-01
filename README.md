# archFlow

> A visual backend architecture designer for Spring Boot microservices — with live AI code generation.

archFlow lets you design your entire Spring Boot backend by dragging nodes onto a canvas and drawing connections. The system automatically infers and populates derived data — DTOs, service methods, endpoint configs, security wiring — from those connections. When the design is ready, you hit **Generate** and Claude streams a complete, production-ready Spring Boot project directly into a Monaco code editor, file by file.

---

## What's Built

### Visual Architecture Designer
- Drag nodes from a palette onto a canvas, draw connections between them
- Every connection triggers **auto-population**: DTOs copy entity fields, service methods are generated, endpoint success codes are inferred, security rules are wired — automatically
- Each node type has a dedicated **Inspector Panel** on the right sidebar for manual editing
- Custom-rendered edges with distinct visual styles per relationship type

### AI Code Generation (live — not a future phase)
- Click **Generate** on any MicroserviceNode to stream a complete Spring Boot project
- Generation runs file-by-file with a live progress modal showing each file as it streams
- Files appear in a Monaco-based **Code Editor** (VS Code-like, with file explorer + tab bar)
- Generation can be **aborted** mid-stream; partial files are preserved
- **Regenerate with diff** — on subsequent generates, only changed parts are re-generated (smart diff against the saved architecture snapshot)
- **Continue generation** — resume an interrupted generation run
- Download the entire generated project as a **ZIP** file

### AI Chat Panel
- Persistent **Chat** tab in the right sidebar alongside the Inspector
- Each session is scoped to a microservice; sessions and messages are stored in IndexedDB
- The AI has access to the full current architecture JSON (toggleable)
- AI can issue **canvas actions** — structured commands to create/update/delete nodes and edges directly from the chat
- Session summaries persist context across sessions

### AI Code Chat
- A separate **CodeChat** panel for conversational code editing
- Focused on the generated files; can explain, refactor, or rewrite generated code

### Architecture Versioning
- Architecture snapshots are saved to IndexedDB before every generation
- Supports **diff** between the current state and any previous snapshot
- Enables smart partial regeneration on subsequent runs

### Export & Context
- **Export architecture** as a structured JSON (used as the generation context)
- Generates a `.claude/` context directory inside the exported project (for Claude Code awareness)
- Download generated files as a `.zip`

### Settings Page (`/settings`)
- Configure the **local proxy URL** (default: `http://127.0.0.1:3456`)
- Live **connection status** indicator — shows whether the proxy is reachable

---

## How AI Works (the proxy model)

archFlow does **not** call the Anthropic API directly. It routes all AI calls through [`claude-max-api-proxy`](https://www.npmjs.com/package/claude-max-api-proxy), a local proxy that uses your installed Claude Code CLI (Claude Max subscription). No separate API key is needed.

**One-time setup:**
```bash
npm install -g claude-max-api-proxy
```

**Before using any AI feature (run each session):**
```bash
claude-max-api-proxy
# Starts proxy at http://127.0.0.1:3456 — keep this terminal open
```

The proxy URL can be changed in the Settings page.

---

## Getting Started

```bash
npm install
npm run dev
```

```bash
npm run build       # production build
npm run preview     # preview production build
npm run lint        # ESLint
```

---

## Tech Stack

| Tool | Purpose |
|---|---|
| React 19 + TypeScript (strict) | UI framework |
| @xyflow/react | Canvas, custom nodes, custom edges |
| Dexie.js (v6 schema) | IndexedDB — projects, nodes, edges, settings, versions, generatedFiles, chatSessions, chatMessages, codeChatSessions |
| Zustand | UI state — canvas, project, settings, chat, codeEditor, codeChat, generationProgress, regenerateModal, relationshipModal |
| TanStack Query | Data access hooks over Dexie |
| React Router v7 | Routing (`/`, `/project/:projectId`, `/settings`) |
| Tailwind CSS v4 | Styling |
| Monaco Editor | Code editor for generated files |
| Vite + vite-plugin-pwa | Build + service worker |
| Workbox | Cache-first offline support |
| JSZip + FileSaver | ZIP download of generated projects |
| claude-max-api-proxy | Local proxy — routes AI calls through Claude Code CLI |

---

## Node Types

| Node | Layer | Role |
|---|---|---|
| **MicroserviceNode** | Architecture | Top-level container. Bounded context. Has the Generate button. |
| **EntityNode** | Data | JPA model. Source of truth for all data shape. |
| **DTONode** | Contract | Request/response shape. Fields auto-copied from Entity on connection. |
| **DBNode** | Infrastructure | Database connection config only (host, port, schema, credentials). |
| **TableNode** | Infrastructure | Table-level config + custom repository queries. Linked to one Entity + one DBNode. |
| **AuthConfigNode** | Security | Authentication mechanism config (JWT, OAuth2, Session, Basic, API Key). |
| **AuthRuleNode** | Security | Named access rule — connects to controllers/endpoints. Defines roles + effect. |
| **ControllerNode** | HTTP | Base path + RBAC + error handler + Swagger tags. |
| **ServiceNode** | Business Logic | Pure business logic. No HTTP, no direct DB. Methods auto-generated from entity connections. |
| **APIEndpointNode** | HTTP | Single HTTP operation — method, path, request/response DTOs, auth rule. |
| **CustomTypeNode** | Data | Value object / embedded document — no table, stored as JSON blob. |

---

## Edge Types

Every connection auto-infers its type from the node pair. Each edge type has a dedicated custom renderer.

| Connection | Edge | Auto-population triggered |
|---|---|---|
| APIEndpoint → Controller | `ROUTES_TO` | Infers success code; adds path var if `{id}`; sets pagination if GET with no id |
| AuthRule → Controller or APIEndpoint | `SECURES` | Wires `authRuleId` |
| AuthRule → AuthConfig | `DEFINED_IN` | Wires `authConfigId` |
| Controller → Service | `INVOKES` | Structural only |
| Service → Entity | `USES` | Auto-generates 5 CRUD methods if `methods[]` is empty |
| Entity → TableNode | `STORED_IN` | Copies entity ID + table name to TableNode |
| TableNode → DBNode | `CONNECTS_TO` | Copies DB ID to TableNode |
| DTO → Entity | `DERIVED_FROM` | Copies all entity fields into DTO; sets purpose (REQUEST/RESPONSE) |
| APIEndpoint → DTO | `ACCEPTS` | Sets request body DTO; enables validation |
| APIEndpoint → DTO | `RETURNS` | Sets response DTO |
| Service → Service | `DEPENDS_ON` | Service dependency link |
| Entity → Entity (no table) | `EMBEDS` | Embedded / value object composition |
| Entity → Entity (both have tables) | `RELATES_TO` | JPA relationship; opens RelationshipModal |
| DTO → Entity (entity has no table) | `USES_TYPE` | Inline type reference |
| Entity or DTO → CustomTypeNode | `USES_CUSTOM_TYPE` | Dotted edge — value object reference |

---

## AI System Prompts

Three system prompts live in `src/prompts/`:

| File | Used by | Purpose |
|---|---|---|
| `chatSystemPrompt.md` | ChatPanel | Drives the architecture assistant. Defines the `<actions>` protocol for canvas mutations. |
| `codeChatSystemPrompt.md` | CodeChat | Drives the code-focused assistant. Aware of generated file contents. |
| `springBootDirectory.md` | `generateCode.ts` | Defines exactly where every generated file must go. Combined with the architecture JSON as the generation prompt. |

### AI prompt priority (per-node, for generation)
```
APIEndpointNode.aiPrompt       ← most specific, overrides everything
ControllerNode.aiPrompt
MicroserviceNode.aiPrompt      ← system-level context, broadest scope
```

Every node carries an `AIPrompt` object (`description`, `businessRules`, `edgeCases`, `expectedBehaviour`, `aiGenerate`). If a node's description is empty, generation falls back to inferring intent from the architecture JSON + the master directory spec.

---

## Canvas Actions (AI → Canvas)

The chat AI can issue structured commands in its response to directly modify the canvas:

```typescript
type CanvasAction =
  | { type: 'CREATE_NODE'; nodeType: string; label: string; data: Record<string, unknown> }
  | { type: 'CREATE_EDGE'; fromLabel: string; toLabel: string; edgeType: string }
  | { type: 'UPDATE_NODE'; label: string; patch: Record<string, unknown> }
  | { type: 'DELETE_NODE'; label: string }
  | { type: 'ADD_FIELD';   nodeLabel: string; field: Record<string, unknown> }
```

These are parsed from the `<actions>…</actions>` block in the AI's streaming response and executed against the live canvas via `executeCanvasActions.ts`.

---

## IndexedDB Schema (v6)

```
projects:          id, name, description, createdAt, updatedAt
nodes:             id, projectId, type, label, position, size, data(JSON), createdAt, updatedAt
edges:             id, projectId, fromNodeId, toNodeId, type, label, fromHandle, toHandle
settings:          key ('theme' | 'inspectorWidth' | 'sidebarWidth'), value (JSON)
versions:          id (${msId}-v${N}), msId, projectId, version, snapshot, savedAt
generatedFiles:    id (${msId}:${filePath}), msId, projectId, filePath, content, generatedAt
chatSessions:      id, projectId, msId, title, createdAt, updatedAt, summary
chatMessages:      id, sessionId, projectId, msId, role, content, actions, timestamp, isError
codeChatSessions:  id, msId, projectId, title, createdAt, updatedAt, messagesJson
```

`nodes.data` stores the full typed node object as a JSON blob — new fields on domain types never require schema migrations.

---

## Zustand Stores

| Store | Holds |
|---|---|
| `canvasStore` | `selectedNodeId`, `selectedEdgeId`, `pan`, `zoom` |
| `projectStore` | `activeProjectId` |
| `settingsStore` | `theme`, `inspectorWidth`, `sidebarWidth` — synced to localStorage + IDB |
| `chatStore` | `activeChatSessionId`, `activeChatMessages`, `chatSessions`, `isLoading`, `isSendingArchitecture` |
| `codeChatStore` | CodeChat session + messages + streaming state |
| `codeEditorStore` | `generatedFiles`, `fileProgress`, `openFilePaths`, `activeFilePath`, `explorerWidth`, `collapsedFolders`, `modifiedFiles`, `thinkingText`, `isGenerating`, `abortController` |
| `generationProgressStore` | `isOpen`, `isMinimised`, `msLabel`, `stopped` |
| `regenerateModalStore` | Controls the regenerate confirmation modal |
| `relationshipModalStore` | Controls the JPA relationship config modal |

---

## File Structure

```
src/
├── components/
│   ├── edges/                       ← custom React Flow edge renderers (one per edge type)
│   │   ├── AcceptsEdge/
│   │   ├── ConnectsToEdge/
│   │   ├── DerivedFromEdge/
│   │   ├── EmbedsEdge/
│   │   ├── InvokesEdge/
│   │   ├── RelatesToEdge/
│   │   ├── ReturnsEdge/
│   │   ├── RoutesToEdge/
│   │   ├── StoredInEdge/
│   │   ├── UsesCustomTypeEdge/
│   │   ├── UsesEdge/
│   │   └── UsesTypeEdge/
│   │
│   ├── nodes/                       ← custom React Flow node renderers (one per node type)
│   │   ├── APIEndpointNode/
│   │   ├── ControllerNode/
│   │   ├── CustomTypeNode/
│   │   ├── DBNode/
│   │   ├── DTONode/
│   │   ├── EntityNode/
│   │   ├── MicroserviceNode/
│   │   ├── ServiceNode/
│   │   └── TableNode/
│   │
│   └── shared/                      ← reusable UI primitives
│       ├── AIPromptBox/             ← AI prompt editor shared by all node inspectors
│       ├── DepChip/
│       ├── ErrorHandlingSection/    ← shared by Controller + APIEndpoint inspectors
│       ├── FieldTypeSelect/
│       ├── GenerationProgressModal/ ← streaming progress UI during code gen
│       ├── RegenerateModal/         ← confirm before re-running generation
│       ├── RelationshipModal/       ← JPA relationship config
│       ├── SectionLabel/
│       ├── ThemeToggle/
│       └── Toggle/
│
├── pages/
│   ├── ProjectList/                 ← home screen — create / open / delete projects
│   │   └── components/
│   │       ├── CreateProjectModal/
│   │       └── ProjectCard/
│   │
│   ├── Editor/                      ← main editor page (/project/:projectId)
│   │   └── components/
│   │       ├── Canvas/              ← React Flow canvas + drag/drop/connect logic
│   │       ├── ChatPanel/           ← AI chat (Inspector tab | Chat tab switcher)
│   │       │   └── components/
│   │       │       ├── ActionChip/
│   │       │       ├── ChatInput/
│   │       │       ├── MessageBubble/
│   │       │       ├── MessageThread/
│   │       │       └── SessionHeader/
│   │       ├── CodeChat/            ← code-focused AI assistant panel
│   │       │   └── components/
│   │       │       ├── CodeChatInput/
│   │       │       └── CodeChatMessage/
│   │       ├── CodeEditor/          ← Monaco-based editor for generated files
│   │       │   └── components/
│   │       │       ├── EditorPane/
│   │       │       ├── Explorer/    ← file tree (collapsible folders)
│   │       │       └── TabBar/      ← open file tabs
│   │       ├── EditorHeader/        ← top bar with project name + tab switcher (Canvas | Code)
│   │       ├── InspectorPanel/      ← right sidebar — inspector per node type
│   │       │   └── components/
│   │       │       ├── APIEndpointInspector/
│   │       │       ├── ControllerInspector/
│   │       │       ├── CustomTypeInspector/
│   │       │       ├── DBInspector/
│   │       │       ├── DTOInspector/
│   │       │       ├── EntityInspector/
│   │       │       ├── MicroserviceInspector/
│   │       │       ├── ServiceInspector/
│   │       │       └── TableInspector/
│   │       ├── LeftSidebar/         ← node palette + layers
│   │       └── RightSidebar/        ← wraps InspectorPanel + ChatPanel with tab switcher
│   │
│   └── Settings/                    ← /settings — proxy URL config + connection status
│
├── routes/
│   ├── AppRouter.tsx                ← '/', '/project/:projectId', '/settings'
│   └── routes.ts                    ← ROUTES constants + toEditor()
│
├── entity/                          ← ALL domain types. Single source of truth. No logic.
│   ├── shared.ts                    ← NodeType, EdgeType, JavaType, HttpMethod enums + base types
│   ├── AIPrompt.ts
│   ├── Chat.ts                      ← ChatSession, ChatMessage, CanvasAction types
│   ├── Project.ts
│   ├── Edge.ts
│   ├── MicroserviceNode.ts
│   ├── EntityNode.ts
│   ├── DTONode.ts
│   ├── DBNode.ts
│   ├── TableNode.ts
│   ├── AuthGuardNode.ts
│   ├── AuthConfigNode.ts
│   ├── AuthRuleNode.ts
│   ├── ControllerNode.ts
│   ├── ServiceNode.ts
│   ├── APIEndpointNode.ts
│   ├── CustomTypeNode.ts
│   └── index.ts
│
├── service/                         ← TanStack Query hooks only. One hook per file.
│   └── node/                        ← useGetNodes, useCreateNode, useUpdateNode, useDeleteNode, useDeleteNodes
│
├── store/                           ← Zustand store definitions
│   ├── canvasStore.ts
│   ├── projectStore.ts
│   ├── settingsStore.ts
│   ├── chatStore.ts
│   ├── codeChatStore.ts
│   ├── codeEditorStore.ts
│   ├── generationProgressStore.ts
│   ├── regenerateModalStore.ts
│   └── relationshipModalStore.ts
│
├── hooks/
│   ├── useDebounce.ts
│   ├── useLoadAppSettings.ts        ← app boot: IDB settings → Zustand hydration
│   └── useTheme.ts
│
├── utils/                           ← pure functions, no React
│   ├── autoPopulate.ts              ← all edge auto-population logic
│   ├── buildFileTree.ts             ← file path → tree structure for Explorer
│   ├── chat.ts                      ← chat message helpers
│   ├── chatApi.ts                   ← streaming API call for Chat panel
│   ├── codeChatApi.ts               ← streaming API call for CodeChat
│   ├── continueGeneration.ts        ← resume interrupted code gen
│   ├── diffArchitecture.ts          ← deep diff between two architecture snapshots
│   ├── downloadAsZip.ts             ← package generated files as ZIP
│   ├── executeCanvasActions.ts      ← execute AI canvas action commands on live RF state
│   ├── exportArchitecture.ts        ← serialize canvas → architecture JSON for generation
│   ├── format.ts                    ← formatting helpers
│   ├── generateClaudeContext.ts     ← generate .claude/ context files for exported project
│   ├── generateCode.ts              ← main streaming code generation
│   ├── generationCallbacks.ts       ← callbacks for streaming file events
│   ├── id.ts                        ← crypto.randomUUID wrapper
│   ├── node.ts                      ← node factory functions (createXNode)
│   ├── proxyUrl.ts                  ← getProxyUrl() + getMessagesUrl()
│   ├── regenerateWithDiff.ts        ← diff-based partial regeneration
│   ├── syncClaudeContext.ts         ← keep .claude/ files up-to-date post-edit
│   └── versionArchitecture.ts       ← save/load architecture snapshots
│
├── db/
│   └── db.ts                        ← Dexie v6 schema + singleton `db` export
│
├── prompts/                         ← AI system prompts (imported as raw strings)
│   ├── chatSystemPrompt.md          ← architecture assistant prompt + canvas action protocol
│   ├── codeChatSystemPrompt.md      ← code assistant prompt
│   └── springBootDirectory.md       ← file placement spec for Spring Boot generation
│
├── constants/
│   ├── canvas.ts
│   ├── messages.ts
│   ├── queryKeys.ts                 ← QUERY_KEYS factory — single source of truth
│   ├── routes.ts
│   └── theme.ts
│
├── sw/
│   └── sw.ts                        ← service worker: BroadcastChannel cross-tab sync relay
│
├── App.tsx
└── main.tsx                         ← QueryClient, BroadcastChannel listener, early theme patch
```

---

## Architecture Rules (strict)

- **`.tsx` files contain zero logic** — all logic lives in `useComponentName.ts`
- **`entity/`** — TypeScript interfaces/enums only. No React. No logic. Single source of truth for all types.
- **`service/`** — TanStack Query hooks only. Dexie is never imported outside this folder.
- **`utils/`** — Pure functions only. No React. No side effects.
- **`store/`** — Zustand store definitions only.
- Every component follows the 4-file structure: `ComponentName.tsx`, `useComponentName.ts`, `types.ts`, `index.ts`
- Single-use hooks stay in `useComponentName.ts`; shared hooks (2+ consumers) go in `hooks/`
- No `any` — use `unknown`. No non-null assertion `!` unless provably safe (with a comment). Enums over string unions.

---

## Cross-Tab Sync

Every IDB write posts to `BroadcastChannel('archflow-sync')`. The service worker relays the message to all other open tabs, which call `queryClient.invalidateQueries()` to re-fetch from IDB. The current tab's React Flow canvas state is never reset mid-session (a `useRef` guard on the initial load effect prevents it).

---

## Further Reading

- [DATA_FLOW.md](DATA_FLOW.md) — complete data flow reference: IDB schema, state sources of truth, edge lifecycle, write paths, cross-tab sync, and end-to-end flow examples
- [CLAUDE.md](CLAUDE.md) — project bible with all canonical TypeScript entity definitions, auto-population rules, and coding conventions
- [componentDesign/](componentDesign/) — per-feature design specs written before implementation (CODE_GENERATION.md, CHAT_UI.md, CODE_EDITOR.md, etc.)
