# MicroserviceNode — Export Architecture Button

> Claude Code: read this in full before writing a single line.
> Follow every rule in CLAUDE.md alongside this document.
> This step adds an Export button to the MicroserviceNode header and implements
> a function that reads from IDB directly to build the architecture JSON.

---

## 1. What This Step Builds

- An **Export button** in the MicroserviceNode header
- A single async function `exportArchitecture(msId, projectId)` in `src/utils/exportArchitecture.ts`
- The function reads entirely from IDB — it does NOT use RF state
- Output is logged to the browser console as formatted JSON

---

## 2. Export Button

### Placement

The Export button lives in the MicroserviceNode header, to the right of the title block, left of the badges.

```
[MS icon]  Order Service              [↗ Export]  [Spring Boot 3.2.0]  [:8080]
           order-service · com.example
```

### Button spec

```tsx
<button
  onClick={handleExport}
  title="Export architecture"
  className="flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)]
             cursor-pointer transition-all duration-150 border-none"
  style={{
    background:  'var(--color-surface-alt)',
    color:       'var(--color-text-3)',
    fontSize:    9,
    fontFamily:  'var(--font-mono)',
    fontWeight:  600,
  }}
  onMouseEnter={e => {
    e.currentTarget.style.background = 'var(--color-accent-light)'
    e.currentTarget.style.color      = 'var(--color-accent)'
  }}
  onMouseLeave={e => {
    e.currentTarget.style.background = 'var(--color-surface-alt)'
    e.currentTarget.style.color      = 'var(--color-text-3)'
  }}
>
  {/* Upload/export SVG icon */}
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
  Export
</button>
```

This uses a standard upload/export arrow icon (arrow pointing up out of a tray) from the
Lucide icon set SVG shape. It reads naturally as "send out" or "export".

### onClick must stopPropagation

```typescript
const handleExport = async (e: React.MouseEvent) => {
  e.stopPropagation()
  // ... call exportArchitecture
}
```

Without `stopPropagation`, the click bubbles to the node and triggers selection.

---

## 3. `useMicroserviceNode.ts` changes

Add the async handler. The hook already receives `props.id` (the MS node ID).

```typescript
// add to imports
import { db } from '@db'
import { exportArchitecture } from '@utils/exportArchitecture'
import { useProjectStore } from '@store'

// add inside the hook body
const projectId = useProjectStore(s => s.activeProjectId)

const handleExport = useCallback(async (e: React.MouseEvent) => {
  e.stopPropagation()
  if (!projectId) return
  const result = await exportArchitecture(props.id, projectId)
  console.group(`[archflow export] ${node.label}`)
  console.log(JSON.stringify(result, null, 2))
  console.groupEnd()
}, [props.id, node.label, projectId])
```

Add `handleExport` to the hook's return object.

---

## 4. `src/utils/exportArchitecture.ts` — complete implementation

This file is **completely standalone**. It imports from `@db` and `@entity` only.
No React. No hooks. No RF state. Pure async function.

```typescript
import { db } from '@db'
import type {
  MicroserviceNode,
  EntityNode,
  DTONode,
  DBNode,
  TableNode,
  ServiceNode,
  ControllerNode,
  APIEndpointNode,
} from '@entity'
import { NodeType } from '@entity'

// ─── Types ───────────────────────────────────────────────────────────────────

interface NodeRow {
  id:        string
  projectId: string
  type:      string
  label:     string
  data:      string   // JSON.stringify of the full typed node
}

interface EdgeRow {
  id:         string
  projectId:  string
  fromNodeId: string
  toNodeId:   string
  type:       string
}

// ─── Main export function ────────────────────────────────────────────────────

export async function exportArchitecture(
  msId:      string,
  projectId: string,
): Promise<object> {

  // ── Step 1: Fetch the MicroserviceNode itself ──────────────────────────────
  const msRow = await db.nodes.get(msId)
  if (!msRow) {
    console.warn('[archflow] MicroserviceNode not found:', msId)
    return {}
  }
  const ms = JSON.parse(msRow.data) as MicroserviceNode

  // ── Step 2: Fetch all child nodes using msId index ─────────────────────────
  // Every child node (Entity, DTO, Service, etc.) stores msId on itself.
  // Use the IDB index on msId to get all of them in one query.
  const childRows: NodeRow[] = await db.nodes
    .where('msId')
    .equals(msId)
    .toArray()

  // Parse all child node data blobs upfront
  const childNodes = childRows.map(row => ({
    id:   row.id,
    type: row.type,
    node: JSON.parse(row.data),
  }))

  // ── Step 3: Partition by node type ─────────────────────────────────────────
  const getAll = <T>(type: string): T[] =>
    childNodes.filter(n => n.type === type).map(n => n.node as T)

  const entities    = getAll<EntityNode>    (NodeType.ENTITY)
  const dtos        = getAll<DTONode>       (NodeType.DTO)
  const tables      = getAll<TableNode>     (NodeType.TABLE)
  const databases   = getAll<DBNode>        (NodeType.DB)
  const services    = getAll<ServiceNode>   (NodeType.SERVICE)
  const controllers = getAll<ControllerNode>(NodeType.CONTROLLER)
  const endpoints   = getAll<APIEndpointNode>(NodeType.API_ENDPOINT)

  // ── Step 4: Fetch all edges for this project ───────────────────────────────
  // We need edges to:
  //   a) find which service each controller INVOKES
  //   b) find which endpoints ROUTE_TO each controller
  const allProjectEdges: EdgeRow[] = await db.edges
    .where('projectId')
    .equals(projectId)
    .toArray()

  // Build a Set of all child node IDs for fast lookup
  const childIdSet = new Set(childNodes.map(n => n.id))
  childIdSet.add(msId)

  // Filter to edges that are relevant to this MS
  // (at least one end must belong to this MS's nodes)
  const msEdges = allProjectEdges.filter(e =>
    childIdSet.has(e.fromNodeId) || childIdSet.has(e.toNodeId)
  )

  // ── Step 5: Build entities output ──────────────────────────────────────────
  const entitiesOut = entities.map(e => ({
    id:        e.id,
    label:     e.label,
    tableName: e.tableName,
    fields:    e.fields.map(f => ({
      name:       f.name,
      type:       f.type,
      constraint: f.constraint,
      nullable:   f.nullable,
    })),
    config: {
      softDelete:         e.config.softDelete,
      auditing:           e.config.auditing,
      lombokStyle:        e.config.lombokStyle,
      generateRepository: e.config.generateRepository,
    },
  }))

  // ── Step 6: Build DTOs output ──────────────────────────────────────────────
  const dtosOut = dtos.map(d => ({
    id:      d.id,
    label:   d.label,
    purpose: d.purpose,
    origin:  d.origin,
    fields:  d.fields.map(f => ({
      name:        f.name,
      type:        f.type,
      validations: f.validations.map(v => v.type),
    })),
  }))

  // ── Step 7: Build tables output ────────────────────────────────────────────
  const tablesOut = tables.map(t => ({
    id:        t.id,
    label:     t.label,
    tableName: t.tableName,
    entityId:  t.entityId,
    dbNodeId:  t.dbNodeId,
    customQueries: t.customQueries.map(q => ({
      methodName:  q.methodName,
      description: q.description,
      type:        q.type,
    })),
  }))

  // ── Step 8: Build databases output ────────────────────────────────────────
  const databasesOut = databases.map(d => ({
    id:     d.id,
    label:  d.label,
    dbName: d.dbName,
    dbType: d.dbType,
    host:   d.host,
    port:   d.port,
    schema: d.schema,
    config: d.config,
  }))

  // ── Step 9: Build services output ─────────────────────────────────────────
  // Find USES edge for each service → connectedEntityId
  const servicesOut = services.map(svc => {
    const usesEdge = msEdges.find(e =>
      e.type === 'USES' && e.fromNodeId === svc.id
    )
    const connectedEntityId = usesEdge?.toNodeId ?? null
    const connectedEntity   = entities.find(en => en.id === connectedEntityId)

    const methods = svc.methods.map(m => {
      // Format return type using entityId
      const returnEntity = connectedEntity
      const entityLabel  = returnEntity?.label ?? undefined
      return {
        name:          m.name,
        returns:       formatReturnType(m.returnType, entityLabel),
        params:        m.params.map(p => ({
          name: p.name,
          type: p.entityId
            ? (connectedEntity?.label ?? 'Entity')
            : (p.primitiveType ?? '?'),
        })),
        transactional: m.transactional,
        async:         m.async,
      }
    })

    return {
      id:                svc.id,
      label:             svc.label,
      connectedEntityId,
      methods,
      config:            svc.config,
    }
  })

  // ── Step 10: Build controllers + embedded endpoints ────────────────────────
  //
  // For each controller:
  //   1. Find the INVOKES edge → invokedServiceId
  //   2. Find all ROUTES_TO edges where toNodeId === controller.id
  //   3. Get the endpoint nodes whose ids match those edges' fromNodeId
  //   4. Embed those endpoints inline — no controller back-reference inside them

  const embeddedEndpointIds = new Set<string>()

  const controllersOut = controllers.map(ctrl => {

    // 1. Which service does this controller invoke?
    const invokesEdge = msEdges.find(e =>
      e.type === 'INVOKES' && e.fromNodeId === ctrl.id
    )
    const invokedServiceId = invokesEdge?.toNodeId ?? null

    // 2. Which endpoints route to this controller?
    const routesToEdges = msEdges.filter(e =>
      e.type === 'ROUTES_TO' && e.toNodeId === ctrl.id
    )
    const endpointIds = routesToEdges.map(e => e.fromNodeId)

    // 3. Look up the APIEndpointNode objects
    const controllerEndpoints = endpoints.filter(ep =>
      endpointIds.includes(ep.id)
    )

    // Track which endpoints are embedded (to catch orphans later)
    controllerEndpoints.forEach(ep => embeddedEndpointIds.add(ep.id))

    // 4. Format each endpoint — no controller field inside
    const endpointsOut = controllerEndpoints.map(ep => ({
      id:          ep.id,
      label:       ep.label,
      method:      ep.method,
      path:        ep.path,
      description: ep.config.description,
      request: {
        bodyDTOId:   ep.request.bodyDTOId,
        pathVars:    ep.request.pathVars,
        queryParams: ep.request.queryParams,
      },
      response: {
        returnDTOId: ep.response.returnDTOId,
        successCode: ep.response.successCode,
        isList:      ep.response.isList,
        isPage:      ep.response.isPage,
      },
      security: {
        override: ep.security.override,
      },
      errorHandling: {
        inheritFromController: ep.errorHandling.inheritFromController,
        errors:                ep.errorHandling.errors,
      },
      config: {
        paginated:   ep.config.paginated,
        deprecated:  ep.config.deprecated,
      },
    }))

    return {
      id:              ctrl.id,
      label:           ctrl.label,
      basePath:        ctrl.basePath,
      invokedServiceId,
      security:        ctrl.security,
      config:          ctrl.config,
      errorHandling:   ctrl.errorHandlerConfig,
      swaggerTags:     ctrl.swaggerTags,
      endpoints:       endpointsOut,
    }
  })

  // ── Step 11: Orphan endpoints (not connected to any controller) ────────────
  const orphanEndpoints = endpoints
    .filter(ep => !embeddedEndpointIds.has(ep.id))
    .map(ep => ({
      id:          ep.id,
      label:       ep.label,
      method:      ep.method,
      path:        ep.path,
      description: ep.config.description,
    }))

  // ── Step 12: Build edges summary ───────────────────────────────────────────
  const edgesOut = msEdges.map(e => ({
    from: e.fromNodeId,
    to:   e.toNodeId,
    type: e.type,
  }))

  // ── Step 13: Build microservice summary (strip canvas-only fields) ─────────
  const msOut = {
    id:          ms.id,
    label:       ms.label,
    serviceName: ms.serviceName,
    packageName: ms.packageName,
    port:        ms.port,
    version:     ms.version,
    build:       ms.build,
    docker:      ms.docker,
  }

  // ── Step 14: Assemble and return ──────────────────────────────────────────
  const result: Record<string, unknown> = {
    microservice: msOut,
    entities:     entitiesOut,
    dtos:         dtosOut,
    tables:       tablesOut,
    databases:    databasesOut,
    services:     servicesOut,
    controllers:  controllersOut,
    edges:        edgesOut,
  }

  // Only include orphanEndpoints key if there are any
  if (orphanEndpoints.length > 0) {
    result['orphanEndpoints'] = orphanEndpoints
  }

  return result
}

// ─── Helper: format MethodReturnType to a readable string ──────────────────

function formatReturnType(
  rt: { entityId: string | null; primitiveType: string | null; isList: boolean; isPage: boolean; isOptional: boolean; isVoid: boolean },
  entityLabel?: string,
): string {
  const typeName = entityLabel ?? rt.primitiveType ?? '?'
  if (rt.isVoid)     return 'void'
  if (rt.isList)     return `List<${typeName}>`
  if (rt.isPage)     return `Page<${typeName}>`
  if (rt.isOptional) return `Optional<${typeName}>`
  if (rt.entityId)   return entityLabel ?? 'Entity'
  return rt.primitiveType ?? '?'
}
```

Export from `src/utils/index.ts`:
```typescript
export { exportArchitecture } from './exportArchitecture'
```

---

## 5. IDB index requirement

The query `db.nodes.where('msId').equals(msId)` requires `msId` to be indexed in Dexie.

In `src/db/db.ts`, confirm the `nodes` table schema includes `msId`:

```typescript
this.version(1).stores({
  projects: 'id, updatedAt',
  nodes:    'id, projectId, msId, type, createdAt',
  edges:    'id, projectId, fromNodeId, toNodeId',
})
```

If `msId` is not already in the index string, add it now.
This is a schema change — Dexie requires a version bump if you add indexes.

If `msId` is not indexed yet:
1. Bump the version number (e.g. from `.version(1)` to `.version(2)`)
2. Add `msId` to the nodes index string
3. Add a migration: `.upgrade(tx => tx.table('nodes').toCollection().modify(() => {}))` — a no-op upgrade to trigger the index rebuild

---

## 6. Verification

### TypeScript
```bash
npx tsc --noEmit
```
Zero errors.

### Button appearance

- [ ] Export button visible in MS header with upload arrow SVG icon + "Export" text
- [ ] Button has `var(--color-surface-alt)` background at rest
- [ ] Hover: accent light background + accent text
- [ ] Clicking button does NOT select/deselect the node (stopPropagation works)

### Console output structure

Open DevTools console, build an architecture, click Export.

- [ ] Console shows a collapsed group: `[archflow export] {MS label}`
- [ ] Expanding shows valid JSON
- [ ] `microservice` key has id, label, serviceName, packageName, port, build, docker
- [ ] `entities` array: one object per EntityNode — has id, label, tableName, fields, config
- [ ] `dtos` array: one per DTONode — has id, label, purpose, origin, fields
- [ ] `tables` array: one per TableNode — has id, label, tableName, entityId, dbNodeId, customQueries
- [ ] `databases` array: one per DBNode — has id, label, dbName, dbType, host, port
- [ ] `services` array: one per ServiceNode — has id, label, connectedEntityId, methods, config
- [ ] `controllers` array: one per ControllerNode — has endpoints array embedded

### Controller endpoints

- [ ] Controller with 3 endpoints → `endpoints` array has 3 items
- [ ] Each endpoint has method, path, request, response — no controller field inside
- [ ] Endpoint without ROUTES_TO edge → appears in `orphanEndpoints` key, not in any controller

### IDB as data source

- [ ] Refresh page (RF state cleared), then click Export — data still appears
  (proves function reads from IDB, not RF state)
- [ ] Add a node, immediately click Export without navigating — new node appears in output

### Multi-MS

- [ ] MS1 Export → only MS1's nodes appear
- [ ] MS2 Export → only MS2's nodes appear
- [ ] No cross-contamination between microservices
