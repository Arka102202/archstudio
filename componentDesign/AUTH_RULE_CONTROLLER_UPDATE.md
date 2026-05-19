# Controller & APIEndpoint — Auth Rule Security Update

> Claude Code: read this in full before writing a single line.
> This document covers changes to ControllerNode and APIEndpointNode only.
> AuthConfigNode and AuthRuleNode specs come in a separate document.
> Follow every rule in CLAUDE.md alongside this document.

---

## What Changes

**Remove** from both nodes:
- All RBAC config (`RBAC`, `RBACStrategy`, `RoleRule`, `RoleAccess`)
- `ControllerSecurity` interface
- `SecurityOverride` enum
- `EndpointSecurity` interface (if it exists)
- `perEndpointOverride` flag

**Add** to both nodes:
- `authRuleId: string | null` — the ID of the connected `AuthRuleNode`
- This is the ONLY security field on both nodes
- It is set automatically when a `SECURES` edge is drawn from an `AuthRuleNode`
- It is cleared when that edge is deleted

---

## 1. Update `CLAUDE.md` — Remove old types, add new field

### Remove these entirely from CLAUDE.md

```typescript
// REMOVE ALL OF THESE:
export interface ControllerSecurity { ... }
export interface RBAC { ... }
export enum RBACStrategy { ... }
export interface RoleRule { ... }
export enum RoleAccess { ... }
export enum SecurityOverride { ... }
```

### Update `ControllerNode`

```typescript
export interface ControllerNode extends BaseNode {
  type:               NodeType.CONTROLLER
  basePath:           string
  authRuleId:         string | null   // → AuthRuleNode.id, set by SECURES edge
  errorHandlerConfig: ErrorHandlerConfig
  config:             ControllerConfig
  swaggerTags:        string[]
}
```

### Update `APIEndpointNode`

```typescript
export interface APIEndpointNode extends BaseNode {
  type:          NodeType.API_ENDPOINT
  method:        HttpMethod
  path:          string
  config:        EndpointConfig
  authRuleId:    string | null   // → AuthRuleNode.id, set by SECURES edge
                                 // null = inherit from controller's authRuleId
  request:       EndpointRequest
  response:      EndpointResponse
  errorHandling: EndpointErrorHandling
}
```

### Update `EndpointConfig`

Remove `idempotent` (that is not user-facing enough to keep):

```typescript
export interface EndpointConfig {
  paginated:   boolean
  deprecated:  boolean
  description: string
}
```

---

## 2. Update entity files

### `src/entity/ControllerNode.ts`

- Remove `ControllerSecurity`, `RBAC`, `RBACStrategy`, `RoleRule`, `RoleAccess`
- Replace `security: ControllerSecurity` with `authRuleId: string | null`

### `src/entity/APIEndpointNode.ts`

- Remove `SecurityOverride` enum
- Remove any `EndpointSecurity` interface
- Replace `security: EndpointSecurity` with `authRuleId: string | null`
- Remove `idempotent` from `EndpointConfig`

---

## 3. Update factory defaults

### `createControllerNode()` in `src/utils/node.ts`

```typescript
// Replace:
security: {
  enabled:             false,
  authGuardId:         null,
  rbac:                { strategy: RBACStrategy.ALLOW_LIST, rules: [] },
  perEndpointOverride: false,
}

// With:
authRuleId: null,
```

### `createAPIEndpointNode()` in `src/utils/node.ts`

```typescript
// Replace:
security: {
  override: SecurityOverride.INHERIT,
  rbac:     { strategy: RBACStrategy.ALLOW_LIST, rules: [] },
}

// With:
authRuleId: null,
```

---

## 4. Canvas card updates

### `ControllerNode.tsx` — Canvas card

**Remove** the security badge/indicator that shows RBAC strategy or auth guard status.

**Add** a security rule display — only shown when `authRuleId` is not null:

In `useControllerNode.ts`, resolve the rule name:
```typescript
const authRuleNode = authRuleId
  ? allNodes.find(n => n.id === authRuleId)
  : null
const authRuleName = authRuleNode
  ? (authRuleNode.data as AuthRuleNode).ruleName
  : null
```

In the canvas card body, add a security row — only when `authRuleName` is set:
```tsx
{authRuleName && (
  <div className="flex items-center gap-1.5 mt-1">
    <span className="text-[9px]"
          style={{ color: 'var(--node-auth-rule-accent)' }}>
      🔒
    </span>
    <span className="text-[9px] font-mono truncate"
          style={{ color: 'var(--node-auth-rule-accent)' }}>
      {authRuleName}
    </span>
  </div>
)}
```

When `authRuleId` is null — show nothing (no security badge at all).

### `APIEndpointNode.tsx` — Canvas card

**Remove** the "inherit 🔒" / "custom" security badge in the header.

**Add** — same pattern as controller, in the endpoint body:
```tsx
{authRuleName && (
  <div className="flex items-center gap-1.5">
    <span className="text-[9px]"
          style={{ color: 'var(--node-auth-rule-accent)' }}>
      🔒
    </span>
    <span className="text-[9px] font-mono truncate"
          style={{ color: 'var(--node-auth-rule-accent)' }}>
      {authRuleName}
    </span>
  </div>
)}
```

When `authRuleId` is null — no lock icon, no badge.

---

## 5. Inspector panel updates

### `ControllerInspector.tsx` — Remove security section entirely

**Remove:**
- Section 5 or whichever section was "Security" / "RBAC"
- All RBAC handlers from `useControllerInspector.ts`:
  - `handleSecurityEnabledToggle`
  - `handleRBACStrategyChange`
  - `handleAddRoleRule`
  - `handleRemoveRoleRule`
  - `handlePerEndpointOverrideToggle`

**Add** — read-only security display in the CONNECTIONS section:

In the connections list, the `AuthRuleNode` connected via `SECURES` edge
already appears. No separate security section needed.

If no AuthRuleNode is connected, show a subtle hint:
```tsx
{!authRuleId && (
  <p className="text-[9px] font-mono text-text-4 italic">
    No security rule — connect an Auth Rule node to secure this controller
  </p>
)}
```

### `APIEndpointInspector.tsx` — Replace security section

**Remove:**
- `SecurityOverride` dropdown (Inherit / Public / Custom)
- RBAC fields that appeared when CUSTOM was selected
- `handleSecurityOverrideChange`
- All RBAC handlers

**Add** — read-only display of the connected AuthRuleNode:

Replace the entire security section with:

```tsx
{/* Section — Security */}
<div className="flex flex-col gap-2 px-4 py-3 border-t border-[var(--color-border)]">
  <p className="text-[9px] font-mono font-bold text-text-3 uppercase tracking-wider">
    SECURITY
  </p>

  {authRuleName ? (
    <div className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)]"
         style={{
           background: 'var(--color-surface-alt)',
           border:     '1px solid var(--color-border)',
         }}>
      <span style={{ color: 'var(--node-auth-rule-accent)' }}>🔒</span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[11px] font-mono text-text truncate">
          {authRuleName}
        </span>
        <span className="text-[9px] font-mono text-text-4">
          {authRuleEffect}   {/* e.g. "ALLOW — ADMIN, TEACHER" */}
        </span>
      </div>
    </div>
  ) : (
    <p className="text-[9px] font-mono text-text-4 italic">
      No security rule — connect an Auth Rule node via SECURES edge
    </p>
  )}
</div>
```

`authRuleName` and `authRuleEffect` are derived in `useAPIEndpointInspector`:

```typescript
const authRuleEdge = allEdges.find(e =>
  e.data?.type === 'SECURES' && e.target === nodeId
)
const authRuleNode = authRuleEdge
  ? (allNodes.find(n => n.id === authRuleEdge.source)?.data as AuthRuleNode)
  : null

const authRuleName   = authRuleNode?.ruleName ?? null
const authRuleEffect = authRuleNode
  ? authRuleNode.effect === 'ALLOW_ALL'
    ? 'Public — no auth required'
    : authRuleNode.effect === 'DENY_ALL'
    ? 'Locked — all access denied'
    : `${authRuleNode.effect} — ${authRuleNode.roles.join(', ')}`
  : null
```

---

## 6. `onConnect` — Remove old security edge logic

### Remove from `useCanvas.ts`

Any `onConnect` logic that handled:
- `SECURED_BY` edge between `AuthGuardNode` and `ControllerNode`
- Setting `security.authGuardId` on controller
- Setting `security.enabled = true` on controller

This will be replaced by the new `SECURES` edge from `AuthRuleNode` — that
comes in the AuthRuleNode spec document. For now just remove the old logic.

---

## 7. CONNECTIONS section updates

### `ControllerInspector` CONNECTIONS section

The `AuthRuleNode` connected via `SECURES` shows as an incoming connection:

```
CONNECTIONS
← ● GET /orders          ROUTES TO    [×]
← ● POST /orders         ROUTES TO    [×]
→ ● Admin Access         SECURED BY   [×]   ← AuthRuleNode
→ ● OrderService         INVOKES      [×]
```

Arrow direction:
- `←` = endpoint routes TO this controller (incoming)
- `→` = controller is SECURED BY a rule (outgoing from rule's perspective,
  but displayed as outgoing from controller for readability)

"SECURED BY" badge colour: `var(--node-auth-rule-accent)`

When `×` is clicked on the SECURED BY row:
- Delete the `SECURES` edge from IDB + RF state
- Set `controller.authRuleId = null`
- Update controller in IDB + RF state

### `APIEndpointInspector` CONNECTIONS section

Same pattern — show the AuthRuleNode if connected:

```
CONNECTIONS
→ ● OrderController      ROUTES TO    [×]
→ ● OrderRequestDTO      ACCEPTS      [×]
→ ● OrderDTO             RETURNS      [×]
→ ● Admin Access         SECURED BY   [×]
```

---

## 8. Remove from `codeEditorStore` / generation

Any reference to `security.enabled`, `security.rbac`, `security.override`,
`SecurityOverride`, `RBAC`, `RBACStrategy` in:
- `exportArchitecture.ts`
- `buildFileTree.ts`
- Any generation prompt building code

Replace with `authRuleId` — just the ID reference. The actual rule data will
come from the AuthRuleNode in the architecture export.

---

## 9. TypeScript verification

```bash
npx tsc --noEmit
```

Expected errors to fix:
- Any component reading `node.security.enabled` → read `node.authRuleId` instead
- Any component reading `node.security.rbac.rules` → remove entirely
- Any component rendering `SecurityOverride` dropdown → remove
- Any handler named `handleRBACStrategyChange` etc. → remove

Zero errors before moving on.

---

## Summary of Files Changed

```
src/entity/ControllerNode.ts
  → remove ControllerSecurity, RBAC, RBACStrategy, RoleRule, RoleAccess
  → replace security: ControllerSecurity with authRuleId: string | null

src/entity/APIEndpointNode.ts
  → remove SecurityOverride enum, EndpointSecurity interface
  → replace security: EndpointSecurity with authRuleId: string | null
  → remove idempotent from EndpointConfig

src/utils/node.ts
  → createControllerNode: authRuleId: null
  → createAPIEndpointNode: authRuleId: null

src/components/nodes/ControllerNode/useControllerNode.ts
  → resolve authRuleName from rfNodes by authRuleId
  → remove all security/RBAC derived values

src/components/nodes/ControllerNode/ControllerNode.tsx
  → remove security badge
  → add authRuleName display row (only when set)

src/components/nodes/APIEndpointNode/useAPIEndpointNode.ts
  → resolve authRuleName from rfNodes by authRuleId
  → remove security badge derivation

src/components/nodes/APIEndpointNode/APIEndpointNode.tsx
  → remove "inherit 🔒" / "custom" badge
  → add authRuleName display (only when set)

src/pages/Editor/components/InspectorPanel/components/ControllerInspector/
useControllerInspector.ts
  → remove all RBAC handlers
  → derive authRuleName from edges

src/pages/Editor/components/InspectorPanel/components/ControllerInspector/
ControllerInspector.tsx
  → remove security section entirely
  → add hint in connections if no auth rule connected

src/pages/Editor/components/InspectorPanel/components/APIEndpointInspector/
useAPIEndpointInspector.ts
  → remove security override handlers
  → derive authRuleName + authRuleEffect from edges

src/pages/Editor/components/InspectorPanel/components/APIEndpointInspector/
APIEndpointInspector.tsx
  → replace security section with read-only AuthRuleNode display

src/pages/Editor/components/Canvas/useCanvas.ts
  → remove SECURED_BY edge logic for old AuthGuardNode → Controller

src/utils/exportArchitecture.ts
  → replace security fields with authRuleId in controller + endpoint output
```
