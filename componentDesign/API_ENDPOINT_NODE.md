# APIEndpointNode — Design & Build Specification

> Claude Code: read this in full before writing a single line.
> Follow every rule in CLAUDE.md alongside this document.
> A MicroserviceNode must exist before an APIEndpointNode can be added.
> No entity nodes connect to this node — only DTOs and Controllers.
> Logging is controller-only. Each endpoint has its own security and error handling.
> Data persists in IDB.

---

## 1. What Is the APIEndpointNode

The `APIEndpointNode` represents **one HTTP operation** — one method + path combination.
It belongs inside a ControllerNode conceptually, and connects to one via a `ROUTES_TO` edge.

It connects to:
- **One ControllerNode** via `ROUTES_TO` (required for routing)
- **Zero or one request DTONode** via `ACCEPTS`
- **Zero or one response DTONode** via `RETURNS`

A BOTH-purpose DTO can serve as both request and response — in that case one edge handles both
and no second DTO edge is allowed.

**No entity nodes connect here.** API endpoints speak only to DTOs.

---

## 2. DTO Connection Rules

These rules are strict:

1. One request DTO maximum — `ACCEPTS` edge. Sets `dto.purpose = REQUEST`.
2. One response DTO maximum — `RETURNS` edge. Sets `dto.purpose = RESPONSE`.
3. If the connected DTO has `purpose = BOTH` — it is both request and response.
   No second DTO edge can be drawn to the same endpoint.
4. Total maximum: 2 DTO edges per endpoint (one ACCEPTS + one RETURNS).
   Exception: if one DTO is BOTH, then total maximum is 1 DTO edge.
5. EntityNodes cannot connect to APIEndpointNode under any circumstance.

Enforcement in `onConnect`:
```
If source or target is an EntityNode → reject silently.
If source or target is not a DTONode (for DTO edges) → reject.
If endpoint already has bodyDTOId and new edge would be ACCEPTS → reject.
If endpoint already has returnDTOId and new edge would be RETURNS → reject.
If endpoint has a BOTH-purpose DTO connected → reject any further DTO edges.
```

---

## 3. Visual Anatomy

The canvas card matches the reference screenshots: a compact dark card with a coloured
accent border, the EP icon badge, HTTP method chip, path, description, body DTO chip,
and response line.

```
┌──────────────────────────────────────┐  ← border: var(--node-ep-accent)
│  [EP]  POST /orders        inherit   │  ← HEADER: icon · label · security badge
│        POST /                        │  ← method + short path (mono, muted)
│  ──────────────────────────────────  │  ← thin divider
│                                      │
│  POST   /                            │  ← method chip + path (body)
│  Create order                        │  ← description (muted)
│                                      │
│  body: OrderRequestDTO               │  ← request DTO chip (when bodyDTOId set)
│  → OrderDTO  201                     │  ← response: returnDTOId chip + success code
└──────────────────────────────────────┘
```

Locked endpoint example (security = PUBLIC):
```
│  [EP]  GET /orders/{id}    inherit 🔒 │
│        GET /{id}                      │
│  ─────────────────────────────────    │
│  GET  /{id}                           │
│  Get by ID — public                   │
│  path: {id}                           │  ← path variable chip
│  → OrderDTO  200                      │
```

**Security badge** in header (top-right):
- `INHERIT` → text "inherit", `className="text-[8px] font-mono text-text-4"`
- `PUBLIC` → text "inherit 🔒", same style (🔒 signals it is publicly accessible)
- `CUSTOM` → text "custom", in accent colour

**Sections:**
| Section | Condition |
|---|---|
| Header | Always |
| Method + short path | Always (below header) |
| Thin divider | Always |
| Method chip + path (body) | Always |
| Description | When `config.description` is not empty |
| `body:` row | When `request.bodyDTOId` is set |
| Path variable row | When `request.pathVars.length > 0` |
| Response row `→` | Always (shows `—` if no returnDTOId) |

Minimum size: **w 220, h 110**. No maximum.

---

## 4. Data Model

Defined in `src/entity/APIEndpointNode.ts`. Import from `@entity`. Do not redefine.

```
APIEndpointNode
  method:        HttpMethod        (GET | POST | PUT | DELETE | PATCH)
  path:          string            e.g. "/" or "/{id}"
  config:        EndpointConfig
    paginated:   boolean
    deprecated:  boolean
    idempotent:  boolean
    description: string            short description e.g. "Create order"
  security:      EndpointSecurity
    override:    SecurityOverride  (INHERIT | PUBLIC | CUSTOM)
    rbac:        RBAC              active only when override = CUSTOM
  request:       EndpointRequest
    pathVars:    PathVariable[]
      name: string
      type: JavaType
    queryParams: EndpointQueryParam[]   (renamed from QueryParam to avoid clash)
      name:         string
      type:         JavaType
      defaultValue: string
      required:     boolean
    bodyDTOId:   string | null    → DTONode.id (set by ACCEPTS edge)
  response:      EndpointResponse
    successCode: number           auto-set by ROUTES_TO: POST=201, DELETE=204, else 200
    returnDTOId: string | null    → DTONode.id (set by RETURNS edge)
    isList:      boolean
    isPage:      boolean
  errorHandling: EndpointErrorHandling
    inheritFromController: boolean   default true
    errors:                EndpointError[]
      id:              string
      matchStrategy:   ErrorMatchStrategy  (BY_EXCEPTION | BY_ERROR_CODE)
      exceptionClass:  string
      errorCode:       string
      httpStatus:      number
      message:         string
      fields:          ErrorResponseField[]
        key:   string
        value: string
      createException: boolean
      (no logLevel — logging is controller-only)
```

---

## 5. Default Values

Add `createAPIEndpointNode()` to `src/utils/node.ts`:

```
id:       generateId()
type:     NodeType.API_ENDPOINT
label:    'GET /'
method:   HttpMethod.GET
path:     '/'
position: { x: 0, y: 0 }
size:     { w: 230, h: 120 }
aiPrompt: emptyAIPrompt()
config:
  paginated:   false
  deprecated:  false
  idempotent:  false
  description: ''
security:
  override: SecurityOverride.INHERIT
  rbac:     { strategy: RBACStrategy.ALLOW_LIST, rules: [] }
request:
  pathVars:    []
  queryParams: []
  bodyDTOId:   null
response:
  successCode: 200
  returnDTOId: null
  isList:      false
  isPage:      false
errorHandling:
  inheritFromController: true
  errors:                []
```

Label auto-format: whenever `method` or `path` changes, update `label = '${method} ${path}'`.

Export from `src/utils/index.ts`.

---

## 6. How APIEndpointNodes Are Added

### Guard

APIEndpointNode palette item enabled only when at least one MicroserviceNode exists.
When disabled: `opacity-40 cursor-not-allowed pointer-events-none`, title "Add a microservice first".

### Way 1 — Drag from left sidebar

- `onDragStart`: `e.dataTransfer.setData('nodeType', 'endpoint')`
- Canvas `onDrop`: `'endpoint'` case → `createAPIEndpointNode({ position })` → IDB → RF state

### Way 2 — Click palette item

- Target MS: selected MS first, else last MS in rfNodes
- Stagger: `{ x: 20 + (count % 4) * 240, y: 60 + Math.floor(count / 4) * 160 }`

---

## 7. Three Edge Types

### Edge 1 — ROUTES_TO (Endpoint → Controller)

**Rules:**
- One ControllerNode per endpoint (one endpoint can only route to one controller).
- One controller can receive many endpoints (many-to-one).
- Drawing from either end — normalise to `fromNodeId = endpoint.id`, `toNodeId = controller.id`.

**Guard:** endpoint already has a ROUTES_TO edge → reject silently.

**Auto-population on connect:**
```
endpoint.response.successCode:
  POST   → 201
  DELETE → 204
  GET / PUT / PATCH → 200

if path contains '{' → auto-add pathVar { name: first {word} in path, type: JavaType.UUID }
if method === GET and path has no '{' → set config.paginated = true
```

**On delete:** remove edge only. No reset of endpoint.
Toast on connect: `"${endpoint.label} routed to ${controller.label}"`

**Edge visual:**
```
src/components/edges/RoutesToEdge/
```
- Stroke: `var(--node-ep-accent)` (violet/pink)
- Arrow at Controller end
- Label: "ROUTES TO"
- Hover `×` + double-click to delete

IDB row: `fromNodeId: endpointId, toNodeId: controllerId, type: 'ROUTES_TO'`

### Edge 2 — ACCEPTS (Endpoint → DTO, request body)

**Rules:**
- Endpoint already has a bodyDTOId → reject.
- Endpoint has a BOTH-purpose DTO connected → reject.
- EntityNode on either end → reject.

**Normalise:** `fromNodeId = endpoint.id`, `toNodeId = dto.id`

**Auto-population on connect:**
```
endpoint.request.bodyDTOId = dto.id
dto.purpose = DTOPurpose.REQUEST
dto.config.validationEnabled = true
```
Update both endpoint and DTO in IDB + RF state.
Toast: `"${dto.label} set as request body — validation enabled"`

**On delete:**
```
endpoint.request.bodyDTOId = null
```
DTO purpose is NOT reverted (user chose it, keep it).

**Edge visual:**
```
src/components/edges/AcceptsEdge/
```
- Stroke: `var(--node-dto-accent)` (teal/cyan)
- Arrow at DTO end
- Label: "ACCEPTS"
- Hover `×` + double-click to delete

IDB row: `fromNodeId: endpointId, toNodeId: dtoId, type: 'ACCEPTS'`

### Edge 3 — RETURNS (Endpoint → DTO, response body)

**Rules:**
- Endpoint already has a returnDTOId → reject.
- Endpoint has a BOTH-purpose DTO connected → reject.
- EntityNode on either end → reject.

**Normalise:** `fromNodeId = endpoint.id`, `toNodeId = dto.id`

**Auto-population on connect:**
```
endpoint.response.returnDTOId = dto.id
dto.purpose = DTOPurpose.RESPONSE
```
Update both in IDB + RF state.
Toast: `"${dto.label} set as response — success code ${endpoint.response.successCode}"`

**On delete:**
```
endpoint.response.returnDTOId = null
```

**Edge visual:**
```
src/components/edges/ReturnsEdge/
```
- Stroke: `var(--node-dto-accent)` (same teal — both DTO edges use DTO colour)
- Arrow at DTO end
- Label: "RETURNS"
- Hover `×` + double-click to delete

IDB row: `fromNodeId: endpointId, toNodeId: dtoId, type: 'RETURNS'`

### BOTH-purpose DTO special case

When the DTO already connected has `purpose = BOTH`:
- It serves as both request and response.
- The endpoint stores the same id in both `bodyDTOId` and `returnDTOId`.
- No second DTO edge is possible.
- This is handled silently by the guard: if either slot is filled, reject new DTO edges.

### Inferring edge type in `onConnect`

```
if source is endpoint and target is controller → ROUTES_TO
if source is controller and target is endpoint → ROUTES_TO (swap)
if source is endpoint and target is dto        → infer ACCEPTS or RETURNS:
    if endpoint.request.bodyDTOId is null      → ACCEPTS
    elif endpoint.response.returnDTOId is null → RETURNS
    else → reject (both slots full)
if source is dto and target is endpoint        → same logic (swap)
if either side is EntityNode                   → reject always
```

### Registering in Canvas.tsx

```typescript
const EDGE_TYPES = {
  derivedFrom: DerivedFromEdge,
  storedIn:    StoredInEdge,
  connectsTo:  ConnectsToEdge,
  uses:        UsesEdge,
  invokes:     InvokesEdge,
  routesTo:    RoutesToEdge,
  accepts:     AcceptsEdge,
  returns:     ReturnsEdge,
} as const
```

Extend load map:
```
'ROUTES_TO' → 'routesTo'
'ACCEPTS'   → 'accepts'
'RETURNS'   → 'returns'
```

---

## 8. Canvas Node Component

### File structure

```
src/components/nodes/APIEndpointNode/
├── APIEndpointNode.tsx
├── useAPIEndpointNode.ts
├── types.ts
└── index.ts
```

### useAPIEndpointNode.ts

Returns:
```typescript
{
  node,              // APIEndpointNode
  isSelected,        // boolean
  handleClick,       // () => void
  requestDTOLabel,   // string | null — label of ACCEPTS DTO
  responseDTOLabel,  // string | null — label of RETURNS DTO
  pathVarSummary,    // string | null — first path var name e.g. "{id}"
  securityBadge,     // string — "inherit" | "inherit 🔒" | "custom"
  methodChipClass,   // string — Tailwind classes for the method colour chip
}
```

**Method chip colours** (inline style, matches screenshot):
```
GET    → background: '#22c55e22', color: '#22c55e'   (green)
POST   → background: '#a855f722', color: '#a855f7'   (violet)
PUT    → background: '#f59e0b22', color: '#f59e0b'   (amber)
PATCH  → background: '#f59e0b22', color: '#f59e0b'   (amber)
DELETE → background: '#ef444422', color: '#ef4444'   (red)
```

**`requestDTOLabel` and `responseDTOLabel`**: resolved from rfNodes by
`node.request.bodyDTOId` and `node.response.returnDTOId`.

**`securityBadge`**:
```
INHERIT → "inherit"
PUBLIC  → "inherit 🔒"
CUSTOM  → "custom"
```

**`pathVarSummary`**: `node.request.pathVars.length > 0 ? node.request.pathVars[0].name : null`

### APIEndpointNode.tsx

**Root div** — accent border always visible (same pattern as ControllerNode):
```
className="relative bg-surface rounded-[var(--radius-lg)] shadow-node
           transition-all duration-150 select-none"
style={{
  border: isSelected
    ? `2px solid var(--node-ep-accent)`
    : `1px solid var(--node-ep-accent)60`,
  boxShadow: isSelected
    ? `0 0 0 3px var(--node-ep-accent)20, var(--shadow-node)`
    : 'var(--shadow-node)',
}}
```

**NodeResizer:**
```tsx
<NodeResizer
  minWidth={220}
  minHeight={110}
  isVisible={isSelected}
  lineStyle={{ border: '2px solid var(--node-ep-accent)' }}
  handleStyle={{ background: 'var(--node-ep-accent)', border: 'none', width: 8, height: 8 }}
/>
```

**Header** — `className="flex items-center gap-2 px-3 pt-3 pb-1"`:
- Icon badge: 28×28, `background: var(--node-ep-icon-bg)`, `color: var(--node-ep-icon-fg)`, text "EP", `text-[8px] font-mono font-bold rounded-[var(--radius-sm)] flex-shrink-0`
- Label: `className="text-[13px] font-bold text-text flex-1 truncate"`, text `node.label`
- Security badge (top-right): `className="text-[8px] font-mono text-text-4 flex-shrink-0"`, text `securityBadge` (includes 🔒 when PUBLIC)

**Sub-header line** — `className="px-3 pb-1.5"`:
`className="text-[10px] font-mono text-text-4 truncate"`, text `${node.method} ${node.path}`

**Thin divider** — `className="mx-3 border-t border-[var(--color-border)]"`

**Body** — `className="px-3 py-2 flex flex-col gap-1.5"`:

_Method chip + path row_ — always:
`className="flex items-center gap-2"`
- Method chip: `className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-sm flex-shrink-0"`, inline style for colour from `methodChipStyle`
- Path text: `className="text-[11px] font-mono text-text-3 flex-1 truncate"`, text `node.path`

_Description line_ — only when `config.description` is not empty:
`className="text-[10px] font-mono text-text-4 truncate"`, text `node.config.description`

_Body DTO row_ — only when `requestDTOLabel !== null`:
`className="flex items-center gap-1.5"`
- `className="text-[9px] font-mono text-text-4"`, text "body:"
- DTO name chip: `className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm"`, `style={{ background: 'var(--node-dto-icon-bg)', color: 'var(--node-dto-icon-fg)' }}`, text `requestDTOLabel`

_Path variable row_ — only when `pathVarSummary !== null`:
`className="flex items-center gap-1.5"`
- `className="text-[9px] font-mono text-text-4"`, text "path:"
- Path var chip: same DTO chip style, text `{${pathVarSummary}}`

_Response row_ — always:
`className="flex items-center gap-1.5"`
- Arrow `→`: `className="text-[10px] flex-shrink-0"`, `style={{ color: 'var(--node-ep-accent)' }}`
- Return DTO chip (if set): same chip style as body DTO chip, text `responseDTOLabel`
- If no returnDTOId: `className="text-[9px] font-mono text-text-4"`, text "—"
- Success code: `className="text-[9px] font-mono px-1 rounded-sm bg-surface-alt text-text-3 flex-shrink-0"`, text `${node.response.successCode}`

---

## 9. Register in Canvas

```typescript
import { APIEndpointNode } from '@components/nodes/APIEndpointNode'

const NODE_TYPES = {
  microservice: MicroserviceNode,
  entity:       EntityNode,
  dto:          DTONode,
  db:           DBNode,
  table:        TableNode,
  service:      ServiceNode,
  controller:   ControllerNode,
  endpoint:     APIEndpointNode,
} as const
```

Extend IDB load type map: `'API_ENDPOINT' → 'endpoint'`
Add `'endpoint'` case to `onDrop`.
Extend `onConnect` with full routing logic (Section 7).

---

## 10. Left Sidebar Updates

In `useLeftSidebar.ts`: add `'endpoint'` to `handleAddNode` and `handleDragStart`.

In `LeftSidebar.tsx`:
- Set `ready: true` for API Endpoint palette item
- `disabled={!hasMicroservice}`, drag + click wired

Layers panel:
```
● Order Service          :8080
  ● Order                         ← entity
  ◈ OrderResponse                 ← dto
  ⬡ OrderService                  ← service
  ▷ OrderController  /api/orders  ← controller
    EP POST /orders               ← endpoint (indented under controller via ROUTES_TO)
    EP GET /orders/{id}
```

How to group endpoints under controllers in the layers panel:
- Read all ROUTES_TO edges from rfEdges
- For each ControllerNode, collect all endpoints that route to it
- Render endpoints indented (`pl-8`) directly below their controller
- Endpoints with no controller sit ungrouped after all controllers

Endpoint layer item:
- `pl-8` (double indent), glyph "EP" small in `var(--node-ep-icon-bg)` with `var(--node-ep-icon-fg)` text
- Left: HTTP method chip (coloured, 8px) + path (10px mono muted)
- No right-side content
- Click: `canvasStore.setSelectedNode(id)`
- Selected: `bg-[var(--color-accent-light)] text-[var(--color-accent)]`

---

## 11. Inspector Panel — APIEndpointInspector

### File structure

```
src/pages/Editor/components/InspectorPanel/components/APIEndpointInspector/
├── APIEndpointInspector.tsx
├── useAPIEndpointInspector.ts
├── types.ts
└── index.ts
```

Wire into `InspectorPanel.tsx`:
```typescript
case NodeType.API_ENDPOINT: return <APIEndpointInspector nodeId={selectedNodeId} />
```

### Panel anatomy

Matches Image 1 from the screenshots exactly.

```
┌──────────────────────────────────────────┐
│ POST /orders                        [×]  │  ← title = node.label
│ EPNode · id1                             │  ← type badge + node id (short)
├──────────────────────────────────────────┤
│ LABEL                                    │  ← section 1
│ [POST /orders                        ]   │
├──────────────────────────────────────────┤
│ HTTP                                     │  ← section 2
│ [POST ▼]  [/                        ]   │  ← method select + path input side by side
│ [Create order                       ]   │  ← description input below
├──────────────────────────────────────────┤
│ REQUEST                                  │  ← section 3
│ Body DTO (REQUEST)                       │
│ [OrderRequestDTO                   ▼]   │  ← dropdown of all DTONodes in project
│ Path variables                           │
│ [name:Type                    ] [+]      │  ← path var add row
│ Query params                             │  ← (collapsed by default, expand button)
├──────────────────────────────────────────┤
│ RESPONSE                                 │  ← section 4
│ Return DTO (RESPONSE)                    │
│ [OrderDTO                         ▼]    │
│ Success code    [201              ▼]    │
│ Paginated (Page<>)          [toggle]    │
│ Deprecated                  [toggle]    │
├──────────────────────────────────────────┤
│ SECURITY OVERRIDE                        │  ← section 5
│ [Inherit from Controller          ▼]    │  ← SecurityOverride select
│ (when CUSTOM: show RBAC rules)           │
├──────────────────────────────────────────┤
│ ERROR HANDLING                           │  ← section 6
│ Inherit from controller     [toggle]    │
│ (when not inherited: error cards)        │
├──────────────────────────────────────────┤
│ CONNECTIONS                              │  ← section 7
│ → ● OrderController  ROUTES TO    [×]   │
│ → ● OrderRequestDTO  ACCEPTS      [×]   │
│ → ● OrderDTO         RETURNS      [×]   │
│                                          │
│ [+ connect to node…               ▼]    │  ← quick-connect dropdown
├──────────────────────────────────────────┤
│ [        Delete node          ]          │  ← section 8
└──────────────────────────────────────────┘
```

### useAPIEndpointInspector.ts

Same optimistic update pattern: instant RF `setNodes` → debounced 300ms IDB write.

**Read connections:**
```typescript
const allEdges = useEdges()
const allNodes = useNodes()

const routesToEdge = allEdges.find(e => e.data?.type === 'ROUTES_TO' && e.source === nodeId)
const acceptsEdge  = allEdges.find(e => e.data?.type === 'ACCEPTS'   && e.source === nodeId)
const returnsEdge  = allEdges.find(e => e.data?.type === 'RETURNS'   && e.source === nodeId)

const connectedController = routesToEdge ? resolveNode(routesToEdge.target) : null
const connectedRequestDTO = acceptsEdge  ? resolveNode(acceptsEdge.target)  : null
const connectedResponseDTO= returnsEdge  ? resolveNode(returnsEdge.target)  : null
```

**Label + HTTP:**
- `handleLabelChange(value: string)` — manual override of the label
- `handleMethodChange(value: HttpMethod)` — updates method, auto-updates label to `${method} ${path}`
- `handlePathChange(value: string)` — auto-prepend `/`, update label
- `handleDescriptionChange(value: string)` — 500ms debounce

**Request:**
- `handleBodyDTOChange(dtoId: string | null)` — sets `request.bodyDTOId`, updates DTO purpose in IDB
  Silently ignore if `response.returnDTOId` is set with a BOTH DTO
- `handleAddPathVar(name: string, type: JavaType)` — auto-extract name from path if contains `{name}`
- `handleRemovePathVar(index: number)`
- `handleAddQueryParam(name, type, defaultValue, required)` — query params sub-section (collapsed)
- `handleRemoveQueryParam(index: number)`

**Response:**
- `handleReturnDTOChange(dtoId: string | null)` — sets `response.returnDTOId`, updates DTO purpose
- `handleSuccessCodeChange(value: number)`
- `handlePaginatedToggle()` — flips `response.isPage`, if true sets `response.isList = false`
- `handleDeprecatedToggle()` — flips `config.deprecated`

**Security:**
- `handleSecurityOverrideChange(value: SecurityOverride)` — updates `security.override`
- When `CUSTOM`: RBAC rule handlers same as ControllerInspector:
  - `handleAddRoleRule(role, access)`, `handleRemoveRoleRule(index)`, `handleRBACStrategyChange`

**Error handling:**
- `handleInheritFromControllerToggle()` — flips `errorHandling.inheritFromController`
- When not inherited: same error card handlers as ControllerInspector but WITHOUT logLevel:
  - `handleAddError()`, `handleRemoveError`, `handleErrorMatchStrategyChange`,
    `handleErrorExceptionClassChange`, `handleErrorCodeChange`,
    `handleErrorHttpStatusChange`, `handleErrorMessageChange`,
    `handleErrorAddField`, `handleErrorRemoveField`,
    `handleErrorFieldKeyChange`, `handleErrorFieldValueChange`,
    `handleErrorCreateExceptionToggle`

**Connections (read-only display + edge delete):**
- `handleDisconnectController()` — delete ROUTES_TO edge
- `handleDisconnectRequestDTO()` — delete ACCEPTS edge, set `request.bodyDTOId = null`
- `handleDisconnectResponseDTO()` — delete RETURNS edge, set `response.returnDTOId = null`
- `handleQuickConnect(targetNodeId: string)` — infer edge type from target node type,
  create the appropriate edge. This powers the "+ connect to node…" dropdown.

**`availableNodes` for quick-connect dropdown:**
```typescript
const availableNodes = allNodes.filter(n => {
  const type = (n.data as BaseNode).type
  if (type === NodeType.DTO) {
    // Only include if there's a slot available
    if (!node.request.bodyDTOId || !node.response.returnDTOId) return true
    return false
  }
  if (type === NodeType.CONTROLLER) {
    return !routesToEdge  // only if not yet connected to a controller
  }
  return false  // entities and everything else: never
})
```

**Lifecycle:**
- `handleClose()` — `canvasStore.clearSelection()`
- `handleDelete()` — confirm → delete node + all 3 edge types where `fromNodeId = nodeId`,
  revert `bodyDTOId` and `returnDTOId` on connected DTOs to null, RF state, clearSelection

### Section 1 — Label

Text input. Shows the auto-formatted `${method} ${path}` by default.
User can override manually. If they clear it, it auto-fills again from method + path.

### Section 2 — HTTP

Two-column row: method select + path input side by side.
Method select: GET, POST, PUT, DELETE, PATCH — coloured options.
Path input: mono, `placeholder="/"`.
Description input below: `placeholder="e.g. Create order"`.

Changing method or path auto-updates the label.

### Section 3 — Request

**Body DTO dropdown** — lists all DTONodes in the project.
Shows current selection or "None" when `bodyDTOId = null`.
Selecting a DTO:
- Sets `bodyDTOId`
- Sets that DTO's `purpose = REQUEST` in IDB + RF state
- If same DTO is also the returnDTOId → purpose becomes BOTH automatically

**Path variables** — one row per pathVar:
```
{id}   UUID   [×]
[name:Type input] [+]
```
Input placeholder: `"name:Type e.g. id:UUID"` — parse on submit.

**Query params** — collapsed by default, expand with "Query params ▼" toggle:
Same add/remove pattern as path vars.

### Section 4 — Response

**Return DTO dropdown** — same as body DTO dropdown, lists all DTONodes.
Selecting sets `returnDTOId` and DTO `purpose = RESPONSE`.

**Success code dropdown**: common codes 200, 201, 204, 400, 401, 403, 404, 500.
User can also type a custom code.

**Paginated toggle** — when on, response wrapped in `Page<>`.
**Deprecated toggle** — marks endpoint as deprecated.

### Section 5 — Security Override

Dropdown: Inherit from Controller / Public / Custom.

When Custom:
- RBAC strategy select (ALLOW_LIST / DENY_LIST)
- Role rules: same add/remove as ControllerInspector

### Section 6 — Error Handling

"Inherit from controller" toggle at top (on by default).
When off: shows error definition cards — identical to ControllerInspector's Section 5
except no logLevel field (logging is controller-only).

### Section 7 — Connections

Matches Image 1 and Image 2 from the screenshots.

Each connection row:
```
→ ● NodeLabel      EDGE_TYPE_BADGE    [×]
```

- Arrow `→`: `style={{ color: 'var(--node-ep-accent)' }}`
- Coloured dot: matches the connected node's accent colour
- Node label: 11px mono
- Edge type badge chip: coloured pill
  - ROUTES TO → violet (`var(--node-ep-accent)`)
  - ACCEPTS → teal (`var(--node-dto-accent)`)
  - RETURNS → teal (`var(--node-dto-accent)`)
- `[×]` button: removes the edge (+ reverts endpoint data if needed)

**"+ connect to node…" dropdown** — collapsible combobox at the bottom of CONNECTIONS.
Shows all `availableNodes` from the hook.
Selecting one calls `handleQuickConnect`.

---

## 12. ControllerInspector — update CONNECTIONS section

When an endpoint connects to a controller via ROUTES_TO, the controller's inspector
CONNECTIONS section must show it.

From the controller's perspective, ROUTES_TO edges have `toNodeId = controllerId`.
Connected endpoints: `rfEdges.filter(e => e.data?.type === 'ROUTES_TO' && e.target === nodeId)`

In the ControllerInspector CONNECTIONS section, show endpoints first (they route IN to the controller):

```
CONNECTIONS
← ● GET /orders          ROUTES TO    [×]
← ● POST /orders         ROUTES TO    [×]
← ● GET /orders/{id}     ROUTES TO    [×]
← ● DELETE /{id}         ROUTES TO    [×]
→ ● JwtAuthGuard         SECURED BY   [×]   ← future: AuthGuard step
→ ● OrderService         INVOKES      [×]
```

Matches Image 2 exactly.

Each endpoint row:
- Left arrow `←` in `var(--node-ep-accent)` — "this endpoint routes to this controller"
- Method chip (coloured, 8px) + path label
- "ROUTES TO" badge in `var(--node-ep-accent)` colour
- `[×]` removes the ROUTES_TO edge

The `←` vs `→` distinction for Image 2:
- `←` = incoming to the controller (endpoint routes TO it)
- `→` = outgoing from the controller (service it INVOKES, auth guard that SECURES it)

---

## 13. IDB Persistence

### Load on canvas mount

Extend type map: `'API_ENDPOINT' → 'endpoint'`
Extend edge map:
```
'ROUTES_TO' → 'routesTo'
'ACCEPTS'   → 'accepts'
'RETURNS'   → 'returns'
```

### Write on create

```typescript
await db.nodes.add({
  id:        node.id,
  projectId: currentProjectId,
  type:      'API_ENDPOINT',
  label:     node.label,
  position:  node.position,
  size:      node.size,
  data:      JSON.stringify(node),
  createdAt: Date.now(),
  updatedAt: Date.now(),
})
```

### Write on update

Debounced 300ms (500ms for description). Full `data` replacement always.

### Write on edge create

For each of the 3 edge types:
```typescript
await db.edges.add({
  id:         generateId(),
  projectId,
  fromNodeId: endpointId,
  toNodeId:   targetId,
  type:       'ROUTES_TO' | 'ACCEPTS' | 'RETURNS',
  label:      ...,
})
```

Also write updated endpoint + DTO node data immediately (no debounce on edge creation).

### Write on drag/resize

`onNodesChange` → position / dimensions → debounce 100ms → `db.nodes.update`

### Write on delete

```
db.nodes.delete(nodeId)
db.edges.where('fromNodeId').equals(nodeId).delete()  ← all 3 edge types
```

Also update connected DTOs: clear `bodyDTOId`/`returnDTOId` references back from endpoint.

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
3. Never hardcode hex except method chip colours (POST=violet, GET=green, etc.) — these are canonical HTTP colours, not theme tokens.
4. `font-mono` for all technical strings: paths, method names, DTO names, path vars.
5. No `!important`.
6. Endpoint accent: `var(--node-ep-accent)` (violet/pink).

---

## 15. What This Step Does NOT Build

- No AuthGuard → Controller `SECURED_BY` edge (that comes with AuthGuardNode)
- No code generation
- No request/response body validation preview
- No context menu on the node

---

## 16. Verification

### TypeScript
```bash
npx tsc --noEmit
```
Zero errors.

### Node basics

- [ ] Endpoint palette item dimmed when no MS exists
- [ ] Click endpoint with MS selected → APIEndpointNode appears with default GET /
- [ ] Drag from sidebar → drop inside MS → node at drop position
- [ ] Canvas card shows: EP badge, label, sub-header method+path, divider, body section
- [ ] Method chip colour: POST=violet, GET=green, PUT/PATCH=amber, DELETE=red
- [ ] Security badge shows "inherit" by default
- [ ] Response row always shows → arrow + success code

### ROUTES_TO edge

- [ ] Draw edge Endpoint → Controller → edge appears (violet, "ROUTES TO")
- [ ] POST endpoint → success code auto-set to 201
- [ ] DELETE endpoint → success code auto-set to 204
- [ ] GET endpoint → success code stays 200
- [ ] Path with `{id}` → pathVar auto-added
- [ ] GET without `{` → paginated = true auto-set
- [ ] Try connecting second controller to same endpoint → rejected
- [ ] ControllerInspector CONNECTIONS shows endpoint with ← arrow + "ROUTES TO" badge
- [ ] Double-click edge → removed

### ACCEPTS edge

- [ ] Draw edge Endpoint → DTONode → ACCEPTS edge (teal)
- [ ] DTO purpose set to REQUEST
- [ ] DTO validation enabled
- [ ] Canvas card shows "body: OrderRequestDTO" chip
- [ ] Inspector Body DTO dropdown shows selected DTO
- [ ] Try connecting second request DTO → rejected
- [ ] EntityNode → rejected always

### RETURNS edge

- [ ] Draw edge Endpoint → DTONode → RETURNS edge (teal)
- [ ] DTO purpose set to RESPONSE
- [ ] Canvas card response row shows DTO label chip
- [ ] Try connecting second response DTO → rejected
- [ ] If endpoint already has BOTH DTO → any new DTO edge rejected

### BOTH DTO case

- [ ] Connect DTO with purpose=BOTH → fills both bodyDTOId and returnDTOId
- [ ] No second DTO edge possible

### Inspector — HTTP section

- [ ] Change method → label auto-updates
- [ ] Change path → label auto-updates
- [ ] Add description → shows on canvas card

### Inspector — Security Override

- [ ] Set to Public → canvas badge shows "inherit 🔒"
- [ ] Set to Custom → RBAC fields appear
- [ ] Set to Inherit → only "inherit" badge

### Inspector — Error Handling

- [ ] Inherit toggle on (default) → no error cards shown
- [ ] Toggle off → add error card UI appears
- [ ] Add error → card with matchStrategy, identifier, httpStatus, message, fields
- [ ] No logLevel field present anywhere in endpoint error cards

### Inspector — Connections section

- [ ] Shows all 3 connected nodes with correct arrow direction and badge colour
- [ ] ROUTES TO badge is violet
- [ ] ACCEPTS / RETURNS badges are teal
- [ ] `×` on each removes the edge and reverts endpoint data
- [ ] "+ connect to node…" dropdown shows available nodes only (no entities)

### IDB persistence

- [ ] Refresh → endpoint reappears with method, path, bodyDTOId, returnDTOId intact
- [ ] ROUTES_TO + ACCEPTS + RETURNS edges all persist
- [ ] Change method → refresh → new method persists
- [ ] Add path var → refresh → path var persists
- [ ] Error cards persist after refresh
- [ ] Delete endpoint → refresh → node + all 3 edges gone
- [ ] Two tabs → connect controller in Tab 1 → Tab 2 updates within ~1 second
