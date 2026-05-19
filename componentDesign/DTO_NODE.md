# DTONode — Design & Build Specification

> Claude Code: read this in full before writing a single line.
> Follow every rule in CLAUDE.md alongside this document.
> A MicroserviceNode must exist on the canvas before any DTONode can be added.
> No edges in this step. No auto-population. Node, inspector, sidebar, IDB only.

---

## 1. What Is the DTONode

The DTONode defines the **data contract** — the shape of data crossing a service boundary.
Every API request body and every API response body is a DTO.

A DTO can be:
- **CUSTOM** — fields defined entirely by hand
- **DERIVED** — fields copied from an Entity (wired via edge in a future step)

Each DTONode lives inside a MicroserviceNode. It cannot exist on the canvas alone.

---

## 2. Visual Anatomy

```
┌─────────────────────────────────┐  ← border: var(--node-dto-accent) when selected
│                                 │
│  [D]  OrderRequest    REQUEST   │  ← HEADER: icon · label · purpose badge
│                                 │
├─────────────────────────────────┤
│  orderId     UUID               │  ← FIELDS
│  quantity    Integer   @NotNull │  ← validation badge when present
│  note        String             │
│                                 │
│  CUSTOM                         │  ← origin badge at bottom
└─────────────────────────────────┘
```

| Section | Content |
|---|---|
| Header | Icon square + label + purpose badge (REQUEST / RESPONSE / BOTH) |
| Fields | One row per field: name · type · first validation badge if any |
| Origin badge | CUSTOM or DERIVED, bottom of card, muted |

Minimum size: **w 200, h 120**. No maximum.

---

## 3. Data Model

`DTONode` extends `BaseNode`. The full interface is defined in `src/entity/DTONode.ts`.
All types are already in CLAUDE.md. Do not redefine them — import from `@entity`.

Key fields:

```
DTONode
  purpose:       DTOPurpose     (REQUEST | RESPONSE | BOTH)
  origin:        DTOOrigin      (DERIVED | CUSTOM)
  entitySources: EntitySource[] ← empty [] in this step, populated by edges later
  fields:        DTOField[]
  config:        DTOConfig
    lombokStyle:       LombokStyle
    validationEnabled: boolean

DTOField
  id:            string
  name:          string
  type:          JavaType
  validations:   Validation[]
  serialization: Serialization
    jsonProperty:   string   (custom JSON key, empty = use field name)
    jsonIgnore:     boolean
    includeNonNull: boolean

Validation
  type:    ValidationType
  value:   string          (e.g. "255" for @Size(max=255))
  message: string
```

---

## 4. Default Values

`createDTONode()` in `src/utils/node.ts`:

```
id:            generateId()
type:          NodeType.DTO
label:         'DTO'
purpose:       DTOPurpose.RESPONSE
origin:        DTOOrigin.CUSTOM
entitySources: []
fields:        []
position:      { x: 0, y: 0 }   ← overridden at placement
size:          { w: 210, h: 140 }
aiPrompt:      emptyAIPrompt()
config:
  lombokStyle:       LombokStyle.BOTH
  validationEnabled: false
```

---

## 5. Entity Type File

If `src/entity/DTONode.ts` does not exist, create it now with the exact types from CLAUDE.md.
Update `src/entity/index.ts` to export everything from it.

All enums it needs — `JavaType`, `LombokStyle`, `DTOPurpose`, `DTOOrigin`, `ValidationType` —
must come from `@entity`, not be redefined locally.

---

## 6. Factory

Add `createDTONode(overrides?: Partial<DTONode>): DTONode` to `src/utils/node.ts`.
Export from `src/utils/index.ts`.

---

## 7. How DTONodes Are Added

Identical pattern to EntityNode. Two ways, same guards.

### Guard

DTO palette item is **enabled** only when at least one MicroserviceNode exists on the canvas.
When disabled: `opacity-40 cursor-not-allowed pointer-events-none`, title "Add a microservice first".

### Way 1 — Drag from left sidebar

- Palette item: `draggable={true}`
- `onDragStart`: `e.dataTransfer.setData('nodeType', 'dto')`, `e.dataTransfer.effectAllowed = 'move'`
- Canvas `onDrop` already handles all `nodeType` values — add `'dto'` case:
  1. Check at least one MS exists → else return
  2. Convert drop position via `screenToFlowPosition`
  3. `createDTONode({ position })`
  4. Write to IDB → add to RF state

### Way 2 — Click palette item

- If `canvasStore.selectedNodeId` points to an MS → add into that MS
- Else → add into the last MS in rfNodes
- Position: stagger within the MS — `{ x: 20 + (count % 4) * 230, y: 60 + Math.floor(count / 4) * 180 }`
  where `count` = existing DTO nodes in the project

---

## 8. Canvas Node Component

### File structure

```
src/components/nodes/DTONode/
├── DTONode.tsx
├── useDTONode.ts
├── types.ts
└── index.ts
```

### types.ts

```typescript
import type { NodeProps } from '@xyflow/react'
import type { DTONode } from '@entity'

export interface DTONodeProps extends NodeProps {
  data: DTONode
}
```

### useDTONode.ts

Returns:
```typescript
{
  node,        // DTONode — from props.data
  isSelected,  // boolean — canvasStore.selectedNodeId === props.id
  handleClick, // () => void — canvasStore.setSelectedNode(id)
}
```

No IDB calls. Read-only display hook.

### DTONode.tsx

**Styling rule:** Tailwind classes for everything. Inline `style` only for values that
come from a JS variable at runtime. Theme CSS variables can be used in Tailwind
arbitrary syntax: `border-[var(--node-dto-accent)]`.

**Root div:**
```
className="relative bg-surface rounded-[var(--radius-md)] shadow-node
           border transition-all duration-150 select-none"
style={{
  borderColor: isSelected
    ? 'var(--node-dto-accent)'
    : 'var(--color-canvas-node-border)',
  boxShadow: isSelected
    ? '0 0 0 2px var(--node-dto-accent)22'
    : undefined,
}}
```

**NodeResizer** — first child:
```tsx
<NodeResizer
  minWidth={200}
  minHeight={120}
  isVisible={isSelected}
  lineStyle={{ border: '1.5px solid var(--node-dto-accent)' }}
  handleStyle={{ background: 'var(--node-dto-accent)', border: 'none', width: 8, height: 8 }}
/>
```

**Header** — `className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)]"`:
- Icon: `className="w-6 h-6 rounded-[var(--radius-sm)] flex items-center justify-center text-[9px] font-bold font-mono flex-shrink-0"`, `style={{ background: 'var(--node-dto-icon-bg)', color: 'var(--node-dto-icon-fg)' }}`, text "D"
- Label: `className="text-[13px] font-bold text-text flex-1 leading-none truncate"`
- Purpose badge:
  - REQUEST → `bg-[var(--color-accent-light)] text-[var(--color-accent)]`
  - RESPONSE → `bg-[var(--color-success-light)] text-[var(--color-success)]`
  - BOTH → `bg-[var(--color-warning-light)] text-[var(--color-warning)]`
  - Common classes: `text-[8px] font-bold font-mono px-1.5 py-0.5 rounded-sm flex-shrink-0`

**Fields list** — `className="px-3 py-2 flex flex-col gap-[3px] flex-1"`:

Each field row: `className="flex items-center gap-2 min-w-0"`:
- Name: `className="text-[11px] font-mono text-text-2 flex-1 truncate"`
- Type: `className="text-[10px] font-mono text-text-3 flex-shrink-0"`
- First validation badge (only when `field.validations.length > 0`):
  `className="text-[8px] font-mono px-1 rounded-sm flex-shrink-0 bg-[var(--color-warning-light)] text-[var(--color-warning)]"`
  text: first validation's type e.g. `@NotNull`, `@Size`

**Empty fields state** (when `fields.length === 0`):
`className="text-[10px] font-mono text-text-4 italic"`, text "no fields"

**Origin badge** — bottom of card, inside a `px-3 pb-2` wrapper:
- CUSTOM → `className="text-[8px] font-mono text-text-4"`, text "CUSTOM"
- DERIVED → `className="text-[8px] font-mono"`, `style={{ color: 'var(--node-dto-accent)' }}`, text "DERIVED"

---

## 9. Register in Canvas

In `Canvas.tsx` add `DTONode` to `NODE_TYPES`:

```typescript
import { MicroserviceNode } from '@components/nodes/MicroserviceNode'
import { EntityNode }       from '@components/nodes/EntityNode'
import { DTONode }          from '@components/nodes/DTONode'

const NODE_TYPES = {
  microservice: MicroserviceNode,
  entity:       EntityNode,
  dto:          DTONode,
} as const
```

In `useCanvas.ts`, extend `onDrop` to handle `nodeType === 'dto'`.
The pattern is identical to the entity case — only `createDTONode` and `'dto'` string differ.

Add `'dto'` to the IDB load type map:
```
'MICROSERVICE' → 'microservice'
'ENTITY'       → 'entity'
'DTO'          → 'dto'
```

---

## 10. Left Sidebar Updates

In `useLeftSidebar.ts`:

- `hasMicroservice` is already computed from `rfNodes`
- Add `'dto'` case to `handleAddNode`:
  - Same guard and target-MS logic as entity
  - `createDTONode({ position })`
  - Write to IDB → add to RF state

In `LeftSidebar.tsx`, update the DTO palette item:
- `disabled={!hasMicroservice}`
- `draggable={hasMicroservice}`
- `onDragStart={(e) => handleDragStart(e, 'dto')}`
- `onClick={() => handleAddNode('dto')}`

Update the `NodePaletteItem` to set `ready: true` for the `dto` item now.
The other 5 node types (DB, Auth Guard, Controller, Service, API Endpoint) remain `ready: false`.

Update layers panel to show DTO nodes after entity nodes:

```
● Order Service          :8080
  ● Order                        ← entity
  ● User                         ← entity
  ◈ OrderRequest                 ← dto (use ◈ or square icon to distinguish)
  ◈ OrderResponse                ← dto
● Payment Service        :8081
```

DTO layer item:
- `pl-4` (same indentation as entity)
- Use a different marker glyph (◈ or just a square `■`) to distinguish from entity dots
- Dot/marker colour: `var(--node-dto-accent)`
- Label: `node.label`, 10px
- Purpose label right-aligned: `REQUEST` / `RESPONSE` / `BOTH`, 8px mono, muted
- Click: `canvasStore.setSelectedNode(id)`
- Selected state: `bg-[var(--color-accent-light)] text-[var(--color-accent)]`

---

## 11. Inspector Panel — DTOInspector

### File structure

```
src/pages/Editor/components/InspectorPanel/components/DTOInspector/
├── DTOInspector.tsx
├── useDTOInspector.ts
├── types.ts
└── index.ts
```

Wire into `InspectorPanel.tsx`: add `case NodeType.DTO: return <DTOInspector nodeId={selectedNodeId} />`.

### Panel anatomy

```
┌──────────────────────────────────────────┐
│ [DTONode]  badge             sticky top  │  ← header
│ OrderRequest                       [×]   │
│ CUSTOM · RESPONSE                        │
├──────────────────────────────────────────┤
│ IDENTITY                                 │  ← section 1
│ [label                               ]   │
│ Purpose    [RESPONSE ▼]                  │
│ Origin     [CUSTOM ▼]                    │
├──────────────────────────────────────────┤
│ CONFIG                                   │  ← section 2
│ Validation enabled          [toggle]     │
│ Lombok style     [BOTH ▼]                │
├──────────────────────────────────────────┤
│ FIELDS                                   │  ← section 3
│  orderId    UUID                  [×]    │
│  quantity   Integer               [×]    │
│    └ @NotNull  ""          [×]           │  ← validation row
│    └ @Min "1"  ""          [×]           │  ← another validation
│  note       String                [×]    │
│                                          │
│  [name    ] [type ▼]             [+]     │  ← add field row
│                                          │
│  Per-field:                              │
│  JSON key [        ]  Ignore [×]  NonNull[×] │  ← serialisation row
│  [+ Add validation ▼]                    │  ← add validation dropdown
├──────────────────────────────────────────┤
│ AI PROMPT  ●                             │  ← section 4
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐  │
│   [description textarea 4 rows      ]   │
│   [businessRules textarea 2 rows    ]   │
│   AI generates code          [toggle]   │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘  │
├──────────────────────────────────────────┤
│ [        Delete DTO        ]             │  ← section 5
└──────────────────────────────────────────┘
```

### useDTOInspector.ts

**Same optimistic update pattern as every inspector:**
1. `setNodes` (RF) immediately — no debounce
2. `debouncedUpdate` → `db.nodes.update()` — 300ms inputs, 500ms textareas

**Handlers:**

Identity:
- `handleLabelChange(value: string)` — direct update, live canvas: header label
- `handlePurposeChange(value: DTOPurpose)` — updates `purpose`, live canvas: purpose badge colour and text
- `handleOriginChange(value: DTOOrigin)` — updates `origin`, live canvas: origin badge at bottom

Config:
- `handleValidationToggle()` — flips `config.validationEnabled`
- `handleLombokStyleChange(value: LombokStyle)`

Fields:
- `handleAddField(name: string, type: JavaType)` — validates non-empty and non-duplicate name, appends `DTOField` with `generateId()`, empty `validations: []`, default `serialization: { jsonProperty: '', jsonIgnore: false, includeNonNull: false }`
- `handleRemoveField(fieldId: string)` — removes field and all its validations
- `handleFieldTypeChange(fieldId: string, type: JavaType)` — updates field type
- `handleFieldNameChange(fieldId: string, name: string)` — updates field name

Serialisation (per-field):
- `handleJsonPropertyChange(fieldId: string, value: string)` — sets `serialization.jsonProperty`
- `handleJsonIgnoreToggle(fieldId: string)` — flips `serialization.jsonIgnore`
- `handleIncludeNonNullToggle(fieldId: string)` — flips `serialization.includeNonNull`

Validations (per-field):
- `handleAddValidation(fieldId: string, type: ValidationType)` — appends `Validation` with `{ type, value: '', message: '' }` and a generated id
- `handleRemoveValidation(fieldId: string, validationIdx: number)` — removes by index
- `handleValidationValueChange(fieldId: string, validationIdx: number, value: string)`
- `handleValidationMessageChange(fieldId: string, validationIdx: number, message: string)`

AI Prompt:
- `handleAIPromptChange(field: keyof AIPrompt, value: string)` — 500ms debounce
- `handleAIGenerateToggle()`

Lifecycle:
- `handleClose()` — `canvasStore.clearSelection()`
- `handleDelete()` — `window.confirm('Delete "${node.label}"?')`, on confirm: `db.nodes.delete(nodeId)` then `setNodes(nodes => nodes.filter(...))` then `clearSelection()`

### Section 1 — Identity

| Field | Control | Live canvas update |
|---|---|---|
| `label` | text input | Header label text |
| `purpose` | select: REQUEST, RESPONSE, BOTH | Purpose badge colour + text |
| `origin` | select: CUSTOM, DERIVED | Origin badge at bottom |

### Section 2 — Config

| Field | Control | Default |
|---|---|---|
| Validation enabled | `<Toggle>` | off |
| Lombok style | select: DATA, BUILDER, BOTH, NONE | BOTH |

### Section 3 — Fields

**Fields list:**
Each field row expands into three rows when the row is active or hovered:

Row 1 (always visible):
```
[name input]  [type select]  [×]
```

Row 2 — Serialisation (shown below each field, collapsible with a small caret):
```
JSON key [input]   Ignore [toggle]   Non-null [toggle]
```
JSON key input: `placeholder="leave empty to use field name"`, font-mono, 10px.
The two toggles use the shared `<Toggle>` component.

Row 3 — Validations (shown when `field.validations.length > 0` or user adds one):
Each validation on its own sub-row:
```
[@NotNull ×]  [value input]  [message input]  [×]
```
- Validation type shown as a badge (non-editable, remove with ×)
- `value` input: only shown for types that take a value (MIN, MAX, SIZE, PATTERN) — hidden for NOT_NULL, NOT_BLANK, EMAIL, etc.
- `message` input: always shown, `placeholder="custom message"`, font-mono, 10px

**Add validation row** below the validations:
A small `+ Add validation` dropdown-button:
- Renders as a compact button with a caret
- Opens a dropdown listing all `ValidationType` values
- Clicking one calls `handleAddValidation(fieldId, type)`
- Only show validation types relevant to the field's JavaType:
  - STRING → NOT_NULL, NOT_BLANK, NOT_EMPTY, SIZE, EMAIL, PATTERN
  - INTEGER, LONG, DOUBLE, DECIMAL → NOT_NULL, MIN, MAX, POSITIVE
  - DATETIME, DATE, LOCALDATE → NOT_NULL, FUTURE, PAST
  - All others → NOT_NULL only

**Add field row** (always at the bottom):
```
[name input flex-1]  [type select]  [+]
```
Enter in name input or click + submits. Clears inputs on success.

### Section 4 — AI Prompt

Same gradient box style as EntityNode using `--ai-box-*` tokens.

| Textarea | Field | Rows |
|---|---|---|
| Description | `aiPrompt.description` | 4 |
| Business rules | `aiPrompt.businessRules` | 2 |

`aiGenerate` toggle in the header row.

### Section 5 — Delete

Button: "Delete DTO"
`className="bg-[var(--color-danger-light)] text-[var(--color-danger)] border border-[var(--color-danger-border)] rounded-[var(--radius-sm)] w-full py-2 text-[11px] font-semibold"`

---

## 12. IDB Persistence

### Schema

Same `nodes` table as EntityNode. `type` column stores `'DTO'`.
`data` column is `JSON.stringify` of the full `DTONode` object.

### Load on mount

`useCanvas.ts` already loads all nodes on mount. Extend the type map:

```
'MICROSERVICE' → 'microservice'
'ENTITY'       → 'entity'
'DTO'          → 'dto'
```

No other changes needed to the load logic.

### Write on create

```typescript
await db.nodes.add({
  id:        node.id,
  projectId: currentProjectId,
  type:      'DTO',
  label:     node.label,
  position:  node.position,
  size:      node.size,
  data:      JSON.stringify(node),
  createdAt: Date.now(),
  updatedAt: Date.now(),
})
```

RF state updated immediately after (do not await IDB before showing the node).

### Write on update

Same debounced pattern as EntityNode.

Step 1 — instant RF update:
```
setNodes(nodes => nodes.map(n =>
  n.id === nodeId ? { ...n, data: { ...n.data, [field]: value } } : n
))
```

Step 2 — debounced IDB write (300ms inputs, 500ms textareas):
```
db.nodes.update(nodeId, {
  label:     updatedNode.label,
  position:  updatedNode.position,
  size:      updatedNode.size,
  data:      JSON.stringify(updatedNode),
  updatedAt: Date.now(),
})
```

Always replace `data` with the full serialised node — never patch JSON in place.

For nested field changes (adding a validation, changing serialisation):
- Produce the full updated `DTONode` object first, then pass it to both `setNodes` and the debounced IDB write.
- The `data` column is always the entire node — partial updates cause stale fields.

### Write on drag/resize

Same as EntityNode — intercept `onNodesChange` events:
- `type === 'position'` and `dragging === false` → debounce 100ms → IDB update
- `type === 'dimensions'` → debounce 100ms → IDB update

### Write on delete

1. `db.nodes.delete(nodeId)` — IDB first
2. `setNodes(nodes => nodes.filter(n => n.id !== nodeId))` — then RF state
3. `canvasStore.clearSelection()`

### Cross-tab sync

After every IDB write, post to BroadcastChannel exactly as done for EntityNode:
```typescript
const bc = new BroadcastChannel('archflow-sync')
bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId })
bc.close()
```

`useCanvas.ts` already listens for the `idb-changed` window event and reloads.
No extra wiring needed for DTO nodes specifically.

---

## 13. Styling Rules

1. **Tailwind first.** All layout, spacing, and typography via Tailwind classes.
2. **Inline `style` only for dynamic JS values.** CSS variable references that don't change at runtime use Tailwind arbitrary syntax: `border-[var(--node-dto-accent)]`. Values computed from JS (e.g. a colour from a runtime variable) use `style={}`.
3. **Never hardcode hex.** All colour values reference CSS custom properties.
4. **`font-mono`** for all technical text: field names, types, JSON keys, validation values.
5. **No `!important`.**

---

## 14. What This Step Does NOT Build

- No edges in or out of DTONode
- No auto-population (DTO fields from Entity — fires on DERIVED_FROM edge, not yet built)
- No `entitySources` UI — `entitySources` is persisted as `[]` and ignored in the inspector
- No context menu on DTONode
- No drag-to-reorder fields
- No silent duplicate field prevention shown visually — just ignore the duplicate

---

## 15. Verification

### TypeScript
```bash
npx tsc --noEmit
```
Zero errors.

### Functionality

- [ ] DTO palette item is dimmed when no MicroserviceNode exists
- [ ] Adding a MicroserviceNode → DTO item becomes active
- [ ] Click DTO item with MS selected → DTONode appears in that MS
- [ ] Click DTO item with no MS selected → DTONode appears in the last MS
- [ ] Drag DTO from sidebar → drop inside MS body → node at drop position
- [ ] Drag DTO → drop outside any MS → nothing happens
- [ ] Multiple DTONodes can be added to the same MS
- [ ] DTONode canvas card shows: icon "D", label, purpose badge, fields, origin badge
- [ ] Purpose badge colour: REQUEST = blue, RESPONSE = green, BOTH = amber
- [ ] Empty fields shows "no fields" text
- [ ] Select DTONode → right panel opens with DTOInspector
- [ ] Change label → canvas header updates immediately
- [ ] Change purpose → badge on canvas updates immediately
- [ ] Change origin → origin badge at bottom updates
- [ ] Add field `orderId: UUID` → row appears in canvas card fields list
- [ ] Add validation @NotNull to orderId → badge appears on canvas card row
- [ ] Change field type → canvas card updates
- [ ] Set JSON key → persists in IDB (no canvas update expected)
- [ ] Toggle jsonIgnore → persists
- [ ] Add validation with value (e.g. @Size value "255") → value input appears
- [ ] Remove validation → disappears from inspector and canvas badge clears if last
- [ ] Remove field → disappears from canvas card
- [ ] Delete DTO → confirm → removed from canvas and IDB
- [ ] Layers panel shows DTO nodes under their MS with purpose label
- [ ] Click DTO layer item → node selected, inspector opens

### IDB persistence

- [ ] Refresh → all DTONodes reappear with correct label, purpose, origin, fields
- [ ] Add a field → refresh → field persists
- [ ] Add a validation → refresh → validation persists
- [ ] Set JSON key → refresh → JSON key persists
- [ ] Toggle validation enabled → refresh → config persists
- [ ] Move node → refresh → position persists
- [ ] Resize node → refresh → size persists
- [ ] Delete node → refresh → node does not reappear
- [ ] Two tabs open → add DTO in Tab 1 → Tab 2 canvas updates within ~1 second
