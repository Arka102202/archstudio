# Step 5 — React Flow Setup

> Instructions for Claude Code.
> Bare minimum only. No node types. No entity layer. No factories.
> Just get React Flow running on the canvas with pan, zoom, and dot grid.
> Follow every rule in CLAUDE.md.

---

## Context

Steps 1–4 are complete. The editor page exists with a left sidebar,
a canvas placeholder area, and a right sidebar.

This step replaces the canvas placeholder with a working React Flow instance.
Nothing else changes.

---

## Scope — read this before writing a single line

**In scope:**
- Zustand stores (canvasStore, projectStore) — needed for selection state
- Canvas constants file — zoom limits and grid size only
- Canvas component (Canvas.tsx + useCanvas.ts + types.ts + index.ts)
- Wire the Canvas component into Editor.tsx
- Import React Flow's CSS
- Override React Flow's default styles to match the theme

**Explicitly out of scope:**
- Entity types — none of the node interfaces (MicroserviceNode, EntityNode, etc.)
- Factory functions — nothing in utils/node.ts
- Edge inference — nothing in utils/edge.ts
- RF adapter utilities — nothing in utils/reactflow.ts
- Any custom node components
- Any node type registration in NODE_TYPES
- Any IDB reads or writes
- TanStack Query

The canvas will be empty. No nodes, no edges. That is correct.

---

## Files to create or update

```
src/
├── store/
│   ├── canvasStore.ts      ← new
│   ├── projectStore.ts     ← new
│   └── index.ts            ← update
│
├── constants/
│   ├── canvas.ts           ← new (zoom + grid constants only)
│   └── index.ts            ← update
│
├── pages/
│   └── Editor/
│       ├── Editor.tsx      ← update (replace canvas placeholder)
│       ├── useEditor.ts    ← update (wire projectStore)
│       └── components/
│           └── Canvas/
│               ├── Canvas.tsx
│               ├── useCanvas.ts
│               ├── types.ts
│               └── index.ts
│
└── main.tsx                ← update (import RF CSS)
```

---

## File 1 — `src/store/canvasStore.ts`

Zustand store. Export it as `useCanvasStore`.

State:
- `selectedNodeId: string | null` — currently selected node, null if none
- `selectedEdgeId: string | null` — currently selected edge, null if none

Actions:
- `setSelectedNode(id: string | null): void`
- `setSelectedEdge(id: string | null): void`
- `clearSelection(): void` — sets both to null

Initial state: both null.

No pan or zoom state here — React Flow manages its own viewport internally.
We only track selection in Zustand.

---

## File 2 — `src/store/projectStore.ts`

Zustand store. Export it as `useProjectStore`.

State:
- `activeProjectId: string | null`

Action:
- `setActiveProject(id: string | null): void`

Initial state: null.

---

## File 3 — `src/store/index.ts`

Barrel-export `useCanvasStore` and `useProjectStore`.

---

## File 4 — `src/constants/canvas.ts`

Canvas constants only. Nothing node-specific.

```
CANVAS_MIN_ZOOM: number = 0.15
CANVAS_MAX_ZOOM: number = 2.5
CANVAS_GRID_SIZE: number = 28
```

Export all three as named constants.

---

## File 5 — `src/constants/index.ts`

Add export for `canvas.ts`. Keep everything already there.

---

## File 6 — `src/pages/Editor/components/Canvas/types.ts`

```
interface CanvasProps
  projectId: string
```

That is all.

---

## File 7 — `src/pages/Editor/components/Canvas/useCanvas.ts`

**What it does:**
Manages React Flow state and wires canvas events to the Zustand store.

**RF state:**
Use `useNodesState` and `useEdgesState` from `@xyflow/react`.
Both start empty — `[]`.
These return a tuple of `[nodes, setNodes, onNodesChange]` and `[edges, setEdges, onEdgesChange]`.
Use the managed RF hooks, not raw `useState`, because RF patches these arrays internally.

**Store:**
Read `clearSelection`, `setSelectedNode`, `setSelectedEdge` from `useCanvasStore`.

**Handlers:**

`onNodeClick(_event: React.MouseEvent, node: Node): void`
- Call `setSelectedNode(node.id)`
- Call `setSelectedEdge(null)`

`onEdgeClick(_event: React.MouseEvent, edge: Edge): void`
- Call `setSelectedEdge(edge.id)`
- Call `setSelectedNode(null)`

`onPaneClick(): void`
- Call `clearSelection()`

`onConnect(connection: Connection): void`
- For now: `console.log('[Canvas] onConnect:', connection)`
- Comment: `// TODO: create edge in IDB, run autoPopulate`

**Return:**
```
{
  rfNodes, rfEdges,
  onNodesChange, onEdgesChange,
  onNodeClick, onEdgeClick,
  onPaneClick, onConnect,
}
```

Note on naming: RF's `Node` and `Edge` types from `@xyflow/react` will conflict
with our future domain types of the same name. Import them with aliases:
```ts
import type { Node as RFNode, Edge as RFEdge, Connection } from '@xyflow/react'
```

---

## File 8 — `src/pages/Editor/components/Canvas/Canvas.tsx`

Render a React Flow canvas. JSX only.

Outer wrapper: `<div style={{ width: '100%', height: '100%', position: 'relative' }}>`.

Inside: `<ReactFlowProvider>` wrapping `<ReactFlow>`.

**`<ReactFlow>` props:**
- `nodes={rfNodes}`
- `edges={rfEdges}`
- `onNodesChange={onNodesChange}`
- `onEdgesChange={onEdgesChange}`
- `onNodeClick={onNodeClick}`
- `onEdgeClick={onEdgeClick}`
- `onPaneClick={onPaneClick}`
- `onConnect={onConnect}`
- `nodeTypes={NODE_TYPES}`
- `fitView`
- `minZoom={CANVAS_MIN_ZOOM}`
- `maxZoom={CANVAS_MAX_ZOOM}`
- `deleteKeyCode={null}` — we manage deletion ourselves
- `selectionKeyCode={null}` — disable default selection box
- `proOptions={{ hideAttribution: true }}`

**`NODE_TYPES` constant — define at top of Canvas.tsx:**
```ts
const NODE_TYPES = {} as const
```
Empty now. Each node step will add its type here.
This constant lives in Canvas.tsx, not in a separate file,
because it is only ever used here.

**Inside `<ReactFlow>`:**
- `<Background variant={BackgroundVariant.Dots} gap={CANVAS_GRID_SIZE} color="var(--color-canvas-dot)" />`
- `<Controls />`

Import all RF components from `@xyflow/react`.
Import constants from `@constants/canvas`.

---

## File 9 — `src/pages/Editor/components/Canvas/index.ts`

Export `Canvas`.

---

## Update `src/pages/Editor/useEditor.ts`

Add two things:

1. After loading the project from IDB and setting local state, call:
   `useProjectStore.getState().setActiveProject(projectId)`

2. Return a cleanup — on unmount, call:
   `useProjectStore.getState().setActiveProject(null)`
   Do this inside the existing mount `useEffect` as a cleanup return.

No other changes to `useEditor.ts`.

---

## Update `src/pages/Editor/Editor.tsx`

Two changes only:

1. Import `Canvas` from `./components/Canvas`

2. In the canvas tab branch, replace the `CanvasArea` inline component with:
   ```tsx
   <Canvas projectId={project.id} />
   ```
   The `<main>` element wrapping the canvas must have:
   - `position: relative`
   - `overflow: hidden`
   - `flex: 1`
   These are needed so React Flow fills the container correctly.

Keep Code and Preview tab branches exactly as they are.

---

## Update `src/main.tsx`

Add one import line after the existing `index.css` import:

```ts
import '@xyflow/react/dist/style.css'
```

Order matters — our `index.css` must come after RF's CSS so our overrides win.
Current order in main.tsx:
1. `import './index.css'`

New order:
1. `import '@xyflow/react/dist/style.css'`
2. `import './index.css'`

---

## Update `src/index.css`

Add React Flow overrides at the very bottom of the file.
These use our CSS variables so theme switching works on the canvas.

Overrides to add:

```css
/* ── React Flow overrides ────────────────────────────── */

.react-flow__pane {
  background-color: var(--color-canvas-bg);
}

.react-flow__controls {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.react-flow__controls-button {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-2);
  fill: var(--color-text-2);
}

.react-flow__controls-button:hover {
  background: var(--color-surface-alt);
}

.react-flow__controls-button svg {
  fill: var(--color-text-2);
}
```

---

## Verification

### 1. TypeScript — zero errors
```bash
npx tsc --noEmit
```
Expected: no output.

### 2. Dev server starts
```bash
npm run dev
```
Expected: no console errors on load.

### 3. Canvas renders in the editor

Open any project. Select the Canvas tab.

- [ ] Canvas area fills the space between the two sidebars
- [ ] Dot grid is visible
- [ ] Pan works — click and drag on empty canvas area
- [ ] Zoom works — scroll wheel zooms in and out
- [ ] Zoom does not go below 0.15 or above 2.5
- [ ] Controls panel is visible (zoom in, zoom out, fit view buttons)
- [ ] Controls panel uses theme colours (white in light mode, dark in dark mode)
- [ ] Clicking empty canvas area logs nothing and causes no error
- [ ] No "unknown node type" warnings in console (empty NODE_TYPES is fine)
- [ ] No React Flow attribution watermark visible

### 4. Theme consistency

Toggle to dark mode.
- [ ] Canvas background changes (`var(--color-canvas-bg)` dark value)
- [ ] Controls panel background changes
- [ ] Dot grid colour changes

### 5. Store wiring

In browser console after opening an editor:
```js
window.__zustand_stores  // won't work — but check via React DevTools
```
Or add a temporary `console.log(useProjectStore.getState().activeProjectId)`
inside `useEditor.ts` to confirm it is set.

---

## Done when

- `npx tsc --noEmit` → zero errors
- Canvas renders with dot grid and controls
- Pan and zoom work
- Theme toggle changes canvas colours
- No console errors

---

## What is NOT done in this step

- No node types in NODE_TYPES (it stays `{}`)
- No custom node components of any kind
- No node creation from the sidebar
- No edges
- No entity type definitions (MicroserviceNode, EntityNode, etc.)
- No factory functions
- No edge inference utils
- No RF adapter utils
- No IDB reads or writes for canvas data
- No auto-population
- No undo/redo
- No context menus
