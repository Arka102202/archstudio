# Step 4 — Routes & Pages

> Instructions for Claude Code.
> This file defines WHAT to build and HOW each piece works.
> You write the actual code. Follow every rule in CLAUDE.md.
> Do not deviate from the file structure defined here.
> Do not write code that belongs to a future step.

---

## Context

Steps 1–3 are complete. The project compiles with zero errors. Theme is in place.

This step builds two routes, the project list page with real IDB persistence, and the editor shell with resizable sidebars. No React Flow. No node logic. No canvas drawing.

---

## Rules

1. Every TypeScript interface used by more than one component goes in `src/entity/`.
2. `.tsx` files: JSX only. No `useState`, no `useEffect`, no logic.
3. All state and logic in the `use*.ts` hook.
4. Local types (props, component-specific shapes) in the component's `types.ts`.
5. Every folder has `index.ts` barrel export.
6. All colours: `var(--color-*)`. Zero hardcoded hex in components.
7. `var(--font-mono)` for all technical/code strings.
8. All user-facing strings from `@constants/messages.ts`. No inline literals.
9. IDB called directly from hooks — TanStack Query not built yet.
10. Imports use path aliases (`@entity`, `@constants`, `@db`, `@components`, etc).

---

## New entity types (create before any component)

### `src/entity/Project.ts`

Named TypeScript interface `Project`:
- `id: string`
- `name: string`
- `description: string`
- `createdAt: number` (unix ms)
- `updatedAt: number` (unix ms)

No logic. No defaults. Types only.

### `src/entity/index.ts`
Add `Project` to the barrel export. Keep everything already there.

---

## New constants files

### `src/constants/routes.ts`
- `ROUTES` object: `HOME = '/'`, `EDITOR = '/project/:projectId'`
- `toEditor(projectId: string): string` — returns the concrete editor path

### `src/constants/messages.ts`
All user-facing strings. Two top-level keys:

**`project`**: modal title + subtitle, field labels, input placeholders, button labels (create, cancel, new project, empty state CTA), delete confirmation as a function taking the project name returning the full confirm string.

**`editor`**: tab labels (Canvas/Code/Preview), export button label, back button symbol, breadcrumb separator, sidebar section labels (add node, layers), empty layers text, hint text (multi-line `
`), right sidebar empty text, code + preview placeholder texts.

### `src/constants/index.ts`
Re-export everything from `routes.ts` and `messages.ts`. Keep existing theme exports.

---

## File structure

```
src/
├── entity/
│   ├── Project.ts          ← new
│   └── index.ts            ← update
│
├── constants/
│   ├── routes.ts           ← new
│   ├── messages.ts         ← new
│   └── index.ts            ← update
│
├── components/
│   └── shared/
│       ├── ThemeToggle/
│       │   ├── ThemeToggle.tsx
│       │   ├── useThemeToggle.ts
│       │   ├── types.ts
│       │   └── index.ts
│       └── index.ts
│
├── routes/
│   ├── AppRouter.tsx
│   ├── routes.ts           ← re-exports from @constants
│   └── index.ts
│
├── pages/
│   ├── index.ts
│   ├── ProjectList/
│   │   ├── ProjectList.tsx
│   │   ├── useProjectList.ts
│   │   ├── types.ts
│   │   ├── index.ts
│   │   └── components/
│   │       ├── ProjectCard/
│   │       │   ├── ProjectCard.tsx
│   │       │   ├── useProjectCard.ts
│   │       │   ├── types.ts
│   │       │   └── index.ts
│   │       └── CreateProjectModal/
│   │           ├── CreateProjectModal.tsx
│   │           ├── useCreateProjectModal.ts
│   │           ├── types.ts
│   │           └── index.ts
│   └── Editor/
│       ├── Editor.tsx
│       ├── useEditor.ts
│       ├── types.ts
│       ├── index.ts
│       └── components/
│           ├── EditorHeader/
│           │   ├── EditorHeader.tsx
│           │   ├── useEditorHeader.ts
│           │   ├── types.ts
│           │   └── index.ts
│           ├── LeftSidebar/
│           │   ├── LeftSidebar.tsx
│           │   ├── useLeftSidebar.ts
│           │   ├── types.ts
│           │   └── index.ts
│           └── RightSidebar/
│               ├── RightSidebar.tsx
│               ├── useRightSidebar.ts
│               ├── types.ts
│               └── index.ts
└── App.tsx                 ← update
```

---

## App.tsx
Import `AppRouter` from `@routes`. Render it. Nothing else.

---

## Routes

**`src/routes/routes.ts`** — re-export `ROUTES` and `toEditor` from `@constants/routes`.

**`src/routes/AppRouter.tsx`** — `BrowserRouter` with three `Route` entries:
- `/` → `ProjectList`
- `/project/:projectId` → `Editor`
- `*` → `<Navigate to="/" replace />`

**`src/routes/index.ts`** — barrel-export `AppRouter`, `ROUTES`, `toEditor`.

---

## ThemeToggle shared component

Used by both pages → lives in `src/components/shared/ThemeToggle/`.

**`useThemeToggle.ts`**
- State: `isDark: boolean` — init by reading `document.documentElement.getAttribute('data-theme') === 'dark'`
- `toggle()` — compute next, call `document.documentElement.setAttribute('data-theme', next)`, flip state
- Return `{ isDark, toggle }`

**`ThemeToggle.tsx`**
- 32×32px icon button
- `background var(--color-surface-alt)`, `border var(--color-border)`, `border-radius 8px`
- Shows 🌙 (light mode) or ☀️ (dark mode)

**`src/components/shared/index.ts`** — export `ThemeToggle`
**`src/components/index.ts`** — export from `./shared`

---

## ProjectList page

### `src/pages/ProjectList/types.ts`

Local type only:
```
interface CreateProjectInput { name: string; description: string }
```
`Project` is imported from `@entity`.

### `src/pages/ProjectList/useProjectList.ts`

State: `projects: Project[]`, `isLoading: boolean`, `isModalOpen: boolean`

Mount: `db.projects.orderBy('updatedAt').reverse().toArray()` → cast to `Project[]` → set state → `isLoading = false`

Handlers:
- `openModal` / `closeModal`
- `openProject(id)` — `navigate(toEditor(id))`
- `createProject(input)` — `crypto.randomUUID()` for id, `Date.now()` for timestamps, `db.projects.add()`, close modal, navigate to new project
- `deleteProject(id, name)` — `window.confirm(MESSAGES.project.deleteConfirm(name))`, on confirm: delete from `db.projects`, delete matching `db.nodes`, delete matching `db.edges`, reload list

### `src/pages/ProjectList/ProjectList.tsx`

Full-height column, `background var(--color-bg)`.

**Topbar** — inline `<header>` (52px, simple, no own folder):
- Left: logo `arch` + `flow` (accent colour on `flow`)
- Right: `<ThemeToggle />` then `+ New project` button

**Main** — `<main>` scrollable, `padding 40px 40px 0`:
- Loading state → loading text
- Empty state → `<EmptyState />` inline component (hex icon, heading, sub, CTA button)
- Loaded → heading "Your projects" + CSS Grid + `<CreateCard />`

**`CARD_ACCENT_COLORS`** constant at top of file: `['#3860f5','#0a9e6e','#c030e8','#d4580a','#0891b2']`

**Grid**: `repeat(auto-fill, minmax(220px, 220px))`, gap 16px. Map projects to `<ProjectCard accentColor={CARD_ACCENT_COLORS[i % 5]} />`. Last item: `<CreateCard onClick={openModal} />`

**EmptyState** — inline function in this file. No own folder.

**CreateCard** — inline function in this file. No own folder. Uses local `useState` for hover. Dashed border, centered `+` and label, hover changes border + text to accent colour.

---

## ProjectCard component

### `useProjectCard.ts`

State: `isMenuOpen: boolean`, `isHovered: boolean`, `menuRef: RefObject<HTMLDivElement>`

Outside-click effect: when `isMenuOpen` listen on `document` `mousedown`. If click is outside `menuRef.current`, close menu. Clean up correctly.

`timeAgo(ts: number): string` — pure function at top of file: "just now" / "Xm ago" / "Xh ago" / "Xd ago"

Handlers:
- `handleCardClick(e)` — skip if inside `[data-menu]`, else call `onOpen`
- `handleMenuToggle(e)` — `stopPropagation`, toggle menu
- `handleMenuOpen` — close menu, call `onOpen`
- `handleMenuDelete` — close menu, call `onDelete`

### `ProjectCard.tsx`

Top to bottom:
- 4px accent bar (`background accentColor`, rounded top corners only)
- Body padding:
  - Name: 14px, weight 700, `var(--color-text)`
  - Description: 11px, `var(--color-text-3)`, single-line ellipsis, `min-height 16px`
  - Divider: 1px
  - Footer row:
    - Timestamp: 10px, `var(--font-mono)`, `var(--color-text-4)`
    - Menu wrapper `data-menu` attribute + `ref=menuRef`:
      - `⋮` button
      - If `isMenuOpen`: absolute dropdown with Open + separator + Delete (danger colour)

Dropdown: `position absolute`, right-aligned, `z-index 100`, `background var(--color-surface-raised)`, border + shadow from theme variables.

---

## CreateProjectModal component

### `useCreateProjectModal.ts`

State: `name`, `description`, `isSubmitting: boolean`, `nameInputRef`

Derived: `canSubmit = name.trim().length > 0 && !isSubmitting`

Mount effect: focus `nameInputRef`.
Keyboard effect: Escape → `onClose`.

Handlers:
- `handleSubmit` — guard `canSubmit`, `isSubmitting = true`, call `onSubmit`, finally `isSubmitting = false`
- `handleKeyDown` — Enter + canSubmit → handleSubmit

### `CreateProjectModal.tsx`

Overlay: `position fixed`, `inset 0`, `z-index 1000`, backdrop blur, flex-centered. Click overlay → `onClose`. Click modal → stop propagation.

Modal: 440px wide, `var(--color-surface)`, `border-radius 14px`, `var(--shadow-modal)`, padding 28px.

Fields: label + name input (ref, keydown handler), label + description textarea (3 rows).
Input focus style: border → `var(--color-border-focus)`, background → `var(--color-surface)`.
Input blur style: border → `var(--color-border-strong)`, background → `var(--color-surface-alt)`.

Actions row (justify-end): Cancel + Create buttons.
Create disabled when `!canSubmit` (opacity 0.4, not-allowed cursor). Shows "Creating…" when `isSubmitting`.

---

## Editor page

### `src/pages/Editor/types.ts`

```
type ActiveTab = 'canvas' | 'code' | 'preview'
interface EditorProject { id: string; name: string }
```

`EditorProject` is a lightweight local shape. Full `Project` from `@entity` used only inside the hook at the IDB layer.

### `src/pages/Editor/useEditor.ts`

Read `projectId` from `useParams`.

Mount effect:
- No `projectId` → redirect home
- `db.projects.get(projectId)` → if not found → redirect home
- Map to `EditorProject`, set state, `isLoading = false`

State: `project: EditorProject | null`, `isLoading: boolean`, `activeTab: ActiveTab` (default `'canvas'`)

Handlers:
- `handleBack` → `navigate(ROUTES.HOME)`
- `handleRename(newName)` → `db.projects.update(projectId, { name, updatedAt: Date.now() })`, update local state
- `setActiveTab` — pass directly

### `src/pages/Editor/Editor.tsx`

Loading: full-height centred "Loading…".

Loaded: full-height column with `EditorHeader` + flex-1 row containing `LeftSidebar`, `<main>`, `RightSidebar`.

**`CanvasArea`** — inline component in Editor.tsx:
- `'code'` → centred placeholder from `MESSAGES.editor.codePlaceholder`
- `'preview'` → centred placeholder from `MESSAGES.editor.previewPlaceholder`
- `'canvas'` → `position absolute inset 0`, pointer-events none, flex-centered column:
  - `⬡` icon (large, `var(--color-canvas-dot)`)
  - Heading + sub from messages
  - Two `<kbd>` elements: ⌘ and N
  - `<kbd>` style: `background var(--color-surface)`, border `var(--color-border-strong)`, border-radius 4px, padding `2px 7px`, `var(--font-mono)`, 9px, box-shadow `0 1px 0 var(--color-border-strong)`

---

## EditorHeader component

### `types.ts`
```
interface EditorHeaderProps {
  projectName: string
  activeTab:   ActiveTab
  onTabChange: (tab: ActiveTab) => void
  onBack:      () => void
  onRename:    (name: string) => Promise<void>
}
```

### `useEditorHeader.ts`

State: `isEditing: boolean`, `editValue: string`, `inputRef: RefObject<HTMLInputElement>`

- `startEdit` — set editValue, isEditing = true, setTimeout select
- `commitEdit` — isEditing = false, if changed call `onRename`
- `cancelEdit` — isEditing = false, reset editValue
- `handleEditKeyDown` — Enter → commitEdit, Escape → cancelEdit

ThemeToggle manages its own state. No theme state here.

### `EditorHeader.tsx`

48px header, three flex sections:

**Left**: back button → `onBack`, divider, breadcrumb (either editable input or clickable span).
Input focus ring: border `var(--color-border-focus)`, box-shadow `0 0 0 3px var(--color-accent-mid)`.

**Center**: tab group wrapper (`var(--color-surface-alt)` bg, rounded, padding 3px). Three tab buttons. Active: `var(--color-surface)` bg, `var(--color-text)`. Inactive: `var(--color-text-3)`.

**Right**: `<ThemeToggle />` from `@components/shared/ThemeToggle`, then Export button.

---

## LeftSidebar component

### `types.ts`
```
interface NodePaletteItem {
  id: string; label: string
  iconBg: string; iconFg: string
  abbr: string; ready: boolean
}
```

### `useLeftSidebar.ts`

Constants (not exported): `MIN_WIDTH = 160`, `MAX_WIDTH = 360`, `DEFAULT_WIDTH = 192`

`PALETTE_ITEMS` array — 8 items all `ready: false`:

| id | label | abbr | iconBg | iconFg |
|---|---|---|---|---|
| microservice | Microservice | MS | #dde6ff | #3730a3 |
| entity | Entity | E | #dbeafe | #1e40af |
| dto | DTO | D | #cffafe | #164e63 |
| db | Database | DB | #ede9fe | #5b21b6 |
| auth | Auth Guard | AG | #fef3c7 | #92400e |
| controller | Controller | C | #ffedd5 | #9a3412 |
| service | Service | S | #dcfce7 | #166534 |
| endpoint | API Endpoint | EP | #fae8ff | #6b21a8 |

State: `width: number` (starts at `DEFAULT_WIDTH`)

Drag resize — `useRef` for drag tracking (not state, avoids re-renders mid-drag):
- `isDragging`, `startX`, `startWidth` as `useRef`
- `handleResizeStart(e)`: preventDefault, set refs, attach `mousemove` + `mouseup` to document
- `mousemove`: `delta = clientX - startX.current`, clamp to `[MIN_WIDTH, MAX_WIDTH]`, setWidth
- `mouseup`: set `isDragging.current = false`, remove both listeners

`handleNodeAdd(item)`: if `!item.ready` return. Else `console.log('Add node:', item.id)`.

Return: `{ width, paletteItems, handleResizeStart, handleNodeAdd }`

### `LeftSidebar.tsx`

Outer: `position relative`, `flex-shrink 0`.
`<aside>` inside with `width`, full height, `var(--color-surface)` bg, right border.

Three sections:
1. **ADD NODE** (`flex-shrink 0`): section label + `paletteItems.map(<PaletteItem />)`
2. **LAYERS** (`flex 1`, overflow hidden): section label + scrollable empty text
3. **Hints** (`flex-shrink 0`, top border): hint text, `white-space pre-line`, `var(--font-mono)`, 9px

**`PaletteItem`** — inline function component in this file (no own folder, no independent logic):
- Row: 20×20 icon square (iconBg, iconFg, border-radius 5px, abbr in mono 9px) + label 11px
- Disabled: `opacity 0.38`, `cursor not-allowed`, `pointer-events none`
- Enabled hover: `background var(--color-surface-alt)`, border `var(--color-border)`

**`ResizeHandle`** — inline function component in this file:
- `position absolute`, `right -3`, `top 0`, `width 6`, full height, `cursor col-resize`, `z-index 10`
- Inner visual bar: 2px wide, 32px tall, centred vertically, `var(--color-border-strong)`
- Bar `opacity 0` by default, `opacity 1` on `:hover` of the handle itself (CSS, not JS state)

**Section label style object** — define once at file top, reuse for all three section labels.

---

## RightSidebar component

### `types.ts`
`interface RightSidebarProps {}` — empty for now.

### `useRightSidebar.ts`

Same pattern as `useLeftSidebar`:
- `MIN_WIDTH = 200`, `MAX_WIDTH = 480`, `DEFAULT_WIDTH = 272`
- Direction inverted: `delta = startX.current - clientX` (left-edge drag, leftward = wider)

Return: `{ width, handleResizeStart }`

### `RightSidebar.tsx`

Outer: `position relative`, `flex-shrink 0`.

**ResizeHandle on the LEFT edge**: `position absolute`, `left -3`, same width/height/cursor pattern.

`<aside>` with `width`, full height, `var(--color-surface)` bg, left border, flex column, centred content.

Centred placeholder: `MESSAGES.editor.rightSidebarEmpty`, 11px, `var(--color-text-4)`, centred, `padding 0 20px`.

---

## `src/pages/index.ts`
Export `ProjectList` and `Editor`.

---

## ID generation

`crypto.randomUUID()` — available natively. Do not import any uuid package.

---

## Verification checklist

### 1. Zero TypeScript errors
```bash
npx tsc --noEmit
```

### 2. Dev server, no console errors
```bash
npm run dev
```

### 3. Project list (`/`)
- [ ] Warm `var(--color-bg)` background
- [ ] Logo with accent on "flow", ThemeToggle, "+ New project" button in topbar
- [ ] Empty state: hex icon, heading, CTA button
- [ ] "+ New project" → modal opens, name input autofocused
- [ ] Create button disabled until name has content
- [ ] Escape closes modal
- [ ] Enter submits
- [ ] Submit: creates in IDB, navigates to editor
- [ ] Return to `/`: project card visible with accent bar, name, timestamp
- [ ] `⋮` → Open, Delete
- [ ] Delete: confirms with project name, removes from list and IDB
- [ ] Click card (not `⋮`) navigates to editor

### 4. Editor (`/project/:projectId`)
- [ ] Invalid ID → redirect to `/`
- [ ] Header: back, breadcrumb, tabs, ThemeToggle, Export
- [ ] Click project name → editable input
- [ ] Enter / blur saves, Escape reverts
- [ ] Rename persists (visible on return to `/`)
- [ ] Back → `/`
- [ ] Canvas tab default: `⬡` empty state, heading, sub, kbd hints
- [ ] Code tab: placeholder message
- [ ] Preview tab: placeholder message
- [ ] Left sidebar: 8 node items, all dimmed
- [ ] Left sidebar resize: min 160px, max 360px
- [ ] Right sidebar: centred placeholder text
- [ ] Right sidebar resize: min 200px, max 480px
- [ ] Export → alert()

### 5. Theme toggle
- [ ] Works from both pages
- [ ] 🌙 in light mode → switches to dark
- [ ] ☀️ in dark mode → switches to light
- [ ] Colours update across entire app immediately

### 6. IDB
DevTools → Application → IndexedDB → archflow → projects
- [ ] Created projects appear as rows
- [ ] Deleted projects removed from projects, nodes, edges tables

---

## What is NOT in this step

- No React Flow
- No canvas drawing, dot grid, pan, zoom
- No node components
- No Zustand stores wired up
- No TanStack Query
- All palette items `ready: false` — clicking logs to console only
- Right sidebar: placeholder only, no inspector panels
- Layers: empty text only
- Export: `alert()` only
