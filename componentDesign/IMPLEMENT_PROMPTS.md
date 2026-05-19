# Implement Generation & Diff Prompts

> Claude Code: read this in full before writing a single line.
> This document tells you exactly what to change and where.
> The three spec files are in /Users/buii/claude_code/archFlow/componentDesign/

---

## Context

Three files have been placed in `/Users/buii/claude_code/archFlow/componentDesign/`:

1. `SPRING_BOOT_DIRECTORY.md` — the directory structure spec
2. `GENERATION_SYSTEM_PROMPT.md` — the full generation system prompt
3. `DIFF_SYSTEM_PROMPT.md` — the diff generation system prompt

Read all three files completely before making any changes.

---

## Step 1 — Create the prompts source file

Create `src/prompts/springBootDirectory.md`.

Copy the **exact content** from:
`/Users/buii/claude_code/archFlow/componentDesign/SPRING_BOOT_DIRECTORY.md`

into `src/prompts/springBootDirectory.md`.

Do not modify the content.

---

## Step 2 — Add TypeScript declaration for .md imports

Vite supports `?raw` imports natively but TypeScript needs a declaration.

Create `src/vite-env.d.ts` if it does not exist, or add to it if it does:

```typescript
/// <reference types="vite/client" />

declare module '*.md?raw' {
  const content: string
  export default content
}
```

---

## Step 3 — Update `generateCode.ts`

File location: `src/utils/generateCode.ts`

### 3a — Add the import at the top of the file

```typescript
import DIRECTORY_SPEC from '@/prompts/springBootDirectory.md?raw'
```

### 3b — Replace SYSTEM_PROMPT

Read the system prompt text from:
`/Users/buii/claude_code/archFlow/componentDesign/GENERATION_SYSTEM_PROMPT.md`

It contains a section marked `## System Prompt` with the prompt inside triple
backtick fences. Copy the text inside those fences (not the fences themselves)
and replace the existing `SYSTEM_PROMPT` constant:

```typescript
const SYSTEM_PROMPT = `You are an expert software developer.
... (full text from GENERATION_SYSTEM_PROMPT.md System Prompt section) ...`
```

### 3c — Replace the user message construction

Find where `userMessage` is built inside `generateCode()` and replace it with:

```typescript
const userMessage =
`ARCHITECTURE:
${JSON.stringify(params.architecture, null, 2)}

DIRECTORY STRUCTURE:
${DIRECTORY_SPEC}

Generate the complete application following both documents above.`
```

### 3d — Remove max_tokens if still present

If `max_tokens` exists anywhere in the fetch body inside `generateCode.ts`,
remove it entirely.

---

## Step 4 — Update `regenerateWithDiff.ts`

File location: `src/utils/regenerateWithDiff.ts`

### 4a — Add the import at the top of the file

```typescript
import DIRECTORY_SPEC from '@/prompts/springBootDirectory.md?raw'
```

### 4b — Replace DIFF_SYSTEM_PROMPT

Read the diff system prompt text from:
`/Users/buii/claude_code/archFlow/componentDesign/DIFF_SYSTEM_PROMPT.md`

It contains a section marked `## System Prompt` with the prompt inside triple
backtick fences. Copy the text inside those fences and replace the existing
`DIFF_SYSTEM_PROMPT` constant:

```typescript
const DIFF_SYSTEM_PROMPT = `You are an expert software developer maintaining an existing codebase.
... (full text from DIFF_SYSTEM_PROMPT.md System Prompt section) ...`
```

### 4c — Replace the user message construction

Find where the user message is built inside `regenerateWithDiff()` and replace
it with:

```typescript
const userMessage =
`ARCHITECTURE CHANGES (diff):
${JSON.stringify(diff, null, 2)}

AFFECTED EXISTING FILES:
${Object.entries(affectedFiles)
  .map(([path, content]) =>
    `<existing-file path="${path}">\n${content}\n</existing-file>`)
  .join('\n\n')}

FULL CURRENT ARCHITECTURE:
${JSON.stringify(params.currentArchitecture, null, 2)}

DIRECTORY STRUCTURE:
${DIRECTORY_SPEC}

Update only the files affected by the changes. Skip unchanged files.`
```

### 4d — Remove max_tokens if still present

If `max_tokens` exists anywhere in the fetch body inside `regenerateWithDiff.ts`,
remove it entirely.

---

## Step 5 — Verify TypeScript compiles

```bash
npx tsc --noEmit
```

Zero errors expected. The only likely error is the `*.md?raw` import — fixed
by Step 2. If any other errors appear, fix them before continuing.

---

## Step 6 — Smoke test

Run the dev server:

```bash
npm run dev
```

1. Open the app
2. Create a simple architecture — one entity, one service, one controller
3. Click Generate on the MS node
4. Verify the generation progress modal opens
5. Verify files are being generated with the correct paths matching the
   directory structure from `SPRING_BOOT_DIRECTORY.md`
6. Check the console — no errors

---

## What NOT to change

- Do not modify `SPRING_BOOT_DIRECTORY.md` content when copying it
- Do not modify any other files beyond what is listed above
- Do not change the stream parser logic in `generateCode.ts`
- Do not change the IDB write logic
- Do not change `generateCode.ts` function signature or callbacks
