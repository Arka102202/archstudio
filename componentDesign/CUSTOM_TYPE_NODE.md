# CustomTypeNode — Design & Build Specification

> Claude Code: read this in full before writing a single line.
> CLAUDE.md has been updated: NodeType.CUSTOM_TYPE and EdgeType.USES_CUSTOM_TYPE added.
> EntityField and DTOField now have `customTypeId: string | null` and support
> `type = 'CUSTOM_TYPE_REF'`.
> The entity-type-fields feature is already implemented — this extends it.

---

## 1. What Is the CustomTypeNode

A `CustomTypeNode` is a **value object** — a typed structure with no database table.
It is purely organisational: it describes a shape of data that will be stored as
a raw JSON blob wherever it is used.

**Key rule:** A CustomTypeNode can NEVER connect to a TableNode.
It has no `@Entity` annotation, no repository, no separate DB table.
- When used inside an EntityNode field → stored as a JSON column (e.g. `@Column(columnDefinition="jsonb")`)
- When used as an array → stored as a JSON array column
- When used inside a DTONode field → serialised as a nested JSON object in the response/request

It behaves identically to an EntityNode in terms of field definition — same
field types, same subtypes, same `ENTITY_REF` / `CUSTOM_TYPE_REF` nesting.

---

## 2. Visual Anatomy

```
┌──────────────────────────────────┐  ← border: var(--node-entity-accent) dashed
│                                  │
│  [CT]  Address                   │  ← HEADER: icon · label
│        Custom Type               │  ← subtitle, muted
│                                  │
├──────────────────────────────────┤
│  street      String              │  ← FIELDS (identical to EntityNode)
│  city        String              │
│  zip         String              │
│  country     String              │
└──────────────────────────────────┘
```

Differences from EntityNode:
- Icon text: "CT" (not "E")
- Border is **dashed** not solid — visually communicates "no table"
- Subtitle "Custom Type" below the label
- No auditing row, no soft-delete row (those are JPA/table concepts)
- No config section with `generateRepository` — no repository is generated

Minimum size: **w 200, h 120**. No maximum.

---

## 3. Data Model

Create `src/entity/CustomTypeNode.ts`:

```typescript
import type { BaseNode, AIPrompt } from './shared'
import { NodeType }               from './shared'
import type { JavaType }          from './shared'

export interface CustomTypeNode extends BaseNode {
  type:   NodeType.CUSTOM_TYPE
  fields: CustomTypeField[]
}

export interface CustomTypeField {
  id:           string
  name:         string
  // Same type union as EntityField and DTOField
  type:         JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF'
  entityTypeId: string | null    // → EntityNode.id
  customTypeId: string | null    // → CustomTypeNode.id (nested custom types)
  nullable:     boolean
  defaultValue: string
}
```

**No `relation` field** — CustomTypeNode fields never have JPA relationship config.
They are plain value object fields. No `@OneToMany`, no `@ManyToOne`.

**No `constraint` field** — no PK, no FK, no UNIQUE. These are JPA/DB concepts.

**No `enumValues`** — keep it simple. If the user wants an enum, use a plain String field.

Add `NodeType.CUSTOM_TYPE` to `src/entity/shared.ts` — already done in CLAUDE.md.

Export from `src/entity/index.ts`:
```typescript
export * from './CustomTypeNode'
```

---

## 4. Default Values

Add `createCustomTypeNode()` to `src/utils/node.ts`:

```typescript
export const createCustomTypeNode = (overrides?: Partial<CustomTypeNode>): CustomTypeNode => ({
  id:       generateId(),
  type:     NodeType.CUSTOM_TYPE,
  label:    'CustomType',
  fields:   [],
  position: { x: 0, y: 0 },
  size:     { w: 210, h: 130 },
  aiPrompt: emptyAIPrompt(),
  ...overrides,
})
```

Export from `src/utils/index.ts`.

---

## 5. How CustomTypeNodes Are Added

Same pattern as all other nodes.

### Guard

Palette item enabled only when at least one MicroserviceNode exists.
When disabled: `opacity-40 cursor-not-allowed pointer-events-none`.

### Way 1 — Drag from left sidebar

`onDragStart`: `e.dataTransfer.setData('nodeType', 'customType')`

### Way 2 — Click palette item

Target MS: selected MS first, else last MS in rfNodes.

---

## 6. CANNOT Connect to TableNode

In `useCanvas.ts` `onConnect`: if either end of a new edge is a `CustomTypeNode`
and the other end is a `TableNode` → **reject silently**.

Also: in the TableNode inspector's CONNECTIONS section and the left-sidebar palette,
add no special guard — the `onConnect` rejection is sufficient.

Communicate this clearly in the UI: in the CustomTypeNode inspector, add a
read-only notice:

```
ℹ This is a value object — no database table will be created.
  Data is stored as a JSON column wherever this type is used.
```

`className="text-[9px] font-mono text-text-4 italic"`

---

## 7. Canvas Node Component

### File structure

```
src/components/nodes/CustomTypeNode/
├── CustomTypeNode.tsx
├── useCustomTypeNode.ts
├── types.ts
└── index.ts
```

### useCustomTypeNode.ts

Returns:
```typescript
{
  node,        // CustomTypeNode
  isSelected,  // boolean
  handleClick, // () => void
}
```

### CustomTypeNode.tsx

**Dashed border — always visible, same accent colour as EntityNode:**

```
style={{
  border: isSelected
    ? `2px dashed var(--node-entity-accent)`
    : `1.5px dashed var(--node-entity-accent)60`,
  boxShadow: isSelected
    ? `0 0 0 3px var(--node-entity-accent)15`
    : undefined,
}}
```

**NodeResizer:**
```tsx
<NodeResizer
  minWidth={200}
  minHeight={120}
  isVisible={isSelected}
  lineStyle={{ border: '1.5px dashed var(--node-entity-accent)' }}
  handleStyle={{ background: 'var(--node-entity-accent)', border: 'none', width: 8, height: 8 }}
/>
```

**Header** — `className="px-3 pt-2 pb-1 border-b border-[var(--color-border)]"`:
- Row 1: icon + label row `className="flex items-center gap-2"`
  - Icon: 24×24, `background: var(--node-entity-icon-bg)`, `color: var(--node-entity-icon-fg)`, text "CT"
  - Label: `className="text-[13px] font-bold text-text flex-1 truncate"`
- Row 2: `className="text-[9px] font-mono text-text-4 mt-0.5"`, text "Custom Type"

**Fields list** — `className="px-3 py-2 flex flex-col gap-[3px]"`:

Each field row: `className="flex items-center gap-2 min-w-0"`:
- Name: `className="text-[11px] font-mono text-text-2 flex-1 truncate"`
- Type: resolved display name
  - `JavaType` → show the JavaType string
  - `'ENTITY_REF'` → look up entity label from rfNodes by `entityTypeId`
  - `'CUSTOM_TYPE_REF'` → look up custom type label from rfNodes by `customTypeId` + "(CT)" suffix

Empty state: `className="text-[10px] font-mono text-text-4 italic"`, text "no fields"

---

## 8. Register in Canvas

```typescript
import { CustomTypeNode } from '@components/nodes/CustomTypeNode'

const NODE_TYPES = {
  // ...existing...
  customType: CustomTypeNode,
} as const
```

Extend IDB load type map: `'CUSTOM_TYPE' → 'customType'`
Add `'customType'` case to `onDrop`.

---

## 9. FieldTypeSelect — Add Custom Types Group

Update `useFieldTypeSelect.ts` to also collect CustomTypeNodes:

```typescript
const customTypeOptions: CustomTypeOption[] = allNodes
  .filter(n =>
    (n.data as BaseNode).type === NodeType.CUSTOM_TYPE &&
    (n.data as BaseNode & { msId?: string }).msId === currentMsId
  )
  .map(n => ({
    id:    n.id,
    label: (n.data as CustomTypeNode).label,
  }))

return { entityOptions, customTypeOptions }
```

Update `FieldTypeSelectProps` in `types.ts`:
```typescript
customTypeOptions: CustomTypeOption[]

export interface CustomTypeOption {
  id:    string
  label: string
  // never disabled — CustomTypeNode is always valid for both entity and DTO fields
}
```

Update `FieldTypeSelect.tsx` to add a third `<optgroup>`:

```tsx
{customTypeOptions.length > 0 && (
  <optgroup label="Custom Types">
    {customTypeOptions.map(ct => (
      <option key={ct.id} value={`customType:${ct.id}`}>
        {ct.label}
      </option>
    ))}
  </optgroup>
)}
```

In the `onChange` handler, add detection for `customType:` prefix:
```typescript
if (v.startsWith('customType:')) {
  onChange('CUSTOM_TYPE_REF', null, v.replace('customType:', ''))
}
```

Update `FieldTypeSelectProps.onChange` signature:
```typescript
onChange: (
  value:        JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF',
  entityId:     string | null,
  customTypeId: string | null,
) => void
```

---

## 10. USES_CUSTOM_TYPE Edge

### Edge type

`EdgeType.USES_CUSTOM_TYPE` — already added to CLAUDE.md.

### Direction

`fromNodeId = EntityNode.id or DTONode.id` (the node whose field references the custom type)
`toNodeId   = CustomTypeNode.id`

### Visual

```
src/components/edges/UsesCustomTypeEdge/
├── UsesCustomTypeEdge.tsx
├── useUsesCustomTypeEdge.ts
├── types.ts
└── index.ts
```

**Always dashed** — this is the key visual distinction:

```
strokeDasharray: "6 3"   ← dashed pattern
stroke:          var(--node-entity-accent)  (blue)
strokeWidth:     1.5px (selected: 2.5px)
```

Arrow: `MarkerType.ArrowClosed` at CustomTypeNode end, fill `var(--node-entity-accent)`.
Label: "USES TYPE", same label style as other edges.
Hover `×` + double-click to delete.

Register in `EDGE_TYPES`:
```typescript
usesCustomType: UsesCustomTypeEdge,
```

IDB load map: `'USES_CUSTOM_TYPE' → 'usesCustomType'`

### Auto-create edge

When the user selects a `CUSTOM_TYPE_REF` in the field type dropdown, create a
`USES_CUSTOM_TYPE` edge automatically — same pattern as `USES_TYPE` for entities.

In `useEntityInspector.ts` and `useDTOInspector.ts`, extend `handleFieldTypeChange`:
```typescript
if (newType === 'CUSTOM_TYPE_REF' && newCustomTypeId) {
  // Check if USES_CUSTOM_TYPE edge from this node to newCustomTypeId already exists
  const alreadyExists = rfEdges.some(e =>
    e.data?.type === 'USES_CUSTOM_TYPE' &&
    e.source === nodeId &&
    e.target === newCustomTypeId
  )
  if (!alreadyExists) {
    // create edge in IDB + RF state
  }
}
```

### Auto-remove edge

When a field type is changed away from `CUSTOM_TYPE_REF`, check if any other
field on the same node still references the same `customTypeId`. If not, delete
the `USES_CUSTOM_TYPE` edge.

Include this in `syncDTOEntityEdges` (from the existing fix spec) — extend it to
also handle `USES_CUSTOM_TYPE` edges alongside `USES_TYPE` edges.

---

## 11. Inspector Panel — CustomTypeInspector

### File structure

```
src/pages/Editor/components/InspectorPanel/components/CustomTypeInspector/
├── CustomTypeInspector.tsx
├── useCustomTypeInspector.ts
├── types.ts
└── index.ts
```

Wire into `InspectorPanel.tsx`:
```typescript
case NodeType.CUSTOM_TYPE: return <CustomTypeInspector nodeId={selectedNodeId} />
```

### Panel anatomy

```
┌──────────────────────────────────────────┐
│ [CustomType]  badge           sticky top │
│ Address                             [×]  │
│ Custom Type — JSON value object          │
├──────────────────────────────────────────┤
│ IDENTITY                                 │
│ [label                               ]   │
├──────────────────────────────────────────┤
│ ℹ No table will be created.              │
│   Stored as JSON column wherever used.   │
├──────────────────────────────────────────┤
│ FIELDS                                   │
│  street   String            [×]          │
│  city     String            [×]          │
│                                          │
│  [name  ] [type ▼]          [+]          │
├──────────────────────────────────────────┤
│ [      Delete custom type     ]          │
└──────────────────────────────────────────┘
```

### useCustomTypeInspector.ts

Handlers:
- `handleLabelChange(value: string)`
- `handleAddField(name: string, type: JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF', entityId: string | null, customTypeId: string | null)`
- `handleRemoveField(fieldId: string)` — also removes the USES_CUSTOM_TYPE edge if last field using that type
- `handleFieldTypeChange(fieldId, newType, entityId, customTypeId)`
- `handleFieldNameChange(fieldId, name)`
- `handleClose()`
- `handleDelete()` — confirm → delete node + all USES_CUSTOM_TYPE edges pointing to this node

### Fields section

Uses `<FieldTypeSelect>` exactly like EntityInspector and DTOInspector.
Mode: `'entity'` — same rules (show all entity types, show all custom types).

No constraint select, no nullable/columnName/defaultValue for now — keep it minimal.
User can add those later if needed. For now: name + type only.

---

## 12. Left Sidebar Updates

In `useLeftSidebar.ts`: add `'customType'` to `handleAddNode` and `handleDragStart`.

In `LeftSidebar.tsx`:
- Palette item icon: `background: var(--node-entity-icon-bg)`, `color: var(--node-entity-icon-fg)`, text "CT"
- Label: "Custom Type"
- `ready: true`, same guard as all other nodes

Layers panel — CustomTypeNode item:
```
● Order Service          :8080
  ● Order                         ← entity
  ◈ OrderResponse                 ← dto
  ⬡ OrderService                  ← service
  ⊡ Address                       ← custom type (dashed square glyph)
```
- `pl-4`, glyph `⊡` or `⬜` in `var(--node-entity-accent)` dashed style
- Label: `node.label`, 10px
- Subtitle: "Custom Type", 8px muted

---

## 13. IDB Persistence

Same pattern as all other nodes.

```typescript
await db.nodes.add({
  id:        node.id,
  projectId: currentProjectId,
  msId:      currentMsId,
  type:      'CUSTOM_TYPE',
  label:     node.label,
  position:  node.position,
  size:      node.size,
  data:      JSON.stringify(node),
  createdAt: Date.now(),
  updatedAt: Date.now(),
})
```

USES_CUSTOM_TYPE edges follow the same IDB write pattern as USES_TYPE edges.

---

## 14. exportArchitecture.ts Update

In `src/utils/exportArchitecture.ts`, add custom types to the output:

```typescript
const customTypes = getAll<CustomTypeNode>(NodeType.CUSTOM_TYPE)

const customTypesOut = customTypes.map(ct => ({
  id:     ct.id,
  label:  ct.label,
  fields: ct.fields.map(f => ({
    name: f.name,
    type: f.type,
    entityTypeId:  f.entityTypeId,
    customTypeId:  f.customTypeId,
  })),
  storageNote: 'Stored as JSON column — no separate database table',
}))
```

Add `customTypes: customTypesOut` to the returned object.

---

## 15. Verification

### TypeScript
```bash
npx tsc --noEmit
```
Zero errors.

### Node basics

- [ ] Custom Type palette item appears in sidebar
- [ ] Drag → drop inside MS → CustomTypeNode appears with dashed border
- [ ] Canvas card shows: "CT" icon, label, "Custom Type" subtitle, fields list
- [ ] Dashed border distinguishes it from EntityNode at a glance

### Cannot connect to TableNode

- [ ] Try drawing edge CustomTypeNode → TableNode → rejected silently
- [ ] Try drawing edge TableNode → CustomTypeNode → rejected silently
- [ ] Inspector shows "No table will be created" info notice

### FieldTypeSelect — Custom Types group

- [ ] Third optgroup "Custom Types" appears in type dropdown in EntityInspector
- [ ] Third optgroup appears in DTOInspector
- [ ] Custom types never disabled (always selectable in both entity and DTO mode)
- [ ] Selecting custom type → field type shows custom type label

### USES_CUSTOM_TYPE edge

- [ ] Select Custom Type as field type → **dashed** edge appears between nodes
- [ ] Edge stroke is dashed (not solid)
- [ ] Changing field type away from Custom Type → edge removed (if no other field uses it)
- [ ] Another field on same node uses same Custom Type → edge stays when first field type changes

### Persistence

- [ ] Refresh → CustomTypeNode reappears with fields
- [ ] USES_CUSTOM_TYPE edge persists
- [ ] customTypeId on fields persists
- [ ] Export JSON includes customTypes array
