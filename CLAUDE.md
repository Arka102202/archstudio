# archflow — Project Bible

> Claude Code: read this file in full at the start of every session before touching any code.

---

## What This App Is

A visual backend architecture designer for Spring Boot microservices.

Users drag nodes onto a canvas and draw connections between them. The system auto-populates all derived data from those connections. The user never manually fills in what can be inferred.

Phase 2 (not in scope now) will use AI to generate actual Spring Boot project files from the completed diagram.

---

## Scope

- Visual architecture designer + code generation via local Claude Code proxy
- All data persisted locally via IndexedDB (Dexie)
- Service worker for offline support + cross-tab sync
- React + TypeScript strict mode throughout

---

## Tech Stack

| Tool | Purpose |
|---|---|
| React 18 + TypeScript (strict) | UI framework |
| @xyflow/react | Canvas and node rendering |
| Dexie.js | IndexedDB wrapper |
| Zustand | UI state (selection, zoom, pan) |
| TanStack Query | Data access hooks over Dexie |
| React Router v6 | Routing |
| Tailwind CSS | Styling |
| Vite | Build tool |
| vite-plugin-pwa + Workbox | Service worker |
| uuid (crypto.randomUUID) | ID generation |

---

## Core Philosophy

```
User defines WHAT exists (nodes) + HOW things relate (connections).
The system derives EVERYTHING ELSE from those two inputs.
```

The user only ever manually provides:
- Node names and labels
- Entity field names, types, constraints
- Enum values
- Base paths and HTTP method + path for endpoints
- Role names for RBAC
- AI prompt descriptions (optional — on any node)

Everything else — DTO fields, service method signatures, response codes,
security wiring, validation annotations, linked IDs — is auto-populated
when connections are drawn.

---

## The 9 Node Types

| # | Node | Layer | Role |
|---|---|---|---|
| 1 | MicroserviceNode | Architecture | Top-level container. Bounded context. One deployable unit. |
| 2 | EntityNode | Data | JPA model. Source of truth for all data shape. |
| 3 | DTONode | Contract | Request/response shape. Derived from Entity or custom. |
| 4 | DBNode | Infrastructure | Database connection config only. One per datasource. |
| 5 | TableNode | Infrastructure | Table-level config + custom queries. Linked to one Entity + one DBNode. |
| 6 | AuthGuardNode | Security | Auth filter + user/role loading pipeline. |
| 7 | ControllerNode | HTTP | Routing + RBAC enforcement. |
| 8 | ServiceNode | Business Logic | Pure business logic. No HTTP, no direct DB. |
| 9 | APIEndpointNode | HTTP | Single HTTP operation. Most granular unit. |

---

## The Request Pipeline

```
HTTP Request → AuthConfigNode (verifies identity)
             → AuthRuleNode (checks access policy)
             → ControllerNode → APIEndpointNode
             → ServiceNode → EntityNode → TableNode → DBNode
             → DTO response
```

---

## Auto-Population Rules

> Implemented in: `src/utils/autoPopulate.ts`
> Called from: `src/service/edge/useCreateEdge.ts` after every new edge

These fire automatically when the user draws a connection. The function returns
`{ fromNodeUpdates, toNodeUpdates }` — partial updates applied to both nodes.

### DTO → Entity (`DERIVED_FROM`)
- Copy all entity fields into `dto.fields`
- Set `dto.linkedEntityId = entity.id`
- If this is the first DTO connected to this entity → `dto.purpose = RESPONSE`
- If a second DTO is connected to same entity → `dto.purpose = REQUEST`
- On REQUEST DTOs: add `@NotNull` validation to all non-PK fields automatically
- Toast: `"X fields copied from EntityName"`

### Entity → TableNode (`STORED_IN`)
- Set `table.entityId = entity.id`
- Set `table.tableName = entity.tableName`
- Copy entity fields as a reference snapshot (for query builder context)
- Toast: `"Entity 'Order' linked to table '${entity.tableName}'"`

### TableNode → DBNode (`CONNECTS_TO`)
- Set `table.dbNodeId = db.id`
- Toast: `"Table '${table.tableName}' connected to ${db.dbName}'"`

### AuthRule → Controller or APIEndpoint (`SECURES`)
- Set `controller.authRuleId = authRule.id` or `endpoint.authRuleId = authRule.id`
- Toast: `"Controller secured by [ruleName]"`

### AuthRule → AuthConfig (`DEFINED_IN`)
- Set `authRule.authConfigId = authConfig.id`
- Toast: `"Rule '[ruleName]' linked to [Auth Config label]"`

### Controller → Service (`INVOKES`)
- Structural only — no data changes
- Toast: `"Controller invokes ServiceName"`

### Service → Entity (`USES`)
- Auto-generate standard CRUD methods on the service if methods[] is empty:
  ```
  findAll()                    → returns List<DTO>
  findById(id: UUID)           → returns Optional<DTO>
  create(request: RequestDTO)  → returns DTO
  update(id: UUID, req: DTO)   → returns DTO
  delete(id: UUID)             → returns void
  ```
- Set method return type dtoRef to the RESPONSE DTO connected to this entity (if exists)
- Toast: `"Service methods generated from EntityName"`

### Endpoint → Controller (`ROUTES_TO`)
- Infer `endpoint.response.successCode`:
  - POST → 201
  - DELETE → 204
  - GET / PUT / PATCH → 200
- If path contains `{id}` → auto-add pathVar `{ name: 'id', type: UUID }`
- If method is GET and path has no `{id}` → set `config.paginated = true`
- Toast: `"Endpoint routed to ControllerName — success code set to X"`

### Endpoint → DTO (`ACCEPTS`)
- Set `endpoint.request.bodyDTOId = dto.id`
- Set `dto.purpose = REQUEST`
- Set `dto.config.validationEnabled = true`
- Toast: `"Request body linked — DTO purpose set to REQUEST"`

### Endpoint → DTO (`RETURNS`)
- Set `endpoint.response.returnDTOId = dto.id`
- Set `dto.purpose = RESPONSE`
- Toast: `"Response DTO linked — success code set to X"`

---

## AI Prompt System (Phase 2 — design now, implement later)

Every node carries an `AIPrompt` object. In Phase 1 these are stored but never sent anywhere.

### Prompt priority (highest to lowest)
```
APIEndpointNode.aiPrompt       ← most specific, highest priority
ControllerNode.aiPrompt
MicroserviceNode.aiPrompt      ← system prompt, lowest priority / broadest context
```

### Fallback rule
If a node's `aiPrompt.description` is empty, the code generator uses the
MicroserviceNode system prompt + the node's structural definition to infer intent.

### The master prompt
There is a hidden master prompt that the user never sees or modifies.
It instructs the AI on file structure, generation steps, code style,
and Spring Boot conventions. It always runs first before any node prompt.
This will live in a server-side constant — never in the client bundle.

---

## File Structure

```
src/
├── components/
│   ├── Canvas/
│   │   ├── Canvas.tsx
│   │   ├── useCanvas.ts
│   │   ├── types.ts
│   │   ├── index.ts
│   │   └── components/
│   │       ├── CanvasToolbar/
│   │       ├── CanvasMinimap/
│   │       └── CanvasControls/
│   │
│   ├── Sidebar/
│   │   ├── Sidebar.tsx
│   │   ├── useSidebar.ts
│   │   ├── types.ts
│   │   ├── index.ts
│   │   └── components/
│   │       ├── NodePalette/
│   │       └── LayersPanel/
│   │
│   ├── InspectorPanel/
│   │   ├── InspectorPanel.tsx
│   │   ├── useInspectorPanel.ts
│   │   ├── types.ts
│   │   ├── index.ts
│   │   └── components/
│   │       ├── MicroserviceInspector/
│   │       ├── EntityInspector/
│   │       ├── DTOInspector/
│   │       ├── DBInspector/
│   │       ├── TableInspector/
│   │       ├── AuthGuardInspector/
│   │       ├── ControllerInspector/
│   │       ├── ServiceInspector/
│   │       └── APIEndpointInspector/
│   │
│   ├── nodes/                        ← React Flow custom node renderers
│   │   ├── MicroserviceNode/
│   │   ├── EntityNode/
│   │   ├── DTONode/
│   │   ├── DBNode/
│   │   ├── TableNode/
│   │   ├── AuthGuardNode/
│   │   ├── ControllerNode/
│   │   ├── ServiceNode/
│   │   └── APIEndpointNode/
│   │
│   └── shared/                       ← globally reusable UI primitives
│       ├── Toggle/
│       ├── Badge/
│       ├── FieldRow/
│       ├── SectionLabel/
│       ├── IconButton/
│       └── EmptyState/
│
├── pages/
│   ├── ProjectList/
│   │   ├── ProjectList.tsx
│   │   ├── useProjectList.ts
│   │   ├── types.ts
│   │   ├── index.ts
│   │   └── components/
│   │       ├── ProjectCard/
│   │       └── CreateProjectModal/
│   │
│   └── Editor/
│       ├── Editor.tsx
│       ├── useEditor.ts
│       ├── types.ts
│       ├── index.ts
│       └── components/
│           ├── EditorHeader/
│           └── EditorLayout/
│
├── routes/
│   ├── AppRouter.tsx
│   ├── routes.ts
│   └── index.ts
│
├── entity/                           ← ALL domain types. Single source of truth.
│   ├── shared.ts                     ← base types, all shared enums
│   ├── AIPrompt.ts
│   ├── Project.ts
│   ├── MicroserviceNode.ts
│   ├── EntityNode.ts
│   ├── DTONode.ts
│   ├── DBNode.ts
│   ├── TableNode.ts
│   ├── AuthGuardNode.ts
│   ├── ControllerNode.ts
│   ├── ServiceNode.ts
│   ├── APIEndpointNode.ts
│   ├── Edge.ts
│   └── index.ts
│
├── service/                          ← TanStack Query hooks. Only data access.
│   ├── project/
│   │   ├── useGetProjects.ts
│   │   ├── useGetProject.ts
│   │   ├── useCreateProject.ts
│   │   ├── useUpdateProject.ts
│   │   ├── useDeleteProject.ts
│   │   └── index.ts
│   ├── node/
│   │   ├── useGetNodes.ts
│   │   ├── useCreateNode.ts
│   │   ├── useUpdateNode.ts
│   │   ├── useDeleteNode.ts
│   │   └── index.ts
│   └── edge/
│       ├── useGetEdges.ts
│       ├── useCreateEdge.ts
│       ├── useDeleteEdge.ts
│       └── index.ts
│
├── hooks/                            ← reusable hooks (used by 2+ components)
│   ├── useDebounce.ts
│   ├── useLocalStorage.ts
│   ├── useKeyboardShortcut.ts
│   ├── useUndoRedo.ts
│   └── index.ts
│
├── utils/                            ← pure functions, no React
│   ├── id.ts
│   ├── node.ts                       ← node factory functions
│   ├── edge.ts                       ← edge inference + creation
│   ├── autoPopulate.ts               ← auto-population logic
│   ├── reactflow.ts                  ← RF format adapters
│   └── index.ts
│
├── db/                               ← Dexie only
│   ├── schema.ts
│   ├── db.ts
│   └── index.ts
│
├── store/                            ← Zustand only
│   ├── canvasStore.ts
│   ├── projectStore.ts
│   └── index.ts
│
├── sw/
│   └── sw.ts
│
├── App.tsx
├── main.tsx
└── vite-env.d.ts
```

---

## File Structure Rules — STRICT, Never Deviate

### Every component follows this exact structure

```
ComponentName/
├── ComponentName.tsx     JSX only. Zero business logic. Zero direct hook calls
│                         except the component's own useComponentName hook.
├── useComponentName.ts   ALL logic lives here. Data fetching, event handlers,
│                         derived state, everything.
├── types.ts              ALL TypeScript types used by this component and its hook.
│                         Never import types from another component's types.ts —
│                         shared types go in entity/.
├── index.ts              Barrel export. Export the component as default +
│                         named exports for types if needed.
└── components/           Sub-components used only by this component.
                          Each follows the same 4-file structure recursively.
```

### Global folder rules

- `entity/` — TypeScript interfaces/enums only. No React. No logic. Single source of truth.
- `service/` — TanStack Query hooks only. One hook per file. Never import Dexie outside here.
- `hooks/` — Only hooks used by 2+ components. Single-use hooks stay in `useComponentName.ts`.
- `utils/` — Pure functions only. No React. No side effects.
- `db/` — Dexie schema + singleton only.
- `store/` — Zustand store definitions only.

### `.tsx` files — zero logic

All logic lives in `useComponentName.ts`. `.tsx` renders only.

---

## IndexedDB Schema

```
projects:       id, name, description, createdAt, updatedAt
nodes:          id, projectId, msId, type, label, position, size, data(JSON), createdAt, updatedAt
edges:          id, projectId, fromNodeId, toNodeId, type, label
versions:       id(=${msId}-v${N}), msId, projectId, version, snapshot, savedAt
generatedFiles: id(=${msId}:${filePath}), msId, projectId, filePath, content, generatedAt
```

`nodes.data` = `JSON.stringify` of the full typed node. Indexes: `projectId`, `msId`, `type`.

---

## Zustand Stores

- `canvasStore` — `selectedNodeId`, `selectedEdgeId`, `pan`, `zoom` + setters + `clearSelection`
- `projectStore` — `activeProjectId` + `setActiveProject`
- `codeEditorStore` — `activeMsId`, `generatedFiles`, `fileProgress`, `isGenerating`, `abortController`, `modifiedFiles`, `thinkingText`
- `generationProgressStore` — `isOpen`, `isMinimised`, `msLabel`, `stopped` + `open/close/minimise/restore`

---

## Service Worker

`vite-plugin-pwa` + Workbox. Cache-first for static assets.
`BroadcastChannel('archflow-sync')` — every IDB write posts a sync message → other tabs invalidate TanStack Query cache.

---
## TypeScript Rules

`strict: true`. No `any` — use `unknown`. No `!` unless impossible to be null (add comment).
Enums over string unions. `interface` for objects, `type` for unions. `T[]` not `Array<T>`.

---

## Naming Conventions

Components + Types/Interfaces → PascalCase. Hooks → `useCamelCase`. Utils → camelCase.
Enums → PascalCase. Enum values + Constants → SCREAMING_SNAKE_CASE. Files → match their export.

---

## Query Keys

```typescript
export const QUERY_KEYS = {
  projects: ['projects'],
  project:  (id: string) => ['projects', id],
  nodes:    (projectId: string) => ['nodes', projectId],
  edges:    (projectId: string) => ['edges', projectId],
}
```

---

## Entity Type Definitions (TypeScript)

These are the canonical types. All code must match these exactly.

```typescript
// ─── entity/shared.ts ────────────────────────────────────────────

export enum NodeType {
  MICROSERVICE  = 'MICROSERVICE',
  ENTITY        = 'ENTITY',
  DTO           = 'DTO',
  DB            = 'DB',
  TABLE         = 'TABLE',
  AUTH_GUARD    = 'AUTH_GUARD',   // legacy — replaced by AUTH_CONFIG + AUTH_RULE
  AUTH_CONFIG   = 'AUTH_CONFIG',  // authentication mechanism config (JWT, OAuth2, Basic etc.)
  AUTH_RULE     = 'AUTH_RULE',    // named access rule — connects to controllers/endpoints
  CONTROLLER    = 'CONTROLLER',
  SERVICE       = 'SERVICE',
  API_ENDPOINT  = 'API_ENDPOINT',
  CUSTOM_TYPE   = 'CUSTOM_TYPE',  // value object / embedded doc — no table, stored as JSON blob
}

export enum EdgeType {
  ROUTES_TO    = 'ROUTES_TO',    // APIEndpoint → Controller
  SECURED_BY   = 'SECURED_BY',   // AuthGuard ↔ Controller
  LOADS_FROM   = 'LOADS_FROM',   // AuthGuard → DB | Service
  INVOKES      = 'INVOKES',      // Controller → Service
  USES         = 'USES',         // Service → Entity
  STORED_IN    = 'STORED_IN',    // Entity → TableNode
  CONNECTS_TO  = 'CONNECTS_TO',  // TableNode → DBNode
  DERIVED_FROM = 'DERIVED_FROM', // DTO → Entity
  ACCEPTS      = 'ACCEPTS',      // APIEndpoint → DTO (request)
  RETURNS      = 'RETURNS',      // APIEndpoint → DTO (response)
  DEPENDS_ON   = 'DEPENDS_ON',   // Service → Service
  EMBEDS          = 'EMBEDS',          // Entity → Entity (no-table composition)
  RELATES_TO      = 'RELATES_TO',      // Entity → Entity (both have tables, JPA relation)
  USES_TYPE       = 'USES_TYPE',       // DTO → Entity (entity has no table)
  USES_CUSTOM_TYPE = 'USES_CUSTOM_TYPE', // Entity or DTO → CustomTypeNode (always dotted edge)
  DEFINED_IN       = 'DEFINED_IN',       // AuthRuleNode → AuthConfigNode
  SECURES          = 'SECURES',          // AuthRuleNode → ControllerNode or APIEndpointNode
}

export enum JavaType {
  UUID      = 'UUID',
  STRING    = 'STRING',
  INTEGER   = 'INTEGER',
  LONG      = 'LONG',
  DOUBLE    = 'DOUBLE',
  DECIMAL   = 'DECIMAL',
  BOOLEAN   = 'BOOLEAN',
  DATETIME  = 'DATETIME',
  DATE      = 'DATE',
  LOCALDATE = 'LOCALDATE',
  ENUM      = 'ENUM',
  TEXT      = 'TEXT',
  BLOB      = 'BLOB',
}

export enum HttpMethod {
  GET    = 'GET',
  POST   = 'POST',
  PUT    = 'PUT',
  DELETE = 'DELETE',
  PATCH  = 'PATCH',
}

export enum LombokStyle {
  DATA    = 'DATA',
  BUILDER = 'BUILDER',
  BOTH    = 'BOTH',
  NONE    = 'NONE',
}

export interface Position { x: number; y: number }
export interface Size     { w: number; h: number }

export interface BaseNode {
  id:        string
  type:      NodeType
  label:     string
  position:  Position
  size:      Size
  aiPrompt:  AIPrompt
}
```

```typescript
// ─── entity/AIPrompt.ts ──────────────────────────────────────────

export interface AIPrompt {
  description:       string   // what this component should do
  businessRules:     string   // domain-specific rules and constraints
  edgeCases:         string   // what to handle that isn't obvious
  expectedBehaviour: string   // what "done" looks like
  aiGenerate:        boolean  // true = AI writes implementation
                              // false = developer writes manually
}

export const emptyAIPrompt = (): AIPrompt => ({
  description:       '',
  businessRules:     '',
  edgeCases:         '',
  expectedBehaviour: '',
  aiGenerate:        true,
})
```

```typescript
// ─── entity/Edge.ts ──────────────────────────────────────────────

export interface Edge {
  id:         string
  projectId:  string
  fromNodeId: string
  toNodeId:   string
  type:       EdgeType
  label:      string
}
```

```typescript
// ─── entity/Project.ts ───────────────────────────────────────────

export interface Project {
  id:          string
  name:        string
  description: string
  createdAt:   number
  updatedAt:   number
}
```

```typescript
// ─── entity/MicroserviceNode.ts ──────────────────────────────────

export interface MicroserviceNode extends BaseNode {
  type:        NodeType.MICROSERVICE
  serviceName: string      // "order-service"
  packageName: string      // "com.example.orderservice"
  port:        string      // "8082"
  version:     string      // "1.0.0"
  build:       BuildConfig
  docker:      DockerConfig
}

export interface BuildConfig {
  tool:               BuildTool
  springBootVersion:  string
  javaVersion:        '17' | '21'
  extraDependencies:  Dependency[]
}

export interface Dependency {
  groupId:    string
  artifactId: string
  version:    string
  scope:      'compile' | 'runtime' | 'test' | null
}

export interface DockerConfig {
  generateDockerfile:    boolean
  generateDockerCompose: boolean
  baseImage:             string
}

export enum BuildTool {
  MAVEN  = 'MAVEN',
  GRADLE = 'GRADLE',
}
```

```typescript
// ─── entity/EntityNode.ts ────────────────────────────────────────

export interface EntityNode extends BaseNode {
  type:        NodeType.ENTITY
  tableName:   string
  fields:      EntityField[]
  relations:   Relation[]
  config:      EntityConfig
}

export interface EntityField {
  id:               string
  name:             string
  // type is either a JavaType primitive, 'ENTITY_REF', or 'CUSTOM_TYPE_REF'
  type:             JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF'
  entityTypeId:     string | null    // → EntityNode.id when type === 'ENTITY_REF'
  customTypeId:     string | null    // → CustomTypeNode.id when type === 'CUSTOM_TYPE_REF'
  relation:         Relation | null  // reuses existing Relation — only when both entities have tables
  constraint:       FieldConstraint
  nullable:         boolean
  columnName:       string           // snake_case override e.g. "user_id"
  defaultValue:     string
  enumValues:       EnumValues | null  // only when type === JavaType.ENUM
  entityTypeWarning: boolean           // true when referenced entity gained a table, needs JPA config
}
// RelationshipConfig and RelationshipKind removed — use existing Relation + RelationType instead

export interface EnumValues {
  values:           string[]  // ["PENDING","CONFIRMED","SHIPPED"]
  columnDefinition: string    // "VARCHAR(20)"
}

export enum FieldConstraint {
  PK     = 'PK',
  FK     = 'FK',
  UNIQUE = 'UNIQUE',
  NONE   = 'NONE',
}

export interface Relation {
  id:             string
  type:           RelationType
  targetEntityId: string       // → EntityNode.id
  mappedBy:       string
  cascade:        CascadeType
  fetch:          FetchType
  optional:       boolean
}

export enum RelationType {
  ONE_TO_MANY  = 'ONE_TO_MANY',
  MANY_TO_ONE  = 'MANY_TO_ONE',
  MANY_TO_MANY = 'MANY_TO_MANY',
  ONE_TO_ONE   = 'ONE_TO_ONE',
}

export enum CascadeType {
  ALL     = 'ALL',
  PERSIST = 'PERSIST',
  MERGE   = 'MERGE',
  REMOVE  = 'REMOVE',
  NONE    = 'NONE',
}

export enum FetchType {
  LAZY  = 'LAZY',
  EAGER = 'EAGER',
}

export interface EntityConfig {
  softDelete:          boolean
  auditing:            boolean
  lombokStyle:         LombokStyle
  generateRepository:  boolean
}
```

```typescript
// ─── entity/DTONode.ts ───────────────────────────────────────────

export interface DTONode extends BaseNode {
  type:          NodeType.DTO
  purpose:       DTOPurpose
  origin:        DTOOrigin
  entitySources: EntitySource[]
  fields:        DTOField[]
  config:        DTOConfig
}

export enum DTOPurpose {
  REQUEST  = 'REQUEST',
  RESPONSE = 'RESPONSE',
  BOTH     = 'BOTH',
}

export enum DTOOrigin {
  DERIVED = 'DERIVED',
  CUSTOM  = 'CUSTOM',
}

export interface EntitySource {
  entityId:      string      // → EntityNode.id
  includeFields: string[]    // empty = include all
  excludeFields: string[]
}

export interface DTOField {
  id:             string
  name:           string
  // ENTITY_REF: only allowed when entity has NO table connection
  // CUSTOM_TYPE_REF: always allowed — CustomTypeNode never has a table
  type:              JavaType | 'ENTITY_REF' | 'CUSTOM_TYPE_REF'
  entityTypeId:      string | null    // → EntityNode.id when type === 'ENTITY_REF'
  customTypeId:      string | null    // → CustomTypeNode.id when type === 'CUSTOM_TYPE_REF'
  // Runtime-only flag — set when a referenced entity gains a table connection (becomes DB-mapped)
  entityTypeInvalid: boolean
  validations:    Validation[]
  serialization:  Serialization
}

export interface Validation {
  type:    ValidationType
  value:   string          // e.g. "255" for @Size(max=255)
  message: string
}

export enum ValidationType {
  NOT_NULL  = 'NOT_NULL',
  NOT_BLANK = 'NOT_BLANK',
  NOT_EMPTY = 'NOT_EMPTY',
  MIN       = 'MIN',
  MAX       = 'MAX',
  SIZE      = 'SIZE',
  EMAIL     = 'EMAIL',
  PATTERN   = 'PATTERN',
  POSITIVE  = 'POSITIVE',
  FUTURE    = 'FUTURE',
  PAST      = 'PAST',
}

export interface Serialization {
  jsonProperty:    string   // custom JSON key
  jsonIgnore:      boolean
  includeNonNull:  boolean
}

export interface DTOConfig {
  lombokStyle:        LombokStyle
  validationEnabled:  boolean
}
```

```typescript
// ─── entity/DBNode.ts ────────────────────────────────────────────
// DBNode = database connection config only.
// Table-level config and custom queries live in TableNode.

export interface DBNode extends BaseNode {
  type:     NodeType.DB
  dbName:   string
  dbType:   DBType
  host:     string
  port:     number
  schema:   string
  username: string   // env ref e.g. "${DB_USER}"
  password: string   // env ref e.g. "${DB_PASS}"
  config:   DBConfig
}

export enum DBType {
  POSTGRESQL = 'POSTGRESQL',
  MYSQL      = 'MYSQL',
  MONGODB    = 'MONGODB',
  H2         = 'H2',
  MSSQL      = 'MSSQL',
}

export interface DBConfig {
  ddlAuto:  DDLAuto
  showSql:  boolean
  poolSize: number
  flyway:   boolean
  redis:    boolean
}

export enum DDLAuto {
  VALIDATE    = 'validate',
  CREATE_DROP = 'create-drop',
  UPDATE      = 'update',
  NONE        = 'none',
}
```

```typescript
// ─── entity/TableNode.ts ─────────────────────────────────────────
// TableNode = one database table.
// Linked to exactly one EntityNode (STORED_IN edge).
// Linked to exactly one DBNode (CONNECTS_TO edge).
// Holds all table-level config and all custom repository queries.

export interface TableNode extends BaseNode {
  type:          NodeType.TABLE
  tableName:     string
  entityId:      string | null   // → EntityNode.id (set by STORED_IN edge)
  dbNodeId:      string | null   // → DBNode.id (set by CONNECTS_TO edge)
  customQueries: CustomQuery[]
}

export interface CustomQuery {
  id:             string
  methodName:     string              // required
  description:    string              // required

  // Everything below is optional — omit if not yet configured
  targetEntityId: string | null       // → EntityNode.id
  type:           QueryType | null
  queryString:    string | null       // actual query if JPQL or NATIVE_SQL
  aiPrompt:       AIPrompt | null     // drives generation if type === AI
  params:         DbQueryParam[]
  returnType:     QueryReturnType | null
  nativeQuery:    boolean
  modifying:      boolean
  cache:          CacheConfig | null
}

export enum QueryType {
  DERIVED    = 'DERIVED',
  JPQL       = 'JPQL',
  NATIVE_SQL = 'NATIVE_SQL',
  AI         = 'AI',
}

// Renamed from QueryParam to avoid clash with EndpointQueryParam
export interface DbQueryParam {
  name:         string
  type:         JavaType
  isCollection: boolean
}

export interface QueryReturnType {
  entityId:        string
  isList:          boolean
  isPage:          boolean
  isOptional:      boolean
  projectionClass: string
}

export interface CacheConfig {
  enabled:    boolean
  cacheName:  string
  ttlSeconds: number
  operation:  CacheOp
}

export enum CacheOp {
  CACHEABLE   = 'CACHEABLE',
  CACHE_EVICT = 'CACHE_EVICT',
  CACHE_PUT   = 'CACHE_PUT',
}
```

```typescript
// ─── entity/AuthGuardNode.ts ─────────────────────────────────────

export interface AuthGuardNode extends BaseNode {
  type:        NodeType.AUTH_GUARD
  tokenType:   TokenType
  userSource:  UserSource
  roleMapping: RoleMapping
  tokenConfig: TokenConfig
  appliesTo:   string[]    // ControllerNode IDs
}

export enum TokenType {
  JWT     = 'JWT',
  OAUTH2  = 'OAUTH2',
  BASIC   = 'BASIC',
  API_KEY = 'API_KEY',
}

export interface UserSource {
  type: UserSourceType
  ref:  string | null     // DBNode.id or ServiceNode.id

  // INTERNAL_DB
  userEntity:     string
  usernameField:  string
  passwordField:  string

  // LDAP
  ldapUrl:         string
  baseDn:          string
  userDnPattern:   string
  groupSearchBase: string

  // KEYCLOAK | AUTH0 | OAUTH2
  issuerUri:    string
  clientId:     string
  clientSecret: string

  // EXTERNAL_SERVICE
  serviceNodeId:    string | null
  rolesEndpoint:    string
  cacheRoles:       boolean
  cacheTtlSeconds:  number
}

export enum UserSourceType {
  INTERNAL_DB      = 'INTERNAL_DB',
  LDAP             = 'LDAP',
  KEYCLOAK         = 'KEYCLOAK',
  AUTH0            = 'AUTH0',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
}

export interface RoleMapping {
  field:      string
  prefix:     string
  transforms: RoleTransform[]
}

export interface RoleTransform {
  from: string
  to:   string
}

export interface TokenConfig {
  jwtSecret:       string
  jwtExpiry:       number
  jwtIssuer:       string
  oauth2IssuerUri: string
  oauth2Audience:  string
  apiKeyHeader:    string
  apiKeyQueryParam: string
}

```

```typescript
// ─── entity/AuthConfigNode.ts ─────────────────────────────────

export interface AuthConfigNode extends BaseNode {
  type:     NodeType.AUTH_CONFIG
  authType: AuthType

  // JWT config — only when authType = JWT
  jwt: JwtConfig | null

  // OAuth2 config — only when authType = OAUTH2
  oauth2: OAuth2Config | null

  // Session config — only when authType = SESSION
  session: SessionConfig | null

  // Basic Auth config — only when authType = BASIC_AUTH
  basicAuth: BasicAuthConfig | null

  // API Key config — only when authType = API_KEY
  apiKey: ApiKeyConfig | null

  // How to resolve the authenticated user — applies to all auth types
  userEntity: UserEntityConfig

  // All roles available in this microservice
  // AuthRuleNodes pick from this list
  roles: string[]
}

export enum AuthType {
  JWT        = 'JWT',
  OAUTH2     = 'OAUTH2',
  SESSION    = 'SESSION',
  BASIC_AUTH = 'BASIC_AUTH',
  API_KEY    = 'API_KEY',
}

export interface JwtConfig {
  secret:           string
  expiration:       number       // milliseconds e.g. 86400000 (24h)
  issuer:           string
  algorithm:        JwtAlgorithm
  refreshToken:     boolean
  refreshExpiration: number      // milliseconds
}

export enum JwtAlgorithm {
  HS256 = 'HS256',
  HS512 = 'HS512',
  RS256 = 'RS256',
}

export interface OAuth2Config {
  provider:     OAuth2Provider
  clientId:     string
  clientSecret: string
  redirectUri:  string
  scopes:       string[]
  issuerUri:    string           // for custom provider
}

export enum OAuth2Provider {
  GOOGLE   = 'GOOGLE',
  GITHUB   = 'GITHUB',
  FACEBOOK = 'FACEBOOK',
  CUSTOM   = 'CUSTOM',
}

export interface SessionConfig {
  timeout:    number    // minutes
  cookieName: string
  secure:     boolean
  httpOnly:   boolean
}

export interface BasicAuthConfig {
  realm: string   // e.g. "School Admin API"
}

export interface ApiKeyConfig {
  headerName:  string   // e.g. "X-API-Key"
  queryParam:  string   // e.g. "api_key" (optional alternative)
  prefix:      string   // e.g. "Bearer " (optional)
}

export interface UserEntityConfig {
  entityId:      string | null   // → EntityNode.id
  usernameField: string          // e.g. "email"
  passwordField: string          // e.g. "password"
  rolesField:    string          // e.g. "role" or "roles"
}
```

```typescript
// ─── entity/AuthRuleNode.ts ──────────────────────────────────

export interface AuthRuleNode extends BaseNode {
  type:         NodeType.AUTH_RULE
  ruleName:     string          // e.g. "Admin Only", "Public", "Teacher and Admin"
  authConfigId: string | null   // → AuthConfigNode.id (set by DEFINED_IN edge)
  effect:       RuleEffect
  roles:        string[]        // subset of AuthConfigNode.roles
  methods:      HttpMethod[]    // empty = applies to all methods
  roleMatch:    RoleMatch
}

export enum RuleEffect {
  ALLOW     = 'ALLOW',      // listed roles can access
  DENY      = 'DENY',       // listed roles cannot access
  ALLOW_ALL = 'ALLOW_ALL',  // public — no auth required
  DENY_ALL  = 'DENY_ALL',   // locked — nobody can access
}

export enum RoleMatch {
  ANY = 'ANY',   // user has at least one of the listed roles
  ALL = 'ALL',   // user must have all listed roles
}
```


```typescript
// ─── entity/ControllerNode.ts ────────────────────────────────────

export interface ControllerNode extends BaseNode {
  type:               NodeType.CONTROLLER
  basePath:           string
  authRuleId:         string | null   // → AuthRuleNode.id, set by SECURES edge
  errorHandlerConfig: ErrorHandlerConfig
  config:             ControllerConfig
  swaggerTags:        string[]
}

export interface ErrorHandlerConfig {
  errors:             ErrorDefinition[]
  includeTimestamp:   boolean
  includeRequestPath: boolean
}

// Shared by both ControllerNode and APIEndpointNode.
// Human-readable, non-technical error handling definition.
// No exception class, no error code, no match strategy.
export interface ErrorDefinition {
  id:               string
  description:      string              // textarea — plain English, e.g. "User not found"
  httpStatus:       number              // HTTP status code to return, e.g. 404
  message:          string              // client-facing message in the response body
  includeTimestamp: boolean             // whether to include timestamp in this error's response
  fields:           ErrorResponseField[] // additional key-value pairs in response body
}

export interface ErrorResponseField {
  key:   string   // JSON key in the error response body, e.g. "detail"
  value: string   // value, e.g. "The requested user does not exist"
}

export interface ControllerConfig {
  crossOrigin:    boolean
  apiVersion:     string | null
  requestLogging: boolean
}
```

```typescript
// ─── entity/ServiceNode.ts ───────────────────────────────────────

export interface ServiceNode extends BaseNode {
  type:          NodeType.SERVICE
  methods:       ServiceMethod[]
  dependencyIds: string[]    // other ServiceNode IDs
  config:        ServiceConfig
}

export interface ServiceMethod {
  id:           string
  name:         string
  returnType:   MethodReturnType
  params:       MethodParam[]
  transactional: boolean
  async:        boolean
  aiPrompt:     AIPrompt
  throwsErrors: ErrorContract[]
}

export interface MethodReturnType {
  // Services are DTO-agnostic. Return types are entity types or primitives only.
  // dtoId deliberately absent — that belongs to API endpoints, not services.
  entityId:      string | null   // → EntityNode.id — the entity type being returned
  primitiveType: JavaType | null // for primitive returns (string, boolean, number, etc.)
  isList:        boolean
  isPage:        boolean
  isOptional:    boolean
  isVoid:        boolean
}

export interface MethodParam {
  // Services are DTO-agnostic. Params are entity types or primitives only.
  // dtoId deliberately absent — params at the service layer are never DTOs.
  name:          string
  primitiveType: JavaType | null  // UUID, String, Integer, etc.
  entityId:      string | null    // → EntityNode.id — when param is an entity type
  isPageable:    boolean          // true = Pageable param for paginated queries
}

export interface ErrorContract {
  exceptionClass:  string
  description:     string
  createException: boolean
}

export interface ServiceConfig {
  classLevelTransactional: boolean
  classLevelAsync:         boolean
  generateInterface:       boolean
}
```

```typescript
// ─── entity/APIEndpointNode.ts ───────────────────────────────────

export interface APIEndpointNode extends BaseNode {
  type:          NodeType.API_ENDPOINT
  method:        HttpMethod
  path:          string
  authRuleId:    string | null   // → AuthRuleNode.id, set by SECURES edge. null = inherit from controller
  request:       EndpointRequest
  response:      EndpointResponse
  errorHandling: EndpointErrorHandling
  config:        EndpointConfig
}

export interface EndpointRequest {
  pathVars:    PathVariable[]
  queryParams: QueryParam[]
  bodyDTOId:   string | null
}

export interface PathVariable {
  name: string
  type: JavaType
}

export interface QueryParam {
  name:         string
  type:         JavaType
  defaultValue: string
  required:     boolean
}

export interface EndpointResponse {
  successCode:  number
  returnDTOId:  string | null
  isList:       boolean
  isPage:       boolean
}

export interface EndpointErrorHandling {
  inheritFromController: boolean   // when true, endpoint uses controller's error handler
  errors:                ErrorDefinition[]  // same type as ControllerNode — no separate EndpointError
}

// EndpointError is removed. Both Controller and APIEndpoint use ErrorDefinition.
// ErrorMatchStrategy is removed. ErrorResponseShape is removed.
// Error handling is human-readable description + httpStatus + message + timestamp + fields.

export interface EndpointConfig {
  paginated:   boolean
  deprecated:  boolean
  description: string
}
```

```typescript
// ─── entity/index.ts — barrel export everything ──────────────────

export * from './shared'
export * from './AIPrompt'
export * from './Project'
export * from './Edge'
export * from './MicroserviceNode'
export * from './EntityNode'
export * from './DTONode'
export * from './DBNode'
export * from './TableNode'
export * from './AuthGuardNode'
export * from './AuthConfigNode'
export * from './AuthRuleNode'
export * from './ControllerNode'
export * from './ServiceNode'
export * from './APIEndpointNode'
export * from './CustomTypeNode'
```

---

## Node Factory Defaults (utils/node.ts)

Every factory returns a complete valid object. Pattern: `createXNode(overrides?: Partial<XNode>): XNode`.
All fields must have defaults — no undefined. Spread `...overrides` last.

---

## Edge Inference (utils/edge.ts)

`inferEdgeType(from, to)` maps node type pairs to edge types:

| From → To | EdgeType |
|---|---|
| APIEndpoint → Controller | ROUTES_TO |
| AuthRule → Controller or APIEndpoint | SECURES |
| AuthRule → AuthConfig | DEFINED_IN |
| Controller → Service | INVOKES |
| Service → Entity | USES |
| Entity → TableNode | STORED_IN |
| TableNode → DBNode | CONNECTS_TO |
| DTO → Entity | DERIVED_FROM |
| APIEndpoint → DTO (REQUEST) | ACCEPTS |
| APIEndpoint → DTO (RESPONSE) | RETURNS |
| Service → Service | DEPENDS_ON |
| Entity → Entity (no table) | EMBEDS |
| Entity → Entity (both tables) | RELATES_TO |
| DTO → Entity (no table) | USES_TYPE |
| Entity or DTO → CustomType | USES_CUSTOM_TYPE |

---

## Routing

```typescript
// routes/routes.ts
export const ROUTES = {
  HOME:   '/',
  EDITOR: '/editor/:projectId',
} as const

export const editorPath = (projectId: string) =>
  `/editor/${projectId}`
```

---

## What Claude Code Should Never Do

- Put logic in `.tsx` — it belongs in `useComponentName.ts`
- Import Dexie directly outside `service/`
- Use `any`
- Duplicate a type — import from `entity/`
- Skip the `index.ts` barrel export
- Hardcode query key strings — use `QUERY_KEYS`
- Proceed to the next step with TypeScript errors outstanding
