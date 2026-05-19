# Step 3 — Theme

> Instructions for Claude Code.
> Read every word. Execute exactly as written.
> Do not add anything not listed here.
> Do not skip anything listed here.

---

## Context

Steps 1 and 2 are complete. The project compiles with zero errors.

This step creates the complete design system for archflow — light theme and dark theme.
Every color, font, shadow, radius, spacing value, and node color used anywhere in the app
comes from this file. Nothing is hardcoded as a raw value in a component.

After this step, every component references tokens only. Never hex. Never raw pixel values
for the core design decisions.

---

## What you are building

```
src/index.css                  ← update: CSS custom properties for both themes
src/constants/theme.ts         ← new: TypeScript mirror of every CSS variable
src/constants/index.ts         ← update: re-export theme
```

Total: 3 files touched. Do not create any other files.

---

## Fonts

Both fonts are loaded from Google Fonts via a `<link>` tag in `index.html`.

Open `index.html` and add this inside `<head>`, after the `<meta charset>` line:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
  rel="stylesheet"
/>
```

Do not change anything else in `index.html`.

---

## File 1 — `src/index.css`

Replace the entire file with the content below.
Do not truncate. Do not skip any variable. Write every line exactly.

```css
@import "tailwindcss";

/* ═══════════════════════════════════════════════════════════════════
   FONTS
═══════════════════════════════════════════════════════════════════ */
@layer base {
  html {
    font-family: 'Geist', system-ui, sans-serif;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   RESET
═══════════════════════════════════════════════════════════════════ */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body,
#root {
  height: 100%;
  width: 100%;
}

body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ═══════════════════════════════════════════════════════════════════
   LIGHT THEME  (default)
   Applied when: no data-theme attribute, or data-theme="light"
═══════════════════════════════════════════════════════════════════ */
:root,
[data-theme='light'] {

  /* ── Page backgrounds ─────────────────────────────────────────── */
  --color-bg:           #f0f0ed;   /* page / canvas background       */
  --color-surface:      #ffffff;   /* cards, panels, modals          */
  --color-surface-alt:  #f7f7f5;   /* inputs, code blocks, hover bg  */
  --color-surface-raised: #ffffff; /* elevated surfaces (dropdowns)  */

  /* ── Borders ──────────────────────────────────────────────────── */
  --color-border:       rgba(0, 0, 0, 0.08);   /* default dividers       */
  --color-border-strong: rgba(0, 0, 0, 0.14);  /* hover, focused borders */
  --color-border-focus: #3860f5;               /* keyboard focus ring    */

  /* ── Text ─────────────────────────────────────────────────────── */
  --color-text:         #141416;   /* primary readable text          */
  --color-text-2:       #555560;   /* secondary labels, descriptions */
  --color-text-3:       #8888a0;   /* muted, timestamps, hints       */
  --color-text-4:       #b8b8cc;   /* placeholder, disabled          */

  /* ── Accent (interactive blue) ────────────────────────────────── */
  --color-accent:       #3860f5;
  --color-accent-hover: #2b52e8;
  --color-accent-light: rgba(56, 96, 245, 0.06);
  --color-accent-mid:   rgba(56, 96, 245, 0.12);
  --color-accent-text:  #ffffff;   /* text on accent background      */

  /* ── Semantic: danger ─────────────────────────────────────────── */
  --color-danger:       #dc2626;
  --color-danger-light: rgba(220, 38, 38, 0.08);
  --color-danger-border: rgba(220, 38, 38, 0.28);

  /* ── Semantic: success ────────────────────────────────────────── */
  --color-success:       #0a9e6e;
  --color-success-light: rgba(10, 158, 110, 0.08);

  /* ── Semantic: warning ────────────────────────────────────────── */
  --color-warning:       #b07800;
  --color-warning-light: rgba(176, 120, 0, 0.08);

  /* ── Canvas-specific ──────────────────────────────────────────── */
  --color-canvas-bg:     #f0f0ed;
  --color-canvas-dot:    rgba(0, 0, 0, 0.07);   /* grid dot color         */
  --color-canvas-node-border: rgba(0, 0, 0, 0.10);
  --color-canvas-node-border-hover: rgba(0, 0, 0, 0.18);
  --color-canvas-drop-hint-border: rgba(0, 0, 0, 0.12);
  --color-canvas-drop-hint-icon-bg: #f0f0ec;

  /* ── Node type colors ─────────────────────────────────────────── */
  /* Each node type has: accent, icon background, icon text color    */

  /* Entity — blue */
  --node-entity-accent:   #3860f5;
  --node-entity-icon-bg:  #dbeafe;
  --node-entity-icon-fg:  #1e40af;

  /* DTO — cyan */
  --node-dto-accent:      #0891b2;
  --node-dto-icon-bg:     #cffafe;
  --node-dto-icon-fg:     #164e63;

  /* Database — purple */
  --node-db-accent:       #6d28d9;
  --node-db-icon-bg:      #ede9fe;
  --node-db-icon-fg:      #5b21b6;

  /* Auth Guard — amber */
  --node-auth-accent:     #b45309;
  --node-auth-icon-bg:    #fef3c7;
  --node-auth-icon-fg:    #92400e;

  /* Controller — orange */
  --node-ctrl-accent:     #c2410c;
  --node-ctrl-icon-bg:    #ffedd5;
  --node-ctrl-icon-fg:    #9a3412;

  /* Service — green */
  --node-svc-accent:      #166534;
  --node-svc-icon-bg:     #dcfce7;
  --node-svc-icon-fg:     #166534;

  /* API Endpoint — violet */
  --node-ep-accent:       #7c3aed;
  --node-ep-icon-bg:      #fae8ff;
  --node-ep-icon-fg:      #6b21a8;

  /* ── Microservice node palette (5 colors, round-robin) ─────────── */
  /* index 0 — blue */
  --ms-0-border:       #3860f5;
  --ms-0-icon-bg:      #dde6ff;
  --ms-0-icon-fg:      #3730a3;
  --ms-0-badge-bg:     #eff3ff;
  --ms-0-badge-border: #c7d2fe;
  --ms-0-badge-text:   #3730a3;

  /* index 1 — green */
  --ms-1-border:       #0a9e6e;
  --ms-1-icon-bg:      #d1fae5;
  --ms-1-icon-fg:      #065f46;
  --ms-1-badge-bg:     #ecfdf5;
  --ms-1-badge-border: #a7f3d0;
  --ms-1-badge-text:   #065f46;

  /* index 2 — purple */
  --ms-2-border:       #c030e8;
  --ms-2-icon-bg:      #f3e8ff;
  --ms-2-icon-fg:      #7e22ce;
  --ms-2-badge-bg:     #fdf4ff;
  --ms-2-badge-border: #e9d5ff;
  --ms-2-badge-text:   #6b21a8;

  /* index 3 — orange */
  --ms-3-border:       #d4580a;
  --ms-3-icon-bg:      #fed7aa;
  --ms-3-icon-fg:      #9a3412;
  --ms-3-badge-bg:     #fff7ed;
  --ms-3-badge-border: #fdba74;
  --ms-3-badge-text:   #9a3412;

  /* index 4 — teal */
  --ms-4-border:       #0891b2;
  --ms-4-icon-bg:      #bae6fd;
  --ms-4-icon-fg:      #075985;
  --ms-4-badge-bg:     #f0f9ff;
  --ms-4-badge-border: #7dd3fc;
  --ms-4-badge-text:   #075985;

  /* ── Dependency chip colors ───────────────────────────────────── */
  --dep-web-bg:         #eff6ff;
  --dep-web-text:       #1d4ed8;
  --dep-web-border:     #bfdbfe;

  --dep-jpa-bg:         #f0fdf4;
  --dep-jpa-text:       #166534;
  --dep-jpa-border:     #bbf7d0;

  --dep-security-bg:    #fffbeb;
  --dep-security-text:  #92400e;
  --dep-security-border:#fde68a;

  --dep-postgres-bg:    #f0f9ff;
  --dep-postgres-text:  #075985;
  --dep-postgres-border:#bae6fd;

  --dep-lombok-bg:      #fdf4ff;
  --dep-lombok-text:    #7e22ce;
  --dep-lombok-border:  #e9d5ff;

  --dep-validation-bg:  #fff7ed;
  --dep-validation-text:#9a3412;
  --dep-validation-border:#fed7aa;

  --dep-default-bg:     #f7f7f5;
  --dep-default-text:   #555560;
  --dep-default-border: rgba(0, 0, 0, 0.10);

  /* ── AI Prompt box ────────────────────────────────────────────── */
  --ai-box-bg-from:  #f8f8ff;
  --ai-box-bg-to:    #f0f4ff;
  --ai-box-border:   #d4dcff;
  --ai-dot-color:    #3860f5;

  /* ── Inspector info dot colors ────────────────────────────────── */
  --dot-java:    #0a9e6e;
  --dot-build:   #3860f5;
  --dot-docker-on:  #0891b2;
  --dot-docker-off: #d1d5db;

  /* ── Shadows ──────────────────────────────────────────────────── */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.10), 0 1px 4px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
  --shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.14), 0 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-node: 0 4px 24px rgba(0, 0, 0, 0.10), 0 1px 4px rgba(0, 0, 0, 0.06);
  --shadow-dropdown: 0 4px 20px rgba(0, 0, 0, 0.12), 0 1px 6px rgba(0, 0, 0, 0.06);
  --shadow-modal: 0 8px 48px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08);

  /* ── Border radius ────────────────────────────────────────────── */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --radius-full: 9999px;

  /* ── Typography ───────────────────────────────────────────────── */
  --font-ui:   'Geist', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* ── Spacing (base 4px grid) ──────────────────────────────────── */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  /* ── Layout ───────────────────────────────────────────────────── */
  --topbar-height:       52px;
  --editor-header-height: 48px;
  --left-panel-width:    192px;
  --right-panel-width:   272px;

  /* ── Toggle component ─────────────────────────────────────────── */
  --toggle-on-bg:   #3860f5;
  --toggle-off-bg:  #e2e2e6;
  --toggle-off-border: rgba(0, 0, 0, 0.10);
  --toggle-knob:    #ffffff;

  /* ── Scrollbar ────────────────────────────────────────────────── */
  --scrollbar-track: transparent;
  --scrollbar-thumb: rgba(0, 0, 0, 0.14);
}

/* ═══════════════════════════════════════════════════════════════════
   DARK THEME
   Applied when: data-theme="dark" OR prefers-color-scheme: dark
   (prefers-color-scheme only activates when no data-theme attribute
    is explicitly set on <html>)
═══════════════════════════════════════════════════════════════════ */
[data-theme='dark'],
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {

  /* ── Page backgrounds ─────────────────────────────────────────── */
  --color-bg:           #0c0c0e;
  --color-surface:      #111114;
  --color-surface-alt:  #18181d;
  --color-surface-raised: #1e1e24;

  /* ── Borders ──────────────────────────────────────────────────── */
  --color-border:       rgba(255, 255, 255, 0.08);
  --color-border-strong: rgba(255, 255, 255, 0.14);
  --color-border-focus: #5b7fff;

  /* ── Text ─────────────────────────────────────────────────────── */
  --color-text:         #f0f0f4;
  --color-text-2:       #9090a8;
  --color-text-3:       #55556a;
  --color-text-4:       #33333f;

  /* ── Accent ───────────────────────────────────────────────────── */
  --color-accent:       #5b7fff;
  --color-accent-hover: #4b6ff5;
  --color-accent-light: rgba(91, 127, 255, 0.10);
  --color-accent-mid:   rgba(91, 127, 255, 0.18);
  --color-accent-text:  #ffffff;

  /* ── Semantic: danger ─────────────────────────────────────────── */
  --color-danger:       #ff5252;
  --color-danger-light: rgba(255, 82, 82, 0.12);
  --color-danger-border: rgba(255, 82, 82, 0.30);

  /* ── Semantic: success ────────────────────────────────────────── */
  --color-success:       #3dd68c;
  --color-success-light: rgba(61, 214, 140, 0.10);

  /* ── Semantic: warning ────────────────────────────────────────── */
  --color-warning:       #ffc947;
  --color-warning-light: rgba(255, 201, 71, 0.10);

  /* ── Canvas-specific ──────────────────────────────────────────── */
  --color-canvas-bg:     #0c0c0e;
  --color-canvas-dot:    rgba(255, 255, 255, 0.06);
  --color-canvas-node-border: rgba(255, 255, 255, 0.10);
  --color-canvas-node-border-hover: rgba(255, 255, 255, 0.18);
  --color-canvas-drop-hint-border: rgba(255, 255, 255, 0.10);
  --color-canvas-drop-hint-icon-bg: #18181d;

  /* ── Node type colors ─────────────────────────────────────────── */

  /* Entity — blue */
  --node-entity-accent:   #4b9eff;
  --node-entity-icon-bg:  rgba(75, 158, 255, 0.15);
  --node-entity-icon-fg:  #4b9eff;

  /* DTO — teal */
  --node-dto-accent:      #2dd4bf;
  --node-dto-icon-bg:     rgba(45, 212, 191, 0.15);
  --node-dto-icon-fg:     #2dd4bf;

  /* Database — purple */
  --node-db-accent:       #a09cf7;
  --node-db-icon-bg:      rgba(160, 156, 247, 0.15);
  --node-db-icon-fg:      #a09cf7;

  /* Auth Guard — yellow */
  --node-auth-accent:     #ffd166;
  --node-auth-icon-bg:    rgba(255, 209, 102, 0.15);
  --node-auth-icon-fg:    #ffd166;

  /* Controller — orange */
  --node-ctrl-accent:     #ff8547;
  --node-ctrl-icon-bg:    rgba(255, 133, 71, 0.15);
  --node-ctrl-icon-fg:    #ff8547;

  /* Service — green */
  --node-svc-accent:      #3dd68c;
  --node-svc-icon-bg:     rgba(61, 214, 140, 0.15);
  --node-svc-icon-fg:     #3dd68c;

  /* API Endpoint — pink */
  --node-ep-accent:       #e05cff;
  --node-ep-icon-bg:      rgba(224, 92, 255, 0.15);
  --node-ep-icon-fg:      #e05cff;

  /* ── Microservice node palette ────────────────────────────────── */
  /* index 0 — blue */
  --ms-0-border:       #5b7fff;
  --ms-0-icon-bg:      rgba(91, 127, 255, 0.18);
  --ms-0-icon-fg:      #5b7fff;
  --ms-0-badge-bg:     rgba(91, 127, 255, 0.12);
  --ms-0-badge-border: rgba(91, 127, 255, 0.30);
  --ms-0-badge-text:   #8aaaff;

  /* index 1 — green */
  --ms-1-border:       #3dd68c;
  --ms-1-icon-bg:      rgba(61, 214, 140, 0.18);
  --ms-1-icon-fg:      #3dd68c;
  --ms-1-badge-bg:     rgba(61, 214, 140, 0.12);
  --ms-1-badge-border: rgba(61, 214, 140, 0.30);
  --ms-1-badge-text:   #6ee7b7;

  /* index 2 — purple */
  --ms-2-border:       #c084fc;
  --ms-2-icon-bg:      rgba(192, 132, 252, 0.18);
  --ms-2-icon-fg:      #c084fc;
  --ms-2-badge-bg:     rgba(192, 132, 252, 0.12);
  --ms-2-badge-border: rgba(192, 132, 252, 0.30);
  --ms-2-badge-text:   #d8b4fe;

  /* index 3 — orange */
  --ms-3-border:       #ff8547;
  --ms-3-icon-bg:      rgba(255, 133, 71, 0.18);
  --ms-3-icon-fg:      #ff8547;
  --ms-3-badge-bg:     rgba(255, 133, 71, 0.12);
  --ms-3-badge-border: rgba(255, 133, 71, 0.30);
  --ms-3-badge-text:   #fdba74;

  /* index 4 — teal */
  --ms-4-border:       #2dd4bf;
  --ms-4-icon-bg:      rgba(45, 212, 191, 0.18);
  --ms-4-icon-fg:      #2dd4bf;
  --ms-4-badge-bg:     rgba(45, 212, 191, 0.12);
  --ms-4-badge-border: rgba(45, 212, 191, 0.30);
  --ms-4-badge-text:   #5eead4;

  /* ── Dependency chip colors ───────────────────────────────────── */
  --dep-web-bg:         rgba(59, 130, 246, 0.12);
  --dep-web-text:       #93c5fd;
  --dep-web-border:     rgba(59, 130, 246, 0.25);

  --dep-jpa-bg:         rgba(34, 197, 94, 0.12);
  --dep-jpa-text:       #86efac;
  --dep-jpa-border:     rgba(34, 197, 94, 0.25);

  --dep-security-bg:    rgba(245, 158, 11, 0.12);
  --dep-security-text:  #fcd34d;
  --dep-security-border:rgba(245, 158, 11, 0.25);

  --dep-postgres-bg:    rgba(14, 165, 233, 0.12);
  --dep-postgres-text:  #7dd3fc;
  --dep-postgres-border:rgba(14, 165, 233, 0.25);

  --dep-lombok-bg:      rgba(168, 85, 247, 0.12);
  --dep-lombok-text:    #d8b4fe;
  --dep-lombok-border:  rgba(168, 85, 247, 0.25);

  --dep-validation-bg:  rgba(249, 115, 22, 0.12);
  --dep-validation-text:#fdba74;
  --dep-validation-border:rgba(249, 115, 22, 0.25);

  --dep-default-bg:     rgba(255, 255, 255, 0.06);
  --dep-default-text:   #9090a8;
  --dep-default-border: rgba(255, 255, 255, 0.10);

  /* ── AI Prompt box ────────────────────────────────────────────── */
  --ai-box-bg-from:  #13132a;
  --ai-box-bg-to:    #0f1428;
  --ai-box-border:   rgba(91, 127, 255, 0.25);
  --ai-dot-color:    #5b7fff;

  /* ── Inspector info dot colors ────────────────────────────────── */
  --dot-java:    #3dd68c;
  --dot-build:   #5b7fff;
  --dot-docker-on:  #2dd4bf;
  --dot-docker-off: #33333f;

  /* ── Shadows ──────────────────────────────────────────────────── */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.30), 0 1px 2px rgba(0, 0, 0, 0.20);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.40), 0 1px 4px rgba(0, 0, 0, 0.30);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.50), 0 2px 8px rgba(0, 0, 0, 0.30);
  --shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.60), 0 4px 12px rgba(0, 0, 0, 0.40);
  --shadow-node: 0 4px 32px rgba(0, 0, 0, 0.50), 0 1px 4px rgba(0, 0, 0, 0.40);
  --shadow-dropdown: 0 8px 32px rgba(0, 0, 0, 0.60), 0 2px 8px rgba(0, 0, 0, 0.40);
  --shadow-modal: 0 16px 64px rgba(0, 0, 0, 0.70), 0 4px 16px rgba(0, 0, 0, 0.50);

  /* ── Toggle component ─────────────────────────────────────────── */
  --toggle-on-bg:   #5b7fff;
  --toggle-off-bg:  #26262f;
  --toggle-off-border: rgba(255, 255, 255, 0.10);
  --toggle-knob:    #ffffff;

  /* ── Scrollbar ────────────────────────────────────────────────── */
  --scrollbar-track: transparent;
  --scrollbar-thumb: rgba(255, 255, 255, 0.12);

  }
}

/* ═══════════════════════════════════════════════════════════════════
   GLOBAL UTILITY STYLES
   These use the CSS variables defined above and apply app-wide.
═══════════════════════════════════════════════════════════════════ */

/* Scrollbar styling */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
}
*::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}
*::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
}
*::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 2px;
}

/* Focus visible — keyboard only */
:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}

/* Remove default focus for mouse users */
:focus:not(:focus-visible) {
  outline: none;
}

/* Body background and text */
body {
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-ui);
}

/* Mono utility class */
.font-mono {
  font-family: var(--font-mono);
}
```

---

## File 2 — `src/constants/theme.ts`

This is the TypeScript mirror of every CSS variable.
Use these in any place where you need the value as a JavaScript string
(e.g. React Flow inline styles, canvas drawing, dynamic color calculations).

For normal component styling, use the CSS variables directly via Tailwind's
`[var(--...)]` syntax or plain CSS. Only import from this file when you
genuinely need a JS string.

```ts
// src/constants/theme.ts
// TypeScript mirror of src/index.css custom properties.
// Keep in sync manually whenever index.css is updated.
//
// Usage:
//   import { THEME } from '@constants/theme'
//   style={{ borderColor: THEME.light.accent }}
//   style={{ borderColor: THEME.dark.accent }}
//
// Or use the helper to get the current theme:
//   const t = useTheme()   ← returns the right set based on data-theme

// ─── Theme shape ─────────────────────────────────────────────────

export interface ThemeColors {
  // Backgrounds
  bg:            string
  surface:       string
  surfaceAlt:    string
  surfaceRaised: string

  // Borders
  border:        string
  borderStrong:  string
  borderFocus:   string

  // Text
  text:          string
  text2:         string
  text3:         string
  text4:         string

  // Accent
  accent:        string
  accentHover:   string
  accentLight:   string
  accentMid:     string
  accentText:    string

  // Semantic
  danger:        string
  dangerLight:   string
  success:       string
  warning:       string

  // Canvas
  canvasBg:      string
  canvasDot:     string
  canvasNodeBorder: string
  canvasDropHintBorder: string

  // Node types
  nodeEntity:    NodeTypeColors
  nodeDto:       NodeTypeColors
  nodeDb:        NodeTypeColors
  nodeAuth:      NodeTypeColors
  nodeCtrl:      NodeTypeColors
  nodeSvc:       NodeTypeColors
  nodeEp:        NodeTypeColors

  // Microservice palette (5 entries)
  msPalette:     MsPaletteEntry[]

  // Dep chips
  depWeb:        ChipColors
  depJpa:        ChipColors
  depSecurity:   ChipColors
  depPostgres:   ChipColors
  depLombok:     ChipColors
  depValidation: ChipColors
  depDefault:    ChipColors

  // AI box
  aiBoxBgFrom:   string
  aiBoxBgTo:     string
  aiBoxBorder:   string
  aiDotColor:    string

  // Info dots
  dotJava:       string
  dotBuild:      string
  dotDockerOn:   string
  dotDockerOff:  string

  // Shadows
  shadowSm:      string
  shadowMd:      string
  shadowLg:      string
  shadowNode:    string
  shadowDropdown:string
  shadowModal:   string
}

export interface NodeTypeColors {
  accent:  string
  iconBg:  string
  iconFg:  string
}

export interface MsPaletteEntry {
  border:      string
  iconBg:      string
  iconFg:      string
  badgeBg:     string
  badgeBorder: string
  badgeText:   string
}

export interface ChipColors {
  bg:     string
  text:   string
  border: string
}

// ─── Light theme ─────────────────────────────────────────────────

const light: ThemeColors = {
  bg:            '#f0f0ed',
  surface:       '#ffffff',
  surfaceAlt:    '#f7f7f5',
  surfaceRaised: '#ffffff',

  border:        'rgba(0,0,0,0.08)',
  borderStrong:  'rgba(0,0,0,0.14)',
  borderFocus:   '#3860f5',

  text:          '#141416',
  text2:         '#555560',
  text3:         '#8888a0',
  text4:         '#b8b8cc',

  accent:        '#3860f5',
  accentHover:   '#2b52e8',
  accentLight:   'rgba(56,96,245,0.06)',
  accentMid:     'rgba(56,96,245,0.12)',
  accentText:    '#ffffff',

  danger:        '#dc2626',
  dangerLight:   'rgba(220,38,38,0.08)',
  success:       '#0a9e6e',
  warning:       '#b07800',

  canvasBg:      '#f0f0ed',
  canvasDot:     'rgba(0,0,0,0.07)',
  canvasNodeBorder: 'rgba(0,0,0,0.10)',
  canvasDropHintBorder: 'rgba(0,0,0,0.12)',

  nodeEntity: { accent: '#3860f5', iconBg: '#dbeafe', iconFg: '#1e40af' },
  nodeDto:    { accent: '#0891b2', iconBg: '#cffafe', iconFg: '#164e63' },
  nodeDb:     { accent: '#6d28d9', iconBg: '#ede9fe', iconFg: '#5b21b6' },
  nodeAuth:   { accent: '#b45309', iconBg: '#fef3c7', iconFg: '#92400e' },
  nodeCtrl:   { accent: '#c2410c', iconBg: '#ffedd5', iconFg: '#9a3412' },
  nodeSvc:    { accent: '#166534', iconBg: '#dcfce7', iconFg: '#166534' },
  nodeEp:     { accent: '#7c3aed', iconBg: '#fae8ff', iconFg: '#6b21a8' },

  msPalette: [
    { border:'#3860f5', iconBg:'#dde6ff', iconFg:'#3730a3', badgeBg:'#eff3ff', badgeBorder:'#c7d2fe', badgeText:'#3730a3' },
    { border:'#0a9e6e', iconBg:'#d1fae5', iconFg:'#065f46', badgeBg:'#ecfdf5', badgeBorder:'#a7f3d0', badgeText:'#065f46' },
    { border:'#c030e8', iconBg:'#f3e8ff', iconFg:'#7e22ce', badgeBg:'#fdf4ff', badgeBorder:'#e9d5ff', badgeText:'#6b21a8' },
    { border:'#d4580a', iconBg:'#fed7aa', iconFg:'#9a3412', badgeBg:'#fff7ed', badgeBorder:'#fdba74', badgeText:'#9a3412' },
    { border:'#0891b2', iconBg:'#bae6fd', iconFg:'#075985', badgeBg:'#f0f9ff', badgeBorder:'#7dd3fc', badgeText:'#075985' },
  ],

  depWeb:        { bg:'#eff6ff',  text:'#1d4ed8', border:'#bfdbfe' },
  depJpa:        { bg:'#f0fdf4',  text:'#166534', border:'#bbf7d0' },
  depSecurity:   { bg:'#fffbeb',  text:'#92400e', border:'#fde68a' },
  depPostgres:   { bg:'#f0f9ff',  text:'#075985', border:'#bae6fd' },
  depLombok:     { bg:'#fdf4ff',  text:'#7e22ce', border:'#e9d5ff' },
  depValidation: { bg:'#fff7ed',  text:'#9a3412', border:'#fed7aa' },
  depDefault:    { bg:'#f7f7f5',  text:'#555560', border:'rgba(0,0,0,0.10)' },

  aiBoxBgFrom:   '#f8f8ff',
  aiBoxBgTo:     '#f0f4ff',
  aiBoxBorder:   '#d4dcff',
  aiDotColor:    '#3860f5',

  dotJava:       '#0a9e6e',
  dotBuild:      '#3860f5',
  dotDockerOn:   '#0891b2',
  dotDockerOff:  '#d1d5db',

  shadowSm:       '0 1px 3px rgba(0,0,0,0.08),0 1px 2px rgba(0,0,0,0.04)',
  shadowMd:       '0 4px 16px rgba(0,0,0,0.10),0 1px 4px rgba(0,0,0,0.06)',
  shadowLg:       '0 8px 32px rgba(0,0,0,0.12),0 2px 8px rgba(0,0,0,0.06)',
  shadowNode:     '0 4px 24px rgba(0,0,0,0.10),0 1px 4px rgba(0,0,0,0.06)',
  shadowDropdown: '0 4px 20px rgba(0,0,0,0.12),0 1px 6px rgba(0,0,0,0.06)',
  shadowModal:    '0 8px 48px rgba(0,0,0,0.18),0 2px 8px rgba(0,0,0,0.08)',
}

// ─── Dark theme ──────────────────────────────────────────────────

const dark: ThemeColors = {
  bg:            '#0c0c0e',
  surface:       '#111114',
  surfaceAlt:    '#18181d',
  surfaceRaised: '#1e1e24',

  border:        'rgba(255,255,255,0.08)',
  borderStrong:  'rgba(255,255,255,0.14)',
  borderFocus:   '#5b7fff',

  text:          '#f0f0f4',
  text2:         '#9090a8',
  text3:         '#55556a',
  text4:         '#33333f',

  accent:        '#5b7fff',
  accentHover:   '#4b6ff5',
  accentLight:   'rgba(91,127,255,0.10)',
  accentMid:     'rgba(91,127,255,0.18)',
  accentText:    '#ffffff',

  danger:        '#ff5252',
  dangerLight:   'rgba(255,82,82,0.12)',
  success:       '#3dd68c',
  warning:       '#ffc947',

  canvasBg:      '#0c0c0e',
  canvasDot:     'rgba(255,255,255,0.06)',
  canvasNodeBorder: 'rgba(255,255,255,0.10)',
  canvasDropHintBorder: 'rgba(255,255,255,0.10)',

  nodeEntity: { accent: '#4b9eff', iconBg: 'rgba(75,158,255,0.15)',   iconFg: '#4b9eff' },
  nodeDto:    { accent: '#2dd4bf', iconBg: 'rgba(45,212,191,0.15)',   iconFg: '#2dd4bf' },
  nodeDb:     { accent: '#a09cf7', iconBg: 'rgba(160,156,247,0.15)',  iconFg: '#a09cf7' },
  nodeAuth:   { accent: '#ffd166', iconBg: 'rgba(255,209,102,0.15)',  iconFg: '#ffd166' },
  nodeCtrl:   { accent: '#ff8547', iconBg: 'rgba(255,133,71,0.15)',   iconFg: '#ff8547' },
  nodeSvc:    { accent: '#3dd68c', iconBg: 'rgba(61,214,140,0.15)',   iconFg: '#3dd68c' },
  nodeEp:     { accent: '#e05cff', iconBg: 'rgba(224,92,255,0.15)',   iconFg: '#e05cff' },

  msPalette: [
    { border:'#5b7fff', iconBg:'rgba(91,127,255,0.18)',   iconFg:'#5b7fff', badgeBg:'rgba(91,127,255,0.12)',   badgeBorder:'rgba(91,127,255,0.30)',   badgeText:'#8aaaff' },
    { border:'#3dd68c', iconBg:'rgba(61,214,140,0.18)',   iconFg:'#3dd68c', badgeBg:'rgba(61,214,140,0.12)',   badgeBorder:'rgba(61,214,140,0.30)',   badgeText:'#6ee7b7' },
    { border:'#c084fc', iconBg:'rgba(192,132,252,0.18)',  iconFg:'#c084fc', badgeBg:'rgba(192,132,252,0.12)',  badgeBorder:'rgba(192,132,252,0.30)',  badgeText:'#d8b4fe' },
    { border:'#ff8547', iconBg:'rgba(255,133,71,0.18)',   iconFg:'#ff8547', badgeBg:'rgba(255,133,71,0.12)',   badgeBorder:'rgba(255,133,71,0.30)',   badgeText:'#fdba74' },
    { border:'#2dd4bf', iconBg:'rgba(45,212,191,0.18)',   iconFg:'#2dd4bf', badgeBg:'rgba(45,212,191,0.12)',   badgeBorder:'rgba(45,212,191,0.30)',   badgeText:'#5eead4' },
  ],

  depWeb:        { bg:'rgba(59,130,246,0.12)',  text:'#93c5fd', border:'rgba(59,130,246,0.25)'  },
  depJpa:        { bg:'rgba(34,197,94,0.12)',   text:'#86efac', border:'rgba(34,197,94,0.25)'   },
  depSecurity:   { bg:'rgba(245,158,11,0.12)',  text:'#fcd34d', border:'rgba(245,158,11,0.25)'  },
  depPostgres:   { bg:'rgba(14,165,233,0.12)',  text:'#7dd3fc', border:'rgba(14,165,233,0.25)'  },
  depLombok:     { bg:'rgba(168,85,247,0.12)',  text:'#d8b4fe', border:'rgba(168,85,247,0.25)'  },
  depValidation: { bg:'rgba(249,115,22,0.12)',  text:'#fdba74', border:'rgba(249,115,22,0.25)'  },
  depDefault:    { bg:'rgba(255,255,255,0.06)', text:'#9090a8', border:'rgba(255,255,255,0.10)' },

  aiBoxBgFrom:   '#13132a',
  aiBoxBgTo:     '#0f1428',
  aiBoxBorder:   'rgba(91,127,255,0.25)',
  aiDotColor:    '#5b7fff',

  dotJava:       '#3dd68c',
  dotBuild:      '#5b7fff',
  dotDockerOn:   '#2dd4bf',
  dotDockerOff:  '#33333f',

  shadowSm:       '0 1px 3px rgba(0,0,0,0.30),0 1px 2px rgba(0,0,0,0.20)',
  shadowMd:       '0 4px 16px rgba(0,0,0,0.40),0 1px 4px rgba(0,0,0,0.30)',
  shadowLg:       '0 8px 32px rgba(0,0,0,0.50),0 2px 8px rgba(0,0,0,0.30)',
  shadowNode:     '0 4px 32px rgba(0,0,0,0.50),0 1px 4px rgba(0,0,0,0.40)',
  shadowDropdown: '0 8px 32px rgba(0,0,0,0.60),0 2px 8px rgba(0,0,0,0.40)',
  shadowModal:    '0 16px 64px rgba(0,0,0,0.70),0 4px 16px rgba(0,0,0,0.50)',
}

// ─── Exported object ─────────────────────────────────────────────

export const THEME = { light, dark } as const

// ─── Radius + Spacing (theme-independent) ────────────────────────

export const RADIUS = {
  sm:   6,
  md:   10,
  lg:   14,
  xl:   20,
  full: 9999,
} as const

export const SPACE = {
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  5:  20,
  6:  24,
  8:  32,
  10: 40,
  12: 48,
} as const

export const LAYOUT = {
  topbarHeight:        52,
  editorHeaderHeight:  48,
  leftPanelWidth:      192,
  rightPanelWidth:     272,
} as const
```

---

## File 3 — `src/constants/index.ts`

Replace the existing `export {}` with:

```ts
export { THEME, RADIUS, SPACE, LAYOUT } from './theme'
export type { ThemeColors, NodeTypeColors, MsPaletteEntry, ChipColors } from './theme'
```

---

## How to apply the theme in the app

### Switching themes

Theme is controlled by `data-theme` on the `<html>` element.

```ts
// Set light theme
document.documentElement.setAttribute('data-theme', 'light')

// Set dark theme
document.documentElement.setAttribute('data-theme', 'dark')

// Follow system preference (remove the attribute)
document.documentElement.removeAttribute('data-theme')
```

A `useTheme` hook will be built in the hooks step. For now, to test, set manually in `index.html`:

```html
<html lang="en" data-theme="light">
```

or

```html
<html lang="en" data-theme="dark">
```

### Using CSS variables in components

Prefer CSS variables directly — they respond to theme switching automatically:

```tsx
// ✅ Correct — responds to theme change
<div style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}>

// ✅ Also correct — using Tailwind with CSS variable
<div className="bg-[var(--color-surface)] text-[var(--color-text)]">

// ❌ Wrong — hardcoded, breaks dark mode
<div style={{ background: '#ffffff', color: '#141416' }}>
```

### Using TypeScript values (when CSS variables won't work)

Some places need a real JavaScript string — React Flow inline node styles,
HTML canvas drawing, dynamic color opacity calculations:

```ts
import { THEME } from '@constants/theme'

// Get the current theme (light or dark)
const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
const t = isDark ? THEME.dark : THEME.light

// Use for canvas grid dot color
gctx.fillStyle = t.canvasDot

// Use for React Flow node border
const palette = t.msPalette[node.colorIdx % 5]
style={{ borderColor: palette.border }}
```

---

## Verification

### 1. TypeScript compiles

```bash
npx tsc --noEmit
```

Expected: zero errors.

### 2. Theme constants import correctly

Create a temp file `src/theme-check.ts`:

```ts
import { THEME, RADIUS, SPACE, LAYOUT } from '@constants'
import type { ThemeColors, MsPaletteEntry } from '@constants'

const _l: ThemeColors = THEME.light
const _d: ThemeColors = THEME.dark
const _p: MsPaletteEntry = THEME.light.msPalette[0]
const _r: number = RADIUS.md
const _s: number = SPACE[4]
const _w: number = LAYOUT.leftPanelWidth

// Suppress unused variable warnings
void _l; void _d; void _p; void _r; void _s; void _w
```

Run:
```bash
npx tsc --noEmit
```

Expected: zero errors. Then delete:
```bash
rm src/theme-check.ts
```

### 3. Light theme renders

Add `data-theme="light"` to `<html>` in `index.html`.
Start the dev server:
```bash
npm run dev
```
Expected: page background is `#f0f0ed`, text is `#141416`.

### 4. Dark theme renders

Change to `data-theme="dark"` in `index.html`.
Expected: page background is `#0c0c0e`, text is `#f0f0f4`.

Revert `index.html` to `data-theme="light"` after confirming both themes work.

---

## Done when

- `npx tsc --noEmit` → zero errors
- Both light and dark themes visually verified in the browser
- `THEME.light.msPalette` has 5 entries
- `THEME.dark.msPalette` has 5 entries
- `THEME.light.msPalette[0].border === '#3860f5'`
- `THEME.dark.msPalette[0].border === '#5b7fff'`

---

## What is NOT done in this step

- No `useTheme` hook — that is in the hooks step
- No theme switcher UI component
- No persistence of theme preference (localStorage) — that is in the hooks step
- No changes to `src/App.tsx`
- No Tailwind config extensions — all tokens live in CSS variables, not Tailwind's config
- No other constants files (`queryKeys.ts`, `routes.ts`, `messages.ts`, `canvas.ts`, `nodeDefaults.ts`) — those are created in their own steps
