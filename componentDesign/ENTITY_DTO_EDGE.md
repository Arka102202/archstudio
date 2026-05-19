# Entity ↔ DTO Edge — Design & Build Specification

> Claude Code: read this in full before writing a single line.
> Follow every rule in CLAUDE.md alongside this document.
> This step builds ONLY the edge between EntityNode and DTONode.
> No other edge types. No other auto-population rules.

---

## 1. What This Step Builds

- Drawing an edge between any EntityNode and any DTONode
- The edge is typed `DERIVED_FROM` regardless of which direction the user draws it
- Auto-population: entity fields sync into the DTO when connected
- Live sync: adding or editing fields on the Entity pushes changes to all connected DTOs
- One edge rule: only one edge between any Entity–DTO pair
- Double-click edge to delete it
- Visual direction arrow on the edge
- Edge info shown in both node inspectors
- Full IDB persistence for edges

---

## 2. Edge Type and Direction

### Edge type

The edge between Entity and DTO is always `EdgeType.DERIVED_FROM`.

It does not matter which node the user starts dragging from.
Both directions produce the same `DERIVED_FROM` edge.

### Canonical direction

Despite allowing drawing from either direction, the edge is **always stored** as:

```
fromNodeId = DTONode.id
toNodeId   = EntityNode.id
```

Reason: the semantic reads "DTO is derived FROM Entity" — the DTO is the source of the arrow in the `DERIVED_FROM` relationship. When the user draws from Entity → DTO, swap the IDs before storing.

The visual arrow on the canvas always points **Entity → DTO** (i.e. from `toNodeId` toward `fromNodeId` in storage terms) to communicate "fields flow from Entity into DTO".

### Normalisation on connect

In `onConnect` handler in `useCanvas.ts`:

```
1. Identify which end is Entity and which is DTO
   - Get the RF node for connection.source and connection.target
   - Check node.data.type

2. If source is EntityNode and target is DTONode:
   - fromNodeId = target (DTO)  ← canonical storage direction
   - toNodeId   = source (Entity)

3. If source is DTONode and target is EntityNode:
   - fromNodeId = source (DTO)
   - toNodeId   = target (Entity)

4. If neither end is an Entity+DTO pair → do nothing (not handled in this step)
```

---

## 3. One Edge Rule

Before creating any edge, check IDB (and current RF edges) for an existing edge
between the same Entity and DTO:

```
const alreadyExists = rfEdges.some(e =>
  (e.source === dtoId && e.target === entityId) ||
  (e.source === entityId && e.target === dtoId)
)
if (alreadyExists) return   // silently ignore, no error shown
```

---

## 4. Auto-Population on Connect

When a valid Entity↔DTO edge is created, run auto-population immediately.

### Step 1 — Copy fields from Entity into DTO

Convert each `EntityField` from the Entity into a `DTOField`:

```
EntityField → DTOField
  id:            generateId()             ← new ID for the DTO field
  name:          entityField.name
  type:          entityField.type
  validations:   []                       ← start empty, user adds later
  serialization: {
    jsonProperty:   '',
    jsonIgnore:     false,
    includeNonNull: false,
  }
```

Do NOT copy PK fields (where `entityField.constraint === FieldConstraint.PK`).
PK is an internal implementation detail that DTOs do not expose.

Merge strategy: do not replace all DTO fields blindly.
- For each entity field: if a DTO field with the same `name` already exists, skip it (preserve any customisations the user has made to that DTO field).
- Only add entity fields that are not yet present by name in `dto.fields`.

### Step 2 — Set origin and entitySources

```
dto.origin = DTOOrigin.DERIVED
dto.entitySources = [
  ...dto.entitySources,        ← keep existing sources for other connected entities
  {
    entityId:      entity.id,
    includeFields: [],           ← empty = include all
    excludeFields: [],
  }
]
```

### Step 3 — Set purpose (if not already set by user)

Apply purpose logic based on how many entities this DTO is now connected to:

```
const totalConnected = updatedEntitySources.length

if (totalConnected === 1) {
  // First entity connection — default to RESPONSE
  // Only set this if the user hasn't already chosen a purpose
  // (purpose defaults to RESPONSE on creation, so this is usually a no-op)
  dto.purpose = DTOPurpose.RESPONSE
}
```

Do **not** force a REQUEST purpose based on connection count —
that is the old CLAUDE.md behaviour and is too opinionated.
Let the user choose purpose from the inspector at any time.

### Step 4 — Update nodes in IDB and RF state

```
1. Update the DTO node (new fields, new origin, new entitySources)
   → db.nodes.update(dto.id, { data: JSON.stringify(updatedDto), updatedAt: now })
   → setNodes(nodes => nodes.map(n => n.id === dto.id ? { ...n, data: updatedDto } : n))

2. Store the edge in IDB and RF state (see Section 8)
```

---

## 5. Live Sync — Entity Field Changes Push to DTOs

When the user **adds, edits, or removes a field on an EntityNode** while an edge to a DTO exists,
those changes must propagate to the connected DTO.

This is the key behaviour: "any change in the entity must carry forward to the connected DTO."

### Where to hook this

In `useEntityInspector.ts`, after every field mutation (add, remove, type change, name change),
call a utility function `syncEntityFieldsToDTOs` from `src/utils/autoPopulate.ts`.

### `syncEntityFieldsToDTOs` signature

```typescript
export function syncEntityFieldsToDTOs(
  entityId: string,
  updatedEntity: EntityNode,
  allRFEdges: RFEdge[],
  allRFNodes: RFNode[],
): UpdatedDTOMap
```

Where `UpdatedDTOMap = Record<string, DTONode>` — a map of DTO id → updated DTONode.

### Sync logic

```
1. Find all edges where toNodeId === entityId (remember: DTO→Entity is canonical)
2. For each such edge, find the connected DTONode from allRFNodes
3. For each connected DTO:

   FIELD ADDED:
   - If DTO already has a field with this name → skip
   - If field is PK → skip
   - Else → append new DTOField (same conversion as Section 4 Step 1)

   FIELD REMOVED:
   - If DTONode.origin === DTOOrigin.DERIVED:
       Remove the DTO field matching the entity field name
   - If DTONode.origin === DTOOrigin.CUSTOM:
       Do NOT remove — user has customised this DTO, respect their changes

   FIELD TYPE CHANGED:
   - If DTO has a field with this name AND DTONode.origin === DTOOrigin.DERIVED:
       Update the DTO field type to match

   FIELD NAME CHANGED:
   - This is a rename. Find the old name in DTO fields and rename it.
   - Only rename if DTONode.origin === DTOOrigin.DERIVED

4. Return the map of updated DTOs
```

### Applying sync results

After `syncEntityFieldsToDTOs` returns, in `useEntityInspector.ts`:

```
for each [dtoId, updatedDto] in UpdatedDTOMap:
  setNodes(nodes => nodes.map(n => n.id === dtoId ? { ...n, data: updatedDto } : n))
  debouncedUpdate(dtoId, updatedDto)  // 300ms debounce to IDB
```

### Origin and "becomes CUSTOM" rule

The user's rule: "if I manipulate the number of fields then it becomes CUSTOM."

Implement this in `useDTOInspector.ts`:
- `handleAddField` — if called by the user manually: set `dto.origin = DTOOrigin.CUSTOM`
- `handleRemoveField` — if called by the user manually: set `dto.origin = DTOOrigin.CUSTOM`

Once a DTO becomes CUSTOM:
- Live sync from Entity will still **add new fields** (in case the entity gains new ones)
- But live sync will **not remove or rename** existing DTO fields

This matches the rule: the user has "taken over" field definitions but the DTO still receives new additions from the entity.

---

## 6. Edge Deletion

### Double-click to delete

React Flow fires `onEdgeDoubleClick` when the user double-clicks an edge.

In `useCanvas.ts`:

```typescript
const onEdgeDoubleClick = useCallback((_event: React.MouseEvent, edge: RFEdge) => {
  // Only handle DERIVED_FROM edges here
  if (edge.data?.type !== EdgeType.DERIVED_FROM) return
  handleDeleteEdge(edge.id)
}, [])
```

`handleDeleteEdge(edgeId: string)`:
```
1. Find the edge in rfEdges to get dtoId and entityId
2. db.edges.delete(edgeId)
3. setEdges(edges => edges.filter(e => e.id !== edgeId))
4. Post BroadcastChannel sync message

5. Update the DTO node:
   - Remove the matching entitySource from dto.entitySources
   - If dto.entitySources becomes empty → set dto.origin = DTOOrigin.CUSTOM
   - Do NOT remove fields — user keeps the fields they had
   - Update DTO in IDB and RF state
```

Register in Canvas.tsx: `onEdgeDoubleClick={onEdgeDoubleClick}`

---

## 7. Visual Edge Styling

### Custom edge component

Create a custom RF edge to display the direction arrow and the edge label.

```
src/components/edges/DerivedFromEdge/
├── DerivedFromEdge.tsx
├── useDerivedFromEdge.ts
├── types.ts
└── index.ts
```

Register in Canvas.tsx:

```typescript
import { DerivedFromEdge } from '@components/edges/DerivedFromEdge'

const EDGE_TYPES = {
  derivedFrom: DerivedFromEdge,
} as const
```

Pass to `<ReactFlow edgeTypes={EDGE_TYPES} />`.

When storing the RF edge, set `type: 'derivedFrom'`.

### Visual design

The edge itself:

```
stroke:       var(--node-dto-accent)   ← teal/cyan colour
strokeWidth:  1.5px
opacity:      0.8
```

Selected state:
```
stroke:       var(--node-dto-accent)
strokeWidth:  2.5px
opacity:      1.0
```

Arrow marker (shows direction Entity → DTO, i.e. "fields flow this way"):
- Use RF's `MarkerType.ArrowClosed` at the DTO end of the edge
- Marker fill: `var(--node-dto-accent)`
- Size: `width: 12, height: 12`

Label in the middle of the edge:
- Text: `DERIVED FROM`
- `className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm bg-surface border border-[var(--color-border)]"`
- `style={{ color: 'var(--node-dto-accent)' }}`

Double-click hint: show a small `×` icon near the label when the edge is hovered.
- When hovered: `×` appears next to the label
- Clicking `×` calls `handleDeleteEdge`
- This supplements the double-click (which some users may not discover on their own)

### useDerivedFromEdge.ts

Returns:
```typescript
{
  isHovered,       // boolean
  setIsHovered,    // (v: boolean) => void
  handleDelete,    // () => void — calls back to canvas via a prop or direct store call
}
```

### DerivedFromEdge.tsx

Uses RF's `BaseEdge` + `EdgeLabelRenderer` from `@xyflow/react`.

```tsx
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react'

// Compute the path
const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, ... })

return (
  <>
    <BaseEdge
      path={edgePath}
      markerEnd={markerEnd}
      style={{ stroke: 'var(--node-dto-accent)', strokeWidth: isSelected ? 2.5 : 1.5 }}
    />
    <EdgeLabelRenderer>
      <div
        style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        className="absolute pointer-events-auto"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onDoubleClick={handleDelete}
      >
        <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm bg-surface border border-[var(--color-border)]"
              style={{ color: 'var(--node-dto-accent)' }}>
          DERIVED FROM
          {isHovered && (
            <span className="ml-1 cursor-pointer opacity-60 hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); handleDelete() }}>
              ×
            </span>
          )}
        </span>
      </div>
    </EdgeLabelRenderer>
  </>
)
```

---

## 8. IDB Persistence — Edges

### Schema

The `edges` table is already defined in `src/db/db.ts`:

```
id:         string  primary key
projectId:  string
fromNodeId: string   ← always DTONode.id
toNodeId:   string   ← always EntityNode.id
type:       string   'DERIVED_FROM'
label:      string   'DERIVED_FROM'
```

### Load on canvas mount

In `useCanvas.ts`, after loading nodes, also load edges:

```typescript
const edgeRows = await db.edges
  .where('projectId').equals(projectId)
  .toArray()

const rfEdges: RFEdge[] = edgeRows.map(row => ({
  id:     row.id,
  source: row.fromNodeId,
  target: row.toNodeId,
  type:   'derivedFrom',
  data:   row,
  markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--node-dto-accent)' },
}))

setRfEdges(rfEdges)
```

Run auto-population on load? **No.** The DTO's `fields` and `entitySources` are already persisted
with the correct data from when the edge was first created. Do not re-run auto-population on load.
Load the data as-is and trust IDB.

### Write on create

```typescript
await db.edges.add({
  id:         generateId(),
  projectId:  currentProjectId,
  fromNodeId: dtoId,
  toNodeId:   entityId,
  type:       'DERIVED_FROM',
  label:      'DERIVED_FROM',
})
```

### Write on delete

```typescript
await db.edges.delete(edgeId)
```

Also update the DTO node in IDB after removing the entitySource (see Section 6).

### Cross-tab sync

After every edge write (create or delete), post to BroadcastChannel:

```typescript
const bc = new BroadcastChannel('archflow-sync')
bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId })
bc.close()
```

`useCanvas.ts` already reloads all nodes and edges on `idb-changed` event.

---

## 9. Inspector Panel — Edge Info

Both EntityInspector and DTOInspector show connected edges.

### In EntityInspector

Add a **CONNECTIONS** section above the Delete button.

For each DTO connected via a DERIVED_FROM edge, show:

```
CONNECTIONS
→  OrderRequest    RESPONSE     [×]
→  OrderResponse   RESPONSE     [×]
```

Each row:
- Green right arrow `→` (visually: "fields go out to this DTO")
- DTO label
- DTO purpose badge (REQUEST / RESPONSE / BOTH)
- `×` button that calls `handleDeleteEdge(edgeId)` — removes the edge

Use the accent colour of the DTO node type for the arrow: `style={{ color: 'var(--node-dto-accent)' }}`.

Tailwind: `className="flex items-center gap-2 py-1 text-[11px]"`

If no connections: show `className="text-[10px] font-mono text-text-4"` text "No DTOs connected".

### In DTOInspector

Add a **CONNECTIONS** section above the Delete button.

For each Entity connected via a DERIVED_FROM edge, show:

```
CONNECTIONS
←  Order     ENTITY     [×]
←  User      ENTITY     [×]
```

Each row:
- Red left arrow `←` (visually: "fields come in from this Entity")
- Entity label
- Small "ENTITY" badge
- `×` button that removes the edge

Use the entity accent: `style={{ color: 'var(--node-entity-accent)' }}` for the left arrow.

If no connections: "No entities connected".

If `dto.origin === DTOOrigin.DERIVED`:
Also show a muted note below the connections list:
`className="text-[9px] font-mono text-text-4 italic"`, text "Fields synced from connected entities"

If `dto.origin === DTOOrigin.CUSTOM` and `dto.entitySources.length > 0`:
Show: "Fields partially customised"

### How inspectors get edge data

`useEntityInspector.ts` and `useDTOInspector.ts` need access to the current RF edges.

Use the `useEdges()` hook from `@xyflow/react` to read all edges in the current canvas,
filter to those involving the current node's ID.

```typescript
import { useEdges } from '@xyflow/react'

const allEdges = useEdges()
const connectedEdges = allEdges.filter(e =>
  e.source === nodeId || e.target === nodeId
)
```

For deleting an edge from the inspector, the inspector hook needs a `handleDeleteEdge`
function. Pass it down from the canvas store or implement it by calling
`useReactFlow().setEdges()` + `db.edges.delete()` directly from the inspector hook.

---

## 10. Files Changed in This Step

### New files
```
src/components/edges/DerivedFromEdge/
├── DerivedFromEdge.tsx
├── useDerivedFromEdge.ts
├── types.ts
└── index.ts

src/utils/autoPopulate.ts          ← new (stub for now, only syncEntityFieldsToDTOs)
```

### Updated files
```
src/pages/Editor/components/Canvas/Canvas.tsx
  → add EDGE_TYPES const with DerivedFromEdge
  → pass edgeTypes to <ReactFlow>
  → pass onEdgeDoubleClick to <ReactFlow>

src/pages/Editor/components/Canvas/useCanvas.ts
  → implement onConnect with guard + normalisation
  → implement onEdgeDoubleClick → handleDeleteEdge
  → load edges from IDB on mount
  → write edges to IDB on create/delete

src/pages/Editor/components/InspectorPanel/components/EntityInspector/useEntityInspector.ts
  → call syncEntityFieldsToDTOs after every field mutation
  → add CONNECTIONS section data

src/pages/Editor/components/InspectorPanel/components/EntityInspector/EntityInspector.tsx
  → render CONNECTIONS section

src/pages/Editor/components/InspectorPanel/components/DTOInspector/useDTOInspector.ts
  → add CONNECTIONS section data
  → set origin = CUSTOM when user manually adds/removes a field

src/pages/Editor/components/InspectorPanel/components/DTOInspector/DTOInspector.tsx
  → render CONNECTIONS section
```

---

## 11. `src/utils/autoPopulate.ts`

Create this file now. It will grow as more edge types are added in later steps.
For this step, implement only `syncEntityFieldsToDTOs`.

```typescript
// src/utils/autoPopulate.ts
// Auto-population utilities. Called after edge creation and node field changes.
// Each function is pure — takes current state, returns updated state.
// The caller is responsible for writing to IDB and updating RF state.
```

Exports needed in this step:
- `syncEntityFieldsToDTOs(entityId, updatedEntity, allRFEdges, allRFNodes): UpdatedDTOMap`
- `applyDerivedFromEdge(dtoNode, entityNode): DTONode` — applies initial field copy on edge creation

Export from `src/utils/index.ts`.

---

## 12. Styling Rules

1. **Tailwind first.** All layout, spacing, typography via Tailwind.
2. **Inline `style` only for dynamic JS values** or CSS variables used as colours.
3. **Never hardcode hex.**
4. Edge colour tokens: `var(--node-dto-accent)` (teal/cyan from `index.css`).
5. Arrow colour matches edge stroke.

---

## 13. What This Step Does NOT Build

- No other edge types (Entity→DB, AuthGuard→Controller, etc.)
- No edge between Entity and non-DTO nodes
- No edge between DTO and non-Entity nodes
- No context menu on edges
- No edge label editing
- No edge colour customisation
- No multi-edge selection
- No undo for edge deletion (global undo comes later)

---

## 14. Verification

### TypeScript
```bash
npx tsc --noEmit
```
Zero errors.

### Edge creation

- [ ] Draw edge from EntityNode handle to DTONode → edge appears
- [ ] Draw edge from DTONode handle to EntityNode → edge appears (same result)
- [ ] Edge colour is teal/cyan matching `--node-dto-accent`
- [ ] Arrow points from Entity toward DTO (fields-flow direction)
- [ ] "DERIVED FROM" label is visible in the middle of the edge
- [ ] Hover over edge label → `×` appears
- [ ] Click `×` on hover → edge removed
- [ ] Double-click edge → edge removed

### One-edge rule

- [ ] Try to draw a second edge between the same Entity and DTO → nothing happens

### Auto-population on connect

- [ ] Entity has 3 fields (id PK, name STRING, email STRING) → connect DTO → DTO gains `name` and `email` fields (not `id`)
- [ ] DTO `origin` becomes DERIVED after connection
- [ ] Entity source entry appears in DTOInspector CONNECTIONS section
- [ ] DTOInspector shows `←` red arrow next to entity name

### Live sync

- [ ] Entity connected to DTO → add new field `phone: STRING` to Entity → DTO gains `phone` field automatically
- [ ] Entity connected to DTO → remove field `email` → DTO with `origin=DERIVED` loses `email`
- [ ] Entity connected to DTO → manually add field in DTO inspector → DTO `origin` becomes CUSTOM
- [ ] DTO is CUSTOM → remove `email` from Entity → DTO keeps `email` (origin was overridden)
- [ ] DTO is CUSTOM → add new field `phone` to Entity → DTO gains `phone` (new additions still sync)

### Multiple entities

- [ ] Connect two EntityNodes to one DTO → both entity sources listed in DTOInspector
- [ ] Fields from both entities are merged into the DTO
- [ ] Disconnect one entity → its entitySource is removed, DTO fields are kept

### Edge deletion

- [ ] Delete edge → DTONode `entitySources` loses that entity entry
- [ ] Delete all edges to a DTO → DTO `origin` reverts to CUSTOM

### Inspector info

- [ ] EntityInspector CONNECTIONS section shows all connected DTOs with `→` green arrow
- [ ] DTOInspector CONNECTIONS section shows all connected Entities with `←` red arrow
- [ ] Click `×` in inspector CONNECTIONS row → edge removed from canvas and IDB
- [ ] After edge removal, inspector CONNECTIONS section updates immediately

### IDB persistence

- [ ] Create edge → refresh page → edge still exists on canvas
- [ ] DTO fields still populated after refresh
- [ ] DTO `origin === DERIVED` after refresh
- [ ] Delete edge → refresh → edge is gone
- [ ] Add field to Entity while DTO connected → refresh → DTO has the new field
- [ ] Two browser tabs → create edge in Tab 1 → Tab 2 updates within ~1 second
