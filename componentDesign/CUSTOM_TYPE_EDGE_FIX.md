# Custom Type Edge — Fix & Clarification Spec

> Claude Code: read this in full before writing a single line.
> This document fixes three missing behaviours in the CustomTypeNode implementation.
> CUSTOM_TYPE_NODE.md, ENTITY_TYPE_FIELDS.md, and CLAUDE.md are all prerequisites.
> The `USES_CUSTOM_TYPE` edge type and `CustomTypeNode` entity already exist.

---

## What This Fixes

1. **Missing auto-edge in EntityInspector** — when a user sets a field type to
   `CUSTOM_TYPE_REF` on an EntityNode, no `USES_CUSTOM_TYPE` edge is created.
   It currently only works for DTONode.

2. **Missing edge propagation in `DERIVED_FROM`** — when a DTO is connected to an
   Entity that already has `CUSTOM_TYPE_REF` fields, the DTO does not get
   `USES_CUSTOM_TYPE` edges to those CustomTypeNodes even though it inherited those fields.

3. **Missing `onConnect` guard** — the user can currently drag an edge directly to
   or from a CustomTypeNode on the canvas. This must be blocked. All `USES_CUSTOM_TYPE`
   edges must be created programmatically only — never by canvas drag.

---

## Fix 1 — Auto-edge when Entity field type is set to CUSTOM_TYPE_REF

### File: `useEntityInspector.ts` — `handleFieldTypeChange`

The existing implementation handles `ENTITY_REF` edges (creates `EMBEDS` or
`RELATES_TO`). It currently does nothing for `CUSTOM_TYPE_REF`.

After the section that handles `ENTITY_REF`, add the following block:

```typescript
// ── Handle CUSTOM_TYPE_REF — create USES_CUSTOM_TYPE edge ─────────────────
if (newType === 'CUSTOM_TYPE_REF' && newCustomTypeId) {
  const alreadyConnected = rfEdges.some(e =>
    e.data?.type === 'USES_CUSTOM_TYPE' &&
    e.source === nodeId &&
    e.target === newCustomTypeId
  )
  if (!alreadyConnected) {
    const newEdge = {
      id:         generateId(),
      projectId:  currentProjectId,
      fromNodeId: nodeId,           // EntityNode
      toNodeId:   newCustomTypeId,  // CustomTypeNode
      type:       'USES_CUSTOM_TYPE',
      label:      'USES_CUSTOM_TYPE',
    }
    await db.edges.add(newEdge)
    setEdges(edges => [...edges, {
      id:     newEdge.id,
      source: nodeId,
      target: newCustomTypeId,
      type:   'usesCustomType',
      data:   newEdge,
    }])
  }
}
```

Also handle the **removal** side — when a field type changes **away from**
`CUSTOM_TYPE_REF`, or the field is removed entirely. This is done by calling
`syncCustomTypeEdges` (defined below) after every field mutation.

### Removal helper: `syncCustomTypeEdges`

Add to `src/utils/autoPopulate.ts` and also call it from `useDTOInspector.ts`
(it already has a similar concept with `syncDTOEntityEdges`).

```typescript
/**
 * After any field mutation on an Entity or DTO node, call this to ensure
 * USES_CUSTOM_TYPE edges are exactly in sync with the fields.
 * Creates missing edges and removes stale ones.
 */
export function syncCustomTypeEdges(
  ownerNodeId:  string,
  updatedFields: Array<{ type: string; customTypeId: string | null }>,
  currentEdges:  RFEdge[],
  setEdges:      (updater: (edges: RFEdge[]) => RFEdge[]) => void,
  db:            Dexie,
  projectId:     string,
): void {
  // 1. Collect all custom type IDs still referenced in fields
  const neededIds = new Set<string>()
  for (const field of updatedFields) {
    if (field.type === 'CUSTOM_TYPE_REF' && field.customTypeId) {
      neededIds.add(field.customTypeId)
    }
  }

  // 2. Find all existing USES_CUSTOM_TYPE edges from this node
  const existing = currentEdges.filter(e =>
    e.data?.type === 'USES_CUSTOM_TYPE' && e.source === ownerNodeId
  )

  // 3. Remove edges that are no longer needed
  for (const edge of existing) {
    if (!neededIds.has(edge.target)) {
      db.edges.delete(edge.id)
      setEdges(edges => edges.filter(e => e.id !== edge.id))
    }
  }

  // 4. Add edges for custom types not yet connected
  const existingTargets = new Set(existing.map(e => e.target))
  for (const customTypeId of neededIds) {
    if (!existingTargets.has(customTypeId)) {
      const newEdge = {
        id:         generateId(),
        projectId,
        fromNodeId: ownerNodeId,
        toNodeId:   customTypeId,
        type:       'USES_CUSTOM_TYPE',
        label:      'USES_CUSTOM_TYPE',
      }
      db.edges.add(newEdge)
      setEdges(edges => [...edges, {
        id:     newEdge.id,
        source: ownerNodeId,
        target: customTypeId,
        type:   'usesCustomType',
        data:   newEdge,
      }])
    }
  }
}
```

### Call `syncCustomTypeEdges` in `useEntityInspector.ts`

Call it at the end of every handler that mutates `fields[]`:
- `handleAddField`
- `handleRemoveField`
- `handleFieldTypeChange`

Pass the full `updatedNode.fields` array each time.

### Call `syncCustomTypeEdges` in `useDTOInspector.ts`

Same — call at the end of every fields mutation handler.
The existing `syncDTOEntityEdges` function handles `USES_TYPE` edges.
`syncCustomTypeEdges` handles `USES_CUSTOM_TYPE` edges separately.
Both must be called together after every field change.

---

## Fix 2 — DERIVED_FROM propagates Custom Type edges to DTO

### File: `src/utils/autoPopulate.ts` — `applyDerivedFromEdge`

The `DERIVED_FROM` edge already copies entity fields into the DTO.
After copying the fields, it must also ensure the DTO gets `USES_CUSTOM_TYPE`
edges for every `CUSTOM_TYPE_REF` field that was copied.

**In the caller of `applyDerivedFromEdge`** — which lives in `useCanvas.ts`
inside `onConnect` — after the DTO node is updated, call `syncCustomTypeEdges`:

```typescript
// After applyDerivedFromEdge returns the updated DTO node:
const updatedDTO = applyDerivedFromEdge(dtoNode, entityNode)

// 1. Update DTO in RF state + IDB
setNodes(nodes => nodes.map(n =>
  n.id === dtoNode.id ? { ...n, data: updatedDTO } : n
))
db.nodes.update(dtoNode.id, {
  data:      JSON.stringify(updatedDTO),
  updatedAt: Date.now(),
})

// 2. Sync USES_CUSTOM_TYPE edges — create edges to any CustomTypeNode
//    that the copied fields reference
syncCustomTypeEdges(
  dtoNode.id,
  updatedDTO.fields,
  rfEdges,
  setEdges,
  db,
  currentProjectId,
)
```

This means: if the Entity has a field `address: CUSTOM_TYPE_REF → Address`, and
the DTO inherits that field, the DTO will automatically get a `USES_CUSTOM_TYPE`
edge to the `Address` CustomTypeNode — the same edge the Entity already has.

---

## Fix 3 — Block all manual canvas edges to/from CustomTypeNode

### File: `useCanvas.ts` — `onConnect`

At the very top of `onConnect`, before any other edge logic, add this guard:

```typescript
const onConnect = useCallback((connection: Connection) => {
  const sourceNode = rfNodes.find(n => n.id === connection.source)
  const targetNode = rfNodes.find(n => n.id === connection.target)

  const sourceType = (sourceNode?.data as BaseNode)?.type
  const targetType = (targetNode?.data as BaseNode)?.type

  // Block all manual edges to or from CustomTypeNode
  if (
    sourceType === NodeType.CUSTOM_TYPE ||
    targetType === NodeType.CUSTOM_TYPE
  ) {
    return   // silently reject — no toast, no error
  }

  // ... rest of existing onConnect logic ...
}, [...])
```

This is a complete block. No edge can be manually drawn involving a CustomTypeNode.
The only `USES_CUSTOM_TYPE` edges that exist are created by `syncCustomTypeEdges`.

---

## Summary of Files Changed

```
src/utils/autoPopulate.ts
  → Add syncCustomTypeEdges() function
  → Export it from src/utils/index.ts

src/pages/Editor/components/Canvas/useCanvas.ts
  → onConnect: add CustomTypeNode guard at the top (Fix 3)
  → DERIVED_FROM onConnect handler: call syncCustomTypeEdges after applyDerivedFromEdge (Fix 2)

src/pages/Editor/components/InspectorPanel/components/EntityInspector/useEntityInspector.ts
  → handleFieldTypeChange: add CUSTOM_TYPE_REF edge creation block (Fix 1)
  → handleAddField, handleRemoveField, handleFieldTypeChange: call syncCustomTypeEdges at end

src/pages/Editor/components/InspectorPanel/components/DTOInspector/useDTOInspector.ts
  → handleAddField, handleRemoveField, handleFieldTypeChange: call syncCustomTypeEdges at end
```

No new files. No new edge types. No schema changes.

---

## Verification

### Fix 1 — Entity field → Custom Type edge

- [ ] Create EntityNode "Order" and CustomTypeNode "Address"
- [ ] In Order's inspector, add field `shippingAddress: CUSTOM_TYPE_REF → Address`
- [ ] Dashed `USES_CUSTOM_TYPE` edge appears from Order to Address immediately
- [ ] Change `shippingAddress` type to `String` → edge is removed
- [ ] Add two fields both typed `CUSTOM_TYPE_REF → Address` → still only one edge
- [ ] Remove one of those fields → edge stays (other field still references it)
- [ ] Remove both fields → edge removed

### Fix 2 — DERIVED_FROM propagates custom type edges to DTO

- [ ] Order entity has field `shippingAddress: CUSTOM_TYPE_REF → Address`
  (USES_CUSTOM_TYPE edge already exists between Order and Address)
- [ ] Create OrderDTO and draw DERIVED_FROM edge from OrderDTO to Order
- [ ] OrderDTO inherits the `shippingAddress` field
- [ ] A second dashed `USES_CUSTOM_TYPE` edge appears from OrderDTO to Address
- [ ] Both edges (Order→Address and OrderDTO→Address) are visible on canvas

### Fix 3 — Cannot manually draw edges to/from CustomTypeNode

- [ ] Try dragging edge from Order to Address (CustomTypeNode) → rejected silently, no edge
- [ ] Try dragging edge from Address to Order → rejected silently
- [ ] Try dragging edge from Address to OrderDTO → rejected silently
- [ ] Try dragging edge from Address to another CustomTypeNode → rejected silently
- [ ] The only way to get a USES_CUSTOM_TYPE edge is via the field type dropdown

### IDB persistence

- [ ] All three scenarios persist after page refresh
- [ ] Order→Address edge persists
- [ ] OrderDTO→Address edge persists after DERIVED_FROM
- [ ] Removing the field removes the edge and that persists after refresh
