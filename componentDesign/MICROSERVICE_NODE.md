# MicroserviceNode — Design & Build Specification

> Claude Code: this document defines every part of the MicroserviceNode.
> Read it in full before writing a single line.
> Follow every rule in CLAUDE.md alongside this document.

---

## 1. What Is the MicroserviceNode

The MicroserviceNode is the **top-level container** on the canvas.
It represents one deployable Spring Boot application — one JAR, one port, one database, one Git repository.

Everything else (Entity, DTO, DB, Controller, Service, API Endpoint, Auth Guard) lives **inside** a MicroserviceNode. You cannot place a child node on the canvas without a MicroserviceNode to contain it.

Its `aiPrompt.description` is the **system prompt** for all code generation inside it. Every child node's AI generation is contextualised against this description first.

---

## 2. Visual Anatomy

```
┌─────────────────────────────────────────────────────────────────────┐  ← outer border
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ [MS]  Order Service                    [Spring Boot 3.2.0]  │   │  ← HEADER
│  │       order-service · com.example.orderservice        [:8082]│   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ● Java 17  │  ● MAVEN  │  ● Docker  │              6 deps   │   │  ← INFO STRIP
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│   ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐    │
│     Right-click to add nodes                                        │  ← BODY / DROP ZONE
│   └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘    │
│                                                                     │
│                                                                  ◢  │  ← RESIZE HANDLE
└─────────────────────────────────────────────────────────────────────┘
```

| Section | Purpose | Interactive |
|---|---|---|
| Header | Identity + key metadata at a glance | Drag to move |
| Info Strip | Build config summary | Read-only on canvas |
| Body | Drop zone for child nodes | Right-click menu |
| Resize handle | Resize the swimlane | Drag |

---

## 3. Data Model

`MicroserviceNode` extends `BaseNode` from `@entity/shared.ts`.
All interfaces referenced below (`BuildConfig`, `DockerConfig`, `Dependency`, `AIPrompt`, `BuildTool`) are defined in `@entity` and must be imported from there — do not redefine them here.

```typescript
// src/entity/MicroserviceNode.ts

export interface MicroserviceNode extends BaseNode {
  type:        NodeType.MICROSERVICE   // discriminant — always MICROSERVICE

  // Identity
  serviceName: string    // kebab-case  e.g. "order-service"
  packageName: string    // Java package e.g. "com.example.orderservice"
  port:        string    // HTTP port   e.g. "8082"
  version:     string    // semver      e.g. "1.0.0"

  // Build — uses BuildConfig from @entity
  build:  BuildConfig

  // Docker — uses DockerConfig from @entity
  docker: DockerConfig

  // Canvas display — which colour scheme from MS_PALETTE to use
  // Set at creation time: existing MS node count % 5
  colorIdx: number

  // AI — inherited from BaseNode as aiPrompt: AIPrompt
  // This node's aiPrompt.description becomes the system prompt
  // for all code generation inside this microservice
}
```

`BuildConfig`, `DockerConfig`, `Dependency`, and `BuildTool` are already defined
in `src/entity/MicroserviceNode.ts` as part of the canonical entity layer.
Do not duplicate them. Import them.

### Field display mapping

| Stored field | Displayed as | Where |
|---|---|---|
| `label` | Node title | Header — large text |
| `serviceName` | Subtitle left | Header — mono text |
| `packageName` | Subtitle right | Header — mono text |
| `build.springBootVersion` | "Spring Boot 3.2.0" | Header badge |
| `port` | ":8082" | Header badge |
| `build.javaVersion` | "Java 17" | Info strip |
| `build.tool` | "MAVEN" | Info strip |
| `docker.generateDockerfile` | "Docker" / "No Docker" | Info strip |
| `build.extraDependencies.length` | "6 deps" | Info strip |
| `colorIdx` | Accent colour of border, icon, badges | Entire node |

---

## 4. Default Values

`createMicroserviceNode()` in `src/utils/node.ts` must produce this exact object.
`colorIdx` is passed in by the caller — `existingMsCount % 5`.

```typescript
{
  id:          generateId(),
  type:        NodeType.MICROSERVICE,
  label:       'New Service',
  serviceName: 'new-service',
  packageName: 'com.example.newservice',
  port:        '8080',
  version:     '1.0.0',
  colorIdx:    0,           // caller passes the real value
  position:    { x: 0, y: 0 },
  size:        { w: 600, h: 400 },
  aiPrompt:    emptyAIPrompt(),
  build: {
    tool:              BuildTool.MAVEN,
    springBootVersion: '3.2.0',
    javaVersion:       '17',
    extraDependencies: [],
  },
  docker: {
    generateDockerfile:    true,
    generateDockerCompose: false,
    baseImage:             'eclipse-temurin:17-jre-alpine',
  },
}
```

---

## 5. Canvas Node Component

### 5.1 File structure

```
src/components/nodes/MicroserviceNode/
├── MicroserviceNode.tsx        JSX only — zero logic
├── useMicroserviceNode.ts      all behaviour for the canvas card
├── types.ts                    MicroserviceNodeProps, local types
└── index.ts                    barrel export
```

### 5.2 Props

```typescript
// types.ts
import type { NodeProps } from '@xyflow/react'
import type { MicroserviceNode } from '@entity'

export interface MicroserviceNodeProps extends NodeProps {
  data: MicroserviceNode
}
```

### 5.3 Hook — useMicroserviceNode.ts

The hook reads `data` from `NodeProps`, derives display values, and returns
everything the component needs. No logic in the component itself.

**Returns:**

```typescript
{
  node,           // MicroserviceNode — the data prop
  isSelected,     // boolean — from canvasStore.selectedNodeId === id
  colorScheme,    // MsPaletteEntry — derived from MS_PALETTE[node.colorIdx]
  handleClick,    // () => void — calls canvasStore.setSelectedNode(id)
  handleContextMenu, // (e: React.MouseEvent) => void — opens context menu
}
```

The hook does NOT call any IDB hooks — the canvas card is read-only display.
All writes go through the inspector panel.

### 5.4 Colour palette

Define `MS_PALETTE` as a constant inside `useMicroserviceNode.ts`.
It is only used by this hook — do not export it.

```typescript
const MS_PALETTE = [
  { border: '#3860f5', iconBg: '#dde6ff', iconFg: '#3730a3', badgeBg: '#eff3ff', badgeBorder: '#c7d2fe', badgeText: '#3730a3' },
  { border: '#0a9e6e', iconBg: '#d1fae5', iconFg: '#065f46', badgeBg: '#ecfdf5', badgeBorder: '#a7f3d0', badgeText: '#065f46' },
  { border: '#c030e8', iconBg: '#f3e8ff', iconFg: '#7e22ce', badgeBg: '#fdf4ff', badgeBorder: '#e9d5ff', badgeText: '#6b21a8' },
  { border: '#d4580a', iconBg: '#fed7aa', iconFg: '#9a3412', badgeBg: '#fff7ed', badgeBorder: '#fdba74', badgeText: '#9a3412' },
  { border: '#0891b2', iconBg: '#bae6fd', iconFg: '#075985', badgeBg: '#f0f9ff', badgeBorder: '#7dd3fc', badgeText: '#075985' },
] as const

export type MsPaletteEntry = typeof MS_PALETTE[number]
```

`colorScheme = MS_PALETTE[node.colorIdx % 5]`

Define `MsPaletteEntry` type here and export it so the component can type its props correctly.

### 5.5 Header section

Layout: flex row, vertically centered, padding `12px 16px`.

Elements left to right:
```
[MS icon square]  [title block flex-1]  [badges]
```

**MS icon:**
- 32×32px, border-radius 9px
- `background: colorScheme.iconBg`
- `color: colorScheme.iconFg`
- Text: "MS", font `var(--font-mono)`, 10px, weight 700

**Title block:**
- Line 1: `node.label` — 13px, weight 700, `var(--color-text)`
- Line 2: `node.serviceName · node.packageName` — 10px, `var(--font-mono)`, `var(--color-text-3)`

**Badges (right-aligned, flex row, gap 5px):**
- Spring Boot badge: `Spring Boot ${node.build.springBootVersion}`
  — 9px mono, `background: colorScheme.badgeBg`, `border: 1px solid colorScheme.badgeBorder`, `color: colorScheme.badgeText`
- Port badge: `:${node.port}`
  — 9px mono, `background: var(--color-surface-alt)`, `border: var(--color-border)`, `color: var(--color-text-3)`

**Drag:** header is the drag handle. React Flow handles this automatically when
the node's `dragHandle` prop is set to the header's CSS selector.
Set `className="ms-drag-handle"` on the header div and pass `dragHandle=".ms-drag-handle"` to the RF node wrapper.

### 5.6 Info strip section

Layout: flex row, `background: var(--color-surface-alt)`, `border-top: 1px solid var(--color-border)`, `border-bottom: 1px solid var(--color-border)`.

4 items separated by hairline `border-right: 1px solid var(--color-border)`.
Last item has `margin-left: auto`.

| Item | Content | Dot colour |
|---|---|---|
| Java version | "Java 17" or "Java 21" | `var(--dot-java)` |
| Build tool | "MAVEN" or "GRADLE" | `var(--dot-build)` |
| Docker | "Docker" or "No Docker" | `var(--dot-docker-on)` if enabled, `var(--dot-docker-off)` if not |
| Dep count | "N deps" | none — text only, `var(--color-text-3)` |

Each dot: 4×4px circle. Each item: padding `7px 14px`, font `var(--font-mono)`, 9px, `var(--color-text-3)`.

### 5.7 Body / drop zone section

Layout: `position: relative`, `flex: 1`, `min-height: 200px`.

**Empty state** (when no child nodes):
- Dashed border inside: `1.5px dashed var(--color-canvas-drop-hint-border)`, `border-radius: var(--radius-md)`
- Centred column:
  - 32px circle icon, `background: var(--color-canvas-drop-hint-icon-bg)`, "+" text
  - "Right-click to add nodes" — 11px, `var(--font-mono)`, `var(--color-text-4)`
  - "Entity · DTO · Service · Controller" — 9px, `var(--color-text-4)`
- `pointer-events: none` — the hint is not interactive

**With child nodes:**
- Dashed border disappears
- Child nodes render inside this div (React Flow manages positioning)

### 5.8 Resize handle

Use `NodeResizer` from `@xyflow/react`.

```tsx
<NodeResizer
  minWidth={480}
  minHeight={300}
  isVisible={isSelected}
  lineStyle={{ border: `1.5px solid ${colorScheme.border}` }}
  handleStyle={{ background: colorScheme.border, border: 'none', width: 8, height: 8 }}
/>
```

`NodeResizer` must be placed as the first child inside the node's root element.

### 5.9 Selection state

When `isSelected === true`:
- Outer border: `1.5px solid ${colorScheme.border}`
- Box shadow: `0 6px 32px ${colorScheme.border}20, 0 0 0 3px ${colorScheme.border}10`

When `isSelected === false`:
- Outer border: `1px solid var(--color-canvas-node-border)`
- No extra box shadow

Apply via inline style on the root div — these values come from `colorScheme` which is dynamic.

### 5.10 Registering in React Flow

In `src/pages/Editor/components/Canvas/Canvas.tsx`, update `NODE_TYPES`:

```typescript
import { MicroserviceNode } from '@components/nodes/MicroserviceNode'

const NODE_TYPES = {
  microservice: MicroserviceNode,
} as const
```

The key `'microservice'` must match `NODE_TYPE_KEYS[NodeType.MICROSERVICE]`
if/when that utility is built. For now hardcode the string.

---

## 6. Inspector Panel

### 6.1 File structure

```
src/pages/Editor/components/
└── InspectorPanel/
    ├── InspectorPanel.tsx
    ├── useInspectorPanel.ts
    ├── types.ts
    ├── index.ts
    └── components/
        └── MicroserviceInspector/
            ├── MicroserviceInspector.tsx
            ├── useMicroserviceInspector.ts
            ├── types.ts
            └── index.ts
```

`InspectorPanel` is the container. It reads `selectedNodeId` from `canvasStore`,
determines the node type, and renders the correct sub-inspector.
For this step only `MicroserviceInspector` exists — all other node types render nothing yet.

### 6.2 Panel anatomy

```
┌─────────────────────────────────────────────┐
│ [MicroserviceNode]  badge        sticky top │  ← header
│ Order Service                          [×]  │
│ order-service · v1.0.0                      │
├─────────────────────────────────────────────┤
│ IDENTITY                                    │  ← section 1
│ [label                                    ] │
│ [serviceName                              ] │
│ [packageName                              ] │
│ [port      ]  [version                    ] │
├─────────────────────────────────────────────┤
│ BUILD                                       │  ← section 2
│ Build tool        [MAVEN ▼]                 │
│ Spring Boot       [3.2.0 ▼]                 │
│ Java version      [17    ▼]                 │
├─────────────────────────────────────────────┤
│ DEPENDENCIES                                │  ← section 3
│ [spring-web ×] [jpa ×] [security ×]         │
│ [postgresql ×] [lombok ×] [validation ×]    │
│ [add dependency…           ] [+]            │
├─────────────────────────────────────────────┤
│ DOCKER                                      │  ← section 4
│ Generate Dockerfile         [toggle]        │
│ docker-compose              [toggle]        │
│ [eclipse-temurin:17-jre-alpine            ] │
├─────────────────────────────────────────────┤
│ AI PROMPT  ●                                │  ← section 5
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│   [description textarea 5 rows          ]  │
│   [businessRules textarea 2 rows        ]  │
│   [edgeCases textarea 2 rows            ]  │
│   AI generates code            [toggle]    │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
├─────────────────────────────────────────────┤
│ [      Delete microservice      ]           │  ← section 6
└─────────────────────────────────────────────┘
```

### 6.3 InspectorPanel — shell

`useInspectorPanel.ts`:
- Read `selectedNodeId` from `useCanvasStore`
- Load the node from `useGetNodes` (TanStack Query) filtered to the current project
- Derive `nodeType` from `node.type`
- Return `{ node, nodeType, isOpen: selectedNodeId !== null }`

`InspectorPanel.tsx`:
- If `!isOpen` render nothing (or `display: none`)
- Switch on `nodeType`:
  - `NodeType.MICROSERVICE` → `<MicroserviceInspector nodeId={selectedNodeId} />`
  - all other types → `null` for now

### 6.4 useMicroserviceInspector.ts

**Every field change follows this exact pattern — no exceptions:**

1. Call `useReactFlow().setNodes()` to update the RF node data immediately
2. Debounce the IDB write by 300ms (textarea fields: 500ms)
3. After debounce: call `useUpdateNode` mutation → writes to Dexie

This gives instant visual feedback on the canvas while keeping IDB writes cheap.

```typescript
// Pseudocode — do not copy literally, implement properly
const { setNodes } = useReactFlow()
const { mutate: updateNode } = useUpdateNode()
const debouncedUpdate = useDebounce(updateNode, 300)

const handleLabelChange = (value: string) => {
  setNodes(nodes => nodes.map(n =>
    n.id === nodeId ? { ...n, data: { ...n.data, label: value } } : n
  ))
  debouncedUpdate({ ...node, label: value })
}
```

**Handlers to implement:**

Identity:
- `handleLabelChange(value: string)` — direct update
- `handleServiceNameChange(value: string)` — auto-format to kebab-case on change
- `handlePackageNameChange(value: string)` — auto-format to lowercase dots on change
- `handlePortChange(value: string)` — direct update
- `handleVersionChange(value: string)` — direct update

Auto-formatting rules (apply on every `onChange`, not on blur):
- `serviceName`: spaces and PascalCase → kebab-case. "OrderService" → "order-service". "order service" → "order-service"
- `packageName`: uppercase → lowercase, spaces → dots. "com.Example.Order" → "com.example.order"

Build:
- `handleBuildToolChange(value: BuildTool)`
- `handleSpringVersionChange(value: string)`
- `handleJavaVersionChange(value: '17' | '21')`

Dependencies:
- `handleAddDependency(raw: string)` — parse `"groupId:artifactId"` or `"artifactId"` (default groupId = `'org.springframework.boot'`), append to `build.extraDependencies`
- `handleRemoveDependency(index: number)` — remove by index

Docker:
- `handleDockerFieldToggle(field: keyof DockerConfig)` — flip boolean
- `handleBaseImageChange(value: string)`

AI Prompt:
- `handleAIPromptChange(field: keyof AIPrompt, value: string)`
- `handleAIGenerateToggle()`

Lifecycle:
- `handleClose()` — `canvasStore.clearSelection()`
- `handleDelete()` — `window.confirm(...)`, on confirm: `useDeleteNode(nodeId)` then `clearSelection()`

### 6.5 Section 1 — Identity

| Field | Type | Live canvas element updated |
|---|---|---|
| `label` | text input | Header title text |
| `serviceName` | text input (auto kebab) | Header subtitle left |
| `packageName` | text input (auto dot-case) | Header subtitle right |
| `port` | text input | Port badge |
| `version` | text input | Header subtitle right |

### 6.6 Section 2 — Build

| Field | Type | Options | Live canvas element |
|---|---|---|---|
| `build.tool` | select | MAVEN, GRADLE | Info strip tool text |
| `build.springBootVersion` | select | 3.2.0, 3.1.0, 2.7.0 | Spring Boot badge |
| `build.javaVersion` | select | 17, 21 | Info strip Java text |

### 6.7 Section 3 — Dependencies

**Preset chips** — 6 presets always shown at the top of the section:

| Label | artifactId | Chip colour token |
|---|---|---|
| Spring Web | spring-boot-starter-web | `--dep-web-*` |
| Spring Data JPA | spring-boot-starter-data-jpa | `--dep-jpa-*` |
| Spring Security | spring-boot-starter-security | `--dep-security-*` |
| PostgreSQL | postgresql | `--dep-postgres-*` |
| Lombok | lombok | `--dep-lombok-*` |
| Validation | spring-boot-starter-validation | `--dep-validation-*` |

Chip colour tokens are defined in `src/index.css` (from Step 3 theme).
Use `var(--dep-web-bg)`, `var(--dep-web-text)`, `var(--dep-web-border)` etc.

A preset chip that is already in `build.extraDependencies` shows with an `×` to remove it.
A preset chip that is not yet added shows as an `+ add` style button.

Custom deps added by the user (not in the presets list) appear below the presets as neutral chips using `var(--dep-default-*)` tokens.

**Add custom dep row:** text input + "+" button.
Parse on submit: if value contains `:` split into `[groupId, artifactId]`, else use `'org.springframework.boot'` as groupId.

Live canvas update: dep count in info strip updates immediately.

### 6.8 Section 4 — Docker

| Field | Type | Live canvas update |
|---|---|---|
| `docker.generateDockerfile` | toggle | Docker dot colour + text in info strip |
| `docker.generateDockerCompose` | toggle | None |
| `docker.baseImage` | text input | None |

Docker dot in info strip:
- `generateDockerfile = true` → dot colour `var(--dot-docker-on)`, text "Docker"
- `generateDockerfile = false` → dot colour `var(--dot-docker-off)`, text "No Docker"

### 6.9 Section 5 — AI Prompt

Visually distinct box — use the theme's AI box tokens:
- `background: linear-gradient(135deg, var(--ai-box-bg-from), var(--ai-box-bg-to))`
- `border: 1px solid var(--ai-box-border)`
- `border-radius: var(--radius-md)`

Header row inside the box:
- Left: pulsing dot (`var(--ai-dot-color)`, animation `pulse 2s infinite`) + label "SYSTEM PROMPT FOR THIS SERVICE" (9px, weight 700, uppercase)
- Right: "AI generates code" label + toggle

Textareas (all use debounce 500ms):

| Field | Rows | Placeholder |
|---|---|---|
| `aiPrompt.description` | 5 | "Describe what this microservice does, its responsibilities, domain boundaries, and what it should NOT handle…" |
| `aiPrompt.businessRules` | 2 | "Rules and constraints this service must enforce…" |
| `aiPrompt.edgeCases` | 2 | "Edge cases and failure scenarios to handle…" |

Hint below the box (outside it):
"This description becomes the system prompt for all code generation inside this service. Leave empty to let AI infer from the node structure."
— 10px, `var(--color-text-4)`

### 6.10 Section 6 — Delete

Full-width button: "Delete microservice"
- `background: var(--color-danger-light)`, `color: var(--color-danger)`, `border: 1px solid var(--color-danger-border)`
- On click: `window.confirm('Delete "${node.label}"? This cannot be undone.')`
- On confirm: `handleDelete()`

---

## 7. Context Menu

Right-clicking on the MicroserviceNode shows:

```
┌──────────────────────────┐
│ ✎  Edit properties       │  → canvasStore.setSelectedNode(id)
│ ⎘  Duplicate             │  → see duplicate logic below
│ ─────────────────────    │
│ + Entity                 │  → disabled (not built yet)
│ + DTO                    │  → disabled (not built yet)
│ + Database               │  → disabled (not built yet)
│ + Auth Guard             │  → disabled (not built yet)
│ + Controller             │  → disabled (not built yet)
│ + Service                │  → disabled (not built yet)
│ + API Endpoint           │  → disabled (not built yet)
│ ─────────────────────    │
│ ⌫  Delete service        │  → handleDelete() — red text
└──────────────────────────┘
```

Child node items (Entity, DTO, etc.) are shown but disabled in this step.
They will be enabled one by one as each node type is built.

**Positioning:** position within viewport — if near right or bottom edge, flip the menu left or upward.

**Duplicate logic:**
```typescript
createMicroserviceNode({
  ...node,
  id:          generateId(),
  label:       node.label + ' copy',
  serviceName: node.serviceName + '-copy',
  port:        String(parseInt(node.port) + 1),
  position:    { x: node.position.x + 48, y: node.position.y + 48 },
  colorIdx:    (node.colorIdx + 1) % 5,
})
```
Write the new node to IDB via `useCreateNode`, then add to RF state via `setNodes`.

---

## 8. Interactions Summary

| Interaction | Result |
|---|---|
| Click node | `canvasStore.setSelectedNode(id)` → right panel opens |
| Drag header | RF handles movement. On drag end: debounce-write new position to IDB |
| Drag resize corner | RF handles resize via NodeResizer. On resize end: debounce-write new size to IDB |
| Click canvas (empty) | `canvasStore.clearSelection()` → right panel closes |
| Right-click node | Context menu appears |
| `Escape` key | `canvasStore.clearSelection()` |
| `Delete` / `Backspace` | If `selectedNodeId` matches: `window.confirm` → delete |
| `⌘N` / `Ctrl+N` | `createMicroserviceNode()` → write to IDB → add to RF state |

---

## 9. Layers Panel

When a MicroserviceNode exists, it appears in the left sidebar layers list.

**Layer item display:**
```
[● dot]  Order Service           :8082
```

- Dot: 6px circle, `background: colorScheme.border`
- Label: `node.label`, 10px, weight 500, `var(--color-text-2)`
- Port: `node.port`, 9px, `var(--font-mono)`, `var(--color-text-4)`, right-aligned
- Selected state: `background: ${colorScheme.border}18`, label colour: `colorScheme.border`
- Click: `canvasStore.setSelectedNode(id)`

**Live update:** label and port in the layer item update immediately as the user edits those fields in the inspector (because the canvas RF state is updated instantly, and the layer list reads from the same RF node data).

The `LeftSidebar` component must be updated in this step to:
1. Read RF nodes from `useNodes()` hook from `@xyflow/react`
2. Filter to `NodeType.MICROSERVICE`
3. Render a layer item for each

---

## 10. Shared Components

These shared components are needed by this inspector and will be reused by every future inspector. Build them as part of this step in `src/components/shared/`.

Each follows the 4-file structure (`Component.tsx`, `useComponent.ts` if stateful, `types.ts`, `index.ts`).

| Component | Purpose | Has internal state? |
|---|---|---|
| `<Toggle />` | Boolean on/off switch. Props: `value: boolean`, `onChange: (v: boolean) => void` | No |
| `<SectionLabel />` | Section heading inside inspector. Props: `label: string` | No |
| `<DepChip />` | Coloured dependency tag with optional remove. Props: `label`, `colorVar` (CSS var prefix), `onRemove?` | No |

`Toggle` uses the theme CSS variables `var(--toggle-on-bg)`, `var(--toggle-off-bg)`, `var(--toggle-knob)` defined in `src/index.css`.

---

## 11. Styling Rules

- All colours via CSS custom properties (`var(--color-*)`). Never hardcode hex inside components.
- Dynamic colours that must be JavaScript values (node border, icon bg from `colorScheme`) are inline styles.
- `var(--font-mono)` for all technical text: service names, package names, port, dep names, timestamps.
- `var(--font-ui)` for all labels, headings, button text.
- `transition: border-color 0.15s, box-shadow 0.15s` on the node root for smooth selection feedback.
- Tailwind utility classes for layout and spacing only — not for colour.

---

## 12. What This Node Does NOT Do

- Does not render child nodes itself — React Flow manages all node rendering
- Does not call IDB directly — all reads/writes go through `service/` hooks
- Does not manage its own selection state — `canvasStore` owns that
- Does not connect to other nodes via edges — MicroserviceNode has no ports in this step
- Does not trigger auto-population — that comes when edges between child nodes are drawn
- Does not contain any code generation logic — that is Phase 2
