# ControllerNode — Design & Build Specification

> Claude Code: read this in full before writing a single line.
> Follow every rule in CLAUDE.md alongside this document.
> A MicroserviceNode must exist before a ControllerNode can be added.
> In this step: node + inspector + sidebar + IDB + one edge type (INVOKES, Controller → Service).
> API Endpoint connections come in a later step.
> No DTO connections. No AuthGuard connections (those come with AuthGuardNode step).

---

## 1. What Is the ControllerNode

The `ControllerNode` is the **HTTP entry point** for a group of related endpoints.
It defines the base path, CORS config, security settings, error handling, and
which ServiceNode it delegates business logic to.

It connects to **exactly one ServiceNode** via an `INVOKES` edge.
The connection is structural only — no data changes on either node when the edge is created.

---

## 2. One Service Rule

- A ControllerNode connects to **one and only one** ServiceNode.
- Attempting a second INVOKES edge from the same ControllerNode → silently rejected.
- A ServiceNode can be connected to **many** ControllerNodes (one service, many controllers).

---

## 3. Visual Anatomy

```
┌──────────────────────────────────┐  ← border: var(--node-ctrl-accent) when selected
│                                  │
│  [C]  OrderController            │  ← HEADER: icon · label
│       /api/orders                │  ← base path (mono, muted)
│                                  │
├──────────────────────────────────┤
│  ◇ OrderService   SERVICE        │  ← SERVICE ROW (when connected)
├──────────────────────────────────┤
│  CORS  │  v1  │  logging         │  ← CONFIG ROW (chips shown when active)
├──────────────────────────────────┤
│  404  OrderNotFound              │  ← ERRORS ROW (when errors exist)
│  500  InternalError   +1 more    │
└──────────────────────────────────┘
```

When no service and no errors:
```
┌──────────────────────────────────┐
│  [C]  OrderController            │
│       /api/orders                │
└──────────────────────────────────┘
```

Sections shown only when they have content:
- Service row: only when INVOKES edge exists
- Config row: only when at least one config chip is active (`crossOrigin`, `apiVersion`, `requestLogging`)
- Errors row: only when `errorHandlerConfig.errors.length > 0`

Minimum size: **w 210, h 90**. No maximum.

---

## 4. Data Model

Defined in `src/entity/ControllerNode.ts`. Import from `@entity`. Do not redefine.

```
ControllerNode
  basePath:           string            e.g. "/api/orders"
  security:           ControllerSecurity
    enabled:             boolean
    authGuardId:         string | null  ← set by AuthGuard edge (future step)
    rbac:                RBAC
      strategy: RBACStrategy  (ALLOW_LIST | DENY_LIST)
      rules:    RoleRule[]
        role:   string
        access: RoleAccess  (ALLOW | DENY)
    perEndpointOverride: boolean
  errorHandlerConfig: ErrorHandlerConfig
    errors:             ErrorDefinition[]
      id:                string
      matchStrategy:     ErrorMatchStrategy  (BY_EXCEPTION | BY_ERROR_CODE)
      exceptionClass:    string              — used when matchStrategy = BY_EXCEPTION
      errorCode:         string              — used when matchStrategy = BY_ERROR_CODE
      httpStatus:        number
      message:           string              — top-level message in response body
      fields:            ErrorResponseField[] — additional key-value pairs in response body
        key:   string    — JSON key e.g. "detail"
        value: string    — static value or SpEL e.g. "Order not found"
      createException:   boolean
      logLevel:          LogLevel  (ERROR | WARN | INFO | DEBUG)
    includeTimestamp:   boolean
    includeRequestPath: boolean
  config:             ControllerConfig
    crossOrigin:    boolean
    apiVersion:     string | null
    requestLogging: boolean
  swaggerTags:        string[]
```

---

## 5. Default Values

Add `createControllerNode()` to `src/utils/node.ts`:

```
id:           generateId()
type:         NodeType.CONTROLLER
label:        'Controller'
basePath:     '/api/resource'
position:     { x: 0, y: 0 }
size:         { w: 220, h: 100 }
aiPrompt:     emptyAIPrompt()
swaggerTags:  []
security:
  enabled:             false
  authGuardId:         null
  rbac:
    strategy: RBACStrategy.ALLOW_LIST
    rules:    []
  perEndpointOverride: false
errorHandlerConfig:
  errors:             []
  includeTimestamp:   true
  includeRequestPath: true
config:
  crossOrigin:    false
  apiVersion:     null
  requestLogging: false
```

Export from `src/utils/index.ts`.

---

## 6. How ControllerNodes Are Added

### Guard

ControllerNode palette item enabled only when at least one MicroserviceNode exists.
When disabled: `opacity-40 cursor-not-allowed pointer-events-none`, title "Add a microservice first".

### Way 1 — Drag from left sidebar

- `onDragStart`: `e.dataTransfer.setData('nodeType', 'controller')`
- Canvas `onDrop`: `'controller'` case → `createControllerNode({ position })` → IDB → RF state

### Way 2 — Click palette item

- Target MS: selected MS first, else last MS in rfNodes
- Stagger: `{ x: 20 + (count % 4) * 230, y: 60 + Math.floor(count / 4) * 180 }`
  where `count` = existing ControllerNodes in the project

---

## 7. INVOKES Edge (Controller → Service)

### Rules

- ControllerNode → one ServiceNode only. Second attempt → silently rejected.
- ServiceNode → many ControllerNodes (no restriction on the service side).
- Drawing from either end is valid — normalise to `fromNodeId = ControllerNode.id`, `toNodeId = ServiceNode.id`.

### Guard in `onConnect`

```
1. Identify which end is ControllerNode and which is ServiceNode.
2. If neither end is Controller+Service → ignore.
3. controllerAlreadyHasService = rfEdges.some(e =>
     e.data?.type === EdgeType.INVOKES && e.source === controllerId
   )
4. If true → reject silently.
```

### Auto-population on connect

INVOKES is **structural only** — no data changes on either node.

After creating the edge:
- Toast: `"${controller.label} invokes ${service.label}"`

No node updates needed. Just write the edge to IDB.

### Edge deletion

On double-click or `×` in inspector:
1. `db.edges.delete(edgeId)`
2. `setEdges(edges => edges.filter(e => e.id !== edgeId))`
3. Post BroadcastChannel sync
4. Toast: `"${controller.label} disconnected from service"`

No reset of the ControllerNode — unlike the ServiceNode, the controller's config
(basePath, security, error handling) is independent of which service it calls.
The user keeps everything they configured.

### Edge visual

```
src/components/edges/InvokesEdge/
├── InvokesEdge.tsx
├── useInvokesEdge.ts
├── types.ts
└── index.ts
```

Register in `EDGE_TYPES`:
```typescript
const EDGE_TYPES = {
  derivedFrom: DerivedFromEdge,
  storedIn:    StoredInEdge,
  connectsTo:  ConnectsToEdge,
  uses:        UsesEdge,
  invokes:     InvokesEdge,
} as const
```

Visual:
- Stroke: `var(--node-ctrl-accent)` (orange)
- StrokeWidth: 1.5px (selected: 2.5px)
- Arrow: `MarkerType.ArrowClosed` at ServiceNode end, fill `var(--node-ctrl-accent)`
- Label: "INVOKES", same label style as all other edges
- Hover `×` + double-click to delete

IDB edge row:
```
fromNodeId: ControllerNode.id
toNodeId:   ServiceNode.id
type:       'INVOKES'
label:      'INVOKES'
```

Extend load map in `useCanvas.ts`:
```
'INVOKES' → 'invokes'
```

---

## 8. Canvas Node Component

### File structure

```
src/components/nodes/ControllerNode/
├── ControllerNode.tsx
├── useControllerNode.ts
├── types.ts
└── index.ts
```

### types.ts

```typescript
import type { NodeProps } from '@xyflow/react'
import type { ControllerNode } from '@entity'

export interface ControllerNodeProps extends NodeProps {
  data: ControllerNode
}
```

### useControllerNode.ts

Returns:
```typescript
{
  node,             // ControllerNode
  isSelected,       // boolean
  handleClick,      // () => void
  connectedService, // { id: string; label: string } | null
  errorSummary,     // ErrorSummaryItem[] — up to 2 items for display, derived below
  hiddenErrorCount, // number — errors beyond the first 2
}
```

**Deriving `errorSummary`:**

```typescript
interface ErrorSummaryItem {
  httpStatus:  number
  identifier:  string   // exceptionClass short name OR errorCode
}

const errors = node.errorHandlerConfig.errors
const errorSummary: ErrorSummaryItem[] = errors.slice(0, 2).map(e => ({
  httpStatus: e.httpStatus,
  identifier: e.matchStrategy === ErrorMatchStrategy.BY_EXCEPTION
    ? e.exceptionClass.split('.').pop() ?? e.exceptionClass   // short class name
    : e.errorCode,
}))
const hiddenErrorCount = Math.max(0, errors.length - 2)
```

`ErrorSummaryItem` is a local type — define it in `types.ts` of this component.

`connectedService`:
```typescript
const allEdges = useEdges()
const allNodes = useNodes()
const invokesEdge = allEdges.find(e =>
  e.data?.type === EdgeType.INVOKES && e.source === props.id
)
const connectedService = invokesEdge
  ? (() => {
      const n = allNodes.find(n => n.id === invokesEdge.target)
      return n ? { id: n.id, label: (n.data as ServiceNode).label } : null
    })()
  : null
```

### ControllerNode.tsx

**Tailwind for all layout. Inline `style` only for dynamic CSS variable colours.**

**Root div:**
```
className="relative bg-surface rounded-[var(--radius-md)] shadow-node
           border transition-all duration-150 select-none"
style={{
  borderColor: isSelected ? 'var(--node-ctrl-accent)' : 'var(--color-canvas-node-border)',
  boxShadow:   isSelected ? '0 0 0 2px var(--node-ctrl-accent)22' : undefined,
}}
```

**NodeResizer:**
```tsx
<NodeResizer
  minWidth={210}
  minHeight={90}
  isVisible={isSelected}
  lineStyle={{ border: '1.5px solid var(--node-ctrl-accent)' }}
  handleStyle={{ background: 'var(--node-ctrl-accent)', border: 'none', width: 8, height: 8 }}
/>
```

**Header** — always shown, `className="px-3 pt-2 pb-1"`:
- Row 1: icon + label
  - Icon: 24×24, `background: var(--node-ctrl-icon-bg)`, `color: var(--node-ctrl-icon-fg)`, text "C", `text-[8px] font-mono font-bold rounded-[var(--radius-sm)]`
  - Label: `className="text-[13px] font-bold text-text flex-1 truncate"`
  - Row `className="flex items-center gap-2"`
- Row 2: basePath — `className="text-[10px] font-mono text-text-4 mt-0.5 truncate"`, text `node.basePath`

**Service row** — only when `connectedService !== null`:
`className="flex items-center gap-1.5 px-3 py-1.5 border-t border-[var(--color-border)]"`
- Glyph `◇`: `className="text-[10px] flex-shrink-0"`, `style={{ color: 'var(--node-svc-accent)' }}`
- Label: `className="text-[10px] font-mono text-text-2 flex-1 truncate"`, text `connectedService.label`
- Badge "SERVICE": `className="text-[8px] font-mono px-1 rounded-sm flex-shrink-0"`, `style={{ background: 'var(--node-svc-icon-bg)', color: 'var(--node-svc-icon-fg)' }}`

**Config row** — only when at least one config chip is active:
`className="flex items-center gap-1.5 px-3 py-1.5 border-t border-[var(--color-border)] flex-wrap"`

Chips:
- `crossOrigin = true` → chip text "CORS", `className="text-[8px] font-mono px-1.5 py-0.5 rounded-sm bg-[var(--color-accent-light)]"`, `style={{ color: 'var(--color-accent)' }}`
- `apiVersion !== null` → chip text `v${node.config.apiVersion}`, same style
- `requestLogging = true` → chip text "logging", `className="text-[8px] font-mono px-1.5 py-0.5 rounded-sm bg-surface-alt text-text-3"`

**Errors row** — only when `errorSummary.length > 0`:
`className="px-3 py-1.5 flex flex-col gap-[3px] border-t border-[var(--color-border)]"`

Each error summary row (max 2): `className="flex items-center gap-1.5 min-w-0"`:
- HTTP status chip:
  - 4xx → `className="text-[8px] font-mono px-1 rounded-sm flex-shrink-0 bg-[var(--color-warning-light)]"`, `style={{ color: 'var(--color-warning)' }}`
  - 5xx → `className="text-[8px] font-mono px-1 rounded-sm flex-shrink-0 bg-[var(--color-danger-light)]"`, `style={{ color: 'var(--color-danger)' }}`
  - other → `className="text-[8px] font-mono px-1 rounded-sm flex-shrink-0 bg-surface-alt text-text-3"`
  - text: `${item.httpStatus}`
- Identifier: `className="text-[10px] font-mono text-text-3 flex-1 truncate"`, text `item.identifier`

If `hiddenErrorCount > 0`, show after the two rows:
`className="text-[9px] font-mono text-text-4 italic"`, text `+${hiddenErrorCount} more`

---

## 9. Register in Canvas

```typescript
import { ControllerNode } from '@components/nodes/ControllerNode'

const NODE_TYPES = {
  microservice: MicroserviceNode,
  entity:       EntityNode,
  dto:          DTONode,
  db:           DBNode,
  table:        TableNode,
  service:      ServiceNode,
  controller:   ControllerNode,
} as const
```

Extend IDB load type map: `'CONTROLLER' → 'controller'`
Add `'controller'` case to `onDrop`.
Extend `onConnect` to handle Controller+Service pairs → INVOKES edge.

---

## 10. Left Sidebar Updates

In `useLeftSidebar.ts`: add `'controller'` case to `handleAddNode` and `handleDragStart`.

In `LeftSidebar.tsx`:
- Set `ready: true` for Controller palette item
- `disabled={!hasMicroservice}`, drag + click wired

Layers panel — ControllerNode item:
```
● Order Service          :8080
  ● Order                         ← entity
  ◈ OrderResponse                 ← dto
  ⬡ OrderService                  ← service
  ▷ OrderController  /api/orders  ← controller (right-pointing triangle)
```
- `pl-4`, glyph `▷` in `var(--node-ctrl-accent)` (orange)
- Label: `node.label`, 10px weight 500
- basePath right-aligned: `node.basePath`, 9px mono muted
- Click: `canvasStore.setSelectedNode(id)`
- Selected: `bg-[var(--color-accent-light)] text-[var(--color-accent)]`

---

## 11. Inspector Panel — ControllerInspector

### File structure

```
src/pages/Editor/components/InspectorPanel/components/ControllerInspector/
├── ControllerInspector.tsx
├── useControllerInspector.ts
├── types.ts
└── index.ts
```

Wire into `InspectorPanel.tsx`:
```typescript
case NodeType.CONTROLLER: return <ControllerInspector nodeId={selectedNodeId} />
```

### Panel anatomy

```
┌──────────────────────────────────────────┐
│ [ControllerNode]  badge       sticky top │
│ OrderController                     [×]  │
│ /api/orders                              │
├──────────────────────────────────────────┤
│ IDENTITY                                 │  ← section 1
│ [label                               ]   │
│ [basePath                            ]   │
├──────────────────────────────────────────┤
│ SERVICE CONNECTION                       │  ← section 2
│ ◇ OrderService   SERVICE        [×]      │  ← when connected
│ (or "Draw an edge to a Service node")    │  ← when not connected
├──────────────────────────────────────────┤
│ CONFIG                                   │  ← section 3
│ CORS (cross-origin)         [toggle]     │
│ API version  [v1            ]            │
│ Request logging             [toggle]     │
├──────────────────────────────────────────┤
│ SECURITY                                 │  ← section 4
│ Enable security             [toggle]     │
│ (when enabled:)                          │
│ Per-endpoint override       [toggle]     │
│ RBAC strategy  [ALLOW_LIST ▼]            │
│                                          │
│ ROLE RULES                               │
│  ADMIN    ALLOW              [×]         │
│  USER     ALLOW              [×]         │
│  [role input] [ALLOW ▼] [+]              │
├──────────────────────────────────────────┤
│ ERROR HANDLING                           │  ← section 5
│ Include timestamp           [toggle]     │
│ Include request path        [toggle]     │
│                                          │
│  ┌─────────────────────────────────────┐ │
│  │ 404  ResourceNotFoundException  ▶   │ │  ← collapsed error card
│  └─────────────────────────────────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │ ▼ 500  InternalError               │ │  ← expanded error card
│  │ Code    [INTERNAL_ERROR           ] │ │
│  │ Message [Something went wrong     ] │ │
│  │ Create exception  [toggle]          │ │
│  │ Log level  [ERROR ▼]                │ │
│  └─────────────────────────────────────┘ │
│  [+ Add error]                           │
├──────────────────────────────────────────┤
│ SWAGGER                                  │  ← section 6
│ Tags  [orders] [+]     [×] per tag       │
├──────────────────────────────────────────┤
│ AI PROMPT  ●                             │  ← section 7
├──────────────────────────────────────────┤
│ [      Delete controller      ]          │  ← section 8
└──────────────────────────────────────────┘
```

### useControllerInspector.ts

Same optimistic update pattern: instant RF `setNodes` → debounced 300ms IDB write.

**Read connection state:**
```typescript
const allEdges = useEdges()
const allNodes = useNodes()
const invokesEdge = allEdges.find(e =>
  e.data?.type === EdgeType.INVOKES && e.source === nodeId
)
const connectedService = invokesEdge
  ? (() => {
      const n = allNodes.find(n => n.id === invokesEdge.target)
      return n
        ? { edgeId: invokesEdge.id, id: n.id, label: (n.data as ServiceNode).label }
        : null
    })()
  : null
```

**Identity:**
- `handleLabelChange(value: string)` — live canvas: header label
- `handleBasePathChange(value: string)` — auto-prepend `/` if missing, live canvas: basePath row

Auto-format for basePath: if value doesn't start with `/`, prepend it on every keystroke.

**Connection:**
- `handleDisconnectService()` — `db.edges.delete(invokesEdge.id)`, remove from RF state, post sync
  No controller reset — configuration is independent of the service.

**Config:**
- `handleCrossOriginToggle()` — flips `config.crossOrigin`, live canvas: CORS chip
- `handleApiVersionChange(value: string)` — sets `config.apiVersion` (empty string → set to null), live canvas: version chip
- `handleRequestLoggingToggle()` — flips `config.requestLogging`, live canvas: logging chip

**Security:**
- `handleSecurityToggle()` — flips `security.enabled`
- `handlePerEndpointOverrideToggle()` — flips `security.perEndpointOverride`
- `handleRBACStrategyChange(value: RBACStrategy)`
- `handleAddRoleRule(role: string, access: RoleAccess)` — append to `security.rbac.rules`
- `handleRemoveRoleRule(index: number)` — remove by index

Security fields only visible when `security.enabled = true`.

**Error handling:**
- `handleIncludeTimestampToggle()` — flips `errorHandlerConfig.includeTimestamp`
- `handleIncludeRequestPathToggle()` — flips `errorHandlerConfig.includeRequestPath`
- `expandedErrorId: string | null` + `setExpandedErrorId`
- `handleAddError()` — append new `ErrorDefinition`:
  ```
  id: generateId()
  matchStrategy:  ErrorMatchStrategy.BY_EXCEPTION
  exceptionClass: 'BadRequestException'
  errorCode:      ''
  httpStatus:     400
  message:        ''
  fields:         []
  createException: false
  logLevel:        LogLevel.ERROR
  ```
- `handleRemoveError(errorId: string)`
- `handleErrorMatchStrategyChange(errorId: string, value: ErrorMatchStrategy)` — switches between BY_EXCEPTION and BY_ERROR_CODE
- `handleErrorExceptionClassChange(errorId: string, value: string)` — only relevant when matchStrategy = BY_EXCEPTION
- `handleErrorCodeChange(errorId: string, value: string)` — only relevant when matchStrategy = BY_ERROR_CODE
- `handleErrorHttpStatusChange(errorId: string, value: number)`
- `handleErrorMessageChange(errorId: string, value: string)` — 500ms debounce
- `handleErrorAddField(errorId: string, key: string, value: string)` — append `ErrorResponseField` to `error.fields`
- `handleErrorRemoveField(errorId: string, fieldIdx: number)` — remove field by index
- `handleErrorFieldKeyChange(errorId: string, fieldIdx: number, key: string)`
- `handleErrorFieldValueChange(errorId: string, fieldIdx: number, value: string)` — 500ms debounce
- `handleErrorCreateExceptionToggle(errorId: string)`
- `handleErrorLogLevelChange(errorId: string, value: LogLevel)`

**Swagger tags:**
- `handleAddSwaggerTag(tag: string)` — append to `swaggerTags[]` if not duplicate
- `handleRemoveSwaggerTag(index: number)`

**AI Prompt:**
- `handleAIPromptChange(field: keyof AIPrompt, value: string)` — 500ms debounce
- `handleAIGenerateToggle()`

**Lifecycle:**
- `handleClose()` — `canvasStore.clearSelection()`
- `handleDelete()` — confirm → `db.nodes.delete`, delete INVOKES edge if any, RF state, clearSelection

### Section 1 — Identity

| Field | Control | Live canvas |
|---|---|---|
| `label` | text input | Header label |
| `basePath` | text input, mono | basePath below header |

### Section 2 — Service Connection

When connected:
- `◇` glyph in `var(--node-svc-accent)` + service label + "SERVICE" badge + `×`
- `×` calls `handleDisconnectService()`

When not connected:
- `className="text-[10px] font-mono text-text-4 italic"`, text "Draw an edge to a Service node"

### Section 3 — Config

| Field | Control | Default | Live canvas |
|---|---|---|---|
| CORS | toggle | off | "CORS" chip |
| API version | text input (empty = none) | null | version chip |
| Request logging | toggle | off | "logging" chip |

API version input: `placeholder="e.g. v1"`, `font-mono`. Empty string → `apiVersion = null`.

### Section 4 — Security

Security toggle (`security.enabled`) at top of section.
When off: all other security fields hidden.
When on:

| Field | Control | Default |
|---|---|---|
| Per-endpoint override | toggle | off |
| RBAC strategy | select: ALLOW_LIST, DENY_LIST | ALLOW_LIST |

**Role rules** (shown when `security.enabled`):
Each rule row: role (mono text) + access badge (ALLOW = green, DENY = red) + `×`
Add row: `[role name input] [ALLOW ▼ | DENY ▼] [+]`

Access badge colours:
- ALLOW: `bg-[var(--color-success-light)]`, `style={{ color: 'var(--color-success)' }}`
- DENY: `bg-[var(--color-danger-light)]`, `style={{ color: 'var(--color-danger)' }}`

### Section 5 — Error Handling

Two toggles at top:

| Field | Control | Default |
|---|---|---|
| Include timestamp | toggle | on |
| Include request path | toggle | on |

**Error definitions** — collapsible cards (same pattern as TableNode custom queries):

**Collapsed** shows: httpStatus chip + matchStrategy badge + identifier (exceptionClass or errorCode) + `▶` caret

HTTP status chip colours:
- 4xx → `bg-[var(--color-warning-light)]`, `style={{ color: 'var(--color-warning)' }}`
- 5xx → `bg-[var(--color-danger-light)]`, `style={{ color: 'var(--color-danger)' }}`
- other → `bg-surface-alt text-text-3`

**Expanded** shows all fields in order:

**Match strategy row:**
- Toggle-style selector between `BY_EXCEPTION` and `BY_ERROR_CODE`
- Render as two tab-like buttons: active one gets accent background

**Identifier field** — shown based on match strategy:
- `BY_EXCEPTION` → label "Exception class", text input, mono, `placeholder="com.example.OrderNotFoundException"`
- `BY_ERROR_CODE` → label "Error code", text input, mono, `placeholder="ORDER_NOT_FOUND"`

Only one is visible at a time. Switching strategy does not clear the other — both values persist.

**HTTP status:**
- Number input, 100–599, label "HTTP status"

**Message:**
- Text input, label "Message", `placeholder="Human-readable error message"`
- This becomes the top-level `message` field in the JSON error response

**Response Fields section** — key-value pairs added to the error response body:
```
RESPONSE FIELDS
  detail    Order with ID {id} not found    [×]
  support   support@example.com             [×]
  [key input] [value input]        [+]
```
Each row: key (mono, flex-none, ~30% width) + value (mono, flex-1) + `×`
Add row: key input + value input + `+` button
Value field hint: static text or Spring SpEL expression e.g. `${exception.message}`

**Create exception toggle** — when on, generates a custom Java exception class

**Log level select** — ERROR, WARN, INFO, DEBUG

**"+ Add error"** button — same dashed-border style as other add buttons.

### Section 6 — Swagger Tags

Chips showing each tag with `×`:
`className="text-[8px] font-mono px-1.5 py-0.5 rounded-sm bg-[var(--color-accent-light)]"`, `style={{ color: 'var(--color-accent)' }}`

Add row: text input + `+` button.
Pressing Enter in input adds the tag and clears the input.

### Section 7 — AI Prompt

Description textarea 4 rows + aiGenerate toggle.
Standard AI box using `--ai-box-*` tokens.

### Section 8 — Delete

Button: "Delete controller"
`className="bg-[var(--color-danger-light)] text-[var(--color-danger)] border border-[var(--color-danger-border)] rounded-[var(--radius-sm)] w-full py-2 text-[11px] font-semibold"`

On confirm:
1. `db.nodes.delete(nodeId)`
2. Delete INVOKES edge if present: `db.edges.where('fromNodeId').equals(nodeId).delete()`
3. RF state updates
4. `canvasStore.clearSelection()`

---

## 12. ServiceInspector — CONNECTIONS update

ServiceInspector currently shows the connected entity.
Add a second connection type: connected ControllerNodes via INVOKES edges.

From the service's perspective, INVOKES edges have `toNodeId = serviceId`.
Connected controllers: `rfEdges.filter(e => e.data?.type === 'INVOKES' && e.target === nodeId)`

Row:
- Arrow `←` in `var(--node-ctrl-accent)` (orange) — "this controller calls this service"
- Controller label + "CONTROLLER" badge in controller icon colours
- `×` — removes the edge only (no reset of either node)

---

## 13. IDB Persistence

### Load on canvas mount

Extend type map: `'CONTROLLER' → 'controller'`
Extend edge map: `'INVOKES' → 'invokes'`

### Write on create

```typescript
await db.nodes.add({
  id:        node.id,
  projectId: currentProjectId,
  type:      'CONTROLLER',
  label:     node.label,
  position:  node.position,
  size:      node.size,
  data:      JSON.stringify(node),
  createdAt: Date.now(),
  updatedAt: Date.now(),
})
```

### Write on update

1. Instant RF `setNodes`
2. Debounced 300ms: `db.nodes.update(id, { data: JSON.stringify(updatedNode), updatedAt: now })`

Always replace `data` entirely — especially important for `errorHandlerConfig.errors[]`
and `security.rbac.rules[]` which are nested arrays.

### Write on INVOKES edge create

```typescript
await db.edges.add({
  id:         generateId(),
  projectId:  currentProjectId,
  fromNodeId: controllerId,
  toNodeId:   serviceId,
  type:       'INVOKES',
  label:      'INVOKES',
})
```

No node updates needed (INVOKES is structural only).

### Write on drag/resize

`onNodesChange` → position (drag end) and dimensions → debounce 100ms → `db.nodes.update`

### Write on delete

```
db.nodes.delete(nodeId)
db.edges.where('fromNodeId').equals(nodeId).delete()
```

### Cross-tab sync

After every IDB write:
```typescript
const bc = new BroadcastChannel('archflow-sync')
bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId })
bc.close()
```

---

## 14. Styling Rules

1. Tailwind classes for all layout, spacing, typography.
2. Inline `style` only for dynamic JS values or CSS variable colour tokens.
3. Never hardcode hex.
4. `font-mono` for all technical strings: basePath, role names, exception classes, error codes.
5. No `!important`.
6. Controller accent: `var(--node-ctrl-accent)` (orange), icon bg: `var(--node-ctrl-icon-bg)`, fg: `var(--node-ctrl-icon-fg)`.

---

## 15. What This Step Does NOT Build

- No APIEndpointNode connections (that is the next node step)
- No AuthGuardNode connections (that comes with AuthGuardNode step)
- No DTO connections — controllers never connect to DTOs directly
- No actual HTTP routing code generation
- No context menu on ControllerNode

---

## 16. Verification

### TypeScript
```bash
npx tsc --noEmit
```
Zero errors.

### Node basics

- [ ] Controller palette item dimmed when no MS exists
- [ ] Click Controller with MS selected → ControllerNode appears with basePath
- [ ] Drag from sidebar → drop inside MS → node at drop position
- [ ] Canvas card shows: icon "C", label, basePath below label
- [ ] No service row when not connected
- [ ] No config chips when all config is off
- [ ] No errors row when `errorHandlerConfig.errors` is empty
- [ ] Add one error → errors row appears showing httpStatus chip + identifier
- [ ] Add error with 4xx status → amber httpStatus chip
- [ ] Add error with 5xx status → red httpStatus chip
- [ ] Add 3 errors → first 2 shown, "+1 more" text appears
- [ ] Identifier shows short class name for BY_EXCEPTION (e.g. "OrderNotFoundException" not full package)
- [ ] Identifier shows error code for BY_ERROR_CODE
- [ ] Error row updates live as user edits httpStatus or identifier in inspector

### INVOKES edge (Controller → Service)

- [ ] Draw edge Controller → Service → edge appears (orange, "INVOKES" label)
- [ ] Draw edge Service → Controller → same result (normalised)
- [ ] Arrow points toward Service
- [ ] Service row appears on canvas card after connection
- [ ] Try connecting a second Service to same Controller → rejected silently
- [ ] Multiple Controllers can connect to same Service (allowed)
- [ ] Double-click INVOKES edge → edge removed, controller config unchanged
- [ ] ServiceInspector CONNECTIONS shows connected controllers with ← orange arrow

### Inspector — Identity

- [ ] Select Controller → ControllerInspector opens
- [ ] Change label → canvas header updates immediately
- [ ] Change basePath → canvas basePath updates immediately
- [ ] basePath auto-prepends `/` if missing

### Inspector — Service Connection

- [ ] Shows service when connected
- [ ] Shows "Draw an edge to a Service node" when not connected
- [ ] `×` removes edge, no controller reset, basePath and config unchanged

### Inspector — Config

- [ ] Toggle CORS on → "CORS" chip appears on canvas card
- [ ] Enter API version "v1" → "v1" chip appears
- [ ] Clear API version → chip disappears
- [ ] Toggle logging on → "logging" chip appears

### Inspector — Security

- [ ] Security toggle off → role rules and RBAC fields hidden
- [ ] Toggle security on → fields appear
- [ ] Add role rule ADMIN/ALLOW → row appears
- [ ] Change RBAC strategy → persists
- [ ] Remove role rule → disappears

### Inspector — Error Handling

- [ ] Add error → collapsed card shows httpStatus + match strategy + identifier
- [ ] 4xx status → amber chip, 5xx → red chip
- [ ] Expand error → all fields visible
- [ ] Match strategy selector: switching between BY_EXCEPTION and BY_ERROR_CODE shows correct identifier field
- [ ] BY_EXCEPTION → exception class input visible, error code hidden
- [ ] BY_ERROR_CODE → error code input visible, exception class hidden
- [ ] Switching strategy keeps both field values intact
- [ ] Add response field key+value → row appears
- [ ] Remove response field → row disappears
- [ ] Empty key or value → add button disabled or ignored
- [ ] Toggle createException
- [ ] Log level select persists
- [ ] Remove error card → disappears
- [ ] All error config persists after refresh (matchStrategy, fields[], message)

### Inspector — Swagger

- [ ] Add tag → chip appears
- [ ] Remove tag `×` → chip disappears
- [ ] Enter adds tag and clears input

### IDB persistence

- [ ] Refresh → ControllerNode reappears with basePath, all config intact
- [ ] Security rules persist after refresh
- [ ] Error definitions persist after refresh
- [ ] Swagger tags persist after refresh
- [ ] INVOKES edge persists → service shown after refresh
- [ ] Disconnect service → refresh → no service row
- [ ] Move node → refresh → position persists
- [ ] Delete node → refresh → node and edge do not reappear
- [ ] Two tabs: connect service in Tab 1 → Tab 2 updates within ~1 second
