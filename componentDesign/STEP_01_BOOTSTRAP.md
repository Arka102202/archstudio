# Step 1 — Project Bootstrap

> Instructions for Claude Code.
> Read every word. Execute exactly as written.
> Do not add anything not listed here.
> Do not skip anything listed here.

---

## What you are building

A Vite + React + TypeScript project called **archflow**.
This is the scaffold only — no components, no pages, no logic.
Just the tooling, dependencies, config, and empty folder structure.

---

## Exact commands to run

Run these in order. Wait for each to finish before running the next.

```bash
npm create vite@latest archflow -- --template react-ts
cd archflow
```

---

## Dependencies to install

Run this single command for all production dependencies:

```bash
npm install \
  react-router-dom \
  @xyflow/react \
  zustand \
  @tanstack/react-query \
  react-hook-form \
  dexie \
  dexie-react-hooks \
  vite-plugin-pwa \
  workbox-window
```

Run this for dev dependencies:

```bash
npm install -D \
  tailwindcss \
  @tailwindcss/vite \
  eslint \
  eslint-plugin-react-hooks \
  eslint-plugin-react-refresh \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser
```

---

## Files to create or overwrite (exact content)

### `vite.config.ts`

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@components': resolve(__dirname, 'src/components'),
      '@pages':      resolve(__dirname, 'src/pages'),
      '@routes':     resolve(__dirname, 'src/routes'),
      '@entity':     resolve(__dirname, 'src/entity'),
      '@service':    resolve(__dirname, 'src/service'),
      '@hooks':      resolve(__dirname, 'src/hooks'),
      '@utils':      resolve(__dirname, 'src/utils'),
      '@db':         resolve(__dirname, 'src/db'),
      '@store':      resolve(__dirname, 'src/store'),
      '@sw':         resolve(__dirname, 'src/sw'),
      '@constants':  resolve(__dirname, 'src/constants'),
    },
  },
})
```

### `tsconfig.json`

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

### `tsconfig.app.json`

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "baseUrl": ".",
    "paths": {
      "@components/*": ["src/components/*"],
      "@pages/*":      ["src/pages/*"],
      "@routes/*":     ["src/routes/*"],
      "@entity/*":     ["src/entity/*"],
      "@service/*":    ["src/service/*"],
      "@hooks/*":      ["src/hooks/*"],
      "@utils/*":      ["src/utils/*"],
      "@db/*":         ["src/db/*"],
      "@store/*":      ["src/store/*"],
      "@sw/*":         ["src/sw/*"],
      "@constants/*":  ["src/constants/*"]
    }
  },
  "include": ["src"]
}
```

### `tsconfig.node.json`

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["vite.config.ts"]
}
```

### `src/index.css`

```css
@import "tailwindcss";

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #root {
  height: 100%;
  width: 100%;
}

body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

### `src/App.tsx`

```tsx
export default function App() {
  return (
    <div>archflow</div>
  )
}
```

### `src/main.tsx`

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

### `eslint.config.js`

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'warn',
    },
  },
)
```

---

## Folder structure to create

Create every folder listed below.
Inside each folder create one file: `index.ts` with the content `export {}`

```
src/
├── components/
├── constants/
├── pages/
├── routes/
├── entity/
├── service/
├── hooks/
├── utils/
├── db/
├── store/
└── sw/
```

Do this with a single shell command:

```bash
mkdir -p src/components src/constants src/pages src/routes src/entity \
         src/service src/hooks src/utils src/db src/store src/sw && \
for dir in src/components src/constants src/pages src/routes src/entity \
           src/service src/hooks src/utils src/db src/store src/sw; do
  echo "export {}" > "$dir/index.ts"
done
```

---

## What goes in `src/constants/`

This folder holds every commonly used constant in the app.
Nothing is hardcoded as a string anywhere else — it comes from here.

**Rule:** If a string, number, or value is used in more than one place,
or could ever be used in more than one place, it lives in `constants/`.

Examples of what will live here (created in later steps, not now):

```
src/constants/
├── queryKeys.ts     — TanStack Query key constants
├── routes.ts        — route path strings
├── messages.ts      — user-facing strings: errors, toasts, confirmations
├── canvas.ts        — canvas defaults: zoom limits, grid size, node min sizes
├── nodeDefaults.ts  — default values for each node type
└── index.ts         — barrel export
```

For this step, `index.ts` contains only `export {}`.
The actual files are created in their respective build steps.

---

## Files to delete

Delete these files that Vite generates but are not needed:

```bash
rm -f src/App.css
rm -f src/assets/react.svg
rm -f public/vite.svg
```

---

## Verification

Run these checks after everything above is done.

### 1. Dev server starts

```bash
npm run dev
```

Expected: server starts, no errors in terminal, browser shows page with text "archflow".
Stop the server after confirming.

### 2. TypeScript compiles

```bash
npx tsc --noEmit
```

Expected output: no output (zero errors).
If there are errors: fix them before moving on.

### 3. Folder structure is correct

```bash
find src -name "index.ts" | sort
```

Expected output (exactly these 11 lines, order may vary):
```
src/components/index.ts
src/constants/index.ts
src/db/index.ts
src/entity/index.ts
src/hooks/index.ts
src/pages/index.ts
src/routes/index.ts
src/service/index.ts
src/store/index.ts
src/sw/index.ts
src/utils/index.ts
```

### 4. Path aliases resolve

Create a temp file `src/alias-check.ts` with this content:

```ts
import {} from '@entity'
import {} from '@store'
import {} from '@utils'
import {} from '@constants'
```

Run:
```bash
npx tsc --noEmit
```

Expected: zero errors.
Then delete the file:
```bash
rm src/alias-check.ts
```

---

## Done when

All four checks above pass with zero errors.
Do not proceed to Step 2 until all four pass.

---

## What is NOT done in this step

- No components
- No pages
- No routing
- No entity types
- No Dexie schema
- No Zustand stores
- No service worker logic
- No TanStack Query setup
- No fonts or design tokens
- No actual files inside `src/constants/` beyond `index.ts`
- Nothing in `src/App.tsx` beyond the placeholder div
