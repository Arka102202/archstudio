# EntityNode — Design & Build Specification

> Claude Code: read this in full before writing a single line.
> Follow every rule in CLAUDE.md alongside this document.
> The MicroserviceNode must exist on the canvas before any EntityNode can be added.

---

## 1. What Is the EntityNode

The EntityNode is the **source of truth for data shape** inside a microservice.
Every other data-related node — DTO, Service, Repository — derives its shape from the Entity.
You define the Entity once; everything else follows from it.

Each EntityNode lives **inside** a MicroserviceNode. It cannot exist on the canvas alone.

---

## 2. Visual Anatomy

```
┌──────────────────────────────────┐  ← border: var(--node-entity-accent) when selected
│                                  │
│  [E]  Order             orders   │  ← HEADER: icon · label · tableName
│                                  │
├──────────────────────────────────┤
│  id          UUID       [PK]     │  ← FIELDS
│  userId      UUID       [FK]     │
│  total       Decimal             │
│  status      Enum                │
│  ─────────────────────────────   │
│  + createdAt · updatedAt         │  ← auditing row (if config.auditing)
│  + deletedAt                     │  ← soft delete row (if config.softDelete)
└──────────────────────────────────┘
```

| Section | Content |
|---|---|
| Header | Icon square + label (large) + tableName (muted mono, right-aligned) |
| Fields | One row per field: name · type · optional constraint badge |
| Auditing row | Shown when `config.auditing = true` |
| Soft delete row | Shown when `config.softDelete = true` |

Minimum size: **w 200, h 140**. No maximum.

---

## 3. Data Model

`EntityNode` extends `BaseNode`. The full interface is already defined in
`src/entity/EntityNode.ts` as part of CLAUDE.md's canonical entity layer.
Build that file now if it does not already exist. Do not redefine the types here.

Refer to CLAUDE.md for the exact interface. Key fields for this step:

```
EntityNode
  tableName:   string
  fields:      EntityField[]
  relations:   Relation[]       ← not used in this step, persist as empty []
  config:      EntityConfig
    softDelete:         boolean
    auditing:           boolean   ← default true
    lombokStyle:        LombokStyle
    generateRepository: boolean   ← default true

EntityField
  id:           string
  name:         string
  type:         JavaType
  constraint:   FieldConstraint   (PK | FK | UNIQUE | NONE)
  nullable:     boolean
  columnName:   string
  defaultValue: string
  enumValues:   EnumValues | null  (only when type === ENUM)

EnumValues
  values:           string[]
  columnDefinition: string
```

Every new `EntityNode` must include one default field:
```
{ id: generateId(), name: 'id', type: JavaType.UUID, constraint: FieldConstraint.PK,
  nullable: false, columnName: 'id', defaultValue: '', enumValues: null }
```

---

## 4. Default Values

`createEntityNode()` in `src/utils/node.ts`:

```
id:        generateId()
type:      NodeType.ENTITY
label:     'Entity'
tableName: 'entities'
position:  { x: 0, y: 0 }       ← overridden on placement
size:      { w: 220, h: 180 }
aiPrompt:  emptyAIPrompt()
fields:    [ default id field ]
relations: []
config:
  softDelete:         false
  auditing:           true
  lombokStyle:        LombokStyle.BOTH
  generateRepository: true
```

---

## 5. Entity Type File

If `src/entity/EntityNode.ts` does not exist yet, create it now.
If `src/entity/shared.ts` (with `BaseNode`, `NodeType`, `Position`, `Size`) does not exist, create it first.
If `src/entity/AIPrompt.ts` does not exist, create it.
Update `src/entity/index.ts` to barrel-export everything.

**Do not skip this.** The canvas component and inspector both import from `@entity`.

---

## 6. Factory

Add `createEntityNode(overrides?: Partial<EntityNode>): EntityNode` to
`src/utils/node.ts`. Pattern is the same as `createMicroserviceNode`.

Export it from `src/utils/index.ts`.

---

## 7. How EntityNodes Are Added

Two ways — both must work:

### Way 1 — Drag from left sidebar

The Entity palette item in `LeftSidebar` must be draggable.
When dropped onto a MicroserviceNode's body area, a new EntityNode is created
inside that microservice at the drop position.

**Implementation:**
- The palette item has `draggable={true}` and sets `event.dataTransfer.setData('nodeType', 'entity')` on `dragStart`
- The Canvas component handles `onDrop` from React Flow: reads the `nodeType` from `dataTransfer`, converts the screen position to canvas position using `screenToFlowPosition`, creates the node, and calls `useCreateNode`
- The Canvas component must have `onDragOver={(e) => e.preventDefault()}` to allow drops

**Guard:** before creating the node, check that at least one MicroserviceNode exists in the current project's RF nodes. If none exists, ignore the drop and show no feedback (the palette item is already visually disabled).

### Way 2 — Click palette item when a MicroserviceNode is selected

If `canvasStore.selectedNodeId` points to a MicroserviceNode:
- Clicking the Entity palette item in `LeftSidebar` creates a new EntityNode
- Position: centre of the canvas viewport
- The palette item calls `handleAddNode('entity')` in `useLeftSidebar`

**Guard:** Entity palette item is **only clickable** when at least one MicroserviceNode exists on the canvas. If no MicroserviceNode exists:
- Entity item shows `opacity-40 cursor-not-allowed pointer-events-none`
- A tooltip or title: "Add a microservice first"

If a MicroserviceNode exists but is not selected:
- Entity item is clickable
- The node is added to the **first** MicroserviceNode in the RF nodes list (or the most recently created one — use the last in the array)
- This is a reasonable default; the user can move it later

If a MicroserviceNode **is** selected:
- Entity item is clickable
- The node is added to the selected microservice

### Position on creation

- Drag: use the exact drop coordinates (converted from screen to canvas space)
- Click: place at a staggered offset based on how many EntityNodes already exist in the target microservice — `{ x: 20 + (count % 4) * 240, y: 60 + Math.floor(count / 4) * 200 }` — so nodes tile across the canvas instead of stacking

---

## 8. Canvas Node Component

### File structure

```
src/components/nodes/EntityNode/
├── EntityNode.tsx
├── useEntityNode.ts
├── types.ts
└── index.ts
```

### types.ts

```typescript
import type { NodeProps } from '@xyflow/react'
import type { EntityNode } from '@entity'

export interface EntityNodeProps extends NodeProps {
  data: EntityNode
}
```

### useEntityNode.ts

**Returns:**
```typescript
{
  node,          // EntityNode — from props.data
  isSelected,    // boolean — canvasStore.selectedNodeId === props.id
  handleClick,   // () => void — canvasStore.setSelectedNode(id)
}
```

No IDB calls. No mutations. Read-only display hook.

### EntityNode.tsx

Styling rule: **Tailwind utility classes only**. Use inline `style` only for
dynamic values that cannot be expressed as Tailwind classes
(e.g. a colour that comes from a JS variable). Everything else is Tailwind.

**Root div:**
```
className="relative bg-surface rounded-[var(--radius-md)] shadow-node
           border transition-all duration-150 select-none"
style={{
  borderColor: isSelected
    ? 'var(--node-entity-accent)'
    : 'var(--color-canvas-node-border)',
  boxShadow: isSelected
    ? '0 0 0 2px var(--node-entity-accent)22'
    : undefined,
}}
```

**`NodeResizer`** — first child inside root:
```tsx
<NodeResizer
  minWidth={200}
  minHeight={140}
  isVisible={isSelected}
  lineStyle={{ border: '1.5px solid var(--node-entity-accent)' }}
  handleStyle={{ background: 'var(--node-entity-accent)', border: 'none', width: 8, height: 8 }}
/>
```

**Header** — `className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)]"`:
- Icon square: `className="w-6 h-6 rounded-[var(--radius-sm)] flex items-center justify-center text-[9px] font-bold font-mono flex-shrink-0"`, `style={{ background: 'var(--node-entity-icon-bg)', color: 'var(--node-entity-icon-fg)' }}`, text "E"
- Label: `className="text-[13px] font-bold text-text flex-1 leading-none"`, text `node.label`
- Table name: `className="text-[9px] font-mono text-text-3 flex-shrink-0"`, text `node.tableName`

**Fields list** — `className="px-3 py-2 flex flex-col gap-[3px]"`:

Each field row: `className="flex items-center gap-2 min-w-0"`:
- Name: `className="text-[11px] font-mono text-text-2 flex-1 truncate"`, text `field.name`
- Type: `className="text-[10px] font-mono text-text-3 flex-shrink-0"`, text `field.type`
- Constraint badge (only when constraint !== NONE):
  - PK → `className="text-[8px] font-bold px-1 rounded-sm flex-shrink-0"`, `style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}`
  - FK → same but `var(--color-success-light)` / `var(--color-success)`
  - UNIQUE → `var(--color-warning-light)` / `var(--color-warning)`

**Auditing row** (render only when `node.config.auditing`):
Divider: `className="border-t border-[var(--color-border)] my-1"`
Row: `className="text-[9px] font-mono text-text-4 italic px-1"`, text `+ createdAt · updatedAt`

**Soft delete row** (render only when `node.config.softDelete`):
Row: `className="text-[9px] font-mono italic px-1"`, `style={{ color: 'var(--color-danger)' }}`, text `+ deletedAt`

---

## 9. Register in Canvas

In `src/pages/Editor/components/Canvas/Canvas.tsx`, add `EntityNode` to `NODE_TYPES`:

```typescript
import { MicroserviceNode } from '@components/nodes/MicroserviceNode'
import { EntityNode }       from '@components/nodes/EntityNode'

const NODE_TYPES = {
  microservice: MicroserviceNode,
  entity:       EntityNode,
} as const
```

Also wire up `onDrop` and `onDragOver` handlers in `useCanvas.ts`:

**`onDragOver`**: `(e: React.DragEvent) => e.preventDefault()`

**`onDrop`**: `(e: React.DragEvent) => void`
```
1. e.preventDefault()
2. const nodeType = e.dataTransfer.getData('nodeType')
3. if nodeType !== 'entity' return   (only entity for now)
4. const msNodes = rfNodes.filter(n => n.type === 'microservice')
5. if msNodes.length === 0 return   (guard)
6. const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
7. const targetMs = find the MicroserviceNode whose bounds contain the drop position
   (check: position.x >= ms.position.x && position.x <= ms.position.x + ms.measured.width
       && position.y >= ms.position.y && position.y <= ms.position.y + ms.measured.height)
   If none found: use the first/last MS in the array as fallback
8. const existingCount = rfNodes.filter(n => n.type === 'entity').length
9. const entityNode = createEntityNode({ position })
10. Call useCreateNode mutation → write to IDB
11. Add to RF state via setNodes
```

Return `onDrop` and `onDragOver` from `useCanvas`.

---

## 10. Left Sidebar Updates

### LeftSidebar palette item — Entity

The Entity item in `LeftSidebar` must:

1. Be **enabled** (not dimmed) when at least one MicroserviceNode exists in RF nodes
2. Be **disabled** when no MicroserviceNode exists
3. Support `draggable={true}` with `onDragStart` setting `event.dataTransfer.setData('nodeType', 'entity')`
4. Support `onClick` calling `handleAddNode('entity')` when enabled

In `useLeftSidebar.ts`:

Add to the hook:
- Read `rfNodes` from `useNodes()` (from `@xyflow/react`)
- Derive `hasMicroservice: boolean = rfNodes.some(n => n.type === 'microservice')`
- `handleAddNode(type: string): void`
  - Guard: if `!hasMicroservice` return
  - For `'entity'`:
    - Find the selected MS node first (check `canvasStore.selectedNodeId` against rfNodes)
    - If no MS selected: use last MS in rfNodes
    - Count existing entity nodes
    - Compute staggered position: `{ x: 20 + (count % 4) * 240, y: 60 + Math.floor(count / 4) * 200 }`
    - `createEntityNode({ position })`
    - Call `useCreateNode` mutation
    - Add to RF state via `setNodes`
- `handleDragStart(e: React.DragEvent, type: string): void`
  - `e.dataTransfer.setData('nodeType', type)`
  - `e.dataTransfer.effectAllowed = 'move'`

Update the `NodePaletteItem` in `LeftSidebar.tsx`:
- Pass `hasMicroservice` down as a prop to each item
- The Entity item: `disabled={!hasMicroservice}`, `draggable={hasMicroservice}`, `onDragStart`, `onClick`
- The dimmed style when disabled: `opacity-40 cursor-not-allowed pointer-events-none`

The other 6 node types (DTO, DB, Auth Guard, Controller, Service, API Endpoint) remain disabled with `pointer-events-none` — they have `ready: false` and will be enabled in their own steps.

---

## 11. Inspector Panel — EntityInspector

### File structure

```
src/pages/Editor/components/InspectorPanel/components/EntityInspector/
├── EntityInspector.tsx
├── useEntityInspector.ts
├── types.ts
└── index.ts
```

Wire into `InspectorPanel.tsx`: add `case NodeType.ENTITY: return <EntityInspector nodeId={selectedNodeId} />`.

### Panel anatomy

```
┌──────────────────────────────────────────┐
│ [EntityNode]  badge          sticky top  │  ← header
│ Order                              [×]   │
│ orders                                   │
├──────────────────────────────────────────┤
│ IDENTITY                                 │  ← section 1
│ [label                               ]   │
│ [tableName                           ]   │
├──────────────────────────────────────────┤
│ CONFIG                                   │  ← section 2
│ Auditing (createdAt/updatedAt)  [toggle] │
│ Soft delete (deletedAt)         [toggle] │
│ Generate repository             [toggle] │
│ Lombok style          [BOTH ▼]           │
├──────────────────────────────────────────┤
│ FIELDS                                   │  ← section 3
│  id         UUID   [PK]           [×]    │
│  userId     UUID   [FK]           [×]    │
│  status     Enum   —              [×]    │
│    └ PENDING / CONFIRMED / SHIPPED       │  ← enum values (when type=ENUM)
│                                          │
│  [name    ] [type ▼] [constraint ▼] [+]  │  ← add field row
├──────────────────────────────────────────┤
│ AI PROMPT  ●                             │  ← section 4
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐  │
│   [description textarea 4 rows      ]   │
│   [businessRules textarea 2 rows    ]   │
│   AI generates code          [toggle]   │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘  │
├──────────────────────────────────────────┤
│ [        Delete entity        ]          │  ← section 5
└──────────────────────────────────────────┘
```

### useEntityInspector.ts

**Same optimistic update pattern as every inspector:**
1. `setNodes` (RF) immediately
2. Debounce 300ms → `useUpdateNode` (IDB)
5. Textareas: debounce 500ms

**State:** none in the hook beyond what comes from the node data.

**Handlers:**

Identity:
- `handleLabelChange(value: string)` — updates `label`, live canvas update: header label text
- `handleTableNameChange(value: string)` — updates `tableName`, auto-formats to snake_case on change ("OrderItem" → "order_items"), live canvas update: header tableName

Auto-format for tableName: lowercase, spaces and camelCase boundaries → underscores, append `s` only if user hasn't already done so — keep it simple, just `toLowerCase().replace(/([A-Z])/g, '_$1').replace(/\s+/g, '_').replace(/^_/, '')`.

Config toggles:
- `handleAuditingToggle()` — flips `config.auditing`, live canvas update: auditing row appears/disappears
- `handleSoftDeleteToggle()` — flips `config.softDelete`, live canvas update: deletedAt row appears/disappears
- `handleGenerateRepositoryToggle()` — flips `config.generateRepository`, no canvas update
- `handleLombokStyleChange(value: LombokStyle)` — updates `config.lombokStyle`, no canvas update

Fields:
- `handleAddField(name: string, type: JavaType, constraint: FieldConstraint)` — validates name is non-empty and not duplicate in `fields[]`, appends new `EntityField` with `generateId()`
- `handleRemoveField(fieldId: string)` — removes from `fields[]` — guard: cannot remove the PK field (the one with `constraint === PK`) — show no UI to delete it, or disable the × for PK rows
- `handleFieldTypeChange(fieldId: string, type: JavaType)` — updates field type. If type changes away from ENUM, set `enumValues = null`. If type changes to ENUM, set `enumValues = { values: [], columnDefinition: 'VARCHAR(20)' }`

Enum values (shown inline below the field row when `field.type === JavaType.ENUM`):
- `handleAddEnumValue(fieldId: string, value: string)` — appends to `field.enumValues.values`
- `handleRemoveEnumValue(fieldId: string, index: number)` — removes by index

AI Prompt:
- `handleAIPromptChange(field: keyof AIPrompt, value: string)` — debounce 500ms
- `handleAIGenerateToggle()`

Lifecycle:
- `handleClose()` — `canvasStore.clearSelection()`
- `handleDelete()` — `window.confirm('Delete "${node.label}"? This will also remove DTOs derived from it.')`, on confirm: `useDeleteNode(nodeId)` then `clearSelection()`

### Section 1 — Identity

| Field | Input | Notes |
|---|---|---|
| `label` | text input | Updates canvas header label immediately |
| `tableName` | text input | Auto-converts to snake_case on every keystroke |

### Section 2 — Config

| Field | Control | Default |
|---|---|---|
| Auditing | `<Toggle>` | on |
| Soft delete | `<Toggle>` | off |
| Generate repository | `<Toggle>` | on |
| Lombok style | `<select>` | BOTH |

Lombok style options: `DATA`, `BUILDER`, `BOTH`, `NONE`.

When auditing toggle changes → live canvas update: the auditing row shows/hides immediately.
When soft delete toggle changes → live canvas update: the deletedAt row shows/hides immediately.

### Section 3 — Fields

**Fields list:**
Each row shows: `name · type · constraint badge · × button`

PK field rows: the × button is hidden (PK cannot be removed).
All other fields: × removes the field.

When `field.type === JavaType.ENUM`, expand the row inline to show:
```
  status   Enum   —   [×]
  └ [PENDING] [CONFIRMED] [×]  [add value input] [+]
```
Enum value chips: small, plain style using `bg-surface-alt text-text-2 border border-[var(--color-border)]`.
Each chip has a tiny × to remove it.

**Add field row** (always shown at the bottom of the fields list):
Three inputs in a flex row:
1. Name text input — `placeholder="field name"`, full width (`flex-1`)
2. Type select — all `JavaType` enum values as options
3. Constraint select — `NONE`, `PK`, `FK`, `UNIQUE`
4. "+" button

On submit (+ button or Enter in name input):
- Validate name is not empty and not already in `fields[]`
- Call `handleAddField`
- Clear the name input, reset type to STRING, constraint to NONE

### Section 4 — AI Prompt

Same visual style as MicroserviceNode: gradient box using `--ai-box-*` tokens.

| Textarea | Field | Rows |
|---|---|---|
| Description | `aiPrompt.description` | 4 |
| Business rules | `aiPrompt.businessRules` | 2 |

`aiGenerate` toggle on the right of the header row.

### Section 5 — Delete

Button: "Delete entity"
Style: `bg-[var(--color-danger-light)] text-[var(--color-danger)] border border-[var(--color-danger-border)] rounded-[var(--radius-sm)] w-full py-2 text-[11px] font-semibold`
Confirm message includes warning that derived DTOs will be affected.

---

## 12. Layers Panel Update

The layers list in `LeftSidebar` currently shows only MicroserviceNodes.
Update it to show EntityNodes indented under their parent microservice.

Layout:
```
● Order Service          :8080    ← MicroserviceNode item
  ● Order                         ← EntityNode item, indented
  ● User                          ← EntityNode item, indented
● Payment Service        :8081
```

EntityNode layer items:
- `pl-4` (indented)
- Dot colour: `var(--node-entity-accent)`
- Label: `node.label`, 10px
- No port on the right (entities don't have ports)
- Click: `canvasStore.setSelectedNode(id)`
- Selected state: `bg-[var(--color-accent-light)] text-[var(--color-accent)]`

To determine which microservice an entity belongs to: in this step, simply show all EntityNodes grouped after all MicroserviceNodes sorted by creation order. Proper parent-child grouping via RF `parentId` is a future concern.

---

## 13. IDB Persistence

This section defines exactly how EntityNode data flows between React Flow state and IndexedDB.
Every node that exists on the canvas must survive a page refresh, a browser close, and reopen.

---

### Schema reminder

Nodes are stored in the `nodes` IDB table (defined in `src/db/db.ts`):

```
id:        string   primary key
projectId: string   foreign key → projects.id
type:      string   'ENTITY'
label:     string
position:  { x: number; y: number }
size:      { w: number; h: number }
data:      string   JSON.stringify of the full EntityNode object
createdAt: number
updatedAt: number
```

`data` is the full `EntityNode` object serialised as JSON.
On read: `JSON.parse(row.data) as EntityNode`.
On write: `JSON.stringify(node)`.

---

### Load on canvas mount

When the Editor page mounts and `useCanvas.ts` initialises:

1. Read all nodes for the current project from IDB:
   `db.nodes.where('projectId').equals(projectId).toArray()`

2. For each row, deserialise:
   ```
   const node: EntityNode = JSON.parse(row.data)
   ```

3. Convert each domain node to an RF node:
   ```
   {
     id:       node.id,
     type:     'entity',          // matches NODE_TYPES key
     position: node.position,
     width:    node.size.w,
     height:   node.size.h,
     data:     node,              // full EntityNode stored in data
   }
   ```
   Do the same for MicroserviceNodes (`type: 'microservice'`).

4. Call `setRfNodes(converted)` to populate the canvas.

The canvas should never be empty on refresh if nodes were previously saved.

This logic already exists in `useCanvas.ts` for MicroserviceNodes.
Extend it to also handle `type === 'ENTITY'` rows in the same load pass.
Use `row.type` to decide which RF node type string to assign:
```
'MICROSERVICE' → 'microservice'
'ENTITY'       → 'entity'
```

---

### Write on create

When `handleAddNode('entity')` or `onDrop` fires:

1. `createEntityNode({ position })` — produces a full `EntityNode` object
2. Write to IDB immediately:
   ```
   await db.nodes.add({
     id:        node.id,
     projectId: currentProjectId,
     type:      'ENTITY',
     label:     node.label,
     position:  node.position,
     size:      node.size,
     data:      JSON.stringify(node),
     createdAt: Date.now(),
     updatedAt: Date.now(),
   })
   ```
3. Add to RF state via `setNodes(prev => [...prev, rfNode])`

Do not wait for IDB before updating RF state.
RF state updates first (instant visual feedback), IDB write follows.

Until the TanStack Query service layer is built, call `db.nodes.add()` directly
from `useCanvas.ts`. When the service layer exists, replace with `useCreateNode`.

---

### Write on update (inspector field changes)

Every change in `useEntityInspector.ts` follows this pattern:

```
Step 1 — Instant RF update (no IDB, no debounce):
  setNodes(nodes => nodes.map(n =>
    n.id === nodeId ? { ...n, data: { ...n.data, [field]: value } } : n
  ))

Step 2 — Debounced IDB write (300ms for inputs, 500ms for textareas):
  debouncedUpdate(updatedNode)

  where debouncedUpdate calls:
    db.nodes.update(nodeId, {
      label:     updatedNode.label,
      position:  updatedNode.position,
      size:      updatedNode.size,
      data:      JSON.stringify(updatedNode),
      updatedAt: Date.now(),
    })
```

The `data` column is always the full serialised node — replace it entirely on every update.
Do not try to partially update fields inside the JSON blob.

Until the TanStack Query service layer is built, call `db.nodes.update()` directly.

---

### Write on position/size change (drag and resize)

React Flow fires `onNodesChange` with change events of type `'position'` and `'dimensions'`.

In `useCanvas.ts`, intercept these changes to persist them:

```
onNodesChange fires
  → call setNodes as normal (RF handles the visual update)
  → if change.type === 'position' && change.dragging === false:
      (drag just ended — position is final)
      debounce 100ms → db.nodes.update(change.id, {
        position:  change.position,
        data:      JSON.stringify({ ...existingNode, position: change.position }),
        updatedAt: Date.now(),
      })
  → if change.type === 'dimensions':
      debounce 100ms → db.nodes.update(change.id, {
        size:      { w: change.dimensions.width, h: change.dimensions.height },
        data:      JSON.stringify({ ...existingNode, size: { w, h } }),
        updatedAt: Date.now(),
      })
```

To get `existingNode` from current RF state inside the debounce:
use a `useRef` that mirrors the current nodes array, updated in `onNodesChange`.

---

### Write on delete

When `handleDelete` confirms:

1. `db.nodes.delete(nodeId)` — remove from IDB
2. `setNodes(nodes => nodes.filter(n => n.id !== nodeId))` — remove from RF state
3. `canvasStore.clearSelection()`

Order: IDB delete first, then RF state update. If IDB fails (unlikely), the node
stays on canvas rather than disappearing from view but reappearing on next load.

---

### Cross-tab sync

The `BroadcastChannel('archflow-sync')` is already set up in `src/main.tsx` from Step 2.
The listener has a `TODO Step 5` comment marking where query invalidation goes.

For now — without TanStack Query — implement a simpler direct reload:

In `main.tsx`, replace the `console.debug` in the `bc.onmessage` handler with:
```
window.dispatchEvent(new CustomEvent('idb-changed', { detail: event.data }))
```

In `useCanvas.ts`, listen for this event:
```
useEffect(() => {
  const handler = () => { void loadNodesFromIDB() }
  window.addEventListener('idb-changed', handler)
  return () => window.removeEventListener('idb-changed', handler)
}, [loadNodesFromIDB])
```

After every IDB write in `useCanvas.ts`, post to the channel:
```
const bc = new BroadcastChannel('archflow-sync')
bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId })
bc.close()
```

This means: Tab A adds a node → writes to IDB → posts to channel → Tab B receives → reloads nodes from IDB → Tab B canvas updates.

When TanStack Query is added later, replace the `window.dispatchEvent` and the
direct IDB reloads with `queryClient.invalidateQueries(QUERY_KEYS.nodes(projectId))`.

---

---

## 14. Styling Rules (strict)

1. **Tailwind first.** Every class that can be expressed as a Tailwind utility must be.
2. **Inline `style` only for dynamic JS values.** Theme-based colours that come from CSS variables like `var(--node-entity-accent)` can be used in Tailwind's arbitrary value syntax: `border-[var(--node-entity-accent)]`. But if the value comes from a JavaScript variable (e.g. a palette colour derived from `colorIdx`), use inline style.
3. **Never hardcode hex, rgb, or named colours in components.** Always reference a CSS variable.
4. **Font classes:** `font-mono` (mapped in `@theme` to `var(--font-mono)`) for all technical strings. `font-[var(--font-ui)]` or just default for labels.
5. **No `!important`.** If specificity is a problem, restructure — don't override with `!important`.

---

## 15. What This Step Does NOT Build

- No edges between EntityNode and any other node
- No auto-population (auto-population fires on edge creation — no edges here)
- No relations UI (relations[] is persisted as `[]` and ignored in the inspector)
- No DTO derivation
- No DB custom queries linked to this entity
- No context menu on EntityNode (add that when context menus are built globally)
- No drag-to-reorder fields in the inspector
- No field validation messages (e.g. "name already exists") shown visually — just silently ignore the duplicate

---

## 16. Verification

After building, all of the following must be true:

### TypeScript
```bash
npx tsc --noEmit
```
Zero errors.

### Functionality

- [ ] Entity palette item is dimmed when no MicroserviceNode exists
- [ ] Adding a MicroserviceNode → Entity item becomes active (clickable + draggable)
- [ ] Click Entity item with MS selected → EntityNode appears inside that MS
- [ ] Click Entity item with no MS selected → EntityNode appears in the last MS
- [ ] Drag Entity item from sidebar → drop onto MS body → node appears at drop position
- [ ] Drag Entity item → drop outside any MS → node does not appear
- [ ] Multiple EntityNodes can be added to the same MS
- [ ] EntityNodes from different MS nodes do not interfere
- [ ] EntityNode canvas card shows: icon "E", label, tableName, fields list
- [ ] PK field (id) shows blue [PK] badge
- [ ] Auditing rows appear when `config.auditing = true` (default)
- [ ] Select EntityNode → right panel opens with EntityInspector
- [ ] Change label → canvas header updates immediately, no lag
- [ ] Change tableName → auto-formats to snake_case, canvas updates
- [ ] Toggle auditing off → auditing rows disappear from canvas card
- [ ] Toggle soft delete on → deletedAt row appears on canvas card
- [ ] Add field `userId: UUID FK` → appears in canvas card fields list
- [ ] Change field type to ENUM → enum value sub-row appears in inspector
- [ ] Add enum value "PENDING" → chip appears
- [ ] Remove enum value → chip disappears
- [ ] Cannot delete PK field (no × button on id row)
- [ ] Delete entity → confirm dialog shows → removed from canvas and IDB
- [ ] All changes persist in IDB (check DevTools → IndexedDB → archflow → nodes)
- [ ] Layers panel shows EntityNodes indented under their MS
- [ ] Click layer item → entity selected on canvas, inspector opens

### IDB persistence

- [ ] Refresh the page → all EntityNodes reappear on the canvas exactly where they were
- [ ] Close the browser tab, reopen → nodes are still there
- [ ] Edit a field (e.g. change label) → refresh → new label persists
- [ ] Add a field → refresh → field is still in the node
- [ ] Toggle auditing off → refresh → auditing is still off
- [ ] Move a node (drag) → refresh → node is in its new position
- [ ] Resize a node → refresh → new size is preserved
- [ ] Delete a node → refresh → node does not reappear
- [ ] Open same project in a second tab → add an EntityNode in Tab 1 → Tab 2 canvas updates within 1–2 seconds
