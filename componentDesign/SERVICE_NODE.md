# ServiceNode — Design & Build Specification

> Claude Code: read this in full before writing a single line.
> Follow every rule in CLAUDE.md alongside this document.
> A MicroserviceNode must exist before a ServiceNode can be added.
> A ServiceNode connects to exactly ONE EntityNode via a USES edge.
> The ServiceNode is completely DTO-agnostic — no DTO references anywhere.
> Data persists in IDB.

---

## 1. What Is the ServiceNode

The `ServiceNode` holds **pure business logic**.
It operates entirely on domain objects — entities and Java primitives.
It has no knowledge of DTOs, HTTP, or databases.

Each ServiceNode connects to **exactly one EntityNode** via a `USES` edge.
When connected, standard CRUD service methods are auto-generated.
When disconnected, the node resets to its default empty state.

---

## 2. One Entity Rule

- A ServiceNode connects to **one and only one** EntityNode.
- Attempting to draw a second USES edge from the same ServiceNode → silently rejected.
- An EntityNode can be connected to **many** ServiceNodes (one entity, many services).

---

## 3. Visual Anatomy

```
┌──────────────────────────────────┐  ← border: var(--node-svc-accent) when selected
│                                  │
│  [S]  OrderService               │  ← HEADER: icon · label
│                                  │
├──────────────────────────────────┤
│  ● Order      ENTITY             │  ← ENTITY ROW (when connected)
├──────────────────────────────────┤
│  findAll      → List<Order>      │  ← METHODS (max 4 shown)
│  findById     → Optional<Order>  │
│  create       → Order            │
│  delete       → void             │
├──────────────────────────────────┤
│  @Transactional  interface       │  ← CONFIG ROW
└──────────────────────────────────┘
```

When no entity is connected (default / reset state):
```
┌──────────────────────────────────┐
│  [S]  OrderService               │  ← HEADER only
└──────────────────────────────────┘
```

No entity row, no methods section, no config chips (all defaults).
The node is as if freshly created.

---

## 4. Data Model

Defined in `src/entity/ServiceNode.ts`. Import from `@entity`. Do not redefine.

```
ServiceNode
  methods:       ServiceMethod[]   ← empty when no entity connected
  dependencyIds: string[]          ← not used in this step
  config:        ServiceConfig
    classLevelTransactional: boolean
    classLevelAsync:         boolean
    generateInterface:       boolean

ServiceMethod
  id:            string
  name:          string
  returnType:    MethodReturnType
    entityId:      string | null   ← the entity type returned (→ EntityNode.id)
    primitiveType: JavaType | null ← for primitive returns (UUID, Boolean, etc.)
    isList:        boolean
    isPage:        boolean
    isOptional:    boolean
    isVoid:        boolean
  params:        MethodParam[]
    name:          string
    primitiveType: JavaType | null ← UUID, String, Integer, etc.
    entityId:      string | null   ← when param is an entity type
    isPageable:    boolean
  transactional:  boolean
  async:          boolean
  aiPrompt:       AIPrompt
  throwsErrors:   ErrorContract[]
    exceptionClass:  string
    description:     string
    createException: boolean
```

No dtoId anywhere. Not in return types. Not in params. Services only speak entity + primitive.

---

## 5. Default Values

Add `createServiceNode()` to `src/utils/node.ts`:

```
id:            generateId()
type:          NodeType.SERVICE
label:         'Service'
methods:       []
dependencyIds: []
position:      { x: 0, y: 0 }
size:          { w: 220, h: 100 }   ← compact when empty
aiPrompt:      emptyAIPrompt()
config:
  classLevelTransactional: true
  classLevelAsync:         false
  generateInterface:       true
```

Export from `src/utils/index.ts`.

---

## 6. How ServiceNodes Are Added

### Guard

ServiceNode palette item enabled only when at least one MicroserviceNode exists.
When disabled: `opacity-40 cursor-not-allowed pointer-events-none`, title "Add a microservice first".

### Way 1 — Drag from left sidebar

- `onDragStart`: `e.dataTransfer.setData('nodeType', 'service')`
- Canvas `onDrop`: `'service'` case → `createServiceNode({ position })` → IDB → RF state

### Way 2 — Click palette item

- Target MS: selected MS first, else last MS in rfNodes
- Stagger: `{ x: 20 + (count % 4) * 230, y: 60 + Math.floor(count / 4) * 180 }`
  where `count` = existing ServiceNodes in the project

---

## 7. USES Edge (Service → Entity)

### Rules

- ServiceNode → one EntityNode only. Second attempt → silently rejected.
- EntityNode → many ServiceNodes (no restriction on the entity side).
- Drawing from either end is valid — normalise to `fromNodeId = ServiceNode.id`, `toNodeId = EntityNode.id`.

### Guard in `onConnect`

```
1. Identify which end is ServiceNode and which is EntityNode.
2. If neither end is a Service+Entity pair → ignore (not this step).
3. If serviceNode already has a USES edge → reject silently.
   alreadyConnected = rfEdges.some(e =>
     e.data?.type === EdgeType.USES && e.source === serviceId
   )
4. If true → return without creating edge.
```

### Auto-population on connect

When the USES edge is created:

**Generate 5 standard CRUD methods** (always — regardless of whether methods[] is empty or not).
On connect, the service is treated as fresh and the methods are always regenerated from the entity.

```typescript
const entityLabel = entity.label   // e.g. "Order"
const entityId    = entity.id

methods = [
  {
    id:            generateId(),
    name:          'findAll',
    returnType:    { entityId, primitiveType: null, isList: true,  isPage: false, isOptional: false, isVoid: false },
    params:        [],
    transactional: false,
    async:         false,
    aiPrompt:      emptyAIPrompt(),
    throwsErrors:  [],
  },
  {
    id:            generateId(),
    name:          'findById',
    returnType:    { entityId, primitiveType: null, isList: false, isPage: false, isOptional: true,  isVoid: false },
    params:        [{ name: 'id', primitiveType: JavaType.UUID, entityId: null, isPageable: false }],
    transactional: false,
    async:         false,
    aiPrompt:      emptyAIPrompt(),
    throwsErrors:  [],
  },
  {
    id:            generateId(),
    name:          'create',
    returnType:    { entityId, primitiveType: null, isList: false, isPage: false, isOptional: false, isVoid: false },
    params:        [{ name: entityLabel.toLowerCase(), primitiveType: null, entityId, isPageable: false }],
    transactional: true,
    async:         false,
    aiPrompt:      emptyAIPrompt(),
    throwsErrors:  [],
  },
  {
    id:            generateId(),
    name:          'update',
    returnType:    { entityId, primitiveType: null, isList: false, isPage: false, isOptional: false, isVoid: false },
    params:        [
      { name: 'id',                         primitiveType: JavaType.UUID, entityId: null,   isPageable: false },
      { name: entityLabel.toLowerCase(),    primitiveType: null,          entityId,          isPageable: false },
    ],
    transactional: true,
    async:         false,
    aiPrompt:      emptyAIPrompt(),
    throwsErrors:  [],
  },
  {
    id:            generateId(),
    name:          'delete',
    returnType:    { entityId: null, primitiveType: null, isList: false, isPage: false, isOptional: false, isVoid: true },
    params:        [{ name: 'id', primitiveType: JavaType.UUID, entityId: null, isPageable: false }],
    transactional: true,
    async:         false,
    aiPrompt:      emptyAIPrompt(),
    throwsErrors:  [],
  },
]
```

After generating methods:
- Update ServiceNode in RF state and IDB (new methods + same config)
- Toast: `"${service.label} connected to ${entity.label} — 5 methods generated"`

**Implement in `src/utils/autoPopulate.ts`:**

```typescript
export function applyUsesEdge(
  service: ServiceNode,
  entity:  EntityNode,
): ServiceNode
```

Returns the updated ServiceNode. Caller writes to IDB and RF state.

### Reset on disconnect

When the USES edge is deleted (from inspector `×` OR double-click on edge):

**Reset the ServiceNode to factory defaults:**

```typescript
const reset: ServiceNode = {
  ...service,
  methods:       [],
  dependencyIds: [],
  config: {
    classLevelTransactional: true,
    classLevelAsync:         false,
    generateInterface:       true,
  },
  aiPrompt: emptyAIPrompt(),
}
```

- Update in RF state and IDB immediately (no debounce — reset is instant)
- Toast: `"${service.label} disconnected — reset to default"`

This means: the node goes back to looking like it was just created.
All methods, all customisations, everything — gone.

**Implement in `src/utils/autoPopulate.ts`:**

```typescript
export function resetServiceNode(service: ServiceNode): ServiceNode
```

### Edge deletion — two paths

**Path 1: Double-click the USES edge on canvas**
`onEdgeDoubleClick` in `useCanvas.ts` → call `handleDeleteUsesEdge(edgeId)`

**Path 2: Click `×` in ServiceInspector CONNECTIONS section**
`handleDisconnectEntity` in `useServiceInspector.ts` → calls the same `handleDeleteUsesEdge`

**`handleDeleteUsesEdge(edgeId: string)`** — implement in `useCanvas.ts`:

```
1. Find the edge in rfEdges to get serviceId and entityId
2. db.edges.delete(edgeId)
3. setEdges(edges => edges.filter(e => e.id !== edgeId))
4. const service = find ServiceNode in rfNodes by serviceId
5. const reset = resetServiceNode(service)
6. db.nodes.update(serviceId, { data: JSON.stringify(reset), updatedAt: now })
7. setNodes(nodes => nodes.map(n => n.id === serviceId ? { ...n, data: reset } : n))
8. Post BroadcastChannel sync
```

### Edge visual

```
src/components/edges/UsesEdge/
├── UsesEdge.tsx
├── useUsesEdge.ts
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
} as const
```

Visual:
- Stroke: `var(--node-svc-accent)` (green)
- StrokeWidth: 1.5px (selected: 2.5px)
- Arrow: `MarkerType.ArrowClosed` at EntityNode end, fill `var(--node-svc-accent)`
- Label: "USES", same style as other edge labels
- Hover `×` + double-click to delete

IDB edge row:
```
fromNodeId: ServiceNode.id
toNodeId:   EntityNode.id
type:       'USES'
label:      'USES'
```

Extend load map in `useCanvas.ts`:
```
'USES' → 'uses'
```

---

## 8. Canvas Node Component

### File structure

```
src/components/nodes/ServiceNode/
├── ServiceNode.tsx
├── useServiceNode.ts
├── types.ts
└── index.ts
```

### types.ts

```typescript
import type { NodeProps } from '@xyflow/react'
import type { ServiceNode } from '@entity'

export interface ServiceNodeProps extends NodeProps {
  data: ServiceNode
}
```

### useServiceNode.ts

```typescript
// Returns:
{
  node,            // ServiceNode
  isSelected,      // boolean
  handleClick,     // () => void
  connectedEntity, // { id: string; label: string } | null
  visibleMethods,  // ServiceMethod[] — first 4
  hiddenCount,     // number — total - 4, min 0
}
```

`connectedEntity`:
```typescript
const allEdges = useEdges()
const allNodes = useNodes()
const usesEdge = allEdges.find(e =>
  e.data?.type === EdgeType.USES && e.source === props.id
)
const entityNode = usesEdge
  ? allNodes.find(n => n.id === usesEdge.target)
  : null
const connectedEntity = entityNode
  ? { id: entityNode.id, label: (entityNode.data as EntityNode).label }
  : null
```

### ServiceNode.tsx

**Tailwind for all layout. Inline `style` only for dynamic CSS variable colours.**

**Root div:**
```
className="relative bg-surface rounded-[var(--radius-md)] shadow-node
           border transition-all duration-150 select-none"
style={{
  borderColor: isSelected ? 'var(--node-svc-accent)' : 'var(--color-canvas-node-border)',
  boxShadow:   isSelected ? '0 0 0 2px var(--node-svc-accent)22' : undefined,
}}
```

**NodeResizer:**
```tsx
<NodeResizer
  minWidth={200}
  minHeight={80}
  isVisible={isSelected}
  lineStyle={{ border: '1.5px solid var(--node-svc-accent)' }}
  handleStyle={{ background: 'var(--node-svc-accent)', border: 'none', width: 8, height: 8 }}
/>
```

**Header** — always shown:
`className="flex items-center gap-2 px-3 py-2"`
- Icon: 24×24, `background: var(--node-svc-icon-bg)`, `color: var(--node-svc-icon-fg)`, text "S", `text-[8px] font-mono font-bold rounded-[var(--radius-sm)]`
- Label: `className="text-[13px] font-bold text-text flex-1 truncate"`

**Entity row** — only when `connectedEntity !== null`:
`className="flex items-center gap-1.5 px-3 pb-1.5 border-b border-[var(--color-border)]"`
- Dot: `className="w-1.5 h-1.5 rounded-full flex-shrink-0"`, `style={{ background: 'var(--node-entity-accent)' }}`
- Label: `className="text-[10px] font-mono text-text-2 flex-1 truncate"`, text = `connectedEntity.label`
- Badge: `className="text-[8px] font-mono px-1 rounded-sm"`, `style={{ background: 'var(--node-entity-icon-bg)', color: 'var(--node-entity-icon-fg)' }}`, text "ENTITY"

**Methods section** — only when `node.methods.length > 0`:
`className="px-3 py-1.5 flex flex-col gap-[3px] border-t border-[var(--color-border)]"`

Each method row (first 4 only): `className="flex items-center gap-1.5 min-w-0"`:
- Name: `className="text-[10px] font-mono text-text-2 flex-1 truncate"`
- Return type: `className="text-[9px] font-mono text-text-4 flex-shrink-0"` — use `formatReturnType(method.returnType, connectedEntity?.label)`

If `hiddenCount > 0`:
`className="text-[9px] font-mono text-text-4 italic"`, text `+${hiddenCount} more`

**Config row** — only when entity is connected AND any config flag is true:
`className="flex items-center gap-1.5 px-3 py-1.5 border-t border-[var(--color-border)]"`
- `@Transactional` chip: shown when `config.classLevelTransactional`, `style={{ background: 'var(--color-success-light)', color: 'var(--node-svc-accent)' }}`
- `interface` chip: shown when `config.generateInterface`, `className="bg-surface-alt text-text-3"`

---

## 9. `src/utils/format.ts`

Create this file:

```typescript
import type { MethodReturnType } from '@entity'

/**
 * Formats a service method return type for display.
 * entityLabel must be resolved by the caller from rt.entityId via rfNodes.
 * Never references DTOs.
 */
export function formatReturnType(
  rt:           MethodReturnType,
  entityLabel?: string
): string {
  const typeName = entityLabel ?? rt.primitiveType ?? '?'
  if (rt.isVoid)        return 'void'
  if (rt.isList)        return `List<${typeName}>`
  if (rt.isPage)        return `Page<${typeName}>`
  if (rt.isOptional)    return `Optional<${typeName}>`
  if (rt.entityId)      return entityLabel ?? 'Entity'
  if (rt.primitiveType) return rt.primitiveType
  return '—'
}
```

Export from `src/utils/index.ts`.

---

## 10. Register in Canvas

```typescript
import { ServiceNode } from '@components/nodes/ServiceNode'

const NODE_TYPES = {
  microservice: MicroserviceNode,
  entity:       EntityNode,
  dto:          DTONode,
  db:           DBNode,
  table:        TableNode,
  service:      ServiceNode,
} as const
```

Extend IDB load type map: `'SERVICE' → 'service'`
Add `'service'` case to `onDrop`.
Extend `onConnect` to handle Service+Entity pairs.

---

## 11. Left Sidebar Updates

In `useLeftSidebar.ts`: add `'service'` to `handleAddNode` and `handleDragStart`.

In `LeftSidebar.tsx`:
- Set `ready: true` for Service palette item
- `disabled={!hasMicroservice}`, drag + click wired

Layers panel — ServiceNode item:
```
● Order Service          :8080
  ● Order                         ← entity
  ◈ OrderResponse                 ← dto
  ⬡ OrderService                  ← service
    └ findAll · findById · +3     ← method names, 8px mono muted, pl-6
```
- `pl-4`, glyph `⬡` in `var(--node-svc-accent)` (green)
- Label: `node.label`, 10px weight 500
- Below label (indented `pl-6`): method names joined by ` · `, max 3, then `+N` — 8px mono muted. Empty when no methods.
- Click: `canvasStore.setSelectedNode(id)`
- Selected: `bg-[var(--color-accent-light)] text-[var(--color-accent)]`

---

## 12. Inspector Panel — ServiceInspector

### File structure

```
src/pages/Editor/components/InspectorPanel/components/ServiceInspector/
├── ServiceInspector.tsx
├── useServiceInspector.ts
├── types.ts
└── index.ts
```

Wire into `InspectorPanel.tsx`:
```typescript
case NodeType.SERVICE: return <ServiceInspector nodeId={selectedNodeId} />
```

### Panel anatomy

```
┌──────────────────────────────────────────┐
│ [ServiceNode]  badge          sticky top │
│ OrderService                        [×]  │
│ connected to: Order                      │  ← subtitle (or "not connected" if none)
├──────────────────────────────────────────┤
│ IDENTITY                                 │  ← section 1
│ [label                               ]   │
├──────────────────────────────────────────┤
│ ENTITY CONNECTION                        │  ← section 2
│ ● Order     ENTITY             [×]       │  ← when connected
│ (or "Draw an edge to an Entity")         │  ← when not connected
├──────────────────────────────────────────┤
│ CONFIG                                   │  ← section 3 (only when connected)
│ Class-level @Transactional  [toggle]     │
│ Class-level async           [toggle]     │
│ Generate interface          [toggle]     │
├──────────────────────────────────────────┤
│ METHODS                                  │  ← section 4 (only when connected)
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ findAll         List<Order>   ▶    │  │  ← collapsed
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ ▼ create        Order              │  │  ← expanded
│  │ Return  [Order ▼]  List[tog]  Opt[tog] Void[tog]│
│  │ Params  order:Order [×]            │  │
│  │         [name] [Entity▼|Prim▼] [+]│  │
│  │ @Transactional [tog]  async [tog]  │  │
│  │ Errors  [exceptionClass] [+]       │  │
│  │   RuntimeException  [×]            │  │
│  │ AI  ● [desc]  gen[tog]             │  │
│  └────────────────────────────────────┘  │
│                                          │
│  [+ Add method]                          │
├──────────────────────────────────────────┤
│ AI PROMPT  ●                             │  ← section 5
├──────────────────────────────────────────┤
│ [       Delete service        ]          │  ← section 6
└──────────────────────────────────────────┘
```

Config and Methods sections are **hidden entirely** when no entity is connected.
Rationale: without an entity, methods have no context to reference.

### useServiceInspector.ts

Same optimistic update pattern: instant RF `setNodes` → debounced 300ms IDB write.

**Read connection state:**
```typescript
const allEdges = useEdges()
const allNodes = useNodes()
const usesEdge = allEdges.find(e =>
  e.data?.type === EdgeType.USES && e.source === nodeId
)
const connectedEntityNode = usesEdge
  ? allNodes.find(n => n.id === usesEdge.target)
  : null
const connectedEntity = connectedEntityNode
  ? { edgeId: usesEdge.id, id: connectedEntityNode.id, label: (connectedEntityNode.data as EntityNode).label }
  : null
```

**Identity:**
- `handleLabelChange(value: string)` — live canvas: header label

**Connection:**
- `handleDisconnectEntity()` — calls `handleDeleteUsesEdge(connectedEntity.edgeId)` which lives in `useCanvas.ts`

  This triggers the reset flow: edge deleted → `resetServiceNode` called → ServiceNode written back to IDB and RF state.

  The inspector will immediately show the "Draw an edge to an Entity" state because `connectedEntity` will be null after the reset.

**Config toggles** (only callable when `connectedEntity !== null`):
- `handleTransactionalToggle()` — flips `config.classLevelTransactional`, live canvas: @Transactional chip
- `handleAsyncToggle()` — flips `config.classLevelAsync`
- `handleGenerateInterfaceToggle()` — flips `config.generateInterface`, live canvas: interface chip

**Methods** (only meaningful when `connectedEntity !== null`):
- `expandedMethodId: string | null` + `setExpandedMethodId`
- `handleAddMethod()` — append new `ServiceMethod`: `name: 'newMethod'`, empty returnType, no params, no errors
- `handleRemoveMethod(methodId: string)`
- `handleMethodNameChange(methodId: string, value: string)`

Return type (per method) — entity or primitive only, never DTO:
- `handleReturnEntityChange(methodId: string, entityId: string | null)` — clears primitiveType when set
- `handleReturnPrimitiveChange(methodId: string, type: JavaType | null)` — clears entityId when set
- `handleReturnIsListToggle(methodId: string)` — enabling disables isPage, isOptional, isVoid
- `handleReturnIsPageToggle(methodId: string)` — enabling disables isList, isOptional, isVoid
- `handleReturnIsOptionalToggle(methodId: string)` — enabling disables isList, isPage, isVoid
- `handleReturnIsVoidToggle(methodId: string)` — enabling clears entityId, primitiveType, all other flags

Params (entity or primitive only, never DTO):
- `handleAddParam(methodId: string, name: string, primitiveType: JavaType | null, entityId: string | null)`
- `handleRemoveParam(methodId: string, paramIdx: number)`
- `handleParamIsPageableToggle(methodId: string, paramIdx: number)`

Method flags:
- `handleMethodTransactionalToggle(methodId: string)`
- `handleMethodAsyncToggle(methodId: string)`

Errors (per method):
- `handleAddError(methodId: string, exceptionClass: string)`
- `handleRemoveError(methodId: string, errorIdx: number)`
- `handleErrorDescriptionChange(methodId: string, errorIdx: number, value: string)`
- `handleErrorCreateExceptionToggle(methodId: string, errorIdx: number)`

Per-method AI prompt:
- `handleMethodAIPromptChange(methodId: string, field: keyof AIPrompt, value: string)` — 500ms debounce
- `handleMethodAIGenerateToggle(methodId: string)`

Node-level AI prompt:
- `handleAIPromptChange(field: keyof AIPrompt, value: string)` — 500ms debounce
- `handleAIGenerateToggle()`

Lifecycle:
- `handleClose()` — `canvasStore.clearSelection()`
- `handleDelete()` — confirm → delete node, delete USES edge if any (no reset needed — node is gone), IDB, RF state, clearSelection

### Section 1 — Identity

| Field | Control | Live canvas |
|---|---|---|
| `label` | text input | Header label |

### Section 2 — Entity Connection

When connected:
- Green dot + entity label + "ENTITY" badge + `×` button
- `×` calls `handleDisconnectEntity()` → triggers edge delete + service reset

When not connected:
- Muted text: "Draw an edge to an Entity node on the canvas"
- `className="text-[10px] font-mono text-text-4 italic"`

### Section 3 — Config (hidden when not connected)

| Field | Control | Default | Live canvas |
|---|---|---|---|
| Class-level @Transactional | toggle | on | @Transactional chip |
| Class-level async | toggle | off | — |
| Generate interface | toggle | on | interface chip |

### Section 4 — Methods (hidden when not connected)

Each method is a collapsible card. Same collapse/expand pattern as TableNode custom queries.

**Collapsed**: method name + formatted return type + `▶` caret
**Expanded**: full field set

Return type row:
- Entity select: dropdown of all EntityNodes in the project
- Primitive select: dropdown of JavaType values
- Mutually exclusive — setting one clears the other
- No DTO option exists anywhere

Shape toggles: List / Page / Optional / Void — mutually exclusive.

Params:
- Each row: name + (entity select OR primitive select, mutually exclusive) + isPageable toggle + `×`
- Add row at bottom

Method flags: @Transactional toggle + async toggle

Errors: exceptionClass input + description input + createException toggle + `×` per error. Add row.

Per-method AI prompt: compact version — description 2 rows + aiGenerate toggle.

**"+ Add method"** at the bottom of the list.

### Section 5 — AI Prompt

Description textarea 4 rows + businessRules 2 rows + aiGenerate toggle.
Standard AI box using `--ai-box-*` tokens.

### Section 6 — Delete

Button: "Delete service"
`className="bg-[var(--color-danger-light)] text-[var(--color-danger)] border border-[var(--color-danger-border)] rounded-[var(--radius-sm)] w-full py-2 text-[11px] font-semibold"`

On confirm:
1. `db.nodes.delete(nodeId)`
2. Delete USES edge if present: `db.edges.where('fromNodeId').equals(nodeId).delete()`
3. `setNodes(nodes => nodes.filter(n => n.id !== nodeId))`
4. `setEdges(edges => edges.filter(e => e.source !== nodeId))`
5. `canvasStore.clearSelection()`

No reset needed — the node is deleted entirely.

---

## 13. EntityInspector — CONNECTIONS update

EntityInspector currently shows DTOs and Tables connected to the entity.
Add a third connection type: connected ServiceNodes via USES edges.

From the entity's perspective, USES edges have `toNodeId = entityId`.
Connected services: `rfEdges.filter(e => e.data?.type === 'USES' && e.target === nodeId)`

Row:
- Left arrow `←` in `var(--node-svc-accent)` — "this service uses this entity"
- Service label + "SERVICE" badge in service icon colours
- `×` — removes the edge AND resets the ServiceNode to default

---

## 14. IDB Persistence

### Write on create

```typescript
await db.nodes.add({
  id:        node.id,
  projectId: currentProjectId,
  type:      'SERVICE',
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

Always replace `data` column entirely — never patch JSON in place.
This is especially important for `methods[]` which is deeply nested.

### Write on edge connect (auto-population)

After auto-generating methods:
```
db.edges.add({ ... USES edge row ... })
db.nodes.update(serviceId, { data: JSON.stringify(updatedServiceWithMethods), updatedAt: now })
```

Both writes happen immediately — no debounce on edge creation.

### Write on edge disconnect (reset)

```
db.edges.delete(edgeId)
db.nodes.update(serviceId, { data: JSON.stringify(resetService), updatedAt: now })
```

Both writes happen immediately — reset is not debounced.

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

## 15. Styling Rules

1. Tailwind classes for all layout, spacing, typography.
2. Inline `style` only for dynamic JS values or CSS variable colour tokens.
3. Never hardcode hex.
4. `font-mono` for method names, param names, exception classes, return types.
5. No `!important`.
6. Service accent: `var(--node-svc-accent)`, icon bg: `var(--node-svc-icon-bg)`, fg: `var(--node-svc-icon-fg)`.
7. No DTO reference anywhere in this node's code. If you write dtoId, it is a bug.

---

## 16. What This Step Does NOT Build

- No ServiceNode → ServiceNode `DEPENDS_ON` edge
- No Controller → ServiceNode `INVOKES` edge
- No code generation

---

## 17. Verification

### TypeScript
```bash
npx tsc --noEmit
```
Zero errors.

### Node basics

- [ ] Service palette item dimmed when no MS exists
- [ ] Click Service with MS selected → ServiceNode appears, compact, header only
- [ ] Drag from sidebar → drop inside MS → node at drop position
- [ ] Canvas card shows header only when no entity connected
- [ ] No entity row, no methods, no config chips when not connected

### USES edge

- [ ] Draw edge Service → Entity → edge appears (green, "USES" label)
- [ ] Draw edge Entity → Service → same result (normalised)
- [ ] Arrow points toward Entity
- [ ] 5 CRUD methods auto-generated on connect
- [ ] Canvas card now shows: entity row + methods + config chips
- [ ] Method names correct: findAll, findById, create, update, delete
- [ ] Return types use entity label: `List<Order>`, `Optional<Order>`, `Order`, `void`
- [ ] create and update params use entity label: `order: Order`
- [ ] Try connecting a second Entity to same Service → rejected silently
- [ ] Multiple Services can connect to same Entity (both get their own methods)

### Disconnect and reset

- [ ] Double-click USES edge → edge removed → ServiceNode resets to empty state
- [ ] After reset: no entity row, no methods, no config chips on canvas card
- [ ] After reset: inspector shows "Draw an edge to an Entity node"
- [ ] After reset: Config and Methods sections hidden in inspector
- [ ] Click `×` in inspector Entity Connection row → same reset result
- [ ] Click `←` `×` in EntityInspector CONNECTIONS → same reset result
- [ ] After reset: can reconnect to same or different Entity → new methods generated
- [ ] Toast shown on connect: "OrderService connected to Order — 5 methods generated"
- [ ] Toast shown on disconnect: "OrderService disconnected — reset to default"

### Inspector

- [ ] Select Service → ServiceInspector opens
- [ ] Change label → canvas header updates immediately
- [ ] Config and Methods sections hidden when not connected
- [ ] Config and Methods sections visible when connected
- [ ] Toggle @Transactional off → chip disappears from canvas card
- [ ] Add method → collapsed card appears
- [ ] Expand method → all fields visible
- [ ] Return type: select Entity → entity label shown
- [ ] Return type: select Primitive → primitive type shown
- [ ] Return type: no DTO option in any dropdown
- [ ] Toggle isList + isPage: mutually exclusive
- [ ] Toggle isVoid: clears entityId and primitiveType
- [ ] Add param: entity OR primitive, never DTO
- [ ] Add error → exceptionClass row appears
- [ ] Delete method → disappears
- [ ] Delete service → confirm → removed from canvas and IDB, USES edge removed

### IDB persistence

- [ ] Refresh → ServiceNode reappears with label and position
- [ ] If connected: entity row and methods visible after refresh
- [ ] All 5 methods persist after refresh
- [ ] Manually added method persists
- [ ] Method changes (name, return type, params) persist
- [ ] Config toggle changes persist
- [ ] Disconnect entity → refresh → node still in reset state (no methods, no entity row)
- [ ] USES edge persists → entity still shown after refresh
- [ ] Move node → refresh → position persists
- [ ] Delete node → refresh → node does not reappear
- [ ] Two tabs: connect entity in Tab 1 → Tab 2 updates within ~1 second
- [ ] Two tabs: disconnect entity in Tab 1 → Tab 2 resets within ~1 second
