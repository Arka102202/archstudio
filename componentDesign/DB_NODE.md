# DBNode — Design & Build Specification

> Claude Code: read this in full before writing a single line.
> Follow every rule in CLAUDE.md alongside this document.
> A MicroserviceNode must exist before a DBNode can be added.
> In this step: node + inspector + sidebar + IDB + one edge type (STORED_IN, Entity → DB).
> No other edge types. No custom query generation. Queries are defined manually only.

---

## 0. CLAUDE.md Update Required First

Before building anything, update `src/entity/DBNode.ts` to reflect the revised
`CustomQuery` interface. The canonical definition is in CLAUDE.md.

Key changes from the old version:
- `description: string` added — required alongside `methodName`
- `targetEntityId: string | null` — optional (null when not yet linked to an entity)
- `type: QueryType | null` — optional
- `queryString: string | null` — optional
- `aiPrompt: AIPrompt | null` — optional
- `cache: CacheConfig | null` — optional
- `returnType: QueryReturnType | null` — optional
- `params` uses `DbQueryParam[]` not `QueryParam[]` — renamed to avoid clash with `EndpointQueryParam`

`DbQueryParam` interface (same fields, new name):
```typescript
export interface DbQueryParam {
  name:         string
  type:         JavaType
  isCollection: boolean
}
```

After updating the entity file, run `npx tsc --noEmit` — zero errors before continuing.

---

## 1. What Is the DBNode

The DBNode defines one **datasource** for a microservice — the database connection config
plus all custom Spring Data JPA repository queries for that database.

Every DBNode connects to **exactly one EntityNode** via a `STORED_IN` edge.
That connection tells the system "this entity's data lives in this database."

Each DBNode lives inside a MicroserviceNode. It cannot exist on the canvas alone.

---

## 2. Visual Anatomy

```
┌──────────────────────────────────┐  ← border: var(--node-db-accent) when selected
│                                  │
│  [DB]  order_db      POSTGRESQL  │  ← HEADER: icon · dbName · dbType badge
│                                  │
├──────────────────────────────────┤
│  localhost : 5432                │  ← CONNECTION ROW
│  schema: public                  │
├──────────────────────────────────┤
│  validate  │  show SQL  │ Flyway │  ← CONFIG ROW: ddlAuto · showSql · flyway
├──────────────────────────────────┤
│  3 queries                       │  ← QUERIES COUNT (if any)
└──────────────────────────────────┘
```

| Section | Content |
|---|---|
| Header | Icon square + dbName + dbType badge |
| Connection row | host:port on first line, schema on second |
| Config row | ddlAuto value · showSql indicator · flyway indicator |
| Queries count | "N queries" shown only when `customQueries.length > 0` |

Minimum size: **w 210, h 130**. No maximum.

---

## 3. Data Model

`DBNode` extends `BaseNode`. Defined in `src/entity/DBNode.ts` (update as per Section 0).
Import all types from `@entity`. Do not redefine.

Key fields:
```
DBNode
  dbName:        string
  dbType:        DBType      (POSTGRESQL | MYSQL | MONGODB | H2 | MSSQL)
  host:          string
  port:          number
  schema:        string
  username:      string      (env ref e.g. "${DB_USER}")
  password:      string      (env ref e.g. "${DB_PASS}")
  config:        DBConfig
    ddlAuto:  DDLAuto        (validate | create-drop | update | none)
    showSql:  boolean
    poolSize: number
    flyway:   boolean
    redis:    boolean
  customQueries: CustomQuery[]
```

`CustomQuery` (updated — see Section 0):
```
  id:             string          required
  methodName:     string          required
  description:    string          required
  targetEntityId: string | null   optional
  type:           QueryType | null optional
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

`createDBNode()` in `src/utils/node.ts`:

```
id:           generateId()
type:         NodeType.DB
label:        'Database'
dbName:       'app_db'
dbType:       DBType.POSTGRESQL
host:         'localhost'
port:         5432
schema:       'public'
username:     '${DB_USER}'
password:     '${DB_PASS}'
position:     { x: 0, y: 0 }
size:         { w: 220, h: 160 }
aiPrompt:     emptyAIPrompt()
config:
  ddlAuto:  DDLAuto.VALIDATE
  showSql:  false
  poolSize: 10
  flyway:   true
  redis:    false
customQueries: []
```

Export from `src/utils/index.ts`.

---

## 5. How DBNodes Are Added

Same guard and two-way pattern as EntityNode and DTONode.

### Guard
DB palette item enabled only when at least one MicroserviceNode exists.
When disabled: `opacity-40 cursor-not-allowed pointer-events-none`, title "Add a microservice first".

### Way 1 — Drag from left sidebar
- `onDragStart`: `e.dataTransfer.setData('nodeType', 'db')`
- Canvas `onDrop`: add `'db'` case → `createDBNode({ position })` → IDB → RF state

### Way 2 — Click palette item
- Target MS: selected MS first, else last MS in rfNodes
- Stagger position: `{ x: 20 + (count % 4) * 230, y: 60 + Math.floor(count / 4) * 180 }`
  where `count` = existing DB nodes in the project

---

## 6. Canvas Node Component

### File structure

```
src/components/nodes/DBNode/
├── DBNode.tsx
├── useDBNode.ts
├── types.ts
└── index.ts
```

### types.ts

```typescript
import type { NodeProps } from '@xyflow/react'
import type { DBNode } from '@entity'

export interface DBNodeProps extends NodeProps {
  data: DBNode
}
```

### useDBNode.ts

Returns:
```typescript
{
  node,        // DBNode — from props.data
  isSelected,  // boolean
  handleClick, // () => void
}
```

Read-only display hook. No IDB calls.

### DBNode.tsx

**Tailwind classes for all layout and static styles. Inline `style` only for dynamic JS values.**

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
  minWidth={210}
  minHeight={130}
  isVisible={isSelected}
  lineStyle={{ border: '1.5px solid var(--node-db-accent)' }}
  handleStyle={{ background: 'var(--node-db-accent)', border: 'none', width: 8, height: 8 }}
/>
```

**Header** — `className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)]"`:
- Icon: 24×24, `background: var(--node-db-icon-bg)`, `color: var(--node-db-icon-fg)`, text "DB", `font-mono text-[8px] font-bold`
- dbName: `className="text-[13px] font-bold text-text flex-1 truncate"`
- dbType badge: `className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm flex-shrink-0 bg-[var(--node-db-icon-bg)]"`, `style={{ color: 'var(--node-db-icon-fg)' }}`, text = `node.dbType`

**Connection row** — `className="px-3 py-1.5 border-b border-[var(--color-border)] flex flex-col gap-0.5"`:
- Line 1: `className="text-[10px] font-mono text-text-2"`, text `${node.host} : ${node.port}`
- Line 2: `className="text-[9px] font-mono text-text-4"`, text `schema: ${node.schema}`

**Config row** — `className="px-3 py-1.5 flex items-center gap-2 border-b border-[var(--color-border)]"`:
Three small indicator chips, each `className="text-[8px] font-mono px-1.5 py-0.5 rounded-sm"`:
- ddlAuto value: `bg-surface-alt text-text-3`, text = `node.config.ddlAuto`
- showSql: conditionally `bg-[var(--color-warning-light)] text-[var(--color-warning)]` if true, else `bg-surface-alt text-text-4`, text "SQL" or "no SQL"
- flyway: conditionally `bg-[var(--color-success-light)] text-[var(--color-success)]` if true, else `bg-surface-alt text-text-4`, text "flyway" or "no flyway"

**Queries count** (render only when `node.customQueries.length > 0`):
`className="px-3 py-1.5 text-[9px] font-mono text-text-4"`, text `${node.customQueries.length} quer${node.customQueries.length === 1 ? 'y' : 'ies'}`

---

## 7. Register in Canvas

```typescript
import { DBNode } from '@components/nodes/DBNode'

const NODE_TYPES = {
  microservice: MicroserviceNode,
  entity:       EntityNode,
  dto:          DTONode,
  db:           DBNode,
} as const
```

Extend IDB load type map in `useCanvas.ts`:
```
'DB' → 'db'
```

Add `'db'` case to `onDrop` handler.

---

## 8. Left Sidebar Updates

In `useLeftSidebar.ts`:
- Add `'db'` case to `handleAddNode` — same pattern as entity/dto
- Add `handleDragStart(e, 'db')` support

In `LeftSidebar.tsx`:
- Set `ready: true` for the DB palette item
- `disabled={!hasMicroservice}`, `draggable={hasMicroservice}`, drag + click handlers wired

Update layers panel to show DB nodes:

```
● Order Service          :8080
  ● Order                        ← entity
  ◈ OrderResponse                ← dto
  ▪ order_db   POSTGRESQL        ← db (use ▪ square to distinguish)
```

DB layer item:
- `pl-4`, marker `▪` or similar, colour `var(--node-db-accent)`
- Label: `node.dbName`, dbType right-aligned in 8px mono muted

---

## 9. STORED_IN Edge (Entity → DB)

### One DB per Entity rule

Each EntityNode can connect to **only one** DBNode via `STORED_IN`.
Each DBNode connects to **only one** EntityNode.

Before creating a `STORED_IN` edge:
```
1. Check: does the entity already have a STORED_IN edge? → if yes, reject silently
2. Check: does the DB already have a STORED_IN edge? → if yes, reject silently
3. Check: does an edge already exist between this exact pair? → if yes, reject silently
```

### Edge direction

`STORED_IN` is always stored as:
```
fromNodeId = EntityNode.id
toNodeId   = DBNode.id
```

The user can draw from either end. Normalise in `onConnect` before storing.

### onConnect guard

In `useCanvas.ts`, extend `onConnect` to handle `STORED_IN`:

```
1. Identify source and target node types
2. If one is ENTITY and the other is DB:
   - Apply the three rejection checks above
   - Normalise direction (entity → db)
   - Create the edge
   - Run auto-population (Section 10)
3. Else if one is DTO and the other is ENTITY:
   - Existing DERIVED_FROM logic
4. Else: ignore
```

### Visual style

Custom edge component:

```
src/components/edges/StoredInEdge/
├── StoredInEdge.tsx
├── useStoredInEdge.ts
├── types.ts
└── index.ts
```

Register in `EDGE_TYPES`:
```typescript
const EDGE_TYPES = {
  derivedFrom: DerivedFromEdge,
  storedIn:    StoredInEdge,
} as const
```

Visual:
- Stroke: `var(--node-db-accent)` (purple)
- StrokeWidth: 1.5px (selected: 2.5px)
- Arrow: `MarkerType.ArrowClosed` at the DB end, fill `var(--node-db-accent)`
- Label: "STORED IN", same style as DerivedFromEdge label
- Hover `×` + double-click to delete (same pattern as DerivedFromEdge)

### Auto-population on STORED_IN connect

When a STORED_IN edge is created:

1. Push `entity.tableName` as a reference into the DB node:
   - The DB node has no explicit `tables` field, so store it as the first custom query's `targetEntityId`
   - Actually: just update `db.customQueries` metadata. For now, just log and mark the edge.
   - This is placeholder — the real auto-population of queries happens when the Service layer is built.

2. Update the DB node's label to `entity.tableName + '_db'` if the DB label is still the default `'Database'`:
   ```
   if (db.label === 'Database') db.label = entity.tableName + '_db'
   if (db.dbName === 'app_db')  db.dbName = entity.tableName + '_db'
   ```

3. Update DB node in RF state and IDB.

On STORED_IN edge delete:
- No rollback of the label change (user can edit it manually)
- No removal of queries (they're user-defined)

---

## 10. Inspector Panel — DBInspector

### File structure

```
src/pages/Editor/components/InspectorPanel/components/DBInspector/
├── DBInspector.tsx
├── useDBInspector.ts
├── types.ts
└── index.ts
```

Wire into `InspectorPanel.tsx`: add `case NodeType.DB: return <DBInspector nodeId={selectedNodeId} />`.

### Panel anatomy

```
┌──────────────────────────────────────────┐
│ [DBNode]  badge               sticky top │  ← header
│ order_db                            [×]  │
│ POSTGRESQL                               │
├──────────────────────────────────────────┤
│ IDENTITY                                 │  ← section 1
│ [dbName                              ]   │
│ [label                               ]   │
│ DB Type      [POSTGRESQL ▼]              │
├──────────────────────────────────────────┤
│ CONNECTION                               │  ← section 2
│ Host   [localhost              ]         │
│ Port   [5432                   ]         │
│ Schema [public                 ]         │
│ User   [${DB_USER}             ]         │
│ Pass   [${DB_PASS}             ] [show]  │
├──────────────────────────────────────────┤
│ CONFIG                                   │  ← section 3
│ DDL Auto     [validate ▼]                │
│ Pool size    [10               ]         │
│ Show SQL                    [toggle]     │
│ Flyway                      [toggle]     │
│ Redis cache                 [toggle]     │
├──────────────────────────────────────────┤
│ CONNECTIONS                              │  ← section 4
│ → Order   ENTITY             [×]         │  ← green arrow out to entity
│ (or "No entity connected")               │
├──────────────────────────────────────────┤
│ CUSTOM QUERIES                           │  ← section 5
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ findByUserId            DERIVED    │  │  ← query card (collapsed)
│  │ Find user by their ID              │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ ▼ findActiveOrders       JPQL      │  │  ← query card (expanded)
│  │ Find all active orders for a user  │  │
│  │ Entity   [Order ▼]                 │  │
│  │ Query    [select o from Order o …] │  │
│  │ Params   name:STRING [+]    [×]    │  │
│  │ Returns  List [toggle]  Page[tog]  │  │
│  │ Native   [toggle]  Modifying[tog]  │  │
│  │ Cache    [toggle]                  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  [+ Add query]                           │
├──────────────────────────────────────────┤
│ AI PROMPT  ●                             │  ← section 6
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐  │
│   [description                      ]   │
│   AI generates code          [toggle]   │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘  │
├──────────────────────────────────────────┤
│ [        Delete database      ]          │  ← section 7
└──────────────────────────────────────────┘
```

### useDBInspector.ts

Same optimistic update pattern: instant RF setNodes → debounced 300ms IDB write.

**Identity handlers:**
- `handleLabelChange(value: string)`
- `handleDbNameChange(value: string)` — live canvas update: header dbName
- `handleDbTypeChange(value: DBType)` — live canvas update: dbType badge

**Connection handlers:**
- `handleHostChange(value: string)` — live canvas update: connection row
- `handlePortChange(value: string)` — parse to number, live canvas update
- `handleSchemaChange(value: string)` — live canvas update
- `handleUsernameChange(value: string)`
- `handlePasswordChange(value: string)`
- `showPassword: boolean` state + `toggleShowPassword()` — toggles password visibility in the input

**Config handlers:**
- `handleDdlAutoChange(value: DDLAuto)`
- `handlePoolSizeChange(value: string)` — parse to number
- `handleShowSqlToggle()` — live canvas update: showSql chip
- `handleFlywayToggle()` — live canvas update: flyway chip
- `handleRedisToggle()`

**Connections:**
Read connected entity from `useEdges()` filtered to STORED_IN edges involving this DB node.
- `connectedEntity: { id: string; label: string } | null`
- `handleDisconnect(edgeId: string)` — deletes the edge

**Custom query handlers:**
- `expandedQueryId: string | null` — which query is expanded
- `setExpandedQueryId(id: string | null)`
- `handleAddQuery()` — appends new `CustomQuery` with `generateId()`, `methodName: 'newQuery'`, `description: ''`, all optionals null, `params: []`, `nativeQuery: false`, `modifying: false`
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
- `handleQueryCacheToggle(queryId: string)` — if `cache` is null, initialise it with defaults; else toggle `cache.enabled`
- `handleQueryCacheFieldChange(queryId: string, field: keyof CacheConfig, value: unknown)`

**AI prompt handlers:**
- `handleAIPromptChange(field: keyof AIPrompt, value: string)` — 500ms debounce
- `handleAIGenerateToggle()`

**Lifecycle:**
- `handleClose()` — `canvasStore.clearSelection()`
- `handleDelete()` — confirm → `db.nodes.delete` + `db.edges` cascade + RF state + clearSelection

### Section 1 — Identity

| Field | Control | Live canvas |
|---|---|---|
| `label` | text input | — |
| `dbName` | text input | Header dbName text |
| `dbType` | select: POSTGRESQL, MYSQL, MONGODB, H2, MSSQL | Header badge |

### Section 2 — Connection

| Field | Control | Live canvas |
|---|---|---|
| `host` | text input, mono | Connection row |
| `port` | number input | Connection row |
| `schema` | text input, mono | Connection row |
| `username` | text input, mono | — |
| `password` | password input (toggle show/hide) | — |

Password field: type `password` by default, `type="text"` when `showPassword`.
Show/hide button: small eye icon (`👁`) or text "show"/"hide" next to the input.

### Section 3 — Config

| Field | Control | Default | Live canvas |
|---|---|---|---|
| `config.ddlAuto` | select: validate, create-drop, update, none | validate | ddlAuto chip |
| `config.poolSize` | number input | 10 | — |
| `config.showSql` | toggle | off | showSql chip |
| `config.flyway` | toggle | on | flyway chip |
| `config.redis` | toggle | off | — |

### Section 4 — Connections

Shows the EntityNode connected via STORED_IN edge (if any).

```
→  Order   ENTITY   [×]
```

Green right arrow `→` in `var(--node-entity-accent)` colour.
If no entity connected: `"No entity connected"` in `text-text-4`.

### Section 5 — Custom Queries

Each query is a **collapsible card**. Collapsed shows: method name + type badge + description (truncated).
Expanded shows all fields.

**Collapsed state** (`className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-2 cursor-pointer hover:border-[var(--color-border-strong)]"`):
- Row 1: method name (11px mono bold) + type badge (8px) + `▶` expand caret
- Row 2: description (10px, text-3, truncated to 1 line)

**Expanded state** (same wrapper, `▼` caret):

Fields shown when expanded:

| Field | Control | Notes |
|---|---|---|
| Method name | text input, mono | required |
| Description | textarea 2 rows | required |
| Query type | select: DERIVED, JPQL, NATIVE_SQL, AI, or "—" for null | optional |
| Target entity | select from available EntityNodes | optional, only when type set |
| Query string | textarea 3 rows, mono | shown only when type = JPQL or NATIVE_SQL |
| Native query | toggle | only when type = JPQL or NATIVE_SQL |
| Modifying | toggle | only when type = JPQL or NATIVE_SQL |

**Params sub-section** (when type is not DERIVED):
Each param row: `name input` + `type select (JavaType)` + `isCollection toggle` + `×`
Add param row: `[name] [type ▼] [+]`

**Return type sub-section:**
- isList toggle
- isPage toggle (only one of isList/isPage active — they're mutually exclusive)
- isOptional toggle (only when neither isList nor isPage)
- projectionClass input (optional, for DTO projections)

**Cache sub-section** (optional — only shown when `cache !== null`):
Triggered by a "Enable cache" toggle that initialises `cache` with defaults.
When enabled shows:
- cacheName input
- ttlSeconds number input
- operation select: CACHEABLE, CACHE_EVICT, CACHE_PUT

**AI Prompt per-query** (only when type = AI):
Small compact version of the AI box (description + aiGenerate toggle), same visual style using `--ai-box-*` tokens.

**Add query button:**
`className="w-full py-1.5 text-[11px] font-semibold border border-dashed border-[var(--color-border-strong)] rounded-[var(--radius-sm)] text-text-3 hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"`
Text: "+ Add query"

**Query type badge colours:**

| Type | bg token | text token |
|---|---|---|
| DERIVED | `--color-success-light` | `--color-success` |
| JPQL | `--color-accent-light` | `--color-accent` |
| NATIVE_SQL | `--color-warning-light` | `--color-warning` |
| AI | `--ai-box-border` | `--ai-dot-color` |
| null | `bg-surface-alt` | `text-text-4`, text "—" |

### Section 6 — AI Prompt (node level)

Small AI box (description textarea 3 rows + aiGenerate toggle).
This is the node-level AI prompt for the DBNode itself, separate from per-query AI prompts.

### Section 7 — Delete

Button: "Delete database"
`className="bg-[var(--color-danger-light)] text-[var(--color-danger)] border border-[var(--color-danger-border)] rounded-[var(--radius-sm)] w-full py-2 text-[11px] font-semibold"`

On confirm: delete node from IDB, delete all STORED_IN edges involving this node from IDB, remove from RF state, clearSelection.

---

## 11. EntityInspector — CONNECTIONS update

EntityInspector already shows connected DTOs.
Add a second row for DB connections:

```
CONNECTIONS
→  OrderRequest    DTO       [×]
→  OrderResponse   DTO       [×]
→  order_db        DATABASE  [×]   ← new: STORED_IN edge
```

DB connection row:
- Green `→` arrow in `var(--node-db-accent)` colour
- DB label + "DATABASE" badge
- `×` button removes the STORED_IN edge

---

## 12. IDB Persistence

### Edge schema

```
edges table row for STORED_IN:
  id:         string
  projectId:  string
  fromNodeId: EntityNode.id
  toNodeId:   DBNode.id
  type:       'STORED_IN'
  label:      'STORED_IN'
```

### Load on mount

`useCanvas.ts` loads all edges on mount. Extend the edge-to-RF-edge mapper:

```
'DERIVED_FROM' → type: 'derivedFrom', use DerivedFromEdge
'STORED_IN'    → type: 'storedIn',    use StoredInEdge
```

### Write on create

```typescript
await db.edges.add({
  id:         generateId(),
  projectId:  currentProjectId,
  fromNodeId: entityId,
  toNodeId:   dbId,
  type:       'STORED_IN',
  label:      'STORED_IN',
})
```

Write the updated DB node (label, dbName auto-set) to IDB at the same time.

### Write on delete

`db.edges.delete(edgeId)` — IDB first, then RF state.

### Node persistence (same pattern as all other nodes)

```
Create:  db.nodes.add({ type: 'DB', data: JSON.stringify(dbNode), ... })
Update:  db.nodes.update(id, { data: JSON.stringify(updatedNode), updatedAt: now })
         — triggered debounced from every inspector field change
Delete:  db.nodes.delete(id)
Drag:    onNodesChange position/dimensions → debounce 100ms → db.nodes.update
```

All updates replace `data` column entirely — never patch JSON in place.

### Cross-tab sync

After every IDB write (node or edge), post:
```typescript
const bc = new BroadcastChannel('archflow-sync')
bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId })
bc.close()
```

---

## 13. Styling Rules

1. Tailwind classes for all layout, spacing, typography.
2. Inline `style` only for dynamic JS values or CSS variable colour tokens.
3. Never hardcode hex. All colours reference `var(--*)` tokens.
4. `font-mono` for all technical strings: dbName, host, port, schema, username, method names, query strings.
5. No `!important`.

---

## 14. What This Step Does NOT Build

- No other edge types (DBNode only connects to EntityNode in this step)
- No auto-generation of queries from entity fields (that comes when Service layer is built)
- No code export of `application.properties` or `application.yml`
- No actual database connection testing
- No context menu on DBNode
- No drag-to-reorder custom queries (though collapse/expand is required)

---

## 15. Verification

### TypeScript
```bash
npx tsc --noEmit
```
Zero errors. The renamed `DbQueryParam` must not conflict with `QueryParam` or `EndpointQueryParam`.

### Node basics

- [ ] DB palette item dimmed when no MS exists
- [ ] Click DB with MS selected → DBNode appears in that MS
- [ ] Drag DB from sidebar → drop inside MS → node at drop position
- [ ] Drop outside MS → nothing happens
- [ ] Canvas card shows: icon "DB", dbName, dbType badge, host:port, schema, config chips
- [ ] `showSql = true` → showSql chip turns amber
- [ ] `flyway = true` → flyway chip turns green
- [ ] Queries count shows only when queries exist

### Inspector

- [ ] Select DB → DBInspector opens
- [ ] Change dbName → canvas header updates immediately
- [ ] Change dbType → badge updates immediately
- [ ] Change host/port → connection row updates immediately
- [ ] Password field hidden by default, "show" reveals it
- [ ] DDL Auto change → config chip updates
- [ ] Toggle showSql → canvas chip updates
- [ ] Toggle flyway → canvas chip updates
- [ ] Add custom query → collapsed card appears
- [ ] Expand query → all fields visible
- [ ] Set method name → collapsed card header updates
- [ ] Set query type to JPQL → queryString textarea appears
- [ ] Set query type to DERIVED → queryString hidden
- [ ] Add query param → row appears
- [ ] Remove query param → row disappears
- [ ] Enable cache → cache fields appear
- [ ] Disable cache (toggle off) → cache fields collapse

### STORED_IN edge

- [ ] Draw edge Entity → DB → edge appears, purple colour, "STORED IN" label
- [ ] Draw edge DB → Entity → same result (normalised to Entity→DB direction)
- [ ] Arrow points toward DB end
- [ ] DB label auto-updates to `{tableName}_db` if still default
- [ ] DB dbName auto-updates if still default
- [ ] Try to connect a second entity to same DB → rejected, nothing happens
- [ ] Try to connect a second DB to same entity → rejected, nothing happens
- [ ] Double-click STORED_IN edge → edge removed
- [ ] Hover edge → `×` appears → click → edge removed
- [ ] EntityInspector CONNECTIONS shows the connected DB with green arrow
- [ ] DBInspector CONNECTIONS shows the connected Entity with green arrow
- [ ] Click `×` in inspector connection row → edge removed from canvas and IDB

### IDB persistence

- [ ] Refresh → DBNode reappears with all config intact
- [ ] Custom queries persist after refresh
- [ ] STORED_IN edge persists after refresh
- [ ] Auto-set label/dbName persists
- [ ] Move DB node → refresh → new position persists
- [ ] Delete DB node → refresh → node and its edges do not reappear
- [ ] Two tabs → create STORED_IN edge in Tab 1 → Tab 2 updates within ~1 second
