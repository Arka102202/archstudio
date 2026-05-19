# archFlow — Data Flow Reference

> Complete guide to how data moves through the app: from user input to IDB, across tabs, and back to the UI.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema (Dexie / IDB)](#2-database-schema)
3. [State Sources of Truth](#3-state-sources-of-truth)
4. [TanStack Query Layer](#4-tanstack-query-layer)
5. [Zustand Stores](#5-zustand-stores)
6. [React Flow State](#6-react-flow-state)
7. [Node Lifecycle](#7-node-lifecycle)
8. [Edge Lifecycle & Auto-Population](#8-edge-lifecycle--auto-population)
9. [Inspector → IDB Write Path](#9-inspector--idb-write-path)
10. [Cross-Tab Sync](#10-cross-tab-sync)
11. [App Boot & Settings](#11-app-boot--settings)
12. [Project List Flow](#12-project-list-flow)
13. [Cache Invalidation Strategy](#13-cache-invalidation-strategy)
14. [End-to-End Flow Examples](#14-end-to-end-flow-examples)

---

## 1. Architecture Overview

```js
┌─────────────────────────────────────────────────────────────────────┐
│                          USER INPUT                                  │
│         (click, drag, type, connect nodes, resize)                  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        COMPONENT LAYER                               │
│   Canvas · InspectorPanel · LeftSidebar · ProjectList               │
│   (JSX only — zero logic, zero direct store writes)                 │
└────────────┬──────────────────────────────────────┬─────────────────┘
             │ reads                                 │ calls
             ▼                                       ▼
┌────────────────────────┐            ┌──────────────────────────────┐
│    ZUSTAND STORES      │            │       HOOK LAYER              │
│  canvasStore           │◄──────────►│  useCanvas · useEntityInspect│
│  projectStore          │            │  useDBInspector · etc.        │
│  settingsStore         │            └──────────────┬───────────────┘
└────────────────────────┘                           │
                                                     │ writes optimistically
                                      ┌──────────────▼───────────────┐
                                      │    REACT FLOW STATE           │
                                      │  rfNodes · rfEdges            │
                                      │  (in-memory canvas state)     │
                                      └──────────────┬───────────────┘
                                                     │ mutations
                                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     SERVICE LAYER (TanStack Query)                   │
│  useGetNodes · useCreateNode · useUpdateNode · useDeleteNode         │
│  → mutationFn calls Dexie directly                                   │
│  → onSuccess invalidates cache keys                                  │
└────────────────────────────┬────────────────────────────────────────┘
                             │ reads & writes
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DEXIE (IndexedDB)                               │
│              projects · nodes · edges · settings                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │ after write
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BROADCAST CHANNEL                                 │
│          'archflow-sync' — notifies other tabs of IDB changes        │
└────────────────────────────┬────────────────────────────────────────┘
                             │ relay via service worker
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    OTHER BROWSER TABS                                │
│   receive message → queryClient.invalidateQueries() → re-fetch IDB  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Database Schema

**File:** `src/db/db.ts`

```js
Database name : archflow
Version       : 2

┌──────────────────────────────────────────────────────────┐
│  TABLE: projects                                          │
│  PK: id                                                  │
│  Indexes: id, updatedAt                                  │
├──────────────┬───────────┬───────────────────────────────┤
│  id          │ string    │ UUID primary key               │
│  name        │ string    │                               │
│  description │ string    │                               │
│  createdAt   │ number    │ timestamp                     │
│  updatedAt   │ number    │ timestamp (used for ordering) │
└──────────────┴───────────┴───────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  TABLE: nodes                                            │
│  PK: id                                                  │
│  Indexes: id, projectId, type, [projectId+type]          │
├──────────────┬───────────┬───────────────────────────────┤
│  id          │ string    │ UUID primary key               │
│  projectId   │ string    │ FK → projects.id              │
│  type        │ string    │ NodeType enum value           │
│  label       │ string    │ display name                  │
│  position    │ object    │ { x: number, y: number }      │
│  size        │ object    │ { w: number, h: number }      │
│  data        │ string    │ JSON.stringify(full node obj) │
│  createdAt   │ number    │                               │
│  updatedAt   │ number    │                               │
└──────────────┴───────────┴───────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  TABLE: edges                                            │
│  PK: id                                                  │
│  Indexes: id, projectId, fromNodeId, toNodeId            │
├──────────────┬───────────┬───────────────────────────────┤
│  id          │ string    │ UUID primary key               │
│  projectId   │ string    │ FK → projects.id              │
│  fromNodeId  │ string    │ source node                   │
│  toNodeId    │ string    │ target node                   │
│  type        │ string    │ EdgeType enum value           │
│  label       │ string    │                               │
│  fromHandle  │ string    │ handle id on source node      │
│  toHandle    │ string    │ handle id on target node      │
└──────────────┴───────────┴───────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  TABLE: settings  (added in v2)                          │
│  PK: key                                                 │
├──────────────┬───────────┬───────────────────────────────┤
│  key         │ string    │ 'theme' | 'inspectorWidth'    │
│              │           │ | 'sidebarWidth'              │
│  value       │ string    │ JSON.stringify of the value   │
└──────────────┴───────────┴───────────────────────────────┘
```

> **Key design decision:** `nodes.data` stores the entire typed node object (EntityNode, DTONode, TableNode, etc.) as a JSON blob. This keeps the IDB schema simple and stable — new fields on domain types don't require schema migrations.

---

## 3. State Sources of Truth

| State | Primary Source | Secondary / Cache |
|---|---|---|
| Node data (fields, config) | `nodes.data` (IDB) | RF node `data` prop (in-memory) |
| Node position / size | RF state (live) | `nodes.position` + `nodes.size` (persisted on drag/resize stop) |
| Edge topology | `edges` table (IDB) | RF edges state (in-memory) |
| Selected node / edge | `canvasStore` (Zustand) | — |
| Active project | `projectStore` (Zustand) | — |
| Theme / panel widths | `settingsStore` (Zustand) | `localStorage` (theme only, for flash-free boot), `settings` IDB table |

---

## 4. TanStack Query Layer

**Files:** `src/service/node/` · `src/constants/queryKeys.ts`

### Query Key Structure

```typescript
QUERY_KEYS = {
  projects:  ['projects'],
  project:   (id)        => ['projects', id],
  nodes:     (projectId) => ['nodes', projectId],
  node:      (id)        => ['nodes', 'single', id],
  edges:     (projectId) => ['edges', projectId],
}
```

### Query Client Config

```typescript
// src/main.tsx
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            60_000,   // data fresh for 60 s
      refetchOnWindowFocus: false,    // do not re-fetch on tab focus
    },
  },
})
```

### Service Hooks

```js
useGetNodes(projectId)
  queryFn  → db.nodes.where('projectId').equals(projectId).toArray()
  enabled  → Boolean(projectId)

useCreateNode()
  mutationFn → db.nodes.add(NodeRow)
  onSuccess  → invalidate QUERY_KEYS.nodes(projectId)

useUpdateNode()
  mutationFn → db.nodes.update(id, { label, position, size, data, updatedAt })
  onSuccess  → invalidate QUERY_KEYS.nodes(projectId)
               invalidate QUERY_KEYS.node(id)

useDeleteNode()
  mutationFn → db.nodes.delete(nodeId)
  onSuccess  → invalidate QUERY_KEYS.nodes(projectId)
               invalidate QUERY_KEYS.node(nodeId)

useDeleteNodes()
  mutationFn → db.nodes.bulkDelete(nodeIds)
  onSuccess  → invalidate QUERY_KEYS.nodes(projectId)
```

---

## 5. Zustand Stores

**Files:** `src/store/`

### canvasStore

```js
selectedNodeId  : string | null   ← set by onNodeClick in useCanvas
selectedEdgeId  : string | null   ← set by onEdgeClick in useCanvas
pan             : { x, y }        ← updated by RF pan events
zoom            : number          ← updated by RF zoom events

setSelectedNode(id)   → triggers InspectorPanel to render the correct inspector
setSelectedEdge(id)   → (future use)
clearSelection()      → called on pane click / inspector close
```

### projectStore

```js
activeProjectId : string | null

setActiveProject(id)  → called in useEditor on route enter
                        cleared on route leave (cleanup)
```

### settingsStore

```js
theme          : 'light' | 'dark'
inspectorWidth : number
sidebarWidth   : number

setTheme(t)           → updates store + localStorage + data-theme attribute
setInspectorWidth(w)  → updates store + persists to IDB settings table
setSidebarWidth(w)    → updates store + persists to IDB settings table
```

---

## 6. React Flow State

**File:** `src/pages/Editor/components/Canvas/useCanvas.ts`

```js
const [rfNodes, setRfNodes] = useNodesState([])
const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([])
```

### RF Node Shape (loaded from IDB)

```typescript
{
  id:         row.id,
  type:       'microservice' | 'entity' | 'dto' | 'db' | 'table',
  position:   row.position,          // { x, y } — absolute or relative to parent
  data:       JSON.parse(row.data),  // full typed node object
  width:      row.size.w,
  height:     row.size.h,
  parentId:   data.msId,             // only for child nodes inside MS
  extent:     'parent',              // only for child nodes
  dragHandle: '.ms-drag-handle',     // microservice only
}
```

### Initial Load Guard

```typescript
const initialLoadDone      = useRef(false)
const initialEdgesLoadDone = useRef(false)

useEffect(() => {
  if (!nodeRows) return
  if (initialLoadDone.current) return   // ← only runs ONCE
  initialLoadDone.current = true
  // ... load nodes into RF state
}, [nodeRows, setRfNodes, projectId])
```

> This guard is critical. After initial load, RF state is the live source of truth for position and visual state. TanStack Query cache invalidations re-fetch IDB but do **not** reset RF state — that would cause visual glitches and reset ongoing user interactions.

---

## 7. Node Lifecycle

### 7.1 Creation

```js
┌─────────────────────────────────────────────────────────────┐
│  Via Drag-Drop (Entity / DTO / DB / Table)                  │
└─────────────────────────────────────────────────────────────┘

useLeftSidebar.handleNodeAdd(type)
  │
  ├─ Find target MS: rfNodes.find by selectedNodeId or last MS
  ├─ Calculate relative position: { x: 20 + count*230, y: 60+... }
  ├─ createXxxNode({ position, msId: targetMs.id })
  │    → generateId() (crypto.randomUUID)
  │    → full default object with all required fields
  │
  ├─ createNode mutation → db.nodes.add(NodeRow)
  │    → onSuccess → invalidate QUERY_KEYS.nodes(projectId)
  │
  └─ setNodes([...nodes, newRfNode])    ← optimistic, immediate
       parentId: targetMs.id
       extent:   'parent'

┌─────────────────────────────────────────────────────────────┐
│  Via Canvas Drop (Drag from palette onto canvas)            │
└─────────────────────────────────────────────────────────────┘

Canvas.onDrop(e: DragEvent)
  │
  ├─ e.dataTransfer.getData('nodeType') → type
  ├─ screenToFlowPosition(e.clientX, e.clientY) → position
  ├─ Same creation pattern as above
  └─ If MICROSERVICE: no parentId (top-level node)
```

### 7.2 Position & Size Persistence

```js
Node Drag:
  onNodeDragStop(_event, node)
    → updateNode({ position: node.position, size: { w, h }, data: JSON.stringify({...data, position, size}) })
    → IDB persisted, cache invalidated

Node Resize:
  onNodesChange(changes)
    → applyNodeChanges(changes, rfNodes) → setRfNodes(...)   ← immediate RF update
    → For change.type === 'dimensions' && !change.resizing:
        → updateNode({ size: { w, h } })                     ← IDB persisted on resize-end
```

### 7.3 Deletion

```js
Inspector "Delete" button
  │
  ├─ window.confirm()
  ├─ Find all edges involving this node in allEdges (RF state)
  ├─ await Promise.all(relatedEdges.map(e => db.edges.delete(e.id)))
  ├─ deleteNode({ nodeId, projectId })
  │    → db.nodes.delete(nodeId)
  │    → onSuccess → invalidate caches
  ├─ setNodes(nodes.filter(n => n.id !== nodeId))   ← immediate RF update
  ├─ setEdges(edges.filter(e => e.source !== nodeId && e.target !== nodeId))
  ├─ BroadcastChannel.postMessage({ type: 'IDB_CHANGED', ... })
  └─ clearSelection()
```

---

## 8. Edge Lifecycle & Auto-Population

### 8.1 Connection Flow

```
User draws a connection on canvas
  │
  ▼
ReactFlow fires onConnect(connection)
  │
  ▼
useCanvas.handleConnect(connection) [async]
  │
  ├─ Resolve sourceNode, targetNode from rfNodes
  ├─ Read sourceType, targetType from node.data.type
  │
  ├─── Entity ↔ DB  ──────────────────────────────────────────────────
  │    (legacy STORED_IN: direct Entity→DB connection)
  │    Guard: entity not already connected
  │    Guard: DB not already connected
  │    Guard: pair doesn't exist
  │    Auto-populate: update DB label/dbName if still default
  │    → db.edges.add(edgeRow)
  │    → db.nodes.update(dbId, updatedDB)
  │    → BroadcastChannel sync
  │    → setRfEdges([...edges, newEdge])
  │    → setRfNodes(nodes.map update for dbId)
  │    return
  │
  ├─── Entity ↔ Table  ───────────────────────────────────────────────
  │    Guard: entity not already connected to a table
  │    Guard: table not already connected to an entity
  │    applyStoredInEdge(entityNode, tableNode)
  │      → updatedTable.entityId = entity.id
  │      → updatedTable.tableName = entity.tableName  (if still 'table_name')
  │    → db.edges.add(edgeRow)
  │    → db.nodes.update(tableId, updatedTable)
  │    → BroadcastChannel sync
  │    → setRfEdges([...edges, newEdge])
  │    → setRfNodes(nodes.map update for tableId)
  │    return
  │
  ├─── Table ↔ DB  ───────────────────────────────────────────────────
  │    Guard: table not already connected to a DB
  │    Guard: exact pair doesn't exist
  │    applyConnectsToEdge(tableNode, dbNode)
  │      → updatedTable.dbNodeId = db.id
  │      → updatedTable.label = db.label + ' Table'  (if still 'Table')
  │    → db.edges.add(edgeRow)
  │    → db.nodes.update(tableId, updatedTable)
  │    → BroadcastChannel sync
  │    → setRfEdges([...edges, newEdge])
  │    → setRfNodes(nodes.map update for tableId)
  │    return
  │
  └─── DTO ↔ Entity  (DERIVED_FROM)  ─────────────────────────────────
       applyDerivedFromEdge(dtoNode, entityNode)
         → Merge non-PK entity fields into dto.fields
         → Skip fields already in DTO (by name)
         → Skip fields in dto.excludeFields (user removed them)
         → Tag merged fields with sourceEntityId
         → Update dto.entitySources
         → Set dto.origin = DERIVED (if no custom fields)
         → Set dto.purpose = RESPONSE (if first entity connection)
       → db.edges.add(edgeRow)
       → db.nodes.update(dtoId, updatedDto)
       → BroadcastChannel sync
       → setRfEdges([...edges, newEdge])
       → setRfNodes(nodes.map update for dtoId)
```

### 8.2 Auto-Population Utilities

**File:** `src/utils/autoPopulate.ts`

```js
applyDerivedFromEdge(dto, entity)
  → Copies entity fields → dto.fields (respecting excludeFields)
  → Returns updated DTONode

syncEntityFieldsToDTOs(entityId, updatedEntity, allEdges, rfNodes)
  → Finds all DTOs connected via DERIVED_FROM edges (target === entityId)
  → For each DTO:
     - Only touch fields where field.sourceEntityId === entityId
     - Never touch fields in excludeFields
     - Never touch custom fields (sourceEntityId === null)
  → Returns { [dtoId]: updatedDTO } map
  → Caller updates RF state + persists each DTO to IDB

applyStoredInEdge(entity, table)
  → table.entityId = entity.id
  → table.tableName = entity.tableName  (if still default)
  → Returns updated TableNode

applyConnectsToEdge(table, db)
  → table.dbNodeId = db.id
  → table.label = db.label + ' Table'  (if still default)
  → Returns updated TableNode
```

### 8.3 Edge Deletion (double-click)

```
onEdgeDoubleClick(_event, edge)
  │
  ├─ await db.edges.delete(edge.id)
  ├─ setRfEdges(edges.filter(e => e.id !== edge.id))
  │
  ├─ If DERIVED_FROM:
  │    dtoId    = edge.source
  │    entityId = edge.target
  │    updatedDto.entitySources = sources.filter(s => s.entityId !== entityId)
  │    If origin === DERIVED: remove fields with sourceEntityId === entityId
  │    If origin === CUSTOM:  keep all fields
  │    → db.nodes.update(dtoId, updatedDto)
  │    → setRfNodes(nodes.map update for dtoId)
  │
  ├─ If STORED_IN:
  │    tableId = edge.target
  │    → db.nodes.update(tableId, { ...tableData, entityId: null })
  │    → setRfNodes(nodes.map update for tableId)
  │
  ├─ If CONNECTS_TO:
  │    tableId = edge.source
  │    → db.nodes.update(tableId, { ...tableData, dbNodeId: null })
  │    → setRfNodes(nodes.map update for tableId)
  │
  └─ BroadcastChannel.postMessage({ type: 'IDB_CHANGED', ... })
```

---

## 9. Inspector → IDB Write Path

**Example file:** `src/pages/Editor/components/InspectorPanel/components/EntityInspector/useEntityInspector.ts`

### Read Path (inspector open)

```
User clicks node
  → canvasStore.setSelectedNode(node.id)
  → RightSidebar renders InspectorPanel
  → InspectorPanel reads canvasStore.selectedNodeId
  → Renders <EntityInspector nodeId={selectedNodeId} />
  → useEntityInspector:
      rfNode = useNodes().find(n => n.id === nodeId)   ← React Flow internal store
      node   = rfNode.data as EntityNode               ← typed domain object
      [no TanStack Query call — reads directly from RF state]
```

### Write Path (field change)

```
User types in inspector field
  │
  ▼
onChange handler calls applyUpdate(updater, debounce)
  │
  ├─ 1. Derive updated node:
  │      updated = updater(node)
  │
  ├─ 2. Optimistic RF update (immediate):
  │      setNodes(nodes.map(n => n.id === nodeId
  │        ? { ...n, data: updated }
  │        : n
  │      ))
  │
  └─ 3. Debounced IDB write:
         debouncedWrite(updated)   ← 300ms for most fields
         debouncedWriteSlow(updated) ← 500ms for long text / slow fields
           │
           ▼ (after debounce)
         writeToIDB(updated)
           → updateNode mutation
               → db.nodes.update(id, {
                   label:     updated.label,
                   position:  updated.position,
                   size:      updated.size,
                   data:      JSON.stringify(updated),
                   updatedAt: Date.now(),
                 })
               → onSuccess:
                   invalidate QUERY_KEYS.nodes(projectId)
                   invalidate QUERY_KEYS.node(id)
```

### Field Sync to Connected DTOs

```
Entity field added / changed / removed
  │
  ▼
applyUpdate(updater)
  │
  ├─ Update Entity RF state (as above)
  │
  └─ syncDTOs(updatedEntity):
       syncEntityFieldsToDTOs(nodeId, updatedEntity, allEdges, rfNodes)
         → Returns { [dtoId]: updatedDto }
         → For each changed DTO:
             setNodes(nodes.map update for dtoId)   ← optimistic
             debouncedWriteDTO(updatedDto)           ← 300ms
               → db.nodes.update(dtoId, { data: JSON.stringify(updatedDto) })
```

---

## 10. Cross-Tab Sync

```
┌────────────────────────────────────────────────────────────────┐
│  TAB A — writing                                               │
│                                                                │
│  useCanvas.handleConnect() or Inspector applyUpdate()          │
│    │                                                           │
│    ├─ db.edges.add() / db.nodes.update()  ← IDB write          │
│    │                                                           │
│    └─ new BroadcastChannel('archflow-sync')                    │
│         .postMessage({ type: 'IDB_CHANGED',                    │
│                        table: 'edges|nodes',                   │
│                        projectId })                            │
│         .close()                                               │
└────────────────────────────────────────────────────────────────┘
                          │
                          │ BroadcastChannel message
                          ▼
┌────────────────────────────────────────────────────────────────┐
│  SERVICE WORKER  (src/sw/sw.ts)                                │
│                                                                │
│  self.addEventListener('message', event => {                   │
│    if (event.data?.type === 'IDB_CHANGED') {                   │
│      clients.matchAll({ type: 'window' }).then(clients => {    │
│        clients.forEach(c => {                                  │
│          if (c.id !== event.source.id)    ← skip sender        │
│            c.postMessage(event.data)                           │
│        })                                                      │
│      })                                                        │
│    }                                                           │
│  })                                                            │
└────────────────────────────────────────────────────────────────┘
                          │
                          │ relays to other tabs
                          ▼
┌────────────────────────────────────────────────────────────────┐
│  TAB B — receiving  (src/main.tsx)                             │
│                                                                │
│  const bc = new BroadcastChannel('archflow-sync')              │
│  bc.onmessage = (event) => {                                   │
│    if (event.data?.type === 'IDB_CHANGED') {                   │
│      queryClient.invalidateQueries()   ← re-fetch from IDB    │
│    }                                                           │
│  }                                                             │
│                                                                │
│  → TanStack Query re-fetches stale keys from IDB               │
│  → Components that call useGetNodes() etc. re-render           │
│  → Canvas RF state is NOT replaced (guard prevents it)         │
└────────────────────────────────────────────────────────────────┘
```

---

## 11. App Boot & Settings

### Boot Sequence

```
main.tsx executes
  │
  ├─ 1. Early theme patch (synchronous, before React mounts):
  │      const theme = localStorage.getItem('theme')
  │      if (theme) document.documentElement.setAttribute('data-theme', theme)
  │      → Prevents theme flash on page load
  │
  ├─ 2. BroadcastChannel listener registered:
  │      new BroadcastChannel('archflow-sync').onmessage = ...
  │
  ├─ 3. React renders:
  │      <QueryClientProvider client={queryClient}>
  │        <App />
  │      </QueryClientProvider>
  │
  └─ 4. App.tsx calls useLoadAppSettings() (once on mount):
         db.settings.toArray()
           → For each row:
               'theme'          → setTheme(), update data-theme attr
               'inspectorWidth' → setInspectorWidth()
               'sidebarWidth'   → setSidebarWidth()
```

### Settings Write Flow

```
User changes theme (ThemeToggle click)
  │
  ├─ settingsStore.setTheme('dark')
  │    → updates Zustand store
  │    → localStorage.setItem('theme', 'dark')       ← flash prevention on next load
  │    → document.documentElement.setAttribute(...)   ← immediate visual update
  │    → db.settings.put({ key: 'theme', value: '"dark"' })  ← persisted to IDB
  │
  └─ All components reading settingsStore.theme re-render
```

---

## 12. Project List Flow

**File:** `src/pages/ProjectList/useProjectList.ts`

```
Load:
  useEffect → db.projects.orderBy('updatedAt').reverse().toArray()
            → setProjects(rows)
  [Direct Dexie call — not via TanStack Query]

Create:
  handleCreate({ name, description })
    → id = crypto.randomUUID()
    → db.projects.add({ id, name, description, createdAt, updatedAt })
    → closeModal()
    → navigate(`/editor/${id}`)

Delete:
  handleDelete(id)
    → window.confirm()
    → db.projects.delete(id)
    → db.nodes.where('projectId').equals(id).delete()
    → db.edges.where('projectId').equals(id).delete()
    → loadProjects()  ← re-fetch from IDB
```

---

## 13. Cache Invalidation Strategy

```
┌──────────────────────────────────────────────────────────────────────┐
│  Mutation          │  Invalidates                                    │
├────────────────────┼─────────────────────────────────────────────────┤
│  useCreateNode     │  QUERY_KEYS.nodes(projectId)                    │
│  useUpdateNode     │  QUERY_KEYS.nodes(projectId)                    │
│                    │  QUERY_KEYS.node(id)                            │
│  useDeleteNode     │  QUERY_KEYS.nodes(projectId)                    │
│                    │  QUERY_KEYS.node(id)                            │
│  useDeleteNodes    │  QUERY_KEYS.nodes(projectId)                    │
│  BroadcastChannel  │  ALL queries (queryClient.invalidateQueries())  │
└────────────────────┴─────────────────────────────────────────────────┘
```

### Why RF State Isn't Replaced on Invalidation

`useCanvas` has a `initialLoadDone` ref guard on the node-loading `useEffect`. Even though `nodeRows` (from TanStack Query) updates after cache invalidation, the effect short-circuits. This means:

- ✅ IDB is always up to date
- ✅ TanStack Query cache is always fresh
- ✅ Other tabs get the latest data via invalidation
- ✅ The current tab's RF state (positions, selections, resize handles) is never reset mid-session

---

## 14. End-to-End Flow Examples

### Example A: User adds a field to an Entity

```
1. User clicks Entity node on canvas
   canvasStore.setSelectedNode('entity-1')

2. RightSidebar → InspectorPanel → EntityInspector renders
   useEntityInspector:
     rfNode = useNodes().find('entity-1')
     node   = rfNode.data  (the EntityNode object)

3. User clicks "Add Field", types 'email' (type STRING)
   handleAddField() calls applyUpdate()

4. applyUpdate():
   a) Compute updated = { ...node, fields: [...node.fields, newField] }
   b) setNodes(nodes.map(n => n.id === 'entity-1' ? {...n, data: updated} : n))
      → Canvas re-renders immediately with new field ✓
   c) debouncedWrite(updated) ← 300ms

5. After 300ms debounce:
   writeToIDB(updated)
     → updateNode mutation
     → db.nodes.update('entity-1', { data: JSON.stringify(updated) })
     → onSuccess: invalidate QUERY_KEYS.nodes(projectId)

6. syncDTOs(updated):
   syncEntityFieldsToDTOs('entity-1', updated, allEdges, rfNodes)
     → Finds DTO 'dto-1' connected via DERIVED_FROM edge
     → updatedDto = { ...dto-1, fields: [...dto-1.fields, mappedEmailField] }
   → setNodes(nodes.map update for 'dto-1')     ← canvas updates ✓
   → debouncedWriteDTO(updatedDto)
       → db.nodes.update('dto-1', { data: JSON.stringify(updatedDto) })

7. BroadcastChannel notifies other tabs
   → Other tabs invalidate all caches
   → Re-fetch nodes from IDB
   → DTO node in other tab shows 'email' field ✓
```

### Example B: User draws Entity → Table connection

```
1. User drags connection from EntityNode 'entity-1' to TableNode 'table-1'

2. ReactFlow fires onConnect({ source: 'entity-1', target: 'table-1' })

3. handleConnect() detects isEntityTablePair = true

4. Guards check:
   - entity-1 not already connected to a table ✓
   - table-1 not already connected to an entity ✓

5. applyStoredInEdge(entityNode, tableNode):
   updatedTable = {
     ...tableNode,
     entityId:  'entity-1',
     tableName: 'users'  ← copied from entity.tableName
   }

6. Persist:
   await db.edges.add({
     id: 'edge-123', fromNodeId: 'entity-1', toNodeId: 'table-1',
     type: 'STORED_IN', projectId, ...
   })
   await db.nodes.update('table-1', {
     data: JSON.stringify(updatedTable)
   })

7. BroadcastChannel.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId })
   BroadcastChannel.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId })

8. setRfEdges([...edges, { id: 'edge-123', source: 'entity-1', target: 'table-1',
                            type: 'storedIn', data: edgeRow }])

9. setRfNodes(nodes.map(n =>
     n.id === 'table-1' ? { ...n, data: updatedTable } : n
   ))
   → Canvas shows blue STORED_IN edge ✓
   → TableNode shows 'Teacher' badge in ENTITY row ✓

10. TableInspector (if open):
    useNodes() returns updated table → connectedEntity computed from node.entityId ✓
    Connections section shows 'Teacher' ENTITY row ✓
```

### Example C: App reload — canvas restores from IDB

```
1. User navigates to /editor/project-abc

2. useEditor:
   db.projects.get('project-abc') → setProject()
   projectStore.setActiveProject('project-abc')

3. useGetNodes('project-abc') executes:
   queryFn: db.nodes.where('projectId').equals('project-abc').toArray()
   → Returns NodeRow[] (nodeRows)
   → TanStack Query caches at QUERY_KEYS.nodes('project-abc')

4. useCanvas useEffect fires (initialLoadDone.current = false):

   a) Migration check:
      Any DBNode with customQueries? → split into DBNode + TableNode
      Reload allRows from IDB

   b) TableNode msId backfill:
      TableNodes without msId → infer from linked DB's msId → persist

   c) Sort: MICROSERVICE rows first (parentId resolution)

   d) Map each row to RF node:
      MICROSERVICE → { type: 'microservice', dragHandle: '.ms-drag-handle', style: {w,h} }
      ENTITY       → { type: 'entity', parentId: data.msId, extent: 'parent' }
      DTO          → { type: 'dto',    parentId: data.msId, extent: 'parent' }
      DB           → { type: 'db',     parentId: data.msId, extent: 'parent' }
      TABLE        → { type: 'table',  parentId: data.msId, extent: 'parent' }

   e) setRfNodes(rfNodesFromIDB)
      initialLoadDone.current = true

5. Edge load useEffect fires (initialEdgesLoadDone.current = false):
   db.edges.where('projectId').equals('project-abc').toArray()
   → Skip legacy STORED_IN edges pointing to DBNode
   → Map each EdgeRow to RF edge with correct type string ('storedIn' | 'connectsTo' | 'derivedFrom')
   → setRfEdges(rfEdgesFromIDB)
   initialEdgesLoadDone.current = true

6. Canvas renders with all nodes and edges restored ✓
```

---

## Key Files Reference

| File | Role |
|---|---|
| `src/db/db.ts` | Dexie schema, table definitions, singleton `db` export |
| `src/main.tsx` | QueryClient config, BroadcastChannel listener, early theme patch |
| `src/App.tsx` | `useLoadAppSettings()` call, router setup |
| `src/constants/queryKeys.ts` | Query key factory — single source of truth for all cache keys |
| `src/service/node/useGetNodes.ts` | `useQuery` over `db.nodes` |
| `src/service/node/useCreateNode.ts` | `useMutation` → `db.nodes.add` |
| `src/service/node/useUpdateNode.ts` | `useMutation` → `db.nodes.update` |
| `src/service/node/useDeleteNode.ts` | `useMutation` → `db.nodes.delete` |
| `src/store/canvasStore.ts` | `selectedNodeId`, `selectedEdgeId`, pan, zoom |
| `src/store/projectStore.ts` | `activeProjectId` |
| `src/store/settingsStore.ts` | theme, panel widths — with localStorage sync |
| `src/pages/Editor/useEditor.ts` | Load project on route enter, set `activeProjectId` |
| `src/pages/Editor/components/Canvas/useCanvas.ts` | Core canvas: load, connect, drag, drop, keyboard |
| `src/pages/Editor/components/InspectorPanel/components/*/use*Inspector.ts` | Node editing with debounced IDB writes |
| `src/utils/autoPopulate.ts` | `applyDerivedFromEdge`, `applyStoredInEdge`, `applyConnectsToEdge`, `syncEntityFieldsToDTOs` |
| `src/utils/node.ts` | Node factory functions with full defaults |
| `src/sw/sw.ts` | Service worker BroadcastChannel relay |
| `src/hooks/useLoadAppSettings.ts` | App-boot IDB → Zustand hydration |
