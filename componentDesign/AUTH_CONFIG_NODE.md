# AuthConfigNode — Design & Build Specification

> Claude Code: read this in full before writing a single line.
> Follow every rule in CLAUDE.md alongside this document.
> CLAUDE.md has been updated with AuthConfigNode, AuthRuleNode, AuthType,
> JwtConfig, OAuth2Config, SessionConfig, BasicAuthConfig, ApiKeyConfig,
> UserEntityConfig, RuleEffect, RoleMatch, DEFINED_IN and SECURES EdgeTypes.
> This document covers the AuthConfigNode only.
> Node edges come in a separate document.

---

## 1. What Is AuthConfigNode

`AuthConfigNode` defines the **authentication mechanism** for a microservice.
It answers: "how do we verify who the user is?"

One `AuthConfigNode` per microservice. It holds:
- The auth type (JWT, OAuth2, Session, Basic Auth, API Key)
- Config specific to that auth type
- The user entity — which entity represents the authenticated user
- The roles list — all roles available in this microservice

`AuthRuleNode`s connect to it via `DEFINED_IN` edges and pick their roles
from its `roles` list.

---

## 2. Data Model

Already defined in CLAUDE.md. Confirm `src/entity/AuthConfigNode.ts` matches:

```typescript
export interface AuthConfigNode extends BaseNode {
  type:      NodeType.AUTH_CONFIG
  authType:  AuthType

  jwt:       JwtConfig | null
  oauth2:    OAuth2Config | null
  session:   SessionConfig | null
  basicAuth: BasicAuthConfig | null
  apiKey:    ApiKeyConfig | null

  userEntity: UserEntityConfig

  roles: string[]   // e.g. ["ADMIN", "TEACHER", "STUDENT"]
}
```

Only the config block matching `authType` is non-null.
All others are null. Enforce this when `authType` changes.

Export `AuthConfigNode` and all its sub-types from `src/entity/index.ts`.

---

## 3. Default Values

Add `createAuthConfigNode()` to `src/utils/node.ts`:

```typescript
export const createAuthConfigNode = (overrides?: Partial<AuthConfigNode>): AuthConfigNode => ({
  id:       generateId(),
  type:     NodeType.AUTH_CONFIG,
  label:    'Auth Config',
  msId:     '',
  position: { x: 0, y: 0 },
  size:     { w: 260, h: 180 },
  aiPrompt: emptyAIPrompt(),

  authType: AuthType.JWT,

  jwt: {
    secret:            '',
    expiration:        86400000,   // 24h
    issuer:            '',
    algorithm:         JwtAlgorithm.HS256,
    refreshToken:      false,
    refreshExpiration: 604800000,  // 7d
  },
  oauth2:    null,
  session:   null,
  basicAuth: null,
  apiKey:    null,

  userEntity: {
    entityId:      null,
    usernameField: 'email',
    passwordField: 'password',
    rolesField:    'role',
  },

  roles: [],

  ...overrides,
})
```

Export from `src/utils/index.ts`.

---

## 4. Visual Anatomy

```
┌──────────────────────────────────────┐  ← border: var(--node-auth-config-accent)
│                                      │
│  [AC]  Auth Config          [label]  │  ← HEADER
│        JWT                           │  ← auth type subtitle
│                                      │
├──────────────────────────────────────┤
│  algorithm  HS256                    │  ← key config fields
│  expiry     24h                      │
│  issuer     example.com              │
│                                      │
├──────────────────────────────────────┤
│  user       Teacher.email            │  ← user entity row
│  roles      ADMIN · TEACHER · STUDENT│  ← roles chips
└──────────────────────────────────────┘
```

Minimum size: **w 240, h 160**. No maximum.

### Accent colour token

Add to the theme:
```css
--node-auth-config-accent: #f59e0b;   /* amber */
--node-auth-config-icon-bg: #f59e0b22;
--node-auth-config-icon-fg: #f59e0b;
--node-auth-rule-accent: #f59e0b;     /* same amber family */
--node-auth-rule-icon-bg: #f59e0b18;
--node-auth-rule-icon-fg: #f59e0b;
```

### Canvas card component

```
src/components/nodes/AuthConfigNode/
├── AuthConfigNode.tsx
├── useAuthConfigNode.ts
├── types.ts
└── index.ts
```

#### `useAuthConfigNode.ts`

Returns:
```typescript
{
  node,           // AuthConfigNode
  isSelected,
  handleClick,
  authTypeLabel,  // e.g. "JWT", "Basic Auth"
  configSummary,  // 2-3 key fields from the active config — see below
  userEntityLabel, // e.g. "Teacher.email" or null
  roleChips,      // node.roles — shown as small chips
}
```

**`configSummary`** — derived per `authType`:
```typescript
function getConfigSummary(node: AuthConfigNode): { key: string; value: string }[] {
  switch (node.authType) {
    case AuthType.JWT:
      return [
        { key: 'algorithm', value: node.jwt?.algorithm ?? '' },
        { key: 'expiry',    value: formatDuration(node.jwt?.expiration ?? 0) },
        { key: 'issuer',    value: node.jwt?.issuer || '—' },
      ]
    case AuthType.OAUTH2:
      return [
        { key: 'provider', value: node.oauth2?.provider ?? '' },
        { key: 'redirect', value: node.oauth2?.redirectUri || '—' },
      ]
    case AuthType.SESSION:
      return [
        { key: 'timeout',  value: `${node.session?.timeout ?? 0}m` },
        { key: 'cookie',   value: node.session?.cookieName || '—' },
      ]
    case AuthType.BASIC_AUTH:
      return [
        { key: 'realm', value: node.basicAuth?.realm || '—' },
      ]
    case AuthType.API_KEY:
      return [
        { key: 'header', value: node.apiKey?.headerName || '—' },
        { key: 'param',  value: node.apiKey?.queryParam || '—' },
      ]
  }
}

function formatDuration(ms: number): string {
  if (ms >= 86400000) return `${ms / 86400000}d`
  if (ms >= 3600000)  return `${ms / 3600000}h`
  if (ms >= 60000)    return `${ms / 60000}m`
  return `${ms}ms`
}
```

**`userEntityLabel`**: resolve entity label from rfNodes by `userEntity.entityId`:
```typescript
const entityNode = node.userEntity.entityId
  ? allNodes.find(n => n.id === node.userEntity.entityId)
  : null
const userEntityLabel = entityNode
  ? `${(entityNode.data as EntityNode).label}.${node.userEntity.usernameField}`
  : null
```

#### `AuthConfigNode.tsx`

**Root div:**
```tsx
style={{
  border: isSelected
    ? `2px solid var(--node-auth-config-accent)`
    : `1px solid var(--node-auth-config-accent)60`,
  boxShadow: isSelected
    ? `0 0 0 3px var(--node-auth-config-accent)15`
    : 'var(--shadow-node)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--color-surface)',
}}
```

**NodeResizer:**
```tsx
<NodeResizer
  minWidth={240}
  minHeight={160}
  isVisible={isSelected}
  lineStyle={{ border: '1.5px solid var(--node-auth-config-accent)' }}
  handleStyle={{ background: 'var(--node-auth-config-accent)', border: 'none', width: 8, height: 8 }}
/>
```

**Header** — `className="flex items-center gap-2 px-3 pt-3 pb-2"`:
- Icon badge: 28×28, `background: var(--node-auth-config-icon-bg)`, text "AC", `text-[9px] font-mono font-bold`
- Label: `text-[13px] font-bold text-text flex-1 truncate`
- Auth type subtitle below: `text-[10px] font-mono text-text-3`

**Divider:** `className="mx-3 border-t border-[var(--color-border)]"`

**Config summary rows** — `className="px-3 py-2 flex flex-col gap-1"`:
```tsx
{configSummary.map(({ key, value }) => (
  <div key={key} className="flex items-center gap-2 min-w-0">
    <span className="text-[9px] font-mono text-text-4 w-16 flex-shrink-0">
      {key}
    </span>
    <span className="text-[10px] font-mono text-text-2 truncate">
      {value}
    </span>
  </div>
))}
```

**Divider**

**User entity row** — only when `userEntityLabel` is set:
```tsx
<div className="flex items-center gap-2 px-3 py-1 min-w-0">
  <span className="text-[9px] font-mono text-text-4 w-16 flex-shrink-0">user</span>
  <span className="text-[10px] font-mono text-text-2 truncate">{userEntityLabel}</span>
</div>
```

**Roles row** — only when `roles.length > 0`:
```tsx
<div className="flex items-center gap-1.5 px-3 pb-2 flex-wrap">
  <span className="text-[9px] font-mono text-text-4 w-16 flex-shrink-0">roles</span>
  {roleChips.map(role => (
    <span
      key={role}
      className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm"
      style={{
        background: 'var(--node-auth-config-icon-bg)',
        color:      'var(--node-auth-config-icon-fg)',
      }}
    >
      {role}
    </span>
  ))}
</div>
```

---

## 5. Register in Canvas

```typescript
import { AuthConfigNode } from '@components/nodes/AuthConfigNode'

const NODE_TYPES = {
  // ...existing...
  authConfig: AuthConfigNode,
} as const
```

IDB load type map: `'AUTH_CONFIG' → 'authConfig'`
Add `'authConfig'` case to `onDrop`.

---

## 6. Left Sidebar

In `useLeftSidebar.ts`: add `'authConfig'` to `handleAddNode` and `handleDragStart`.

In `LeftSidebar.tsx`:
- Icon: "AC" in `var(--node-auth-config-icon-bg)` / `var(--node-auth-config-icon-fg)`
- Label: "Auth Config"
- `ready: true`
- Same guard as all other nodes: disabled when no MS exists

Layers panel item:
```
● School Service
  🔐 School Auth        ← authConfig glyph
```
- Glyph: 🔐 or a lock icon
- Label: `node.label` + auth type subtitle (`JWT`, `Basic Auth` etc.)

---

## 7. Inspector Panel — AuthConfigInspector

### File structure

```
src/pages/Editor/components/InspectorPanel/components/AuthConfigInspector/
├── AuthConfigInspector.tsx
├── useAuthConfigInspector.ts
├── types.ts
└── index.ts
```

Wire into `InspectorPanel.tsx`:
```typescript
case NodeType.AUTH_CONFIG: return <AuthConfigInspector nodeId={selectedNodeId} />
```

### Panel anatomy

```
┌──────────────────────────────────────────┐
│ 🔐 Auth Config                      [×]  │
│ AUTH_CONFIG · id1                        │
├──────────────────────────────────────────┤
│ IDENTITY                                 │
│ [label                               ]   │
├──────────────────────────────────────────┤
│ AUTH TYPE                                │
│ [JWT                               ▼]   │
├──────────────────────────────────────────┤
│ JWT CONFIG        (shown when JWT)       │
│ Secret      [                      ]    │
│ Expiration  [86400000          ] ms     │
│ Issuer      [                      ]    │
│ Algorithm   [HS256              ▼]      │
│ Refresh     [toggle]                    │
│ Refresh exp [604800000         ] ms     │
├──────────────────────────────────────────┤  ← other config sections below
│ USER ENTITY                              │
│ Entity      [Teacher             ▼]     │  ← dropdown of EntityNodes in MS
│ Username    [email               ]      │
│ Password    [password            ]      │
│ Roles field [role                ]      │
├──────────────────────────────────────────┤
│ ROLES                                    │
│  ADMIN   [×]                            │
│  TEACHER [×]                            │
│  STUDENT [×]                            │
│  [role name         ] [+]               │
├──────────────────────────────────────────┤
│ CONNECTIONS                              │
│ → ● Admin Only      DEFINED_IN   [×]    │  ← AuthRuleNodes
│ → ● Public          DEFINED_IN   [×]    │
├──────────────────────────────────────────┤
│ [      Delete node            ]          │
└──────────────────────────────────────────┘
```

### Config sections per auth type

Show only the section matching the current `authType`. Hide all others.

**JWT section** (shown when `authType === JWT`):
- Secret: text input (masked — `type="password"` with show/hide toggle)
- Expiration: number input + unit display (convert ms to readable on the side)
- Issuer: text input
- Algorithm: select (HS256, HS512, RS256)
- Refresh token: toggle
- Refresh expiration: number input (only shown when refresh token is on)

**OAuth2 section** (shown when `authType === OAUTH2`):
- Provider: select (Google, GitHub, Facebook, Custom)
- Client ID: text input
- Client secret: password input
- Redirect URI: text input
- Scopes: tag-style add/remove (e.g. "openid", "email", "profile")
- Issuer URI: text input (only when provider = Custom)

**Session section** (shown when `authType === SESSION`):
- Timeout: number input (minutes)
- Cookie name: text input
- Secure: toggle
- HttpOnly: toggle

**Basic Auth section** (shown when `authType === BASIC_AUTH`):
- Realm: text input, placeholder "e.g. School Admin API"

**API Key section** (shown when `authType === API_KEY`):
- Header name: text input, placeholder "e.g. X-API-Key"
- Query param: text input, placeholder "e.g. api_key (optional)"
- Prefix: text input, placeholder "e.g. Bearer  (optional)"

### `useAuthConfigInspector.ts`

Same optimistic update pattern as all other inspectors: instant RF `setNodes`
→ debounced 300ms IDB write.

Handlers:
- `handleLabelChange(value: string)`
- `handleAuthTypeChange(value: AuthType)` — switches active config block:
  ```typescript
  // When authType changes, set the matching config to defaults, null all others
  const updatedNode = {
    ...node,
    authType: value,
    jwt:       value === AuthType.JWT        ? (node.jwt       ?? defaultJwtConfig())       : null,
    oauth2:    value === AuthType.OAUTH2     ? (node.oauth2    ?? defaultOAuth2Config())     : null,
    session:   value === AuthType.SESSION    ? (node.session   ?? defaultSessionConfig())    : null,
    basicAuth: value === AuthType.BASIC_AUTH ? (node.basicAuth ?? defaultBasicAuthConfig())  : null,
    apiKey:    value === AuthType.API_KEY    ? (node.apiKey    ?? defaultApiKeyConfig())     : null,
  }
  ```

- `handleJwtChange(patch: Partial<JwtConfig>)` — merges patch into `node.jwt`
- `handleOAuth2Change(patch: Partial<OAuth2Config>)`
- `handleSessionChange(patch: Partial<SessionConfig>)`
- `handleBasicAuthChange(patch: Partial<BasicAuthConfig>)`
- `handleApiKeyChange(patch: Partial<ApiKeyConfig>)`
- `handleUserEntityChange(patch: Partial<UserEntityConfig>)`
- `handleAddRole(role: string)` — add to `node.roles` if not duplicate
- `handleRemoveRole(role: string)` — remove from `node.roles`
- `handleDisconnectRule(edgeId: string)` — delete DEFINED_IN edge
- `handleClose()`
- `handleDelete()` — confirm → delete node + all DEFINED_IN edges from this node

### Default config factories

```typescript
const defaultJwtConfig = (): JwtConfig => ({
  secret: '', expiration: 86400000, issuer: '',
  algorithm: JwtAlgorithm.HS256, refreshToken: false, refreshExpiration: 604800000,
})

const defaultOAuth2Config = (): OAuth2Config => ({
  provider: OAuth2Provider.GOOGLE, clientId: '', clientSecret: '',
  redirectUri: '', scopes: ['openid', 'email'], issuerUri: '',
})

const defaultSessionConfig = (): SessionConfig => ({
  timeout: 60, cookieName: 'JSESSIONID', secure: true, httpOnly: true,
})

const defaultBasicAuthConfig = (): BasicAuthConfig => ({
  realm: '',
})

const defaultApiKeyConfig = (): ApiKeyConfig => ({
  headerName: 'X-API-Key', queryParam: '', prefix: '',
})
```

---

## 8. IDB Persistence

```typescript
await db.nodes.add({
  id:        node.id,
  projectId: currentProjectId,
  msId:      currentMsId,
  type:      'AUTH_CONFIG',
  label:     node.label,
  position:  node.position,
  size:      node.size,
  data:      JSON.stringify(node),
  createdAt: Date.now(),
  updatedAt: Date.now(),
})
```

All config sub-objects are serialised inside `data` as part of the full node.

---

## 9. `exportArchitecture.ts` Update

Add `authConfig` to the exported object:

```typescript
const authConfigs = getAll<AuthConfigNode>(NodeType.AUTH_CONFIG)

const authConfigsOut = authConfigs.map(ac => ({
  id:       ac.id,
  label:    ac.label,
  authType: ac.authType,
  jwt:      ac.jwt,
  oauth2:   ac.oauth2,
  session:  ac.session,
  basicAuth: ac.basicAuth,
  apiKey:   ac.apiKey,
  userEntity: ac.userEntity,
  roles:    ac.roles,
}))
```

Add `authConfigs: authConfigsOut` to the returned object.

---

## 10. Verification

### TypeScript
```bash
npx tsc --noEmit
```
Zero errors.

### Canvas

- [ ] Auth Config palette item appears in sidebar
- [ ] Drag → drop inside MS → AuthConfigNode appears with amber border
- [ ] Canvas card shows: "AC" icon, label, auth type subtitle
- [ ] JWT selected → shows algorithm, expiry, issuer on canvas card
- [ ] Basic Auth selected → shows realm on canvas card
- [ ] User entity row visible when entity connected (comes later via edges)
- [ ] Roles chips visible when roles added

### Inspector — Auth Type switching

- [ ] Select JWT → JWT config section appears, all others hidden
- [ ] Select OAuth2 → OAuth2 section appears, JWT section hidden
- [ ] Select Session → Session section appears
- [ ] Select Basic Auth → Basic Auth section with realm input
- [ ] Select API Key → API Key section with header/param inputs
- [ ] Switching auth type preserves previously entered config for that type
  (switching JWT → OAuth2 → JWT restores the JWT config, not reset)

### Inspector — JWT config

- [ ] Secret input: type="password" with show/hide toggle
- [ ] Expiration input: number, readable duration shown beside it
- [ ] Algorithm select: HS256, HS512, RS256
- [ ] Refresh token toggle: off by default
- [ ] Refresh expiration: only visible when refresh token is on

### Inspector — Roles

- [ ] Type a role name → click + → role chip appears
- [ ] Click × on chip → role removed
- [ ] Duplicate role rejected (not added twice)
- [ ] Roles list persists after refresh

### Inspector — User Entity

- [ ] Entity dropdown lists all EntityNodes in the same MS
- [ ] Select Teacher entity → canvas card shows "Teacher.email"
- [ ] Username, password, roles field inputs update correctly

### IDB persistence

- [ ] Add AuthConfigNode → refresh → node reappears with full config
- [ ] All JWT fields persist
- [ ] Roles list persists
- [ ] User entity selection persists
- [ ] Export JSON includes `authConfigs` array with correct data
