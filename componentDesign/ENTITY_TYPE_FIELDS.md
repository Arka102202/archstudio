# Entity as Field Type — Design & Build Specification

> Claude Code: read this in full before writing a single line.
> Follow every rule in CLAUDE.md alongside this document.
> CLAUDE.md has already been updated with the new EntityField, DTOField,
> and the three new EdgeTypes. RelationshipConfig and RelationshipKind were NOT
> added — the existing Relation interface and RelationType enum are used instead.
> This document covers the full implementation.

---

## 1. What This Builds

When a user adds or edits a field on an EntityNode or DTONode, the type dropdown
now includes all EntityNodes in the same microservice alongside the existing
JavaType primitives.

Selecting an entity as a field type:
- Stores `type = 'ENTITY_REF'` and `entityTypeId = entity.id` on the field
- Automatically creates an edge between the two nodes
- Adds a relationship sub-row at the field level for JPA config (when applicable)

Live sync: when a TableNode is connected or disconnected from an entity, all
fields across all nodes that reference that entity are updated automatically.

---

## 2. Data Model Changes — Confirmed in CLAUDE.md

### `EntityField` (updated)

```typescript
export interface EntityField {
  id:               string
  name:             string
  type:             JavaType | 'ENTITY_REF'  // 'ENTITY_REF' when field references another entity
  entityTypeId:     string | null            // → EntityNode.id when type === 'ENTITY_REF'
  relation:         Relation | null          // reuses existing Relation — only when both entities have tables
  constraint:       FieldConstraint
  nullable:         boolean
  columnName:       string
  defaultValue:     string
  enumValues:       EnumValues | null
  entityTypeWarning: boolean                 // true when referenced entity gained a table, needs JPA config
}
// RelationshipConfig and RelationshipKind are NOT used here.
// Use the existing Relation interface and RelationType enum from EntityNode.ts.
```

### `DTOField` (updated)

```typescript
export interface DTOField {
  id:                string
  name:              string
  type:              JavaType | 'ENTITY_REF'
  entityTypeId:      string | null   // → EntityNode.id (entity must have NO table)
  entityTypeInvalid: boolean         // true when referenced entity gained a table connection
  validations:       Validation[]
  serialization:     Serialization
}
```

### Three new EdgeTypes (in `shared.ts`)

```
EMBEDS     = 'EMBEDS'     // Entity → Entity (no-table composition)
RELATES_TO = 'RELATES_TO' // Entity → Entity (both have tables, JPA relation)
USES_TYPE  = 'USES_TYPE'  // DTO → Entity (entity has no table)
```

### Factory default additions

In `createEntityField()` (add to `src/utils/node.ts`):
```typescript
entityTypeId:      null,
relation:          null,   // uses existing Relation interface
entityTypeWarning: false,
```

In `createDTOField()`:
```typescript
entityTypeId:      null,
entityTypeInvalid: false,
```

---

## 3. Type Dropdown — Where to Build It

The type dropdown is used in two places:
1. `EntityInspector` — Section 3 (Fields), the field type select
2. `DTOInspector` — Section 3 (Fields), the field type select

Build a shared component for this:

```
src/components/shared/FieldTypeSelect/
├── FieldTypeSelect.tsx
├── useFieldTypeSelect.ts
├── types.ts
└── index.ts
```

### types.ts

```typescript
import type { JavaType } from '@entity'

export interface FieldTypeSelectProps {
  value:         JavaType | 'ENTITY_REF' | null
  entityTypeId:  string | null
  // All entity nodes available as options (same MS, filtered by caller)
  entityOptions: EntityOption[]
  // For DTO: only show entities that have no table connection
  // For Entity: show all entities except self
  onChange:      (value: JavaType | 'ENTITY_REF', entityId: string | null) => void
}

export interface EntityOption {
  id:          string
  label:       string
  hasTable:    boolean   // true if STORED_IN edge exists for this entity
  disabled:    boolean   // true for DTO when entity has table
}
```

### useFieldTypeSelect.ts

```typescript
import { useNodes, useEdges } from '@xyflow/react'
import type { EntityNode, BaseNode } from '@entity'
import { NodeType } from '@entity'

export function useFieldTypeSelect(
  currentNodeId: string,   // ID of the EntityNode or DTONode that owns this field
  mode:          'entity' | 'dto',
) {
  const allNodes = useNodes()
  const allEdges = useEdges()

  // Get all EntityNodes in the same microservice
  // Use msId matching: find the MS of currentNodeId, then all entities with same msId
  const currentNode  = allNodes.find(n => n.id === currentNodeId)
  const currentMsId  = (currentNode?.data as BaseNode & { msId?: string })?.msId

  const entityOptions: EntityOption[] = allNodes
    .filter(n =>
      (n.data as BaseNode).type === NodeType.ENTITY &&
      (n.data as BaseNode & { msId?: string }).msId === currentMsId &&
      n.id !== currentNodeId   // exclude self (for entity-to-entity)
    )
    .map(n => {
      const entity    = n.data as EntityNode
      const hasTable  = allEdges.some(e =>
        e.data?.type === 'STORED_IN' && e.source === n.id
      )
      return {
        id:       n.id,
        label:    entity.label,
        hasTable,
        disabled: mode === 'dto' && hasTable,  // DTOs cannot use DB-mapped entities
      }
    })

  return { entityOptions }
}
```

### FieldTypeSelect.tsx

Renders a `<select>` with two option groups:

```
┌────────────────────────────────┐
│ [select type                 ▼]│
│   ── Java Types ──             │
│   UUID                         │
│   String                       │
│   Integer                      │
│   … all JavaType values …      │
│   ── Entities ──               │
│   Order            (no table)  │
│   User             (no table)  │
│   Address ✕ disabled           │  ← disabled in DTO mode when has table
└────────────────────────────────┘
```

```tsx
<select
  value={value === 'ENTITY_REF' ? `entity:${entityTypeId}` : (value ?? '')}
  onChange={e => {
    const v = e.target.value
    if (v.startsWith('entity:')) {
      onChange('ENTITY_REF', v.replace('entity:', ''))
    } else {
      onChange(v as JavaType, null)
    }
  }}
  className="w-full text-[11px] font-mono text-text bg-surface-alt
             border border-[var(--color-border)] rounded-[var(--radius-sm)]
             px-2 py-1 outline-none focus:border-[var(--color-border-focus)]"
>
  <option value="">— select type —</option>

  <optgroup label="Java Types">
    {JAVA_TYPE_OPTIONS.map(jt => (
      <option key={jt} value={jt}>{jt}</option>
    ))}
  </optgroup>

  {entityOptions.length > 0 && (
    <optgroup label="Entity Types">
      {entityOptions.map(eo => (
        <option
          key={eo.id}
          value={`entity:${eo.id}`}
          disabled={eo.disabled}
        >
          {eo.label}{eo.disabled ? ' (DB-mapped — not allowed in DTO)' : ''}
        </option>
      ))}
    </optgroup>
  )}
</select>
```

`JAVA_TYPE_OPTIONS` is an array of all `JavaType` enum string values — define as a
constant in the same file or import from utils.

Export from `src/components/shared/index.ts`.

---

## 4. Auto-edge Creation and Deletion

### Where: `useEntityInspector.ts` and `useDTOInspector.ts`

When the field type changes, create or remove edges as follows.

### In `useEntityInspector.ts` — `handleFieldTypeChange`

```typescript
const handleFieldTypeChange = async (
  fieldId: string,
  newType: JavaType | 'ENTITY_REF',
  newEntityTypeId: string | null,
) => {
  const field = node.fields.find(f => f.id === fieldId)
  if (!field) return

  // ── 1. Remove old entity-type edge if field was previously ENTITY_REF ──
  if (field.type === 'ENTITY_REF' && field.entityTypeId) {
    const oldEdge = rfEdges.find(e =>
      (e.data?.type === 'EMBEDS' || e.data?.type === 'RELATES_TO') &&
      e.source === nodeId &&
      e.target === field.entityTypeId
    )
    if (oldEdge) {
      await db.edges.delete(oldEdge.id)
      setEdges(edges => edges.filter(e => e.id !== oldEdge.id))
    }
  }

  // ── 2. Build the updated field ──────────────────────────────────────────
  const updatedField: EntityField = {
    ...field,
    type:              newType,
    entityTypeId:      newEntityTypeId,
    relation:          null,      // reset on type change — uses Relation interface
    entityTypeWarning: false,
  }

  // ── 3. Create new edge if new type is ENTITY_REF ────────────────────────
  if (newType === 'ENTITY_REF' && newEntityTypeId) {
    const targetEntityNode = rfNodes.find(n => n.id === newEntityTypeId)
    if (targetEntityNode) {
      // Does the target entity have a table?
      const targetHasTable = rfEdges.some(e =>
        e.data?.type === 'STORED_IN' && e.source === newEntityTypeId
      )
      // Does the current entity (parent) have a table?
      const parentHasTable = rfEdges.some(e =>
        e.data?.type === 'STORED_IN' && e.source === nodeId
      )

      const edgeType = (targetHasTable && parentHasTable)
        ? EdgeType.RELATES_TO
        : EdgeType.EMBEDS

      // If RELATES_TO, mark field with warning (needs JPA config)
      if (edgeType === EdgeType.RELATES_TO) {
        updatedField.entityTypeWarning = true
      }

      const newEdge = {
        id:         generateId(),
        projectId:  currentProjectId,
        fromNodeId: nodeId,        // parent entity
        toNodeId:   newEntityTypeId,
        type:       edgeType,
        label:      edgeType,
      }
      await db.edges.add(newEdge)
      setEdges(edges => [...edges, {
        id:     newEdge.id,
        source: nodeId,
        target: newEntityTypeId,
        type:   edgeType === EdgeType.EMBEDS ? 'embeds' : 'relatesTo',
        data:   newEdge,
      }])
    }
  }

  // ── 4. Update the node ───────────────────────────────────────────────────
  const updatedNode = {
    ...node,
    fields: node.fields.map(f => f.id === fieldId ? updatedField : f),
  }
  setNodes(nodes => nodes.map(n =>
    n.id === nodeId ? { ...n, data: updatedNode } : n
  ))
  db.nodes.update(nodeId, { data: JSON.stringify(updatedNode), updatedAt: Date.now() })
}
```

### In `useDTOInspector.ts` — `handleFieldTypeChange`

Same pattern. Edge type is always `USES_TYPE` when entity is selected.
Skip the table check for edge type — DTOs can only reference no-table entities
(enforced by the dropdown disabling those options).

```typescript
// On ENTITY_REF selected for a DTO field:
const newEdge = {
  type:       EdgeType.USES_TYPE,
  fromNodeId: dtoNodeId,
  toNodeId:   newEntityTypeId,
  // ...
}
```

On clearing (switching back to JavaType):
- Find USES_TYPE edge from this DTO to the old entity → delete it

---

## 5. Relationship Sub-row in EntityInspector

When a field has `type === 'ENTITY_REF'` and `relationship !== null` (or `entityTypeWarning === true`),
show a sub-row directly below the field row in the FIELDS section.

### Warning state (entityTypeWarning = true, relationship = null)

```
  order   Order   ENTITY_REF   [×]
  ⚠ JPA relationship required — both entities are DB-mapped
    [ONE_TO_ONE ▼]  [configure]
```

A warning banner below the field row:
```tsx
{field.entityTypeWarning && !field.relationship && (
  <div className="ml-4 px-2 py-1.5 rounded-[var(--radius-sm)] flex items-center gap-2"
       style={{ background: 'var(--color-warning-light)' }}>
    <span className="text-[9px]" style={{ color: 'var(--color-warning)' }}>⚠</span>
    <span className="text-[9px] font-mono flex-1"
          style={{ color: 'var(--color-warning)' }}>
      JPA relationship required — set the relationship kind below
    </span>
  </div>
)}
```

### Relationship config row (relationship !== null)

```
  ┌─ @ManyToOne ─────────────────────────────────────────────────────┐
  │  Kind      [MANY_TO_ONE ▼]                                        │
  │  Mapped by [orders        ]                                       │
  │  Cascade   [ALL         ▼]                                        │
  │  Fetch     [LAZY        ▼]                                        │
  │  Optional  [toggle]                                               │
  └───────────────────────────────────────────────────────────────────┘
```

Indented `ml-4`, `border border-[var(--color-border)] rounded-[var(--radius-sm)] p-2`.

Handlers in `useEntityInspector.ts`:
- `handleFieldRelationshipChange(fieldId: string, patch: Partial<Relation>)`:
  ```typescript
  // Uses existing Relation interface — not RelationshipConfig
  const initRelation: Relation = {
    id:             generateId(),
    type:           RelationType.ONE_TO_MANY,  // existing RelationType enum
    targetEntityId: field.entityTypeId ?? '',
    mappedBy:       '',
    cascade:        CascadeType.NONE,          // existing CascadeType enum
    fetch:          FetchType.LAZY,            // existing FetchType enum
    optional:       true,
  }
  const updatedField = {
    ...field,
    relation:          { ...(field.relation ?? initRelation), ...patch },
    entityTypeWarning: false,  // clear warning once relation is being configured
  }
  ```

When the user sets the relationship type from the warning banner's quick dropdown,
initialise a `Relation` with that type and defaults, then clear `entityTypeWarning`.

---

## 6. Live Sync — STORED_IN Edge Connect/Disconnect

### Where: `useCanvas.ts` — `onConnect` and `handleDeleteEdge`

When a STORED_IN edge is created or deleted, call `syncEntityTypeFields` from
`src/utils/autoPopulate.ts`.

### `syncEntityTypeFields` signature

```typescript
export function syncEntityTypeFields(
  affectedEntityId: string,   // the entity that gained or lost a table connection
  entityNowHasTable: boolean, // true = gained table, false = lost table
  allRFNodes: RFNode[],
  allRFEdges: RFEdge[],
): SyncResult

interface SyncResult {
  updatedNodes: Map<string, EntityNode | DTONode>  // nodeId → updated node data
  updatedEdges: EdgeChange[]                        // edges to add or remove
}

interface EdgeChange {
  action:    'add' | 'remove'
  edgeId:    string
  edgeType?: EdgeType
  fromNodeId?: string
  toNodeId?:  string
}
```

### Logic

```
For every EntityNode in the same MS:
  For every field where field.entityTypeId === affectedEntityId:

    If entityNowHasTable:
      parentHasTable = check if this EntityNode has a STORED_IN edge
      if parentHasTable:
        → change edge from EMBEDS to RELATES_TO
        → set field.entityTypeWarning = true
        → keep field.relation = null (user must fill it using existing Relation interface)
      else:
        → edge stays EMBEDS (parent has no table, only target does)
        → no warning needed

    If !entityNowHasTable (lost table):
      if edge was RELATES_TO:
        → change edge to EMBEDS
        → set field.relation = null
        → set field.entityTypeWarning = false
      (edge was already EMBEDS → no change)

For every DTONode in the same MS:
  For every field where field.entityTypeId === affectedEntityId:

    If entityNowHasTable:
      → set field.entityTypeInvalid = true
      → do NOT remove the field — user must resolve it
      → edge: keep USES_TYPE (don't remove — keep the connection visible)

    If !entityNowHasTable:
      → set field.entityTypeInvalid = false
      → edge: keep USES_TYPE
```

### Calling in `useCanvas.ts`

After STORED_IN edge is created:
```typescript
const result = syncEntityTypeFields(entityId, true, rfNodes, rfEdges)
// Apply all updated nodes to RF state and IDB
// Apply all edge changes (remove EMBEDS → add RELATES_TO, etc.)
```

After STORED_IN edge is deleted:
```typescript
const result = syncEntityTypeFields(entityId, false, rfNodes, rfEdges)
```

For each updated node in `result.updatedNodes`:
```typescript
setNodes(nodes => nodes.map(n =>
  result.updatedNodes.has(n.id)
    ? { ...n, data: result.updatedNodes.get(n.id) }
    : n
))
for (const [id, updatedNode] of result.updatedNodes) {
  db.nodes.update(id, { data: JSON.stringify(updatedNode), updatedAt: Date.now() })
}
```

For each edge change:
```typescript
for (const change of result.updatedEdges) {
  if (change.action === 'remove') {
    db.edges.delete(change.edgeId)
    setEdges(edges => edges.filter(e => e.id !== change.edgeId))
  } else {
    const newEdge = { id: change.edgeId, fromNodeId: change.fromNodeId!, ... }
    db.edges.add(newEdge)
    setEdges(edges => [...edges, toRFEdge(newEdge)])
  }
}
```

---

## 7. Canvas Display — Entity-type Fields

### EntityNode canvas card

When a field has `type === 'ENTITY_REF'`:
- Name: same as other fields
- Type shown: resolved entity label (look up rfNodes by `entityTypeId`), e.g. "Order"
- Constraint badge: same rules
- Warning indicator: if `entityTypeWarning`, show a small `⚠` in amber

```
  userId      UUID      [FK]
  address     Address               ← entity type, no badge
  order       Order     ⚠           ← entity type with warning
```

### DTONode canvas card

When a field has `type === 'ENTITY_REF'` and `entityTypeInvalid = true`:
```
  address   Address   ⚠ invalid    ← red warning
```

If `entityTypeInvalid = false`:
```
  address   Address               ← normal display
```

---

## 8. Edge Visuals

Three new edge components:

```
src/components/edges/EmbedsEdge/
src/components/edges/RelatesToEdge/
src/components/edges/UsesTypeEdge/
```

| Edge | Stroke colour | Arrow | Label |
|---|---|---|---|
| EMBEDS | `var(--node-entity-accent)` (blue) | At target entity | "EMBEDS" |
| RELATES_TO | `var(--color-warning)` (amber) | At target entity | Relationship kind e.g. "@ManyToOne" |
| USES_TYPE | `var(--node-dto-accent)` (teal) | At entity | "USES TYPE" |

`RELATES_TO` edge label is dynamic — shows the `RelationType` from the field's `relation.type` (using the existing RelationType enum).
To get this, the edge component reads the source entity's fields from rfNodes to find the
field that references the target entity.

Register in `EDGE_TYPES`:
```typescript
const EDGE_TYPES = {
  // ... existing ...
  embeds:    EmbedsEdge,
  relatesTo: RelatesToEdge,
  usesType:  UsesTypeEdge,
} as const
```

Extend IDB load map:
```
'EMBEDS'     → 'embeds'
'RELATES_TO' → 'relatesTo'
'USES_TYPE'  → 'usesType'
```

---

## 9. Inspector Updates — Using `FieldTypeSelect`

### In `EntityInspector.tsx`

In the add-field row and in each field row (when editing type), replace the old
`<select>` of JavaType values with `<FieldTypeSelect>`:

```tsx
<FieldTypeSelect
  value={field.type}
  entityTypeId={field.entityTypeId}
  entityOptions={entityOptions}     // from useFieldTypeSelect(nodeId, 'entity')
  onChange={(type, entityId) =>
    handleFieldTypeChange(field.id, type, entityId)
  }
/>
```

When `field.type === 'ENTITY_REF'` and `field.entityTypeWarning`, show the warning banner.
When `field.type === 'ENTITY_REF'` and `field.relationship !== null`, show the relationship config row.

### In `DTOInspector.tsx`

Same pattern. Use `mode='dto'` in `useFieldTypeSelect` so DB-mapped entities are disabled.

When `field.entityTypeInvalid`, show an inline error below the field:
```tsx
{field.entityTypeInvalid && (
  <div className="ml-4 px-2 py-1 rounded-[var(--radius-sm)]"
       style={{ background: 'var(--color-danger-light)' }}>
    <span className="text-[9px] font-mono"
          style={{ color: 'var(--color-danger)' }}>
      ⚠ This entity is now DB-mapped — it cannot be used as a DTO field type.
      Change the field type or disconnect the entity's table.
    </span>
  </div>
)}
```

---

## 10. Files Changed / Created

### New files
```
src/components/shared/FieldTypeSelect/
├── FieldTypeSelect.tsx
├── useFieldTypeSelect.ts
├── types.ts
└── index.ts

src/components/edges/EmbedsEdge/
src/components/edges/RelatesToEdge/
src/components/edges/UsesTypeEdge/
```

### Updated files
```
src/entity/EntityNode.ts
  → EntityField: add entityTypeId, relationship, entityTypeWarning, 'ENTITY_REF' type
  → Add entityTypeId, relation (uses existing Relation), entityTypeWarning to EntityField
  → RelationshipConfig and RelationshipKind are NOT added — existing types used

src/entity/DTONode.ts
  → DTOField: add entityTypeId, entityTypeInvalid, 'ENTITY_REF' type

src/entity/shared.ts
  → EdgeType: add EMBEDS, RELATES_TO, USES_TYPE

src/utils/node.ts
  → createEntityField(): add new fields with defaults
  → createDTOField(): add new fields with defaults

src/utils/autoPopulate.ts
  → Add syncEntityTypeFields()

src/pages/Editor/components/Canvas/useCanvas.ts
  → onConnect: no changes needed (entity-type edges are created from inspector, not canvas handles)
  → STORED_IN edge create/delete: call syncEntityTypeFields()
  → EDGE_TYPES: add embeds, relatesTo, usesType

src/pages/Editor/components/InspectorPanel/components/EntityInspector/useEntityInspector.ts
  → handleFieldTypeChange: full new implementation (Section 4)
  → handleFieldRelationshipChange: new handler (Section 5)

src/pages/Editor/components/InspectorPanel/components/EntityInspector/EntityInspector.tsx
  → Fields section: use FieldTypeSelect, add warning banner, add relationship row

src/pages/Editor/components/InspectorPanel/components/DTOInspector/useDTOInspector.ts
  → handleFieldTypeChange: updated with USES_TYPE edge logic

src/pages/Editor/components/InspectorPanel/components/DTOInspector/DTOInspector.tsx
  → Fields section: use FieldTypeSelect, add entityTypeInvalid error

src/components/nodes/EntityNode/useEntityNode.ts
  → resolve entity label from rfNodes for ENTITY_REF fields

src/components/nodes/DTONode/useDTONode.ts
  → resolve entity label, handle entityTypeInvalid display

src/components/shared/index.ts
  → export FieldTypeSelect
```

---

## 11. Verification

### TypeScript
```bash
npx tsc --noEmit
```
Zero errors.

### FieldTypeSelect dropdown

- [ ] Entity field type dropdown shows Java Types group + Entity Types group
- [ ] All entities in the same MS appear in Entity Types group
- [ ] Entity Types group does not show the entity itself (self-reference excluded)
- [ ] In DTO mode: DB-mapped entities are shown but disabled with "(DB-mapped)" label
- [ ] In Entity mode: all entities enabled
- [ ] Selecting an entity type → field shows entity label (not JavaType)

### Entity → Entity (no-table — EMBEDS)

- [ ] Create EntityA and EntityB (both without tables)
- [ ] In EntityA, add field "body" with type = EntityB → EMBEDS edge appears on canvas
- [ ] EntityA canvas card shows field "body   EntityB"
- [ ] No relationship sub-row in inspector (no tables → no JPA config needed)
- [ ] Clear field type → EMBEDS edge removed

### Entity → Entity (both have tables — RELATES_TO)

- [ ] Create EntityA and EntityB, connect both to TableNodes
- [ ] In EntityA, add field "orders" with type = EntityB → RELATES_TO edge appears (amber)
- [ ] Warning banner appears below the field in inspector
- [ ] Set relationship kind to ONE_TO_MANY → edge label updates to "@OneToMany"
- [ ] Warning clears once kind is set
- [ ] Relationship config row shows: kind, mappedBy, cascade, fetch, optional

### DTO → Entity (no-table — USES_TYPE)

- [ ] Create a DTO and an Entity with no table
- [ ] In DTO, add field "address" with type = Entity → USES_TYPE edge appears (teal)
- [ ] DTO canvas card shows "address   Address"
- [ ] No error state

### DTO → Entity (has table) — blocked

- [ ] Create Entity with table connected
- [ ] In DTO type dropdown → entity appears as disabled option
- [ ] Cannot select it

### Live sync — entity gains table

- [ ] EntityA uses EntityB as field type (EMBEDS edge exists)
- [ ] Connect EntityB to a TableNode
- [ ] EMBEDS edge changes to RELATES_TO (amber) immediately
- [ ] Warning banner appears on EntityA's field in inspector
- [ ] EntityA canvas card shows ⚠ next to the field

- [ ] DTONode uses EntityC as field type (USES_TYPE edge)
- [ ] Connect EntityC to a TableNode
- [ ] DTO field shows ⚠ invalid error in inspector
- [ ] Canvas card shows invalid indicator

### Live sync — entity loses table

- [ ] EntityA uses EntityB as field type (RELATES_TO with JPA config)
- [ ] Disconnect EntityB's TableNode
- [ ] RELATES_TO edge changes to EMBEDS immediately
- [ ] Relationship config row disappears from inspector
- [ ] entityTypeWarning cleared

- [ ] DTO field with entityTypeInvalid = true
- [ ] Disconnect entity's TableNode
- [ ] entityTypeInvalid cleared, error banner disappears

### IDB persistence

- [ ] Set entity field type to EntityRef → refresh → ENTITY_REF type and edge persist
- [ ] Set relationship config → refresh → relationship config persists
- [ ] entityTypeWarning persists after refresh
- [ ] entityTypeInvalid persists after refresh
- [ ] All three edge types (EMBEDS, RELATES_TO, USES_TYPE) persist and reload correctly
