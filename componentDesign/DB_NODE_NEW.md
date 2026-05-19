# DBNode (Redesigned) — Design & Build Specification

> Claude Code: the migration step (DB_NODE_MIGRATION.md) must be complete before this step.
> This step builds the final lean DBNode — connection config only.
> No custom queries. No entity linkage. No table config.
> That all lives in TableNode (built separately).

---

## 1. What Is the DBNode (Redesigned)

The `DBNode` represents one **database instance** — the connection config needed to
reach that database. Nothing more.

It is not linked to any entity directly. It is not responsible for any table.
TableNodes connect to it via a `CONNECTS_TO` edge to say "this table lives in this database."

Multiple TableNodes can connect to the same DBNode (one database, many tables).
One DBNode can serve the whole microservice.

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
│  validate  │  no SQL  │ flyway   │  ← CONFIG ROW
├──────────────────────────────────┤
│  2 tables connected              │  ← TABLE COUNT (if any TableNodes connected)
└──────────────────────────────────┘
```

| Section | Content |
|---|---|
| Header | Icon "DB" + dbName + dbType badge |
| Connection row | host:port / schema |
| Config row | ddlAuto · showSql · flyway |
| Table count | "N tables connected" — only when `CONNECTS_TO` edges exist |

Minimum size: **w 210, h 130**. No maximum.

---

## 3. Data Model

Defined in `src/entity/DBNode.ts` (already updated in migration step).

```
DBNode
  dbName:   string
  dbType:   DBType      (POSTGRESQL | MYSQL | MONGODB | H2 | MSSQL)
  host:     string
  port:     number
  schema:   string
  username: string      (env ref e.g. "${DB_USER}")
  password: string      (env ref e.g. "${DB_PASS}")
  config:   DBConfig
    ddlAuto:  DDLAuto   (validate | create-drop | update | none)
    showSql:  boolean
    poolSize: number
    flyway:   boolean
    redis:    boolean
```

No `customQueries`. No `entityId`. No `tableId`. Connection config only.

---

## 4. Default Values

`createDBNode()` in `src/utils/node.ts` (already updated in migration step):

```
id:       generateId()
type:     NodeType.DB
label:    'Database'
dbName:   'app_db'
dbType:   DBType.POSTGRESQL
host:     'localhost'
port:     5432
schema:   'public'
username: '${DB_USER}'
password: '${DB_PASS}'
position: { x: 0, y: 0 }
size:     { w: 220, h: 160 }
aiPrompt: emptyAIPrompt()
config:
  ddlAuto:  DDLAuto.VALIDATE
  showSql:  false
  poolSize: 10
  flyway:   true
  redis:    false
```

---

## 5. How DBNodes Are Added

Same guard and two-way pattern as all other nodes.

### Guard
DB palette item enabled only when at least one MicroserviceNode exists.
When disabled: `opacity-40 cursor-not-allowed pointer-events-none`, title "Add a microservice first".

### Way 1 — Drag from left sidebar
- `onDragStart`: `e.dataTransfer.setData('nodeType', 'db')`
- Canvas `onDrop`: `'db'` case → `createDBNode({ position })` → IDB → RF state

### Way 2 — Click palette item
- Target MS: selected MS, else last MS in rfNodes
- Stagger: `{ x: 20 + (count % 4) * 230, y: 60 + Math.floor(count / 4) * 180 }`

---

## 6. Canvas Node Component

No changes needed to the component structure — the migration step already
removed the queries count from the canvas card.

Confirm `DBNode.tsx` renders exactly these four sections and nothing else:
- Header (icon, dbName, dbType badge)
- Connection row (host:port, schema)
- Config row (ddlAuto chip, showSql chip, flyway chip)
- Table count row (only when `CONNECTS_TO` edges exist — read from RF edges)

### Deriving table count in useDBNode.ts

```typescript
const allEdges = useEdges()  // from @xyflow/react
const tableCount = allEdges.filter(
  e => e.data?.type === EdgeType.CONNECTS_TO && e.source === props.id
).length
// Return tableCount alongside node, isSelected, handleClick
```

The table count is live — it updates as TableNodes connect/disconnect.

---

## 7. Canvas Node Styling

Identical to the previous DBNode implementation. No visual changes from the user's perspective.

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

**Header:**
- Icon: 24×24, `background: var(--node-db-icon-bg)`, `color: var(--node-db-icon-fg)`, text "DB"
- dbName: `text-[13px] font-bold text-text`
- dbType badge: `background: var(--node-db-icon-bg)`, `color: var(--node-db-icon-fg)`, 8px mono bold

**Connection row:**
- Line 1: `text-[10px] font-mono text-text-2` — `${host} : ${port}`
- Line 2: `text-[9px] font-mono text-text-4` — `schema: ${schema}`

**Config row chips (3):**
- ddlAuto: `bg-surface-alt text-text-3`
- showSql: amber if true, else `bg-surface-alt text-text-4`
- flyway: green if true, else `bg-surface-alt text-text-4`

**Table count row** (only when `tableCount > 0`):
`className="px-3 py-1.5 text-[9px] font-mono text-text-4 border-t border-[var(--color-border)]"`
Text: `${tableCount} table${tableCount === 1 ? '' : 's'} connected`

---

## 8. Inspector Panel — DBInspector (final form)

The DBInspector was already slimmed down in the migration step.
This is the confirmed final structure.

### Panel anatomy

```
┌──────────────────────────────────────────┐
│ [DBNode]  badge               sticky top │
│ order_db                            [×]  │
│ POSTGRESQL                               │
├──────────────────────────────────────────┤
│ IDENTITY                                 │  ← section 1
│ [label                               ]   │
│ [dbName                              ]   │
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
│ ← Order Table   TABLE        [×]         │  ← TableNodes connected via CONNECTS_TO
│ (or "No tables connected")               │
├──────────────────────────────────────────┤
│ AI PROMPT  ●                             │  ← section 5
├──────────────────────────────────────────┤
│ [        Delete database      ]          │  ← section 6
└──────────────────────────────────────────┘
```

### CONNECTIONS section — direction arrows

DBNode is the destination of `CONNECTS_TO` edges (TableNode → DBNode).
So from the DB's perspective, connections come **in**.

Each connected TableNode:
- Left arrow `←` in `var(--node-db-accent)` (purple) — "this table uses this DB"
- TableNode label
- "TABLE" badge
- `×` to remove the edge

### useDBInspector.ts (final)

**Handlers:**

Identity:
- `handleLabelChange(value: string)`
- `handleDbNameChange(value: string)` — live canvas: header dbName
- `handleDbTypeChange(value: DBType)` — live canvas: dbType badge

Connection:
- `handleHostChange(value: string)` — live canvas: connection row
- `handlePortChange(value: string)` — parse to number, live canvas
- `handleSchemaChange(value: string)` — live canvas
- `handleUsernameChange(value: string)`
- `handlePasswordChange(value: string)`
- `showPassword: boolean` + `toggleShowPassword()`

Config:
- `handleDdlAutoChange(value: DDLAuto)` — live canvas: ddlAuto chip
- `handlePoolSizeChange(value: string)` — parse to number
- `handleShowSqlToggle()` — live canvas: showSql chip
- `handleFlywayToggle()` — live canvas: flyway chip
- `handleRedisToggle()`

Connections (read-only, edge deletion only):
- Read `CONNECTS_TO` edges from `useEdges()` where `target === nodeId`
- For each, get the connected TableNode label
- `handleDisconnectTable(edgeId: string)` — delete the edge

AI Prompt:
- `handleAIPromptChange(field: keyof AIPrompt, value: string)` — 500ms debounce
- `handleAIGenerateToggle()`

Lifecycle:
- `handleClose()` — `canvasStore.clearSelection()`
- `handleDelete()` — confirm → delete node + all `CONNECTS_TO` edges where `target === nodeId` → RF state + IDB + clearSelection

All field changes: instant RF `setNodes` + debounced 300ms `db.nodes.update`.

---

## 9. IDB Persistence

### Write on create

```typescript
await db.nodes.add({
  id:        node.id,
  projectId: currentProjectId,
  type:      'DB',
  label:     node.label,
  position:  node.position,
  size:      node.size,
  data:      JSON.stringify(node),
  createdAt: Date.now(),
  updatedAt: Date.now(),
})
```

### Write on update

Same pattern as all other nodes:
1. Instant RF `setNodes`
2. Debounced 300ms `db.nodes.update(id, { data: JSON.stringify(updatedNode), updatedAt: now })`

### Write on drag/resize

`onNodesChange` → `position` (drag end) and `dimensions` → debounce 100ms → `db.nodes.update`

### Write on delete

1. `db.nodes.delete(nodeId)`
2. `db.edges.where('toNodeId').equals(nodeId).delete()` — cascade delete all CONNECTS_TO edges
3. `setNodes(nodes => nodes.filter(n => n.id !== nodeId))`
4. `setEdges(edges => edges.filter(e => e.target !== nodeId))`
5. `canvasStore.clearSelection()`

### Cross-tab sync

After every IDB write:
```typescript
const bc = new BroadcastChannel('archflow-sync')
bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId })
bc.close()
```

---

## 10. Left Sidebar

In `useLeftSidebar.ts`:
- `'db'` case in `handleAddNode` — same pattern as entity/dto
- `handleDragStart(e, 'db')` support

In `LeftSidebar.tsx`:
- DB palette item: `ready: true`, `disabled={!hasMicroservice}`, drag + click wired

Layers panel — DB item:
- `pl-4`, marker `▪`, colour `var(--node-db-accent)` (purple)
- Label: `node.dbName`, dbType right-aligned 8px mono muted

---

## 11. Verification

### TypeScript
```bash
npx tsc --noEmit
```
Zero errors.

### Node basics

- [ ] DB palette item active when MS exists, dimmed otherwise
- [ ] Click DB with MS selected → DBNode appears in that MS
- [ ] Drag DB from sidebar → drop inside MS → node at drop position
- [ ] Canvas card shows header, connection row, config chips — no query count
- [ ] `showSql = true` → chip turns amber
- [ ] `flyway = true` → chip turns green
- [ ] Table count row hidden when no TableNodes connected

### Inspector

- [ ] Select DB → DBInspector opens
- [ ] Change dbName → canvas header updates immediately
- [ ] Change dbType → badge updates immediately
- [ ] Change host/port → connection row updates
- [ ] Password hidden by default, "show" reveals it
- [ ] DDL Auto change → config chip updates
- [ ] Toggle showSql → canvas chip updates
- [ ] Toggle flyway → canvas chip updates
- [ ] CONNECTIONS section shows "No tables connected" when none
- [ ] No Custom Queries section present anywhere in the inspector

### IDB persistence

- [ ] Refresh → DBNode reappears with all config intact
- [ ] No `customQueries` field in the IDB `data` blob (check DevTools)
- [ ] Move node → refresh → position persists
- [ ] Delete DB node → refresh → node does not reappear
- [ ] Delete DB node → its CONNECTS_TO edges are also deleted

### Migration check (if running on project with old DBNode data)

- [ ] Canvas loads without error even if old DBNode had `customQueries`
- [ ] A new TableNode appears carrying the migrated queries
- [ ] The old DBNode's IDB blob no longer contains `customQueries`
