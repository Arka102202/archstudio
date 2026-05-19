# DBNode Migration — Split into DBNode + TableNode

> Claude Code: this document migrates the existing DBNode implementation.
> Read it in full before writing a single line.
> Do not build the new TableNode canvas component in this step — that is a separate step.
> This step only: updates entity types, migrates existing data, and slims down the inspector.

---

## Why This Is Happening

The original `DBNode` mixed database-level concerns (connection config) with
table-level concerns (custom queries, entity linkage). This is being split into:

- **`DBNode`** — connection config only. One per datasource.
- **`TableNode`** — one per entity-table pair. Holds queries. Links to one Entity + one DBNode.

This migration step strips `DBNode` down to connection config only and
migrates any existing `customQueries` data into new `TableNode` records.

---

## Step 0 — Update entity files first

### `src/entity/DBNode.ts`

Replace the entire file with this lean version:

```typescript
import type { BaseNode } from './shared'
import { NodeType } from './shared'

export interface DBNode extends BaseNode {
  type:     NodeType.DB
  dbName:   string
  dbType:   DBType
  host:     string
  port:     number
  schema:   string
  username: string   // env ref e.g. "${DB_USER}"
  password: string   // env ref e.g. "${DB_PASS}"
  config:   DBConfig
}

export enum DBType {
  POSTGRESQL = 'POSTGRESQL',
  MYSQL      = 'MYSQL',
  MONGODB    = 'MONGODB',
  H2         = 'H2',
  MSSQL      = 'MSSQL',
}

export interface DBConfig {
  ddlAuto:  DDLAuto
  showSql:  boolean
  poolSize: number
  flyway:   boolean
  redis:    boolean
}

export enum DDLAuto {
  VALIDATE    = 'validate',
  CREATE_DROP = 'create-drop',
  UPDATE      = 'update',
  NONE        = 'none',
}
```

`CustomQuery`, `QueryType`, `DbQueryParam`, `QueryReturnType`, `CacheConfig`, `CacheOp`
are **removed from DBNode.ts**. They now live in `src/entity/TableNode.ts`.

### `src/entity/TableNode.ts`

Create this new file:

```typescript
import type { BaseNode, AIPrompt } from './shared'
import { NodeType }               from './shared'
import type { JavaType }          from './shared'

export interface TableNode extends BaseNode {
  type:          NodeType.TABLE
  tableName:     string
  entityId:      string | null   // set by STORED_IN edge
  dbNodeId:      string | null   // set by CONNECTS_TO edge
  customQueries: CustomQuery[]
}

export interface CustomQuery {
  id:             string
  methodName:     string
  description:    string

  targetEntityId: string | null
  type:           QueryType | null
  queryString:    string | null
  aiPrompt:       AIPrompt | null
  params:         DbQueryParam[]
  returnType:     QueryReturnType | null
  nativeQuery:    boolean
  modifying:      boolean
  cache:          CacheConfig | null
}

export enum QueryType {
  DERIVED    = 'DERIVED',
  JPQL       = 'JPQL',
  NATIVE_SQL = 'NATIVE_SQL',
  AI         = 'AI',
}

export interface DbQueryParam {
  name:         string
  type:         JavaType
  isCollection: boolean
}

export interface QueryReturnType {
  entityId:        string
  isList:          boolean
  isPage:          boolean
  isOptional:      boolean
  projectionClass: string
}

export interface CacheConfig {
  enabled:    boolean
  cacheName:  string
  ttlSeconds: number
  operation:  CacheOp
}

export enum CacheOp {
  CACHEABLE   = 'CACHEABLE',
  CACHE_EVICT = 'CACHE_EVICT',
  CACHE_PUT   = 'CACHE_PUT',
}
```

### `src/entity/shared.ts`

Add `TABLE = 'TABLE'` to the `NodeType` enum.
Add `CONNECTS_TO = 'CONNECTS_TO'` to the `EdgeType` enum with comment `// TableNode → DBNode`.

### `src/entity/index.ts`

Add `export * from './TableNode'` alongside the existing exports.

After these changes, run `npx tsc --noEmit`. Fix all errors before continuing.
There will be errors in `src/utils/node.ts` and `src/components/nodes/DBNode/` — fix them below.

---

## Step 1 — Update factory functions

### `src/utils/node.ts`

**Update `createDBNode`** — remove `customQueries` from the returned object:

```typescript
export const createDBNode = (overrides?: Partial<DBNode>): DBNode => ({
  id:       generateId(),
  type:     NodeType.DB,
  label:    'Database',
  dbName:   'app_db',
  dbType:   DBType.POSTGRESQL,
  host:     'localhost',
  port:     5432,
  schema:   'public',
  username: '${DB_USER}',
  password: '${DB_PASS}',
  position: { x: 0, y: 0 },
  size:     { w: 220, h: 160 },
  aiPrompt: emptyAIPrompt(),
  config: {
    ddlAuto:  DDLAuto.VALIDATE,
    showSql:  false,
    poolSize: 10,
    flyway:   true,
    redis:    false,
  },
  ...overrides,
})
```

**Add `createTableNode`** — new factory:

```typescript
export const createTableNode = (overrides?: Partial<TableNode>): TableNode => ({
  id:            generateId(),
  type:          NodeType.TABLE,
  label:         'Table',
  tableName:     'table_name',
  entityId:      null,
  dbNodeId:      null,
  position:      { x: 0, y: 0 },
  size:          { w: 220, h: 160 },
  aiPrompt:      emptyAIPrompt(),
  customQueries: [],
  ...overrides,
})
```

Export `createTableNode` from `src/utils/index.ts`.

---

## Step 2 — IDB data migration

Any existing `DBNode` rows in IDB may have a `customQueries` array in their `data` JSON blob.
On the next canvas load, these must be migrated.

In `useCanvas.ts`, inside the node-loading logic, add a one-time migration pass:

```typescript
// Migration: split old DBNode (with customQueries) into DBNode + TableNode
const migrationNeeded = loadedNodes.some(n =>
  n.type === 'DB' && (JSON.parse(n.data) as { customQueries?: unknown }).customQueries?.length > 0
)

if (migrationNeeded) {
  await migrateDbNodesToTableNodes(loadedNodes, currentProjectId)
  // Reload after migration
  loadedNodes = await db.nodes.where('projectId').equals(currentProjectId).toArray()
}
```

**`migrateDbNodesToTableNodes`** — add to `src/utils/autoPopulate.ts`:

```typescript
export async function migrateDbNodesToTableNodes(
  nodeRows: NodeRow[],
  projectId: string,
): Promise<void> {
  for (const row of nodeRows) {
    if (row.type !== 'DB') continue

    const old = JSON.parse(row.data) as DBNode & { customQueries?: CustomQuery[] }
    if (!old.customQueries?.length) continue

    // Create a TableNode carrying the old queries
    const tableNode = createTableNode({
      label:         old.label + ' Table',
      tableName:     old.dbName.replace(/_db$/, ''),
      dbNodeId:      old.id,
      customQueries: old.customQueries,
    })

    await db.nodes.add({
      id:        tableNode.id,
      projectId,
      type:      'TABLE',
      label:     tableNode.label,
      position:  tableNode.position,
      size:      tableNode.size,
      data:      JSON.stringify(tableNode),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    // Strip customQueries from the DBNode
    const cleanedDb: DBNode = {
      id:       old.id,
      type:     NodeType.DB,
      label:    old.label,
      dbName:   old.dbName,
      dbType:   old.dbType,
      host:     old.host,
      port:     old.port,
      schema:   old.schema,
      username: old.username,
      password: old.password,
      position: old.position,
      size:     old.size,
      aiPrompt: old.aiPrompt,
      config:   old.config,
    }

    await db.nodes.update(old.id, {
      data:      JSON.stringify(cleanedDb),
      updatedAt: Date.now(),
    })
  }
}
```

Import `NodeRow` from `@db`. Import `createTableNode` from `@utils`.
This migration runs once per project load where old data exists and is idempotent
(the second load will find no `customQueries` in any DBNode).

---

## Step 3 — Update the canvas IDB load type map

In `useCanvas.ts`, add `'TABLE'` to the node type map:

```
'MICROSERVICE' → 'microservice'
'ENTITY'       → 'entity'
'DTO'          → 'dto'
'DB'           → 'db'
'TABLE'        → 'table'
```

And in `EDGE_TYPES` load map for edges:
```
'STORED_IN'   → 'storedIn'      (Entity → TableNode — was Entity → DBNode)
'CONNECTS_TO' → 'connectsTo'    (TableNode → DBNode — new edge type)
```

**Important:** the existing `STORED_IN` edges in IDB have `toNodeId` pointing to a `DBNode`.
After the migration, new `STORED_IN` edges will point to a `TableNode`. Old edges still
point to the old DBNode and will be effectively orphaned — they were previously handled
as Entity→DB but are now invalid. The migration in Step 2 does not create new edges
(that is left to the user to reconnect), but the canvas load must not crash when it
encounters an old STORED_IN edge whose `toNodeId` points to a DB-type node.

Guard in edge loading:
```typescript
// When loading a STORED_IN edge, check that toNode.type is 'TABLE'
// If it's 'DB' (legacy), skip rendering the edge silently
// The user will reconnect manually
```

---

## Step 4 — Update DBNode canvas component

In `src/components/nodes/DBNode/DBNode.tsx`, remove the queries count row.
The canvas card now shows only:

```
┌──────────────────────────────────┐
│  [DB]  order_db      POSTGRESQL  │  ← HEADER
├──────────────────────────────────┤
│  localhost : 5432                │  ← CONNECTION ROW
│  schema: public                  │
├──────────────────────────────────┤
│  validate  │  show SQL  │ Flyway │  ← CONFIG ROW
└──────────────────────────────────┘
```

Remove the `"N queries"` row entirely from `DBNode.tsx` — it is no longer relevant.

In `useDBNode.ts`, remove any reference to `customQueries` from the returned values.

---

## Step 5 — Update DBInspector

In `useDBInspector.ts`:
- Remove all `customQueries` state and handlers
- Remove `expandedQueryId` state
- Remove all `handleQueryXxx` handlers
- Remove `handleAddQuery` / `handleRemoveQuery`

Keep everything else: identity, connection, config, connections, AI prompt, delete.

In `DBInspector.tsx`:
- Remove **Section 5 — Custom Queries** entirely
- The panel now has 6 sections: Identity, Connection, Config, Connections, AI Prompt, Delete

The inspector becomes shorter and cleaner. Custom queries are now managed in the
`TableInspector` (built in the next step).

---

## Step 6 — Update autoPopulate.ts

The `STORED_IN` auto-population rule now targets `TableNode`, not `DBNode`:

```typescript
// In autoPopulate.ts

// Old: Entity → DBNode (STORED_IN)
// New: Entity → TableNode (STORED_IN)

export function applyStoredInEdge(entity: EntityNode, table: TableNode): TableNode {
  return {
    ...table,
    entityId:  entity.id,
    tableName: table.tableName === 'table_name' ? entity.tableName : table.tableName,
    // Auto-set tableName if still default
  }
}

// TableNode → DBNode (CONNECTS_TO)
export function applyConnectsToEdge(table: TableNode, db: DBNode): TableNode {
  return {
    ...table,
    dbNodeId: db.id,
    label:    table.label === 'Table' ? db.label + ' Table' : table.label,
  }
}
```

---

## Step 7 — Register TABLE in Canvas.tsx

Add a placeholder for the table node type in `NODE_TYPES`:

```typescript
// Placeholder — TableNode canvas component will be built in the next step
// For now, use a minimal fallback so the canvas does not crash if a TableNode
// is loaded from IDB after migration
const TABLE_FALLBACK: React.FC<NodeProps> = ({ data }) => (
  <div className="bg-surface border border-[var(--color-border)] rounded-[var(--radius-md)] p-2 text-[11px] font-mono text-text-3">
    Table: {(data as TableNode).tableName}
  </div>
)

const NODE_TYPES = {
  microservice: MicroserviceNode,
  entity:       EntityNode,
  dto:          DTONode,
  db:           DBNode,
  table:        TABLE_FALLBACK,   // replaced in the TableNode step
} as const
```

---

## Verification

### TypeScript
```bash
npx tsc --noEmit
```
Zero errors after all steps above.

### Runtime checks

- [ ] Canvas loads without crashing
- [ ] Existing DBNodes still appear on canvas with connection info
- [ ] DBNode canvas card shows header, connection row, config row — no queries count
- [ ] DBInspector opens when DBNode selected — no Custom Queries section
- [ ] Identity, Connection, Config, AI Prompt sections still work
- [ ] Changes persist to IDB
- [ ] If any old DBNode had `customQueries` in IDB: after migration, a new `TableNode`
      appears on canvas carrying those queries (positioned near the DB node)
- [ ] After migration, the DBNode's IDB `data` blob no longer contains `customQueries`
- [ ] `npx tsc --noEmit` → zero errors

---

## What Is NOT done in this step

- No `TableNode` canvas component (built in the next step)
- No `TableInspector` (built in the next step)
- No `STORED_IN` edge from Entity → TableNode (rebuilt in the next step)
- No `CONNECTS_TO` edge from TableNode → DBNode (built in the next step)
- No left sidebar palette item for TableNode
