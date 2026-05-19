# TableNode — Design & Build Specification

> Claude Code: the DB_NODE_MIGRATION.md step must be complete before this step.
> Read this file in full before writing a single line.
> Follow every rule in CLAUDE.md alongside this document.
> A MicroserviceNode must exist before a TableNode can be added.
> No edges in the "add node" flow — edges are drawn manually after placement.
> Data must persist in IDB.

---

## 1. What Is the TableNode

The `TableNode` represents **one database table** inside a microservice.

It connects to:
- **One EntityNode** via a `STORED_IN` edge — "this table stores this entity's data"
- **One DBNode** via a `CONNECTS_TO` edge — "this table lives in this database"

It holds all **custom Spring Data JPA repository queries** for that table.
Standard CRUD is auto-generated; only non-standard queries are defined here.

A TableNode can exist on the canvas without either edge connected yet.
The user draws the edges after placing the node.

---

## 2. Visual Anatomy

```
┌──────────────────────────────────┐  ← border: var(--node-db-accent) when selected
│                                  │
│  [T]  orders                     │  ← HEADER: icon · tableName
│                                  │
├──────────────────────────────────┤
│  ● Order      ENTITY             │  ← ENTITY ROW (when entityId set)
│  ▪ order_db   DATABASE           │  ← DB ROW (when dbNodeId set)
├──────────────────────────────────┤
│  3 queries                       │  ← QUERY COUNT (when queries exist)
└──────────────────────────────────┘
```

States of the connection rows:

| State | Entity row | DB row |
|---|---|---|
| Neither connected | "No entity linked" (muted) | "No database linked" (muted) |
| Entity only | Entity label + ENTITY badge | "No database linked" |
| DB only | "No entity linked" | DB label + DATABASE badge |
| Both connected | Entity label + badge | DB label + badge |

Minimum size: **w 200, h 120**. No maximum.

---

## 3. Data Model

Defined in `src/entity/TableNode.ts` (created in migration step).
Import all types from `@entity`. Do not redefine.

```
TableNode
  tableName:     string
  entityId:      string | null   — set by STORED_IN edge
  dbNodeId:      string | null   — set by CONNECTS_TO edge
  customQueries: CustomQuery[]

CustomQuery
  id:             string          required
  methodName:     string          required
  description:    string          required
  targetEntityId: string | null   optional
  type:           QueryType | null optional  (DERIVED | JPQL | NATIVE_SQL | AI)
  queryString:    string | null   optional
  aiPrompt:       AIPrompt | null optional
  params:         DbQueryParam[]
  returnType:     QueryReturnType | null optional
  nativeQuery:    boolean
  modifying:      boolean
  cache:          CacheConfig | null optional
```

---

## 4. Default Values

Add `createTableNode()` to `src/utils/node.ts` if it does not already exist:

```
id:            generateId()
type:          NodeType.TABLE
label:         'Table'
tableName:     'table_name'
entityId:      null
dbNodeId:      null
position:      { x: 0, y: 0 }
size:          { w: 220, h: 160 }
aiPrompt:      emptyAIPrompt()
customQueries: []
```

Export from `src/utils/index.ts`.

---

## 5. How TableNodes Are Added

Same guard and two-way pattern as all other child nodes.

### Guard

TableNode palette item enabled only when at least one MicroserviceNode exists.
When disabled: `opacity-40 cursor-not-allowed pointer-events-none`, title "Add a microservice first".

### Way 1 — Drag from left sidebar

- `onDragStart`: `e.dataTransfer.setData('nodeType', 'table')`
- Canvas `onDrop`: add `'table'` case → `createTableNode({ position })` → IDB → RF state

### Way 2 — Click palette item

- Target MS: selected MS first, else last MS in rfNodes
- Stagger: `{ x: 20 + (count % 4) * 230, y: 60 + Math.floor(count / 4) * 180 }`
  where `count` = existing TableNodes in the project

---

## 6. Canvas Node Component

### File structure

```
src/components/nodes/TableNode/
├── TableNode.tsx
├── useTableNode.ts
├── types.ts
└── index.ts
```

### types.ts

```typescript
import type { NodeProps } from '@xyflow/react'
import type { TableNode } from '@entity'

export interface TableNodeProps extends NodeProps {
  data: TableNode
}
```

### useTableNode.ts

```typescript
// Returns:
{
  node,          // TableNode — from props.data
  isSelected,    // boolean — canvasStore.selectedNodeId === props.id
  handleClick,   // () => void — canvasStore.setSelectedNode(id)
  entityLabel,   // string | null — label of connected entity (from RF nodes)
  dbLabel,       // string | null — label of connected DBNode (from RF nodes)
  queryCount,    // number
}
```

`entityLabel` and `dbLabel`: use `useNodes()` from `@xyflow/react` to read all RF nodes.
Find the node whose `id === node.entityId` and `id === node.dbNodeId` respectively.
Return their `data.label` if found, else `null`.

`queryCount`: `node.customQueries.length`

Read-only display hook. No IDB calls.

### TableNode.tsx

**Tailwind for all layout and static styles. Inline `style` only for dynamic values.**

**Root div:**
```
className="relative bg-surface rounded-[var(--radius-md)] shadow-node
           border transition-all duration-150 select-none"
style={{
  borderColor: isSelected ? 'var(--node-db-accent)' : 'var(--color-canvas-node-border)',
  boxShadow:   isSelected ? '0 0 0 2px var(--node-db-accent)22' : undefined,
}}
```

**NodeResizer:**
```tsx
<NodeResizer
  minWidth={200}
  minHeight={120}
  isVisible={isSelected}
  lineStyle={{ border: '1.5px solid var(--node-db-accent)' }}
  handleStyle={{ background: 'var(--node-db-accent)', border: 'none', width: 8, height: 8 }}
/>
```

**Header** — `className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)]"`:
- Icon: 24×24, `background: var(--node-db-icon-bg)`, `color: var(--node-db-icon-fg)`, text "T", `font-mono text-[8px] font-bold rounded-[var(--radius-sm)]`
- tableName: `className="text-[13px] font-bold text-text font-mono flex-1 truncate"`

**Connection rows** — `className="px-3 py-1.5 flex flex-col gap-1 border-b border-[var(--color-border)]"`:

Entity row:
```tsx
{entityLabel ? (
  <div className="flex items-center gap-1.5">
    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: 'var(--node-entity-accent)' }} />
    <span className="text-[10px] font-mono text-text-2 flex-1 truncate">{entityLabel}</span>
    <span className="text-[8px] font-mono px-1 rounded-sm"
          style={{ background: 'var(--node-entity-icon-bg)', color: 'var(--node-entity-icon-fg)' }}>
      ENTITY
    </span>
  </div>
) : (
  <div className="text-[9px] font-mono text-text-4 italic">No entity linked</div>
)}
```

DB row (same pattern, using `var(--node-db-*)` tokens and "DATABASE" badge).

**Query count row** (only when `queryCount > 0`):
`className="px-3 py-1.5 text-[9px] font-mono text-text-4"`
Text: `${queryCount} quer${queryCount === 1 ? 'y' : 'ies'}`

---

## 7. Register in Canvas

In `Canvas.tsx`:

```typescript
import { TableNode } from '@components/nodes/TableNode'

const NODE_TYPES = {
  microservice: MicroserviceNode,
  entity:       EntityNode,
  dto:          DTONode,
  db:           DBNode,
  table:        TableNode,   // replaces the TABLE_FALLBACK from migration step
} as const
```

Extend IDB load type map in `useCanvas.ts`:
```
'TABLE' → 'table'
```

Add `'table'` case to `onDrop`.

---

## 8. Two Edge Types

### Edge 1 — STORED_IN (Entity → TableNode)

**Rules:**
- One EntityNode can connect to **one** TableNode via STORED_IN
- One TableNode can connect to **one** EntityNode via STORED_IN
- Drawing from either end is valid — normalise to `fromNodeId = EntityNode.id`, `toNodeId = TableNode.id`
- Only one edge between any Entity–Table pair

**Guard in `onConnect`:**
```
1. entityAlreadyHasTable = rfEdges.some(e => e.data?.type === 'STORED_IN' && e.source === entityId)
2. tableAlreadyHasEntity = rfEdges.some(e => e.data?.type === 'STORED_IN' && e.target === tableId)
3. If either is true → reject silently
```

**Auto-population on connect:**
```
table.entityId  = entity.id
table.tableName = entity.tableName   (if tableName is still default 'table_name')
```
Update TableNode in IDB and RF state.

**Edge visual:**
```
src/components/edges/StoredInEdge/
├── StoredInEdge.tsx
├── useStoredInEdge.ts
├── types.ts
└── index.ts
```

- Stroke: `var(--node-entity-accent)` (blue)
- Arrow: `MarkerType.ArrowClosed` at TableNode end, fill `var(--node-entity-accent)`
- Label: "STORED IN", same style as DerivedFromEdge
- Hover `×` + double-click to delete

**On delete:**
```
1. db.edges.delete(edgeId)
2. setEdges(edges => edges.filter(e => e.id !== edgeId))
3. Update TableNode: table.entityId = null  (IDB + RF state)
```

### Edge 2 — CONNECTS_TO (TableNode → DBNode)

**Rules:**
- One TableNode connects to **one** DBNode via CONNECTS_TO
- One DBNode can receive **many** CONNECTS_TO edges (many tables, one database)
- Drawing from either end — normalise to `fromNodeId = TableNode.id`, `toNodeId = DBNode.id`
- Only one edge between any Table–DB pair

**Guard in `onConnect`:**
```
1. tableAlreadyHasDB = rfEdges.some(e => e.data?.type === 'CONNECTS_TO' && e.source === tableId)
2. pairAlreadyExists = rfEdges.some(e =>
     e.data?.type === 'CONNECTS_TO' &&
     e.source === tableId && e.target === dbId)
3. If either is true → reject silently
```

**Auto-population on connect:**
```
table.dbNodeId = db.id
```
Update TableNode in IDB and RF state.

**Edge visual:**
```
src/components/edges/ConnectsToEdge/
├── ConnectsToEdge.tsx
├── useConnectsToEdge.ts
├── types.ts
└── index.ts
```

- Stroke: `var(--node-db-accent)` (purple)
- Arrow: `MarkerType.ArrowClosed` at DBNode end, fill `var(--node-db-accent)`
- Label: "CONNECTS TO"
- Hover `×` + double-click to delete

**On delete:**
```
1. db.edges.delete(edgeId)
2. setEdges(edges => edges.filter(e => e.id !== edgeId))
3. Update TableNode: table.dbNodeId = null  (IDB + RF state)
```

### Registering both edge types in Canvas

```typescript
import { DerivedFromEdge } from '@components/edges/DerivedFromEdge'
import { StoredInEdge }    from '@components/edges/StoredInEdge'
import { ConnectsToEdge }  from '@components/edges/ConnectsToEdge'

const EDGE_TYPES = {
  derivedFrom: DerivedFromEdge,
  storedIn:    StoredInEdge,
  connectsTo:  ConnectsToEdge,
} as const
```

Extend the IDB edge load map:
```
'DERIVED_FROM' → 'derivedFrom'
'STORED_IN'    → 'storedIn'
'CONNECTS_TO'  → 'connectsTo'
```

### onConnect — full handler logic

```
1. Get source and target RF nodes
2. Determine node types of both ends
3. Route to the correct handler:

   Entity + TableNode  → STORED_IN (normalise direction)
   TableNode + DBNode  → CONNECTS_TO (normalise direction)
   DTO + Entity        → DERIVED_FROM (existing)
   Anything else       → ignore
```

---

## 9. Inspector Panel — TableInspector

### File structure

```
src/pages/Editor/components/InspectorPanel/components/TableInspector/
├── TableInspector.tsx
├── useTableInspector.ts
├── types.ts
└── index.ts
```

Wire into `InspectorPanel.tsx`:
```typescript
case NodeType.TABLE: return <TableInspector nodeId={selectedNodeId} />
```

### Panel anatomy

```
┌──────────────────────────────────────────┐
│ [TableNode]  badge            sticky top │
│ orders                              [×]  │
│ No entity · No database                  │  ← subtitle changes as edges connect
├──────────────────────────────────────────┤
│ IDENTITY                                 │  ← section 1
│ [label                               ]   │
│ [tableName                           ]   │
├──────────────────────────────────────────┤
│ CONNECTIONS                              │  ← section 2
│ ● Order      ENTITY              [×]     │  ← STORED_IN — green dot, entity accent
│ ▪ order_db   DATABASE            [×]     │  ← CONNECTS_TO — purple dot, db accent
│                                          │
│ (or "No entity linked" / "No DB linked") │
├──────────────────────────────────────────┤
│ CUSTOM QUERIES                           │  ← section 3
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ findByStatus          DERIVED  ▶   │  │  ← collapsed query card
│  │ Find orders by status              │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ findActiveOrders       JPQL   ▼    │  │  ← expanded query card
│  │ Find all active orders for a user  │  │
│  │ Entity   [Order ▼]                 │  │
│  │ Query    [select o from Order o…]  │  │
│  │ Params   name:STRING [+]    [×]    │  │
│  │ Returns  List [tog]  Page[tog]     │  │
│  │ Native   [tog]  Modifying [tog]    │  │
│  │ Cache    [Enable cache ▼]          │  │
│  └────────────────────────────────────┘  │
│                                          │
│  [+ Add query]                           │
├──────────────────────────────────────────┤
│ AI PROMPT  ●                             │  ← section 4
├──────────────────────────────────────────┤
│ [        Delete table         ]          │  ← section 5
└──────────────────────────────────────────┘
```

### useTableInspector.ts

Same optimistic update pattern: instant RF `setNodes` → debounced 300ms IDB write.

**Identity handlers:**
- `handleLabelChange(value: string)`
- `handleTableNameChange(value: string)` — auto-converts to snake_case on every keystroke. Live canvas: header tableName

Auto-format for tableName: `value.toLowerCase().replace(/([A-Z])/g, '_$1').replace(/\s+/g, '_').replace(/^_/, '')`

**Connections (read-only, edge deletion only):**
```typescript
const allEdges = useEdges()
const storedInEdge    = allEdges.find(e => e.data?.type === 'STORED_IN' && e.target === nodeId)
const connectsToEdge  = allEdges.find(e => e.data?.type === 'CONNECTS_TO' && e.source === nodeId)
const allNodes        = useNodes()
const connectedEntity = allNodes.find(n => n.id === storedInEdge?.source)
const connectedDB     = allNodes.find(n => n.id === connectsToEdge?.target)
```

- `handleDisconnectEntity(edgeId: string)` — delete edge, set `table.entityId = null`, update IDB + RF
- `handleDisconnectDB(edgeId: string)` — delete edge, set `table.dbNodeId = null`, update IDB + RF

**Custom query handlers** (identical to the old DBInspector):
- `expandedQueryId: string | null` + `setExpandedQueryId`
- `handleAddQuery()` — new `CustomQuery` with `generateId()`, `methodName: 'newQuery'`, `description: ''`, all optionals null, `params: []`, `nativeQuery: false`, `modifying: false`
- `handleRemoveQuery(queryId: string)`
- `handleQueryMethodNameChange(queryId: string, value: string)`
- `handleQueryDescriptionChange(queryId: string, value: string)` — 500ms debounce
- `handleQueryTypeChange(queryId: string, value: QueryType | null)`
- `handleQueryStringChange(queryId: string, value: string)` — 500ms debounce
- `handleQueryTargetEntityChange(queryId: string, entityId: string | null)`
- `handleQueryNativeToggle(queryId: string)`
- `handleQueryModifyingToggle(queryId: string)`
- `handleAddQueryParam(queryId: string, name: string, type: JavaType)`
- `handleRemoveQueryParam(queryId: string, paramIdx: number)`
- `handleQueryReturnTypeChange(queryId: string, partial: Partial<QueryReturnType>)`
- `handleQueryCacheToggle(queryId: string)` — if null initialise with defaults, else toggle `enabled`
- `handleQueryCacheFieldChange(queryId: string, field: keyof CacheConfig, value: unknown)`

**AI Prompt:**
- `handleAIPromptChange(field: keyof AIPrompt, value: string)` — 500ms debounce
- `handleAIGenerateToggle()`

**Lifecycle:**
- `handleClose()` — `canvasStore.clearSelection()`
- `handleDelete()` — confirm → delete node, delete all edges involving this node, RF state, IDB, clearSelection

### Section 1 — Identity

| Field | Control | Live canvas |
|---|---|---|
| `label` | text input | — |
| `tableName` | text input (auto snake_case) | Header tableName |

### Section 2 — Connections

Two rows showing current edge state.

**Entity row** (STORED_IN edge):
- If connected: `●` dot in `var(--node-entity-accent)` + entity label + "ENTITY" badge + `×`
- If not: `"No entity linked"` in `text-text-4`
- The `×` calls `handleDisconnectEntity(edgeId)`

**DB row** (CONNECTS_TO edge):
- If connected: `▪` square in `var(--node-db-accent)` + DB label + "DATABASE" badge + `×`
- If not: `"No database linked"` in `text-text-4`
- The `×` calls `handleDisconnectDB(edgeId)`

This section is **read-only** — connections are made by drawing edges on the canvas, not from the inspector.

### Section 3 — Custom Queries

Each query is a collapsible card. Identical behaviour to what was designed in the old DBNode spec.

**Collapsed card** (`className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-2 cursor-pointer hover:border-[var(--color-border-strong)] transition-colors"`):
- Row 1: method name (`text-[11px] font-mono font-bold text-text`) + type badge + `▶` caret
- Row 2: description (`text-[10px] text-text-3 truncate`)
- Click anywhere on card → expand

**Expanded card** (same wrapper, `▼` caret):

Fields in expanded state:

| Field | Control | Condition |
|---|---|---|
| Method name | text input, mono | always |
| Description | textarea 2 rows | always |
| Query type | select: DERIVED, JPQL, NATIVE_SQL, AI, "—" for null | always |
| Target entity | select from rfNodes of type ENTITY | when type is set |
| Query string | textarea 3 rows, mono | when type = JPQL or NATIVE_SQL |
| Native query | toggle | when type = JPQL or NATIVE_SQL |
| Modifying | toggle | when type = JPQL or NATIVE_SQL |

**Params sub-section** (when type is not DERIVED):
Each param row: name input + type select (JavaType) + isCollection toggle + `×`
Add param: `[name input] [type select] [+]`

**Return type sub-section:**
- isList toggle
- isPage toggle — mutually exclusive with isList
- isOptional toggle — only when neither list nor page
- projectionClass text input (optional)

**Cache sub-section:**
"Enable cache" toggle — when toggled on, initialises `cache` with defaults and shows:
- cacheName text input
- ttlSeconds number input
- operation select: CACHEABLE, CACHE_EVICT, CACHE_PUT

**Per-query AI Prompt** (only when type = AI):
Compact AI box using `--ai-box-*` tokens: description textarea 3 rows + aiGenerate toggle.

**Query type badge colours:**

| Type | background | text |
|---|---|---|
| DERIVED | `--color-success-light` | `--color-success` |
| JPQL | `--color-accent-light` | `--color-accent` |
| NATIVE_SQL | `--color-warning-light` | `--color-warning` |
| AI | `--ai-box-border` | `--ai-dot-color` |
| null | `bg-surface-alt` | `text-text-4`, text "—" |

**"+ Add query" button:**
`className="w-full py-1.5 text-[11px] font-semibold border border-dashed border-[var(--color-border-strong)] rounded-[var(--radius-sm)] text-text-3 hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"`

### Section 4 — AI Prompt

Compact AI box: description textarea 3 rows + aiGenerate toggle.
Uses `--ai-box-*` tokens from the theme.

### Section 5 — Delete

Button: "Delete table"
`className="bg-[var(--color-danger-light)] text-[var(--color-danger)] border border-[var(--color-danger-border)] rounded-[var(--radius-sm)] w-full py-2 text-[11px] font-semibold"`

On confirm:
1. `db.nodes.delete(nodeId)`
2. Delete all edges where `source === nodeId` or `target === nodeId`
3. `setNodes(nodes => nodes.filter(n => n.id !== nodeId))`
4. `setEdges(edges => edges.filter(e => e.source !== nodeId && e.target !== nodeId))`
5. `canvasStore.clearSelection()`

---

## 10. EntityInspector — CONNECTIONS update

EntityInspector shows connected DTOs and DB nodes.
Add a third connection type: connected TableNodes via STORED_IN.

```
CONNECTIONS
→  OrderRequest    DTO       [×]
→  OrderResponse   DTO       [×]
→  orders          TABLE     [×]   ← new
```

Table connection row:
- Arrow `→` in `var(--node-db-accent)` colour
- TableNode label + "TABLE" badge
- `×` removes the STORED_IN edge

---

## 11. Left Sidebar Updates

In `useLeftSidebar.ts`:
- Add `'table'` case to `handleAddNode` — same guard and target-MS logic
- Support `handleDragStart(e, 'table')`

In `LeftSidebar.tsx`:
- Set `ready: true` for the Table palette item
- `disabled={!hasMicroservice}`, drag + click wired

**Palette item appearance:**
- Icon bg: `var(--node-db-icon-bg)`, fg: `var(--node-db-icon-fg)`, abbr: "T"
- Label: "Table"

Layers panel — TableNode item:
```
● Order Service          :8080
  ● Order                        ← entity
  ◈ OrderResponse                ← dto
  T orders                       ← table (T prefix glyph)
```

- `pl-4`, glyph "T" or small square in `var(--node-db-accent)`
- Label: `node.tableName`
- If entity connected: entity label right-aligned in 8px mono muted
- Click: `canvasStore.setSelectedNode(id)`
- Selected: `bg-[var(--color-accent-light)] text-[var(--color-accent)]`

---

## 12. IDB Persistence

### Schema

Nodes table — same `nodes` table, `type` column stores `'TABLE'`.
`data` column is `JSON.stringify` of the full `TableNode`.

### Load on canvas mount

`useCanvas.ts` — extend type map (done in migration step, confirm it's there):
```
'TABLE' → 'table'
```

Edge load map (done in migration step, confirm it's there):
```
'STORED_IN'   → 'storedIn'
'CONNECTS_TO' → 'connectsTo'
```

### Write on create

```typescript
await db.nodes.add({
  id:        node.id,
  projectId: currentProjectId,
  type:      'TABLE',
  label:     node.label,
  position:  node.position,
  size:      node.size,
  data:      JSON.stringify(node),
  createdAt: Date.now(),
  updatedAt: Date.now(),
})
```

RF state updated immediately — do not await IDB before showing the node.

### Write on update

1. Instant RF `setNodes`
2. Debounced 300ms:
```typescript
db.nodes.update(nodeId, {
  label:     updatedNode.label,
  position:  updatedNode.position,
  size:      updatedNode.size,
  data:      JSON.stringify(updatedNode),
  updatedAt: Date.now(),
})
```

Always replace `data` column entirely. Never patch JSON in place.
This includes when `entityId` or `dbNodeId` change (from edge connect/disconnect).

### Write on drag/resize

`onNodesChange` → `position` (drag end, `dragging === false`) and `dimensions` → debounce 100ms → `db.nodes.update`

### Write on delete

1. `db.nodes.delete(nodeId)` — IDB first
2. `db.edges.where('fromNodeId').equals(nodeId).delete()`
3. `db.edges.where('toNodeId').equals(nodeId).delete()`
4. RF state updates
5. `canvasStore.clearSelection()`

### Edge IDB writes

**STORED_IN on create:**
```typescript
await db.edges.add({
  id:         generateId(),
  projectId:  currentProjectId,
  fromNodeId: entityId,
  toNodeId:   tableId,
  type:       'STORED_IN',
  label:      'STORED_IN',
})
```

**CONNECTS_TO on create:**
```typescript
await db.edges.add({
  id:         generateId(),
  projectId:  currentProjectId,
  fromNodeId: tableId,
  toNodeId:   dbId,
  type:       'CONNECTS_TO',
  label:      'CONNECTS_TO',
})
```

**On delete:** `db.edges.delete(edgeId)` — same for both types.

### Cross-tab sync

After every IDB write (node or edge):
```typescript
const bc = new BroadcastChannel('archflow-sync')
bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId })
bc.close()
```

---

## 13. Styling Rules

1. Tailwind classes for all layout, spacing, typography.
2. Inline `style` only for dynamic JS values or CSS variable colour tokens used in arbitrary positions.
3. Never hardcode hex.
4. `font-mono` for all technical strings: tableName, method names, query strings, param names.
5. No `!important`.
6. Node accent colour for TableNode: `var(--node-db-accent)` (same as DBNode — they are the same infrastructure layer).

---

## 14. What This Step Does NOT Build

- No auto-generation of standard CRUD methods (that comes with ServiceNode)
- No code export of JPA repository files
- No validation of query syntax
- No context menu on TableNode
- No drag-to-reorder custom queries

---

## 15. Verification

### TypeScript
```bash
npx tsc --noEmit
```
Zero errors.

### Node basics

- [ ] Table palette item dimmed when no MS exists, active when MS exists
- [ ] Click Table with MS selected → TableNode appears in that MS
- [ ] Drag Table from sidebar → drop inside MS → node at drop position
- [ ] Drop outside MS → nothing happens
- [ ] Canvas card shows: icon "T", tableName, "No entity linked", "No database linked"
- [ ] Query count row hidden until queries are added

### STORED_IN edge (Entity → Table)

- [ ] Draw edge from EntityNode to TableNode → edge appears (blue, "STORED IN" label)
- [ ] Draw from TableNode to EntityNode → same result
- [ ] Arrow points toward TableNode
- [ ] TableNode `entityId` is set after connecting
- [ ] TableNode `tableName` auto-updates to entity's `tableName` if still default
- [ ] Entity row in canvas card updates: shows entity label + ENTITY badge
- [ ] Try connecting a second Entity to same TableNode → rejected
- [ ] Try connecting same Entity to a second TableNode → rejected
- [ ] Double-click STORED_IN edge → removed
- [ ] After removal: TableNode `entityId = null`, entity row shows "No entity linked"

### CONNECTS_TO edge (Table → DB)

- [ ] Draw edge from TableNode to DBNode → edge appears (purple, "CONNECTS TO" label)
- [ ] Draw from DBNode to TableNode → same result
- [ ] Arrow points toward DBNode
- [ ] TableNode `dbNodeId` is set after connecting
- [ ] DB row in canvas card shows DB label + DATABASE badge
- [ ] DBNode table count increments
- [ ] Multiple TableNodes can connect to the same DBNode
- [ ] TableNode can only connect to one DBNode (second attempt rejected)
- [ ] Double-click CONNECTS_TO edge → removed
- [ ] After removal: TableNode `dbNodeId = null`, DB row shows "No database linked"

### Inspector

- [ ] Select TableNode → TableInspector opens
- [ ] Change tableName → auto-formats to snake_case, canvas header updates
- [ ] CONNECTIONS section shows entity and DB when connected
- [ ] `×` in entity connection row → STORED_IN edge removed from canvas + IDB
- [ ] `×` in DB connection row → CONNECTS_TO edge removed
- [ ] Add custom query → collapsed card appears with method name + type badge
- [ ] Expand query → all fields visible
- [ ] Set method name → collapsed card updates
- [ ] Set query type JPQL → queryString textarea appears
- [ ] Set query type DERIVED → queryString hidden
- [ ] Add param → param row appears, remove → disappears
- [ ] Enable cache → cache fields appear
- [ ] Delete table → confirm → removed from canvas and IDB + all edges removed

### IDB persistence

- [ ] Refresh → TableNode reappears with tableName, entityId, dbNodeId intact
- [ ] Custom queries persist after refresh
- [ ] STORED_IN edge persists after refresh → canvas card still shows entity
- [ ] CONNECTS_TO edge persists after refresh → canvas card still shows DB
- [ ] Disconnect entity → refresh → entityId still null
- [ ] Move TableNode → refresh → position persists
- [ ] Delete TableNode → refresh → node and its edges do not reappear
- [ ] Two tabs → add STORED_IN edge in Tab 1 → Tab 2 updates within ~1 second
