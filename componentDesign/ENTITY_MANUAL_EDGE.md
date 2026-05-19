# Entity-to-Entity Manual Edge — Design & Build Specification

> Claude Code: read this in full before writing a single line.
> The entity-type-fields feature is already implemented.
> EMBEDS and RELATES_TO edge types already exist in shared.ts.
> This step enables drawing those edges manually on the canvas via drag.

---

## 1. What This Builds

Currently, `EMBEDS` and `RELATES_TO` edges are only created programmatically
when the user sets a field type to `ENTITY_REF` in the EntityInspector.
Users cannot draw an edge directly between two EntityNodes on the canvas.

This step enables manual edge drawing between any two EntityNodes.
When the user drags from one EntityNode to another, a **RelationshipModal** opens
asking for the relation configuration before the edge is created.

---

## 2. Changes to `onConnect` in `useCanvas.ts`

Currently the `onConnect` handler ignores Entity+Entity pairs or rejects them.
Change it to handle them:

```typescript
// In onConnect — add this case before the existing DTO/Entity handling:
if (
  sourceNodeType === NodeType.ENTITY &&
  targetNodeType === NodeType.ENTITY
) {
  // One edge rule: only one edge between any two entities
  const alreadyConnected = rfEdges.some(e =>
    (e.source === connection.source && e.target === connection.target) ||
    (e.source === connection.target && e.target === connection.source)
  )
  if (alreadyConnected) return   // silently reject

  // Open the relationship modal with both entity IDs
  openRelationshipModal({
    trigger:    'CANVAS_EDGE',
    entityAId:  connection.source,
    entityBId:  connection.target,
  })
  return   // don't create the edge yet — modal handles it
}
```

The edge is **not** created until the user confirms the modal. If the user
cancels the modal, no edge is created.

---

## 3. RelationshipModal

### File structure

```
src/components/shared/RelationshipModal/
├── RelationshipModal.tsx
├── useRelationshipModal.ts
├── types.ts
└── index.ts
```

Export from `src/components/shared/index.ts`.

### When it opens

Two triggers:

1. **`CANVAS_EDGE`** — user dragged an edge between two EntityNodes on canvas
2. **`FIELD_TYPE`** — user selected another EntityNode as a field type or subtype
   in the EntityInspector

The modal is opened via a Zustand store (not local state) so both `useCanvas.ts`
and `useEntityInspector.ts` can trigger it from anywhere.

### Zustand store — `relationshipModalStore`

Create `src/store/relationshipModalStore.ts`:

```typescript
import { create } from 'zustand'

export type RelationshipModalTrigger = 'CANVAS_EDGE' | 'FIELD_TYPE'

export interface RelationshipModalState {
  isOpen:     boolean
  trigger:    RelationshipModalTrigger | null
  entityAId:  string | null  // source entity — the one the user acted on
  entityBId:  string | null  // target entity
  fieldId:    string | null  // only when trigger = FIELD_TYPE — the field being configured

  open:  (params: Omit<RelationshipModalState, 'isOpen' | 'open' | 'close'>) => void
  close: () => void
}

export const useRelationshipModalStore = create<RelationshipModalState>(set => ({
  isOpen:    false,
  trigger:   null,
  entityAId: null,
  entityBId: null,
  fieldId:   null,
  open:  params => set({ isOpen: true, ...params }),
  close: ()     => set({ isOpen: false, trigger: null, entityAId: null, entityBId: null, fieldId: null }),
}))
```

Export `useRelationshipModalStore` from `src/store/index.ts`.

### Modal anatomy

```
┌──────────────────────────────────────────────────────┐
│  Entity Relationship                             [×]  │
│  Order ←→ OrderItem                                  │  ← entity labels
├──────────────────────────────────────────────────────┤
│                                                      │
│  Relation type                                       │
│  ┌──────────────────────────────────────────────┐    │
│  │  @OneToMany                               ▼  │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  Two-way binding                                     │
│  ┌──────────────────────────────────────────────┐    │
│  │  [toggle]  Create complementary field        │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  When enabled, a complementary field is added        │
│  to the other entity automatically.                  │
│  e.g. adding @OneToMany on Order → adds @ManyToOne  │
│  on OrderItem                                        │
│                                                      │
├──────────────────────────────────────────────────────┤
│              [Cancel]    [Confirm]                    │
└──────────────────────────────────────────────────────┘
```

### types.ts

```typescript
import type { RelationType } from '@entity'

export interface RelationshipModalResult {
  relationType:   RelationType
  twoWayBinding:  boolean
}
```

### useRelationshipModal.ts

```typescript
export function useRelationshipModal() {
  const store    = useRelationshipModalStore()
  const allNodes = useNodes()
  const rfEdges  = useEdges()
  const { setNodes, setEdges } = useReactFlow()

  const [relationType,  setRelationType]  = useState<RelationType>(RelationType.ONE_TO_MANY)
  const [twoWayBinding, setTwoWayBinding] = useState(false)

  const entityA = allNodes.find(n => n.id === store.entityAId)
  const entityB = allNodes.find(n => n.id === store.entityBId)

  const entityALabel = entityA ? (entityA.data as EntityNode).label : ''
  const entityBLabel = entityB ? (entityB.data as EntityNode).label : ''

  // Reset state when modal opens
  useEffect(() => {
    if (store.isOpen) {
      setRelationType(RelationType.ONE_TO_MANY)
      setTwoWayBinding(false)
    }
  }, [store.isOpen])

  const handleConfirm = async () => {
    if (!store.entityAId || !store.entityBId) return

    await applyRelationship({
      trigger:       store.trigger!,
      entityAId:     store.entityAId,
      entityBId:     store.entityBId,
      fieldId:       store.fieldId,
      relationType,
      twoWayBinding,
      allNodes,
      rfEdges,
      setNodes,
      setEdges,
    })

    store.close()
  }

  return {
    isOpen:        store.isOpen,
    entityALabel,
    entityBLabel,
    relationType,
    setRelationType,
    twoWayBinding,
    setTwoWayBinding,
    handleConfirm,
    handleCancel:  store.close,
  }
}
```

### RelationshipModal.tsx

Renders as a centered modal overlay. Use a portal (`ReactDOM.createPortal`) to
render at the document body level so it sits above everything.

```tsx
{isOpen && ReactDOM.createPortal(
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    {/* Backdrop */}
    <div
      className="absolute inset-0 bg-black/40"
      onClick={handleCancel}
    />
    {/* Modal card */}
    <div className="relative bg-surface rounded-[var(--radius-lg)] shadow-modal
                    w-[420px] max-w-[90vw] p-5 flex flex-col gap-4"
         style={{ border: '1px solid var(--color-border-strong)' }}>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[14px] font-bold text-text">Entity Relationship</p>
          <p className="text-[11px] font-mono text-text-3 mt-0.5">
            {entityALabel} ↔ {entityBLabel}
          </p>
        </div>
        <button onClick={handleCancel}
                className="text-text-4 hover:text-text transition-colors
                           bg-transparent border-none cursor-pointer text-[16px]">
          ×
        </button>
      </div>

      {/* Relation type */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-mono font-bold text-text-3 uppercase tracking-wider">
          Relation type
        </label>
        <select
          value={relationType}
          onChange={e => setRelationType(e.target.value as RelationType)}
          className="w-full text-[12px] font-mono text-text bg-surface-alt
                     border border-[var(--color-border)] rounded-[var(--radius-sm)]
                     px-3 py-2 outline-none focus:border-[var(--color-border-focus)]"
        >
          <option value="ONE_TO_ONE">@OneToOne</option>
          <option value="ONE_TO_MANY">@OneToMany</option>
          <option value="MANY_TO_ONE">@ManyToOne</option>
          <option value="MANY_TO_MANY">@ManyToMany</option>
        </select>
      </div>

      {/* Two-way binding */}
      <div className="flex flex-col gap-2 p-3 rounded-[var(--radius-sm)]"
           style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-text-2">Two-way binding</span>
          <Toggle value={twoWayBinding} onChange={() => setTwoWayBinding(v => !v)} />
        </div>
        <p className="text-[10px] font-mono text-text-4">
          {twoWayBinding
            ? `A complementary field will be added to ${entityBLabel} automatically.`
            : 'Only the field in the source entity will be created.'}
        </p>
        {twoWayBinding && (
          <p className="text-[9px] font-mono text-text-3 italic">
            {complementaryRelation(relationType)} will be added on {entityBLabel}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={handleCancel}
          className="px-4 py-2 text-[11px] font-semibold text-text-3
                     bg-surface-alt rounded-[var(--radius-sm)] border border-[var(--color-border)]
                     hover:border-[var(--color-border-strong)] cursor-pointer transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          className="px-4 py-2 text-[11px] font-semibold
                     rounded-[var(--radius-sm)] cursor-pointer transition-colors"
          style={{
            background: 'var(--color-accent)',
            color:      'var(--color-accent-text)',
          }}
        >
          Confirm
        </button>
      </div>
    </div>
  </div>,
  document.body
)}
```

Place `<RelationshipModal />` in `Editor.tsx` (or `Canvas.tsx`) so it is always
mounted. It reads its own open state from the store.

### Complementary relation helper

```typescript
function complementaryRelation(kind: RelationType): string {
  switch (kind) {
    case RelationType.ONE_TO_MANY:  return '@ManyToOne'
    case RelationType.MANY_TO_ONE:  return '@OneToMany'
    case RelationType.ONE_TO_ONE:   return '@OneToOne'
    case RelationType.MANY_TO_MANY: return '@ManyToMany'
  }
}
```

---

## 4. `applyRelationship` function

Create in `src/utils/autoPopulate.ts`:

```typescript
export async function applyRelationship(params: {
  trigger:       RelationshipModalTrigger
  entityAId:     string
  entityBId:     string
  fieldId:       string | null   // only when trigger = FIELD_TYPE
  relationType:  RelationType
  twoWayBinding: boolean
  allNodes:      RFNode[]
  rfEdges:       RFEdge[]
  setNodes:      Function
  setEdges:      Function
}): Promise<void>
```

### Logic

```
1. Resolve EntityA and EntityB from allNodes

2. Determine edge type:
   entityAHasTable = rfEdges.some(e => e.data?.type === 'STORED_IN' && e.source === entityAId)
   entityBHasTable = rfEdges.some(e => e.data?.type === 'STORED_IN' && e.source === entityBId)
   edgeType = (entityAHasTable && entityBHasTable) ? EdgeType.RELATES_TO : EdgeType.EMBEDS

3. If trigger === 'CANVAS_EDGE':
   - Add a new EntityField to EntityA:
     {
       id:           generateId(),
       name:         entityBLabel.toLowerCase(),  // e.g. "orderItem"
       type:         'ENTITY_REF',
       entityTypeId: entityBId,
       relation:     {
         id:             generateId(),
         type:           relationType,
         targetEntityId: entityBId,
         mappedBy:       '',
         cascade:        CascadeType.NONE,
         fetch:          FetchType.LAZY,
         optional:       true,
       },
       entityTypeWarning: false,
       constraint:    FieldConstraint.NONE,
       nullable:      true,
       columnName:    '',
       defaultValue:  '',
       enumValues:    null,
       customTypeId:  null,
     }
   - Update EntityA in RF state + IDB

4. If trigger === 'FIELD_TYPE':
   - The field in EntityA already exists (user defined it in the inspector)
   - Find that field by fieldId
   - Set field.relation = {
       id:             generateId(),
       type:           relationType,
       targetEntityId: entityBId,
       mappedBy:       '',
       cascade:        CascadeType.NONE,
       fetch:          FetchType.LAZY,
       optional:       true,
     }
   - Set field.entityTypeWarning = false
   - Update EntityA in RF state + IDB

5. If twoWayBinding:
   - Compute complementary relation type (ONE_TO_MANY ↔ MANY_TO_ONE, etc.)
   - Add a new EntityField to EntityB:
     {
       name:         entityALabel.toLowerCase(),
       type:         'ENTITY_REF',
       entityTypeId: entityAId,
       relation: {
         type:           complementaryRelationType,
         targetEntityId: entityAId,
         ...defaults,
       },
       ...rest of defaults
     }
   - Update EntityB in RF state + IDB

6. Create or ensure EMBEDS/RELATES_TO edge exists between EntityA and EntityB:
   - Check rfEdges — if edge already exists → skip
   - If not → create edge in IDB + RF state
   
7. Post BroadcastChannel sync
```

---

## 5. Trigger from EntityInspector (FIELD_TYPE)

When the user selects an `ENTITY_REF` in the field type dropdown:

**In `useEntityInspector.ts` `handleFieldTypeChange`**, after the existing
"create edge" logic, also check if either entity has a table and open the modal
instead of silently setting the relation:

```typescript
// After setting the field type and before writing to IDB:
if (newType === 'ENTITY_REF' && newEntityTypeId) {
  // Always open the modal — let the user configure the relationship
  // The modal will call applyRelationship(trigger='FIELD_TYPE', ...)
  // which will set the relation on the field and handle two-way binding
  openRelationshipModal({
    trigger:   'FIELD_TYPE',
    entityAId: nodeId,
    entityBId: newEntityTypeId,
    fieldId:   fieldId,
  })
  // Do NOT write relation to IDB yet — modal handles that via applyRelationship
  // But DO write the basic field type change (name, type, entityTypeId) immediately
  const partialField = {
    ...field,
    type:         newType,
    entityTypeId: newEntityTypeId,
    relation:     null,           // will be set by modal
    entityTypeWarning: false,
  }
  // ... update RF state + IDB with partialField ...
}
```

---

## 6. One Edge Rule

Between any two EntityNodes there is always exactly **one** edge.
Even if EntityA has three fields referencing EntityB (unusual but possible),
the canvas shows only one edge.

Enforcement:
- In `onConnect`: check for existing edge in both directions before opening modal
- In `applyRelationship` step 6: check before creating edge

The edge is **not** removed when a single field's type is changed — only when
all fields referencing that entity are cleared (handled by `syncEntityTypeFields`
in `autoPopulate.ts`).

---

## 7. Verification

### TypeScript
```bash
npx tsc --noEmit
```

### Manual canvas edge

- [ ] Drag edge from EntityA to EntityB → RelationshipModal opens
- [ ] Modal shows "EntityA ↔ EntityB" labels
- [ ] Modal has relation type dropdown with @OneToOne, @OneToMany, @ManyToOne, @ManyToMany
- [ ] Cancel → no edge, no field changes
- [ ] Confirm → EMBEDS or RELATES_TO edge appears on canvas
- [ ] EntityA gets a new field with the entity type and relation config
- [ ] Second drag between same pair → rejected (modal does not open again)

### Two-way binding via canvas edge

- [ ] Enable two-way binding → hint shows complementary relation e.g. "@ManyToOne will be added on OrderItem"
- [ ] Confirm → EntityA gets field with @OneToMany, EntityB gets field with @ManyToOne
- [ ] Both fields have relation config populated

### Field type selection trigger

- [ ] Select EntityB as field type in EntityA's inspector → modal opens
- [ ] Confirm → field gets relation config, edge appears on canvas
- [ ] With two-way binding → complementary field added to EntityB

### One edge rule

- [ ] EntityA and EntityB already have an edge → drag another → rejected silently
- [ ] Multiple fields on EntityA reference EntityB → still only one edge on canvas
