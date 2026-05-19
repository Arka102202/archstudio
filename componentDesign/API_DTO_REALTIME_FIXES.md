# API Endpoint ↔ DTO — Real-time Sync Bug Fixes

> Claude Code: read this in full before writing a single line.
> This document fixes two bugs and adds real-time DTO info sync to the
> APIEndpointNode canvas card and inspector.
> No new files are needed — only targeted changes to existing files.

---

## Bug 1 — BOTH-purpose DTO connected but `bodyDTOId` stays null

### Root cause

When a DTO with `purpose = BOTH` is connected to an endpoint, the `onConnect`
handler infers the edge type by checking which slot is empty first:

```
if endpoint.request.bodyDTOId is null → create ACCEPTS edge, set bodyDTOId
elif endpoint.response.returnDTOId is null → create RETURNS edge, set returnDTOId
```

It creates the ACCEPTS edge and sets `bodyDTOId = dto.id` — but **never sets
`returnDTOId`** to the same id. The BOTH case requires writing the same DTO id
into both slots simultaneously.

### Fix — `useCanvas.ts` `onConnect` handler

In the ACCEPTS branch, after setting `bodyDTOId`, check the DTO's purpose:

```typescript
// Inside the ACCEPTS auto-population block:
const updatedEndpoint: APIEndpointNode = {
  ...endpoint,
  request: { ...endpoint.request, bodyDTOId: dto.id },
}

// If the DTO is BOTH-purpose, fill the response slot too.
// One DTO, one edge, both slots filled — no second DTO edge needed.
if (dto.purpose === DTOPurpose.BOTH) {
  updatedEndpoint.response = {
    ...updatedEndpoint.response,
    returnDTOId: dto.id,
  }
}
```

The DTO auto-population for ACCEPTS stays as it was:
```typescript
const updatedDTO: DTONode = {
  ...dto,
  purpose: DTOPurpose.BOTH,   // already BOTH — no change needed
  config:  { ...dto.config, validationEnabled: true },
}
```

Do not set `dto.purpose = REQUEST` when the DTO is already BOTH. Respect the
existing purpose — only enable validation.

**Write both nodes to IDB and RF state:**
```typescript
// 1. Update endpoint in RF state + IDB
setNodes(nodes => nodes.map(n =>
  n.id === endpoint.id ? { ...n, data: updatedEndpoint } : n
))
db.nodes.update(endpoint.id, {
  data:      JSON.stringify(updatedEndpoint),
  updatedAt: Date.now(),
})

// 2. Update DTO in RF state + IDB (validation enabled)
setNodes(nodes => nodes.map(n =>
  n.id === dto.id ? { ...n, data: updatedDTO } : n
))
db.nodes.update(dto.id, {
  data:      JSON.stringify(updatedDTO),
  updatedAt: Date.now(),
})
```

### Fix — guard for second DTO edge when BOTH is connected

The existing guard checks `if either slot is filled → reject`. This already
handles the case correctly once `returnDTOId` is also filled. Confirm the guard
reads:

```typescript
const endpointAlreadyFull =
  endpoint.request.bodyDTOId !== null &&
  endpoint.response.returnDTOId !== null

if (endpointAlreadyFull) return   // reject silently — both slots full
```

---

## Bug 2 — DTO purpose change in DTOInspector not reflected in endpoint

### Root cause

`useAPIEndpointInspector` and `useAPIEndpointNode` resolve DTO info at render
time by looking up DTO nodes in RF state via `bodyDTOId` and `returnDTOId`.
This lookup is correct — but when the DTO's `purpose` changes in DTOInspector,
the endpoint only re-renders if the DTO node's RF data changes in a way that
affects the lookup.

The real problem: the endpoint's own data (`bodyDTOId`, `returnDTOId`) does not
change when the DTO purpose changes. The endpoint canvas card and inspector
display DTO label and purpose — and `purpose` is on the DTO node, not on the
endpoint. If RF re-renders the DTO node but the endpoint component only watches
`endpoint.data`, the endpoint display goes stale.

There are two parts to the fix:

**Part A — `useAPIEndpointNode` and `useAPIEndpointInspector` must read DTO data
live from `useNodes()` on every render.**

Currently the hooks probably do something like:
```typescript
const requestDTOLabel = useMemo(() => {
  const dto = allNodes.find(n => n.id === endpoint.request.bodyDTOId)
  return dto ? (dto.data as DTONode).label : null
}, [endpoint.request.bodyDTOId])   // ← BUG: only depends on the ID, not the DTO data
```

The dependency array only includes the ID — if the DTO label or purpose changes
but the ID stays the same, the memo never re-runs.

**Part B — when DTO purpose changes in `useDTOInspector`, propagate the change
to any connected endpoint's slot assignments.**

When the user changes a DTO's purpose in the DTOInspector, check if any
endpoint has this DTO connected and update the endpoint's slots accordingly.

---

## Fix A — Live DTO data in `useAPIEndpointNode`

### In `useAPIEndpointNode.ts`

Replace the current DTO label derivation with one that reads the full DTO node
every render — **not** inside a `useMemo` with only the ID as dependency:

```typescript
// Read all RF nodes on every render — React Flow's useNodes() is already
// optimised for this (shallow comparison, only re-renders when nodes change)
const allNodes = useNodes()

// Resolve request DTO — read full node data, not just the label
const requestDTONode = node.request.bodyDTOId
  ? allNodes.find(n => n.id === node.request.bodyDTOId)
  : null
const requestDTO = requestDTONode
  ? (requestDTONode.data as DTONode)
  : null
const requestDTOLabel  = requestDTO?.label  ?? null
const requestDTOPurpose = requestDTO?.purpose ?? null

// Resolve response DTO
const responseDTONode = node.response.returnDTOId
  ? allNodes.find(n => n.id === node.response.returnDTOId)
  : null
const responseDTO = responseDTONode
  ? (responseDTONode.data as DTONode)
  : null
const responseDTOLabel  = responseDTO?.label  ?? null
const responseDTOPurpose = responseDTO?.purpose ?? null
```

Return from the hook:
```typescript
{
  node,
  isSelected,
  handleClick,
  requestDTOLabel,
  requestDTOPurpose,
  responseDTOLabel,
  responseDTOPurpose,
  // ... other existing returns
}
```

The canvas card now re-renders whenever any node in RF state changes — including
when the DTO node's purpose or label updates. No stale display.

### In `useAPIEndpointInspector.ts`

Same pattern. Replace any `useMemo` that depends only on `bodyDTOId` or
`returnDTOId` with direct reads from `useNodes()`:

```typescript
const allNodes = useNodes()
const allEdges = useEdges()

// Live DTO data — no memoisation, read fresh every render
const requestDTONode = node.request.bodyDTOId
  ? (allNodes.find(n => n.id === node.request.bodyDTOId)?.data as DTONode | undefined)
  : undefined

const responseDTONode = node.response.returnDTOId
  ? (allNodes.find(n => n.id === node.response.returnDTOId)?.data as DTONode | undefined)
  : undefined
```

Use `requestDTONode` and `responseDTONode` directly wherever DTO info is
displayed in the inspector — label, purpose, fields list, validation status.

---

## Fix B — Propagate DTO purpose change to connected endpoints

### In `useDTOInspector.ts` — `handlePurposeChange`

When the user changes a DTO's purpose, find any endpoints that have this DTO
connected and update their slot assignments accordingly:

```typescript
const handlePurposeChange = (value: DTOPurpose) => {
  // 1. Update the DTO itself
  const updatedDTO: DTONode = { ...node, purpose: value }

  setNodes(nodes => nodes.map(n =>
    n.id === nodeId ? { ...n, data: updatedDTO } : n
  ))
  debouncedUpdate(nodeId, updatedDTO)

  // 2. Find all endpoints connected to this DTO
  const acceptsEdge = allEdges.find(e =>
    e.data?.type === 'ACCEPTS' && e.target === nodeId
  )
  const returnsEdge = allEdges.find(e =>
    e.data?.type === 'RETURNS' && e.target === nodeId
  )

  // 3. Update connected endpoint slots based on new purpose
  const endpointId = acceptsEdge?.source ?? returnsEdge?.source ?? null

  if (endpointId) {
    const endpointRFNode = allNodes.find(n => n.id === endpointId)
    if (!endpointRFNode) return
    const endpoint = endpointRFNode.data as APIEndpointNode

    let updatedEndpoint = { ...endpoint }

    if (value === DTOPurpose.BOTH) {
      // DTO is now BOTH → fill both slots with this DTO's id
      updatedEndpoint = {
        ...updatedEndpoint,
        request:  { ...updatedEndpoint.request,  bodyDTOId:   nodeId },
        response: { ...updatedEndpoint.response, returnDTOId: nodeId },
      }
    } else if (value === DTOPurpose.REQUEST) {
      // DTO is now REQUEST only → fill bodyDTOId, clear returnDTOId if it was this DTO
      updatedEndpoint = {
        ...updatedEndpoint,
        request: { ...updatedEndpoint.request, bodyDTOId: nodeId },
        response: {
          ...updatedEndpoint.response,
          returnDTOId: updatedEndpoint.response.returnDTOId === nodeId
            ? null
            : updatedEndpoint.response.returnDTOId,
        },
      }
    } else if (value === DTOPurpose.RESPONSE) {
      // DTO is now RESPONSE only → fill returnDTOId, clear bodyDTOId if it was this DTO
      updatedEndpoint = {
        ...updatedEndpoint,
        request: {
          ...updatedEndpoint.request,
          bodyDTOId: updatedEndpoint.request.bodyDTOId === nodeId
            ? null
            : updatedEndpoint.request.bodyDTOId,
        },
        response: { ...updatedEndpoint.response, returnDTOId: nodeId },
      }
    }

    // 4. Update endpoint in RF state and IDB
    setNodes(nodes => nodes.map(n =>
      n.id === endpointId ? { ...n, data: updatedEndpoint } : n
    ))
    debouncedUpdate(endpointId, updatedEndpoint)
  }
}
```

This ensures:
- DTO changes to BOTH → endpoint has both slots filled with the same DTO id
- DTO changes to REQUEST → endpoint has `bodyDTOId` set, `returnDTOId` cleared (if it was pointing to this DTO)
- DTO changes to RESPONSE → endpoint has `returnDTOId` set, `bodyDTOId` cleared (if it was pointing to this DTO)

The `debouncedUpdate` for the endpoint uses 300ms, same as all other inspector
debounced writes.

---

## Summary of all files changed

```
src/pages/Editor/components/Canvas/useCanvas.ts
  → onConnect ACCEPTS branch: if dto.purpose === BOTH → also set returnDTOId
  → guard: check both bodyDTOId and returnDTOId to determine if slots are full

src/components/nodes/APIEndpointNode/useAPIEndpointNode.ts
  → replace memoised DTO label lookups with live useNodes() reads
  → return requestDTOPurpose and responseDTOPurpose from the hook

src/pages/Editor/components/InspectorPanel/components/APIEndpointInspector/useAPIEndpointInspector.ts
  → replace memoised DTO data with live useNodes() reads
  → use requestDTONode and responseDTONode directly for all DTO display

src/pages/Editor/components/InspectorPanel/components/DTOInspector/useDTOInspector.ts
  → handlePurposeChange: find connected endpoints via useEdges()
  → update endpoint bodyDTOId / returnDTOId based on new purpose value
  → write updated endpoint to RF state + IDB (debounced)
```

---

## Verification

### Bug 1 — BOTH-purpose DTO

- [ ] Connect a BOTH-purpose DTO to an endpoint → both `bodyDTOId` and `returnDTOId` are set to the same DTO id
- [ ] Canvas card shows both `body: OrderDTO` and `→ OrderDTO 200`
- [ ] Inspector REQUEST section shows the DTO in the Body DTO dropdown
- [ ] Inspector RESPONSE section shows the same DTO in the Return DTO dropdown
- [ ] Trying to connect a second DTO to the same endpoint → rejected (both slots full)
- [ ] After refresh → both slots still filled (IDB write was correct)

### Bug 2 — Real-time DTO purpose sync

- [ ] Connect a REQUEST DTO to an endpoint → `body:` chip appears on canvas card
- [ ] Open DTOInspector, change purpose to RESPONSE → canvas card immediately loses `body:` chip, response row updates
- [ ] Open DTOInspector, change purpose to BOTH → canvas card shows both `body:` and `→` response row
- [ ] Open DTOInspector, change purpose back to REQUEST → `body:` chip reappears, response row clears
- [ ] APIEndpointInspector Body DTO dropdown updates in real-time as DTO purpose changes
- [ ] APIEndpointInspector Return DTO dropdown updates in real-time
- [ ] All changes persist after refresh
- [ ] No stale display in the endpoint canvas card or inspector at any point during purpose changes
